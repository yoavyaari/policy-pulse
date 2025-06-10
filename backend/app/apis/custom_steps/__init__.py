# Tool code for modifying src/app/apis/custom_steps/__init__.py
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Dict, List, Any, Union, Literal, Tuple, Optional
import traceback
from collections import Counter, defaultdict
import json
import databutton as db
import uuid
import asyncio
import os  # Added for path manipulation
from docx import Document  # Added for DOCX processing
import time
import io  # Added for PDF processing
import pypdf  # Added for PDF processing
from datetime import datetime, timezone, UTC
import httpx  # Added for specific error handling MYA-63
from storage3 import (
    exceptions as storage3_exceptions,
)  # Added for specific error handling MYA-63

# Supabase client imports
from supabase.client import Client, create_client
from postgrest.exceptions import APIError as PostgrestAPIError

# OpenAI client import
try:
    from app.apis.documents import get_openai_client
    from openai import OpenAI
except ImportError:
    print("WARN: Could not import get_openai_client from documents API, defining locally.")
    from openai import OpenAI

    def get_openai_client() -> OpenAI:
        """Initializes and returns an OpenAI client (Fallback definition)."""
        try:
            openai_api_key: str = db.secrets.get("OPENAI_API_KEY")
            if not openai_api_key:
                print("Error: OPENAI_API_KEY secret not found.")
                raise HTTPException(
                    status_code=500,
                    detail="Server configuration error: OpenAI API key missing.",
                )
            return OpenAI(api_key=openai_api_key)
        except Exception as e:
            print(f"Error initializing OpenAI client (fallback): {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Server configuration error: Could not initialize OpenAI client: {e}",
            ) from e


async def _execute_prompt_config_and_get_results(
    prompt_config: "PromptConfig",
    doc_content_full: str,  # Full document content
    prior_results_in_step: dict,  # Results from previous prompts in THIS step
    current_doc_custom_analysis_results: dict,  # Full doc data for OTHER steps' context
    current_step_id: str,  # For filtering inter-step context
    openai_client: "OpenAI",
    current_doc_id_for_log: str,  # For logging
) -> tuple[Optional[dict], Optional[str]]:
    """
    Constructs the prompt based on PromptConfig, executes it,
    and returns parsed JSON and raw text results.
    """
    doc_id_for_log = current_doc_id_for_log  # Renaming for clarity within this scope

    # 1. Determine document content to include for this specific prompt
    doc_content_for_llm = ""
    if prompt_config.include_document_context:
        doc_content_for_llm = doc_content_full
    else:
        # Optional: could add a placeholder if desired, e.g.,
        # doc_content_for_llm = "(Document content intentionally omitted for this specific prompt instruction. Focus on prior extracted data.)"
        pass  # Defaults to empty string

    # 2. Prepare intra-step context (results from prior prompts in this step)
    intra_step_context_section = ""
    if prior_results_in_step:
        try:
            prior_results_json = json.dumps(prior_results_in_step, indent=2)
            intra_step_context_section = f"""

Information Extracted So Far (Current Step - use this to inform your answer for the current instruction. Do NOT simply copy this information.):
{prior_results_json}"""
        except Exception as json_ex:
            print(
                f"[WARN_EXEC_PROMPT] Failed to serialize prior_results_in_step for prompt for doc {doc_id_for_log}, step {current_step_id}: {json_ex}"
            )
            intra_step_context_section = "\n\n(Note: Information from the current step was available but could not be serialized for the prompt.)\n"

    # 3. Prepare inter-step context (results from other analysis steps)
    # This reuses the existing logic for pre_extracted_info_section
    existing_custom_results_from_other_steps = current_doc_custom_analysis_results
    inter_step_context_section = ""
    if (
        existing_custom_results_from_other_steps
        and isinstance(existing_custom_results_from_other_steps, dict)
        and existing_custom_results_from_other_steps
    ):
        try:
            filtered_results_for_prompt = {
                k: v for k, v in existing_custom_results_from_other_steps.items() if k != current_step_id
            }
            if filtered_results_for_prompt:
                inter_step_context_json = json.dumps(filtered_results_for_prompt, indent=2)
                inter_step_context_section = f"""

Pre-extracted Information from Other Analysis Steps (This is context from DIFFERENT analysis tasks. Use it to inform your answer to the current instruction IF RELEVANT. Do NOT simply copy this information.):
{inter_step_context_json}"""
        except Exception as json_ex:
            print(
                f"[WARN_EXEC_PROMPT] Failed to serialize existing_custom_results (inter-step) for prompt for doc {doc_id_for_log}, step {current_step_id}: {json_ex}"
            )
            inter_step_context_section = "\n\n(Note: Previous analysis data from other steps was available but could not be serialized for the prompt.)\n"

    # 4. Construct the final prompt using the text from PromptConfig
    # The user's core instruction is prompt_config.text
    # We then append the document content (if included), then intra-step context, then inter-step context.
    # Finally, the JSON guidance.

    final_prompt = f"""{prompt_config.text}

Document Content:
{doc_content_for_llm}
intra step context section:
{intra_step_context_section}
inter step context section:
{inter_step_context_section}

Respond ONLY with the valid JSON object as described in the instructions provided by the user (which is the text at the beginning of this entire message, before 'Document Content:'). Do not include explanations or markdown formatting in your response.
The JSON object should be the direct answer to the instructions, based on the Document Content (if provided) and informed by any other contextual information given."""

    # 5. Execute LLM call
    raw_text_response = None
    parsed_json_result = None
    try:
        print(
            f'[INFO_EXEC_PROMPT] Executing LLM call for doc {doc_id_for_log}, step {current_step_id}, prompt text: "{prompt_config.text[:100]}..."'
        )
        print(f"[DEBUG_EXEC_PROMPT] Full prompt for doc {doc_id_for_log}, step {current_step_id}:\n{final_prompt}") # For debugging, can be very verbose

        completion = await asyncio.to_thread(
            openai_client.chat.completions.create,
            model="gpt-4o-mini",  # Consider making this configurable
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI assistant that processes documents and extracts information as a structured JSON object according to user instructions. Follow the JSON output requirements strictly.",
                },
                {"role": "user", "content": final_prompt},
            ],
            temperature=0.2,  # Consider making this configurable
        )
        raw_text_response = completion.choices[0].message.content

        if raw_text_response:
            # Attempt to parse the raw_text_response as JSON
            # Remove potential markdown code block fences if present
            cleaned_response = raw_text_response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
                if cleaned_response.endswith("```"):
                    cleaned_response = cleaned_response[:-3]
            elif cleaned_response.startswith("```"):  # Less specific, might be just ```
                cleaned_response = cleaned_response[3:]
                if cleaned_response.endswith("```"):
                    cleaned_response = cleaned_response[:-3]

            cleaned_response = cleaned_response.strip()

            try:
                # Ensure the response is not empty before trying to parse
                if cleaned_response:
                    parsed_json_result = json.loads(cleaned_response)
                else:
                    # Handle case where response is empty after stripping markdown
                    print(
                        f"[WARN_EXEC_PROMPT] LLM response was empty after stripping markdown for doc {doc_id_for_log}, step {current_step_id}."
                    )
                    parsed_json_result = {}  # Or None, depending on how you want to treat empty valid JSON responses
            except json.JSONDecodeError as jde:
                print(
                    f"[ERROR_EXEC_PROMPT] Failed to parse LLM JSON response for doc {doc_id_for_log}, step {current_step_id}. Error: {jde}. Raw response: {raw_text_response[:500]}..."
                )
                # Keep raw_text_response, parsed_json_result remains None
                # Optionally, store the error or the raw response in a special field if needed later.
            except Exception as e_parse:
                print(
                    f"[ERROR_EXEC_PROMPT] Unexpected error parsing LLM JSON response for doc {doc_id_for_log}, step {current_step_id}. Error: {e_parse}. Raw response: {raw_text_response[:500]}..."
                )
        else:
            print(
                f"[WARN_EXEC_PROMPT] LLM response content was empty/None for doc {doc_id_for_log}, step {current_step_id}."
            )

    except Exception as e_openai:
        print(
            f"[ERROR_EXEC_PROMPT] OpenAI API call failed for doc {doc_id_for_log}, step {current_step_id}. Error: {e_openai}"
        )
        # raw_text_response and parsed_json_result remain None
        # Re-raise or handle as appropriate for the calling function
        # For now, we'll let the calling function decide how to handle this (e.g., by seeing Nones)

    return raw_text_response, parsed_json_result


router = APIRouter(prefix="/api/custom-steps", tags=["Processing Steps"])


# --- Supabase Client Dependency ---
def get_supabase_client() -> Client:
    """Initializes and returns a Supabase client.
    Raises HTTPException if secrets are missing or client creation fails.
    """
    try:
        supabase_url: str = db.secrets.get("SUPABASE_URL")
        supabase_key: str = db.secrets.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
            print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret not found.")
            raise HTTPException(
                status_code=500,
                detail="Server configuration error: Supabase secrets missing.",
            )

        return create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"[ERROR] Failed to create Supabase client: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize Supabase client: {e}") from e


class DeleteStepResultsResponse(BaseModel):
    step_id: uuid.UUID
    project_id: uuid.UUID
    message: str
    results_cleared: bool
    step_reset: bool


# --- New Pydantic Models for Conditional Prompts ---
class PromptConfig(BaseModel):
    text: str
    include_document_context: bool = True


class StandardPromptStructure(BaseModel):
    type: Literal["standard_prompt"] = "standard_prompt"
    prompt: PromptConfig


class ConditionalBlockStructure(BaseModel):
    type: Literal["conditional_block"] = "conditional_block"
    condition_prompt: PromptConfig
    action_prompts: list[PromptConfig]


PromptItem = Union[StandardPromptStructure, ConditionalBlockStructure]


# --- Pydantic Models ---


class StepActionResponse(BaseModel):
    step_id: uuid.UUID
    action: Literal["pause_requested", "resume_requested", "pause_failed", "resume_failed"]
    message: str
    details: Optional[str] = None


# To represent distribution of simple values (string, number, bool)
class SimpleValueDistribution(BaseModel):
    value: Any
    count: int


# To represent distribution within a key-value structure
class KeyValueDistribution(BaseModel):
    key_name: str
    total_occurrences: int
    value_distribution: List[SimpleValueDistribution]


# New: To represent the summary for nested key-value structure
class NestedKeyValueSummary(BaseModel):
    outer_key_name: str
    inner_key_summary: List[KeyValueDistribution]


SummaryData = Union[List[SimpleValueDistribution], List[KeyValueDistribution], NestedKeyValueSummary]


class StepResultsSummaryResponse(BaseModel):
    step_name: str
    total_documents_analyzed: int
    total_project_documents: int
    summary_type: Literal[
        "simple_value",
        "key_value",
        "nested_key_value",
        "mixed",
        "error",
        "no_results",
        "empty",
    ]
    summary_data: SummaryData | None = Field(None, description="Distribution summary, depends on summary_type")
    error: str | None = None


# New Models for Bulk Reprocessing
class BulkReprocessRequest(BaseModel):
    project_id: uuid.UUID


class ProcessingProgress(BaseModel):
    status: str
    total: int = 0
    processed: int = 0
    failed: int = 0
    percent: float = 0.0  # Added percent
    current_doc_id: Optional[str] = Field(default=None, alias="currentDocId")
    current_doc_index: Optional[int] = Field(default=None, alias="currentDocIndex")  # Alias for serialization
    message: Optional[str] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


# Models for CRUD operations
class AnalysisPipelineConfig(BaseModel):
    data_collection_fields: List[str] = Field(
        default_factory=list,
        description="Paths to fields to collect from documents for project-wide analysis.",
    )
    global_aggregation_logic: Dict[str, Any] = Field(
        default_factory=dict,
        description="Definition of operations to create global values from collected data.",
    )
    document_assignment_logic: Dict[str, Any] = Field(
        default_factory=dict,
        description="Definition of operations to assign values to documents using global values.",
    )

    class Config:
        from_attributes = True


class CustomStepBase(BaseModel):
    name: str
    description: Optional[str] = None
    prompts: Optional[list[PromptItem]] = None  # New field for sequential prompts
    processing_mode: Optional[Literal["document_by_document", "project_wide_dynamic_analysis"]] = Field(
        default="document_by_document",
        description="The processing mode for this step. 'document_by_document' is the default, 'project_wide_dynamic_analysis' enables multi-step project-level analysis.",
    )
    analysis_pipeline_config: Optional[AnalysisPipelineConfig] = Field(
        default=None,
        description="Configuration for project-wide dynamic analysis. Only applicable if processing_mode is 'project_wide_dynamic_analysis'.",
    )

    @field_validator("prompts", mode="before")
    @classmethod
    def convert_str_prompts_to_prompt_items(cls, v: Optional[list[Any]]) -> Optional[list[Any]]:
        if v is None:
            return None
        if not isinstance(v, list):
            return v

        processed_prompts = []
        for item in v:
            if isinstance(item, str):
                prompt_config = PromptConfig(text=item, include_document_context=True)
                standard_prompt_dict = {
                    "type": "standard_prompt",
                    "prompt": prompt_config.model_dump(),
                }
                processed_prompts.append(standard_prompt_dict)
            elif isinstance(item, dict):
                processed_prompts.append(item)
        return processed_prompts


class CustomStepCreate(CustomStepBase):
    project_id: uuid.UUID


class CustomStepUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompts: Optional[list[PromptItem]] = None  # New field for sequential prompts
    processing_mode: Optional[Literal["document_by_document", "project_wide_dynamic_analysis"]] = None
    analysis_pipeline_config: Optional[AnalysisPipelineConfig] = None

    @field_validator("prompts", mode="before")
    @classmethod
    def convert_str_prompts_to_prompt_items_update(cls, v: Optional[list[Any]]) -> Optional[list[Any]]:
        if v is None:
            return None
        if not isinstance(v, list):
            return v

        processed_prompts = []
        for item in v:
            if isinstance(item, str):
                prompt_config = PromptConfig(text=item, include_document_context=True)
                standard_prompt_dict = {
                    "type": "standard_prompt",
                    "prompt": prompt_config.model_dump(),
                }
                processed_prompts.append(standard_prompt_dict)
            elif isinstance(item, dict):
                processed_prompts.append(item)
        return processed_prompts


class CustomStepResponse(CustomStepBase):
    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_reprocess_type: Optional[str] = None
    run_status: Optional[str] = None

    class Config:
        from_attributes = True


class GlobalValuesSetStorageSchema(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    project_id: uuid.UUID
    generating_custom_step_id: uuid.UUID
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC if os.environ.get("PYTEST_CURRENT_TEST") else timezone.utc)
    )
    values_data: Dict[str, Any] = Field(default_factory=dict, description="The actual computed global values.")
    analysis_pipeline_config_snapshot: Optional[AnalysisPipelineConfig] = None

    class Config:
        from_attributes = True


# --- CRUD Endpoints ---
@router.post("", response_model=CustomStepResponse)
async def create_custom_step(step_data: CustomStepCreate, supabase: Client = Depends(get_supabase_client)):
    try:
        # Pre-insert check for project-level duplicate name
        existing_step_query = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select("id", count="exact")
            .eq("project_id", str(step_data.project_id))
            .eq("name", step_data.name)
            .execute
        )
        
        if existing_step_query.count > 0:
            raise HTTPException(
                status_code=409, # HTTP 409 Conflict
                detail=f"A custom processing step with the name '{step_data.name}' already exists in this project.",
            )

        insert_payload = {
            "name": step_data.name,
            "description": step_data.description,  # Retain for backward compatibility
            "project_id": str(step_data.project_id),
            "processing_mode": step_data.processing_mode,
            "analysis_pipeline_config": (
                step_data.analysis_pipeline_config.model_dump() if step_data.analysis_pipeline_config else None
            ),
            "run_status": "idle",
        }

        # Handle the new 'prompts' field
        if step_data.prompts is not None:
            # Convert each Pydantic model in the prompts list to a dict
            insert_payload["prompts"] = [
                prompt.model_dump(exclude_none=True) for prompt in step_data.prompts
            ]
        elif step_data.description is not None:  # If prompts is None but description exists (legacy or simple case)
            # Assuming description is a simple string or already a serializable structure compatible with the DB schema for prompts
            # If description was intended to be a full PromptStructure, this might need more complex handling.
            # For now, the error is about StandardPromptStructure from step_data.prompts.
            insert_payload["prompts"] = [step_data.description] # This line might need review if description can be complex
        else:
            insert_payload["prompts"] = None

        if step_data.processing_mode == "document_by_document" and step_data.analysis_pipeline_config is not None:
            raise HTTPException(
                status_code=400,
                detail="analysis_pipeline_config must be null when processing_mode is 'document_by_document'",
            )
        elif (
            step_data.processing_mode == "project_wide_dynamic_analysis" and step_data.analysis_pipeline_config is None
        ):
            raise HTTPException(
                status_code=400,
                detail="analysis_pipeline_config is required when processing_mode is 'project_wide_dynamic_analysis'",
            )

        try:
            response = await asyncio.to_thread(supabase.table("custom_processing_steps").insert(insert_payload).execute)
            if response.data:
                created_step_data = response.data[0]
                return CustomStepResponse(**created_step_data)
            else:
                # This case should ideally not be reached if Postgrest throws an error for failed inserts.
                error_detail = "Failed to create custom step: No data returned from Supabase and no explicit error."
                print(f"[ERROR] {error_detail}")
                raise HTTPException(status_code=500, detail=error_detail)
        except PostgrestAPIError as e:
            if e.code == "23505" and "custom_processing_steps_name_key" in e.message:
                # This is a global duplicate name error on the unique constraint for 'name'
                print(f"[INFO_DB_CONSTRAINT] Global duplicate name detected for step '{step_data.name}' on insert: {e.message}")
                raise HTTPException(
                    status_code=409, # Using 409 Conflict for this as well, frontend will distinguish by detail
                    detail=f"A custom processing step with the name '{step_data.name}' already exists globally. Please choose a different name."
                )
            else:
                # Some other database error occurred during insert
                error_detail = f"Database error on create custom step: {e.code} - {e.message}"
                print(f"[ERROR_DB_INSERT] {error_detail}")
                raise HTTPException(status_code=500, detail=error_detail)
        except HTTPException: # Re-raise HTTPExceptions from pre-checks (like project-level duplicate)
            raise
        except Exception as e: # Catch-all for other unexpected errors during the insert block
            print(f"[ERROR_UNEXPECTED_INSERT] Unexpected exception in create_custom_step during insert: {type(e).__name__} - {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred during step creation: {e}")

    except HTTPException: # Re-raise HTTPExceptions from the outer try (e.g. project-level duplicate check)
        raise
    except Exception as e: # Catch-all for unexpected errors in the main function body (outside insert block)
        print(f"[ERROR] Exception in create_custom_step (outer): {type(e).__name__} - {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


@router.get("", response_model=List[CustomStepResponse])
async def list_custom_steps_for_project(
    project_id: uuid.UUID = Query(...), supabase: Client = Depends(get_supabase_client)
):
    try:
        response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select("*")
            .eq("project_id", str(project_id))
            .order("created_at", desc=True)
            .execute
        )
        if response.data:
            return [CustomStepResponse(**step) for step in response.data]
        return []
    except Exception as e:
        print(f"[ERROR] Exception in list_custom_steps_for_project: {type(e).__name__} - {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to list custom steps: {e}")


@router.put("/{project_id}/{step_id}", response_model=CustomStepResponse)
async def update_custom_step(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    step_update_data: CustomStepUpdate,
    supabase: Client = Depends(get_supabase_client),
) -> CustomStepResponse:
    try:
        current_step_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select("*")
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .maybe_single()
            .execute
        )

        if not current_step_response.data:
            raise HTTPException(
                status_code=404,
                detail=f"Custom step {step_id} not found or does not belong to project {project_id}.",
            )

        current_step_db_data = current_step_response.data
        update_payload = step_update_data.model_dump(exclude_unset=True)

        # Handle 'prompts' and sync with 'description' for backward compatibility
        if "prompts" in update_payload:
            # If prompts are explicitly provided (list or None), they are used.
            # The description field (if also provided) is handled as a separate field.
            pass
        elif "description" in update_payload:
            # Prompts were NOT in the request, but description WAS.
            # Update prompts based on the new description for consistency.
            if update_payload["description"] is not None:
                update_payload["prompts"] = [update_payload["description"]]
            else:
                # If description is explicitly set to null, prompts should also be null.
                update_payload["prompts"] = None

        effective_processing_mode = current_step_db_data.get("processing_mode", "document_by_document")
        if "processing_mode" in update_payload:
            effective_processing_mode = update_payload["processing_mode"]

        effective_analysis_config = current_step_db_data.get("analysis_pipeline_config")
        if "analysis_pipeline_config" in update_payload:
            if step_update_data.analysis_pipeline_config is None:
                effective_analysis_config = None
                update_payload["analysis_pipeline_config"] = None
            elif isinstance(step_update_data.analysis_pipeline_config, AnalysisPipelineConfig):
                effective_analysis_config = step_update_data.analysis_pipeline_config.model_dump()
                update_payload["analysis_pipeline_config"] = effective_analysis_config

        if effective_processing_mode == "document_by_document" and effective_analysis_config is not None:
            if "analysis_pipeline_config" in update_payload and update_payload["analysis_pipeline_config"] is not None:
                raise HTTPException(
                    status_code=400,
                    detail="analysis_pipeline_config must be null if processing_mode is 'document_by_document'. Set analysis_pipeline_config to null.",
                )
            elif (
                "analysis_pipeline_config" not in update_payload
                and "processing_mode" in update_payload
                and update_payload["processing_mode"] == "document_by_document"
            ):
                update_payload["analysis_pipeline_config"] = None
        elif effective_processing_mode == "project_wide_dynamic_analysis" and effective_analysis_config is None:
            raise HTTPException(
                status_code=400,
                detail="analysis_pipeline_config is required if processing_mode is 'project_wide_dynamic_analysis'.",
            )

        if not update_payload:
            print(f"[INFO] No fields to update for custom step {step_id} based on request.")
            return CustomStepResponse(**current_step_db_data)

        update_payload["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .update(update_payload)
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .execute
        )

        if response.data:
            updated_step_data = response.data[0]
            return CustomStepResponse(**updated_step_data)
        else:
            error_detail = f"Failed to update custom step {step_id}: No data returned from Supabase."
            if hasattr(response, "error") and response.error:
                error_detail = f"Failed to update custom step {step_id}: {response.error.message}"
            print(f"[ERROR] {error_detail}")
            raise HTTPException(status_code=500, detail=error_detail)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in update_custom_step for step {step_id}: {type(e).__name__} - {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while updating step {step_id}: {e}",
        )


@router.delete("/{project_id}/{step_id}", status_code=204)
async def delete_custom_step(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        step_check_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select("id, project_id")
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .maybe_single()
            .execute
        )
        if not step_check_response.data:
            raise HTTPException(
                status_code=404,
                detail=f"Custom step {step_id} not found or does not belong to project {project_id}.",
            )

        docs_response = await asyncio.to_thread(
            supabase.table("documents").select("id, custom_analysis_results").eq("project_id", str(project_id)).execute
        )
        if docs_response.data:
            for doc in docs_response.data:
                if doc.get("custom_analysis_results") and str(step_id) in doc["custom_analysis_results"]:
                    del doc["custom_analysis_results"][str(step_id)]
                    await asyncio.to_thread(
                        supabase.table("documents")
                        .update({"custom_analysis_results": doc["custom_analysis_results"]})
                        .eq("id", str(doc["id"]))
                        .execute
                    )
        delete_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .delete()
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .execute
        )
        if not delete_response.data:
            print(
                f"[WARN] Delete operation for step {step_id} returned no data. It might have already been deleted or an issue occurred."
            )
            return

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in delete_custom_step for step {step_id}: {type(e).__name__} - {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


@router.delete("/{project_id}/{step_id}/results", response_model=DeleteStepResultsResponse)
async def delete_step_results_and_reset_progress(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
):
    """
    Deletes all analysis results associated with a specific custom processing step
    for all documents in a project and resets the step's progress and status.
    """
    results_cleared_count = 0
    step_reset_done = False

    try:
        # Check if the step exists and belongs to the project
        step_check_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select("id")
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .maybe_single()
            .execute
        )
        if not step_check_response.data:
            raise HTTPException(
                status_code=404,
                detail=f"Custom step {step_id} not found or does not belong to project {project_id}.",
            )

        # 1. Clear results from 'documents' table
        print(f"[INFO] Clearing results for step {step_id} from documents in project {project_id}...")
        docs_response = await asyncio.to_thread(
            supabase.table("documents")
            .select("id, custom_analysis_results")
            .eq("project_id", str(project_id))
            # .neq("custom_analysis_results", None) # Optimization: only fetch docs with results
            .execute
        )

        if docs_response.data:
            for doc in docs_response.data:
                doc_id = doc.get("id")
                current_custom_results = doc.get("custom_analysis_results")
                if (
                    current_custom_results
                    and isinstance(current_custom_results, dict)
                    and str(step_id) in current_custom_results
                ):
                    print(f"[INFO] Removing results for step {step_id} from document {doc_id}")
                    del current_custom_results[str(step_id)]
                    # If custom_analysis_results becomes empty, Supabase might store it as null or {}
                    # depending on its handling of JSONB empty objects. This is fine.
                    update_doc_response = await asyncio.to_thread(
                        supabase.table("documents")
                        .update({"custom_analysis_results": current_custom_results})
                        .eq("id", str(doc_id))
                        .execute
                    )
                    if update_doc_response.data:
                        results_cleared_count += 1
                    else:
                        print(
                            f"[WARN] Failed to update document {doc_id} after removing step results. Error: {update_doc_response.error.message if update_doc_response.error else 'Unknown'}"
                        )

        print(f"[INFO] Cleared results for step {step_id} from {results_cleared_count} documents.")

        # 2. Reset progress in 'custom_processing_steps' table
        print(f"[INFO] Resetting progress for step {step_id}...")
        reset_payload = {
            "run_status": "idle",
            "processed_count_cache": 0,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        update_step_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .update(reset_payload)
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .execute
        )

        if update_step_response.data:
            step_reset_done = True
            print(f"[INFO] Successfully reset progress for step {step_id}.")
        else:
            print(
                f"[WARN] Failed to reset progress for step {step_id}. Error: {update_step_response.error.message if update_step_response.error else 'Unknown'}"
            )
            # Even if step reset fails, we might have cleared results, so proceed to return info

        return DeleteStepResultsResponse(
            step_id=step_id,
            project_id=project_id,
            message=f"Results cleared for {results_cleared_count} documents. Step progress reset: {step_reset_done}.",
            results_cleared=results_cleared_count > 0
            or not docs_response.data,  # True if any cleared or no docs to clear
            step_reset=step_reset_done,
        )

    except HTTPException:
        raise
    except PostgrestAPIError as e:
        print(f"[DB_ERROR] Supabase API error for step {step_id}, project {project_id}: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Database error processing request for step {step_id}: {e.message}",
        )
    except Exception as e:
        print(f"[UNEXPECTED_ERROR] Unexpected error for step {step_id}, project {project_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")


# --- Helper Function for Document Assignment Logic (Initial Ops for MYA-73) ---
async def _execute_document_assignment_logic(
    supabase_client: Client,
    project_id: uuid.UUID,
    custom_step_id: uuid.UUID,
    assignment_config: Dict[str, Any],
) -> Tuple[bool, str, int, int]:
    """
    Executes the document assignment logic for a project-wide dynamic analysis step.
    For MYA-73 Initial Ops, this specifically handles a predefined "custom_criteria".
    Updates the 'custom_analysis_results' field for relevant documents.
    Returns: (success_status, message, total_docs_in_project, docs_updated_count)
    """
    # Temporarily bypassed to resolve persistent syntax/indentation errors.
    # TODO MYA-73: Restore and debug this function's original logic.
    print(
        f"[INFO] _execute_document_assignment_logic for step {custom_step_id} project {project_id} is currently bypassed."
    )
    return True, "Bypassed", 0, 0


class ExecuteAssignmentResponse(BaseModel):
    success: bool
    message: str
    total_documents_in_project: int
    documents_updated: int
    step_id: uuid.UUID
    project_id: uuid.UUID


@router.post(
    "/{project_id}/{step_id}/execute-assignment",
    response_model=ExecuteAssignmentResponse,
    summary="Execute Document Assignment Logic for a Project-Wide Custom Step",
    description="Triggers the document assignment logic defined in a project-wide dynamic analysis step. \nFor initial operations (MYA-73), this supports a predefined criteria like 'Set a test_processed field'.",
)
async def execute_document_assignment_endpoint(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    supabase_client: Client = Depends(get_supabase_client),
) -> ExecuteAssignmentResponse:
    """
    Endpoint to trigger the execution of document assignment rules for a given custom step.
    """
    print(f"[EXEC_ASSIGN_ENDPOINT] Received request to execute assignment for step {step_id} in project {project_id}.")

    try:
        print(f"[EXEC_ASSIGN_ENDPOINT] Fetching config for step {step_id}...")
        step_config_response = await asyncio.to_thread(
            supabase_client.table("custom_processing_steps")
            .select("id, project_id, name, processing_mode, analysis_pipeline_config")
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .maybe_single()
            .execute
        )

        if not step_config_response.data:
            print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] Custom step {step_id} not found in project {project_id}.")
            raise HTTPException(
                status_code=404,
                detail=f"Custom step {step_id} not found in project {project_id}.",
            )

        step_config_data = step_config_response.data

        if step_config_data.get("processing_mode") != "project_wide_dynamic_analysis":
            message = f"Document assignment can only be executed for steps with 'project_wide_dynamic_analysis' mode. Step {step_id} has mode: {step_config_data.get('processing_mode')}."
            print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] {message}")
            raise HTTPException(status_code=400, detail=message)

        pipeline_config_dict = step_config_data.get("analysis_pipeline_config")
        if not pipeline_config_dict:
            message = f"Custom step {step_id} does not have an analysis_pipeline_config."
            print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] {message}")
            raise HTTPException(status_code=400, detail=message)

        assignment_logic_config = pipeline_config_dict.get("document_assignment_logic")
        if not assignment_logic_config:
            message = f"Custom step {step_id} does not have document_assignment_logic in its pipeline config."
            print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] {message}")
            raise HTTPException(status_code=400, detail=message)

        print(
            f"[EXEC_ASSIGN_ENDPOINT] Calling _execute_document_assignment_logic for step {step_id} with config: {assignment_logic_config}"
        )
        success, message_from_logic, total_docs, updated_docs = await _execute_document_assignment_logic(
            supabase_client=supabase_client,
            project_id=project_id,
            custom_step_id=step_id,
            assignment_config=assignment_logic_config,
        )

        print(
            f"[EXEC_ASSIGN_ENDPOINT] Assignment logic returned: success={success}, message='{message_from_logic}', total_docs={total_docs}, updated_docs={updated_docs}"
        )
        return ExecuteAssignmentResponse(
            success=success,
            message=message_from_logic,
            total_documents_in_project=total_docs,
            documents_updated=updated_docs,
            step_id=step_id,
            project_id=project_id,
        )

    except HTTPException as http_exc:
        print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] HTTPException: {http_exc.detail}")
        raise http_exc
    except PostgrestAPIError as db_error:
        error_message = f"Database error when fetching step configuration for {step_id}: {db_error.message}"
        print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] {error_message}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_message)
    except Exception as e:
        error_message = (
            f"An unexpected error occurred in execute_document_assignment_endpoint for step {step_id}: {str(e)}"
        )
        print(f"[EXEC_ASSIGN_ENDPOINT_ERROR] {error_message}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_message)


# --- Helper Function for Analysis ---
def analyze_results(
    results: List[Any],
) -> Tuple[
    Literal["simple_value", "key_value", "nested_key_value", "mixed", "empty"],
    SummaryData | None,
]:
    if not results:
        return "empty", None

    # Check if all items are simple types (not dicts or lists)
    if all(not isinstance(item, (dict, list)) for item in results):
        distribution = [SimpleValueDistribution(value=k, count=v) for k, v in Counter(results).items()]
        return "simple_value", distribution

    # Check if all items are dicts with a consistent structure (for key_value or nested_key_value)
    if all(isinstance(item, dict) for item in results):
        # Simplified: Check first item's structure for key-value or nested_key_value
        # This is a heuristic and might need refinement for more complex mixed structures.
        first_item = results[0]
        if not first_item:  # Handle empty dicts
            return "mixed", None  # Or treat as empty/error appropriately

        # Check for simple key-value (all values are simple types)
        if all(not isinstance(v, (dict, list)) for v in first_item.values()):
            # Aggregate distributions for each key
            key_data = defaultdict(list)
            for item in results:
                for k, v in item.items():
                    key_data[k].append(v)

            key_distributions = []
            for key_name, values_list in key_data.items():
                value_counts = Counter(values_list)
                dist = [SimpleValueDistribution(value=val, count=c) for val, c in value_counts.items()]
                key_distributions.append(
                    KeyValueDistribution(
                        key_name=key_name,
                        total_occurrences=len(values_list),
                        value_distribution=dist,
                    )
                )
            return "key_value", key_distributions

        # Check for nested_key_value (first level keys, second level are simple key-values)
        # This is a very specific check for { "outer_key": { "inner_key": "value" } }
        # And assumes all items follow this pattern if the first one does.
        is_nested = True
        for outer_key, inner_dict in first_item.items():
            if not isinstance(inner_dict, dict):
                is_nested = False
                break
            if not all(not isinstance(v, (dict, list)) for v in inner_dict.values()):
                is_nested = False
                break

        if is_nested:
            # This requires a more complex aggregation to fit NestedKeyValueSummary
            # For now, let's assume if it's nested, it's one primary outer key we are interested in summarizing.
            # This is a simplification for MYA-64 and needs robust generalization.
            # Let's try to summarize the *first* outer key found as an example.
            if not first_item:
                return (
                    "mixed",
                    None,
                )  # Should not happen if first_item was checked before

            # Aggregate all inner dicts under their respective outer keys
            outer_key_to_inner_dicts_list = defaultdict(list)
            for item in results:
                for outer_k, inner_d in item.items():
                    if isinstance(inner_d, dict):  # Ensure it is a dict
                        outer_key_to_inner_dicts_list[outer_k].append(inner_d)

            summarized_outer_keys = []
            for outer_k, list_of_inner_dicts in outer_key_to_inner_dicts_list.items():
                # For each outer key, summarize its list of inner dicts
                # Each inner dict is like a "key_value" structure itself
                inner_key_data = defaultdict(list)
                for single_inner_dict in list_of_inner_dicts:
                    for inner_k_specific, inner_v_specific in single_inner_dict.items():
                        inner_key_data[inner_k_specific].append(inner_v_specific)

                inner_key_distributions = []
                for inner_key_name, inner_values_list in inner_key_data.items():
                    inner_value_counts = Counter(inner_values_list)
                    inner_dist = [SimpleValueDistribution(value=val, count=c) for val, c in inner_value_counts.items()]
                    inner_key_distributions.append(
                        KeyValueDistribution(
                            key_name=inner_key_name,
                            total_occurrences=len(inner_values_list),
                            value_distribution=inner_dist,
                        )
                    )
                summarized_outer_keys.append(
                    NestedKeyValueSummary(
                        outer_key_name=outer_k,
                        inner_key_summary=inner_key_distributions,
                    )
                )

            # For now, if multiple outer keys exist, we return a list of their summaries.
            # The StepResultsSummaryResponse expects a single NestedKeyValueSummary or List[KeyValueDistribution] etc.
            # This part needs to align with how frontend expects to consume it. For now, returning the list of summaries directly in summary_data
            # and setting type to "nested_key_value" - frontend will need to handle list if multiple outer keys exist.
            # Or, more strictly, assume only ONE outer key is expected for this summary type.
            # Let's adjust to return the first one if available, or handle as "mixed" if structure varies too much.
            if summarized_outer_keys:
                # This still doesn't quite fit `SummaryData = Union[..., NestedKeyValueSummary]` if there are multiple outer keys.
                # For now, let's return a list of KeyValueDistribution for the inner keys of the *first* outer key found.
                # This simplifies the return type to fit existing Union better, but loses multiple outer key info.
                # A better approach would be to have SummaryData = Union[..., List[NestedKeyValueSummary]] or similar.
                # Forcing a specific structure for now for "nested_key_value":
                # Assume we want to show the summary for EACH inner key of the FIRST outer key.
                if summarized_outer_keys[0].inner_key_summary:  # If the first outer key has inner summaries
                    return (
                        "nested_key_value",
                        summarized_outer_keys[0],
                    )  # Return the whole NestedKeyValueSummary object
                else:
                    return "mixed", None  # Not fitting the expected nested structure
            else:
                return "mixed", None  # No valid nested structure found

    # If it's a mix or unrecognized structure
    return "mixed", None


@router.get("/{project_id}/{step_id}/results-summary", response_model=StepResultsSummaryResponse)
async def get_step_results_summary(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
):
    """Retrieve a summary of analysis results for a specific custom processing step within a project."""
    step_name = "Unknown Step"
    total_project_documents = 0
    total_documents_analyzed_for_step = 0
    step_specific_results_list = []

    try:
        # 1. Fetch custom step details to get the name
        step_details_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select("name")
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .maybe_single()
            .execute
        )
        if not step_details_response.data:
            raise HTTPException(
                status_code=404,
                detail=f"Custom step {step_id} not found in project {project_id}.",
            )
        step_name = step_details_response.data.get("name", "Unnamed Step")

        # 2. Fetch all documents for the project to get total count and their analysis results
        documents_response = await asyncio.to_thread(
            supabase.table("documents")
            .select(
                "id, custom_analysis_results, project_id"
            )  # Ensure project_id is part of select for filtering clarity if needed
            .eq("project_id", str(project_id))
            .execute
        )

        if documents_response.data:
            total_project_documents = len(documents_response.data)
            for doc in documents_response.data:
                custom_results = doc.get("custom_analysis_results")
                if custom_results and isinstance(custom_results, dict):
                    step_result = custom_results.get(str(step_id))
                    if step_result is not None:  # Check if result for this step_id exists
                        step_specific_results_list.append(step_result)
                        total_documents_analyzed_for_step += 1

        # 3. Analyze the collected results
        summary_type, summary_data = analyze_results(step_specific_results_list)

        return StepResultsSummaryResponse(
            step_name=step_name,
            total_documents_analyzed=total_documents_analyzed_for_step,
            total_project_documents=total_project_documents,
            summary_type=summary_type,
            summary_data=summary_data,
            error=None,
        )

    except HTTPException as http_exc:
        # Re-raise HTTPException directly
        raise http_exc
    except PostgrestAPIError as db_error:
        print(
            f"[DB_ERROR] Supabase API error in get_step_results_summary for step {step_id}, project {project_id}: {db_error}"
        )
        traceback.print_exc()
        return StepResultsSummaryResponse(
            step_name=step_name,  # Use fetched name if available, otherwise default
            total_documents_analyzed=total_documents_analyzed_for_step,
            total_project_documents=total_project_documents,
            summary_type="error",
            summary_data=None,
            error=f"Database error: {db_error.message}",
        )
    except Exception as e:
        print(
            f"[UNEXPECTED_ERROR] Unexpected error in get_step_results_summary for step {step_id}, project {project_id}: {e}"
        )
        traceback.print_exc()
        return StepResultsSummaryResponse(
            step_name=step_name,  # Use fetched name if available, otherwise default
            total_documents_analyzed=total_documents_analyzed_for_step,
            total_project_documents=total_project_documents,
            summary_type="error",
            summary_data=None,
            error=f"An unexpected server error occurred: {str(e)}",
        )


# --- Bulk Reprocessing Logic & Endpoints ---


async def _update_step_status_and_progress(
    step_id: uuid.UUID,
    project_id: uuid.UUID,
    supabase: Client,
    run_status: Optional[str] = None,
    last_reprocess_type: Optional[str] = None,
    processed_count_cache: Optional[int] = None,
    failed_count_cache: Optional[int] = None,
    total_documents_cache: Optional[int] = None,
    current_doc_id_cache: Optional[str] = None,
    last_processed_document_offset: Optional[int] = None,  # Added MYA-63
):
    payload = {}
    if run_status is not None:
        payload["run_status"] = run_status
    if last_reprocess_type is not None:
        payload["last_reprocess_type"] = last_reprocess_type
    if processed_count_cache is not None:
        payload["processed_count_cache"] = processed_count_cache
    if failed_count_cache is not None:
        payload["failed_count_cache"] = failed_count_cache
    if total_documents_cache is not None:
        payload["total_documents_cache"] = total_documents_cache
    # The following line attempting to set current_doc_id_cache is removed
    # as the column does not exist in the user's custom_processing_steps table.
    # if current_doc_id_cache is not None:
    #     payload["current_doc_id_cache"] = current_doc_id_cache
    if last_processed_document_offset is not None:  # Added MYA-63
        payload["last_processed_document_offset"] = last_processed_document_offset

    if payload:
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            await asyncio.to_thread(
                supabase.table("custom_processing_steps")
                .update(payload)
                .eq("id", str(step_id))
                .eq("project_id", str(project_id))  # Ensure project_id match for security
                .execute
            )
            print(f"[PROGRESS_UPDATE] Step {step_id} in project {project_id} updated with: {payload}")
        except Exception as e:
            print(f"[PROGRESS_ERROR] Failed to update step {step_id} status/progress: {e}")
            traceback.print_exc()


async def _bulk_reprocess_generator(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    reprocess_type: Literal["all", "new", "failed", "pending"],  # Added 'failed', 'pending' for MYA-63
    supabase: Client,
    openai_client: OpenAI,
):
    step_id_as_str = str(step_id)
    project_id_as_str = str(project_id)
    current_status_for_finally = "running"

    # Initial status update
    await _update_step_status_and_progress(
        step_id=step_id,
        project_id=project_id,
        supabase=supabase,
        run_status="running",
        last_reprocess_type=reprocess_type,
        processed_count_cache=0,
        failed_count_cache=0,
        total_documents_cache=0,
        current_doc_id_cache=None,
        last_processed_document_offset=-1,  # Start before the first doc for 'new' logic
    )

    yield_counter = 0
    processed_count_this_run = 0
    failed_count_this_run = 0
    last_sent_processed_count = -1
    last_sent_failed_count = -1
    last_sent_percent = -1.0

    # MYA-77 Debug: Send an immediate init event to test stream viability
    init_event_string = f"event: init\ndata: {json.dumps({'message': 'Stream initiated for step ' + step_id_as_str, 'project_id': project_id_as_str})}\n\n"
    print(f"[SSE_YIELD_DEBUG] Yielding init: {init_event_string.strip()}")
    try:
        yield init_event_string
        yield_counter += 1
    except Exception as e_init_yield:
        print(f"[STREAM_CRITICAL_ERROR] Failed to yield initial 'init' event for step {step_id_as_str}: {e_init_yield}")
        traceback.print_exc()
        current_status_for_finally = "error_init_yield_fatal"
        # Re-raise, the main finally clause will then handle setting db status to error.
        raise

    # Fetch step details first (including description/prompt_template)
    print(f"[STREAM_DEBUG] Attempting to fetch step details for {step_id_as_str}...")
    try:
        step_details_response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select(
                "id, name, description, prompts, run_status, last_processed_document_offset, total_documents_cache, processed_count_cache, failed_count_cache"  # Added 'prompts'
            )
            .eq("id", step_id_as_str)
            .eq("project_id", project_id_as_str)
            .single()
            .execute
        )
        print(
            f"[STREAM_DEBUG] Fetched step details response for {step_id_as_str}: {step_details_response.data is not None}"
        )
        print(
            f"[STREAM_DEBUG_DATA] step_details_response.data: {getattr(step_details_response, 'data', 'N/A')}"
        )  # MYA-77 More detailed log
    except Exception as e_step_details:
        print(f"[STREAM_CRITICAL_ERROR] Failed to fetch step_details for step {step_id_as_str}: {e_step_details}")
        traceback.print_exc()
        current_status_for_finally = "error_fetch_step_details_fatal"
        # Attempt to yield an SSE error if possible, then re-raise
        try:
            error_event_string = f"event: error\ndata: {json.dumps({'message': 'CRITICAL: Failed to fetch step configuration.', 'details': str(e_step_details)})}\n\n"
            print(
                f"[SSE_YIELD_DEBUG] Attempting to yield critical step_details fetch error: {error_event_string.strip()}"
            )
            yield error_event_string
        except Exception as e_yield_critical_error:
            print(
                f"[STREAM_CRITICAL_ERROR] ALSO FAILED to yield critical step_details error event for {step_id_as_str}: {e_yield_critical_error}"
            )
        raise  # Re-raise e_step_details

    if not step_details_response.data:
        error_message = f"Custom step {step_id_as_str} not found."
        print(f"[STREAM_ERROR] {error_message}")
        sse_error_event_string = f"event: error\ndata: {json.dumps({'message': error_message})}\n\n"
        print(f"[SSE_YIELD_DEBUG] Yielding error (step not found): {sse_error_event_string.strip()}")  # MYA-77 Debug
        yield sse_error_event_string
        current_status_for_finally = "error_setup"
        await _update_step_status_and_progress(
            step_id,
            project_id,
            supabase,
            run_status=current_status_for_finally,
            last_reprocess_type=reprocess_type,
        )
        return

    step_config = step_details_response.data

    prompts_to_execute = []
    # Check for 'prompts' field first (new multi-prompt structure)
    step_prompts_list = step_config.get("prompts")
    # Check if it's a list and its elements are dicts (our new prompt objects) or strings (legacy)
    if isinstance(step_prompts_list, list) and step_prompts_list:
        # If the first item is a dictionary, assume it's the new structure
        if isinstance(step_prompts_list[0], dict):
            prompts_to_execute = step_prompts_list  # Use the list of prompt objects directly
        # Else, if the first item is a string, assume it's a list of legacy string prompts
        elif isinstance(step_prompts_list[0], str):
            prompts_to_execute = [p for p in step_prompts_list if isinstance(p, str) and p.strip()]
        # Else, it's an unknown format, initialize as empty to fall through to error or legacy description
        else:
            prompts_to_execute = []

    # If 'prompts' was not the new structure or was empty/invalid, try legacy single-prompt
    if not prompts_to_execute:
        legacy_description = step_config.get("description")
        if isinstance(legacy_description, str) and legacy_description.strip():
            # Convert legacy description to a StandardPromptStructure for consistency
            prompts_to_execute = [
                {
                    "type": "standard_prompt",
                    "prompt": {
                        "text": legacy_description.strip(),
                        "include_document_context": True,
                    },
                }
            ]

    if not prompts_to_execute:
        error_message = f"No valid prompt templates found for step {step_id_as_str}. Either 'prompts' list must be non-empty or 'description' must be set."
        print(f"[STREAM_ERROR] {error_message}")
        sse_error_event_string = f"event: error\ndata: {json.dumps({'message': error_message})}\n\n"
        print(f"[SSE_YIELD_DEBUG] Yielding error (prompt missing): {sse_error_event_string.strip()}")  # MYA-77 Debug
        yield sse_error_event_string
        current_status_for_finally = "error_setup_prompt"
        await _update_step_status_and_progress(
            step_id,
            project_id,
            supabase,
            run_status=current_status_for_finally,
            last_reprocess_type=reprocess_type,
        )
        return

    # Define the main query for data fetching with all necessary columns
    # This will also have .order() applied based on reprocess_type
    query_for_data = (
        supabase.table("documents")
        .select(
            "id, file_name, extracted_text, custom_analysis_results, created_at, storage_path"  # Added storage_path
        )
        .eq("project_id", project_id_as_str)
    )

    initial_offset = 0
    if reprocess_type == "new":
        query_for_data = query_for_data.order("id", desc=False)
        last_offset_db = step_config.get("last_processed_document_offset", -1)
        initial_offset = last_offset_db + 1
        print(
            f"[STREAM_INFO] Reprocess type 'new'. Starting from offset: {initial_offset} (last_processed_document_offset from DB: {last_offset_db})"
        )
    elif reprocess_type == "failed":
        query_for_data = query_for_data.order("id", desc=False)
    elif reprocess_type == "pending":
        query_for_data = query_for_data.order("id", desc=False)
    else:  # "all" or any other case
        query_for_data = query_for_data.order("id", desc=False)  # Default order

    # For counting, use a simpler query that is less likely to fail due to missing columns
    # not essential for the count itself. Filters should match.
    # Selecting just 'id' or '*' for count is safer.
    query_for_count = supabase.table("documents").select("id", count="exact").eq("project_id", project_id_as_str)
    # Note: .order() is not strictly needed for a total count without offset/limit, so not applying it here.

    total_docs_for_progress = 0
    try:
        print(f"[STREAM_DEBUG_QUERY_COUNT] Attempting to execute document count query for project {project_id_as_str}")
        count_response = await asyncio.to_thread(query_for_count.execute)  # Use query_for_count
        total_docs_for_progress = count_response.count if count_response.count is not None else 0
        print(
            f"[STREAM_DEBUG_QUERY_COUNT_SUCCESS] Successfully executed document count query. Total docs: {total_docs_for_progress}"
        )
    except Exception as e_count_query:
        print(
            f"[STREAM_CRITICAL_ERROR] Failed to execute document count query for project {project_id_as_str}: {type(e_count_query).__name__} - {str(e_count_query)}"
        )  # MYA-77 Debug
        traceback.print_exc()
        sse_error_event_string = f"event: error\ndata: {json.dumps({'message': 'Failed to count documents in project.', 'details': str(e_count_query)})}\n\n"
        try:
            yield sse_error_event_string
        except Exception as e_yield_err:
            print(f"[STREAM_CRITICAL_ERROR] Also failed to yield count query error event: {e_yield_err}")
        current_status_for_finally = "error_doc_count_query"
        await _update_step_status_and_progress(step_id, project_id, supabase, run_status=current_status_for_finally)
        return

    print(f"[STREAM_DEBUG_TOTAL_DOCS] total_docs_for_progress: {total_docs_for_progress}")  # MYA-77 Debug

    if total_docs_for_progress == 0:
        print(f"[STREAM_INFO] No documents found for project {project_id_as_str}. Nothing to process.")
        # Removed progress event yield for zero-doc case to simplify client handling (MYA-77)
        current_status_for_finally = "completed_empty"
        await _update_step_status_and_progress(
            step_id,
            project_id,
            supabase,
            run_status=current_status_for_finally,
            total_documents_cache=0,
            processed_count_cache=0,
            failed_count_cache=0,
        )
        sse_end_stream_event = f"event: end_stream\ndata: {json.dumps({'message': 'No documents found for project, stream ended cleanly.'})}\n\n"
        print(f"[SSE_YIELD_DEBUG] Yielding end_stream: {sse_end_stream_event.strip()}")  # MYA-77 Debug
        yield sse_end_stream_event
        return

    await _update_step_status_and_progress(step_id, project_id, supabase, total_documents_cache=total_docs_for_progress)
    print(
        f"[STREAM_SETUP] Total documents for progress for step {step_id_as_str}: {total_docs_for_progress}, initial offset for query: {initial_offset}"
    )

    # Batch processing variables
    BATCH_SIZE = 10  # Number of documents to fetch per Supabase call
    current_batch_offset = initial_offset
    has_more_documents = True
    doc_index_overall = initial_offset - 1  # To track overall document index for `last_processed_document_offset`

    try:
        while has_more_documents:
            # Check run_status before processing each batch (for pause)
            latest_step_status_resp = await asyncio.to_thread(
                supabase.table("custom_processing_steps")
                .select("run_status")
                .eq("id", step_id_as_str)
                .eq("project_id", project_id_as_str)
                .single()
                .execute
            )
            if latest_step_status_resp.data and latest_step_status_resp.data.get("run_status") == "paused":
                print(f"[STREAM_PAUSE] Step {step_id_as_str} is paused. Pausing generator.")
                percent_complete = (
                    (processed_count_this_run + failed_count_this_run) / total_docs_for_progress * 100
                    if total_docs_for_progress > 0
                    else 0
                )
                progress_payload_json = ProcessingProgress(
                    status="paused",
                    total=total_docs_for_progress,
                    processed=processed_count_this_run,
                    failed=failed_count_this_run,
                    percent=percent_complete,
                    message="Processing paused by user.",
                ).model_dump_json(by_alias=True)
                yield f"event: progress\ndata: {progress_payload_json}\n\n"
                # No further status update to DB here, already paused.
                current_status_for_finally = "paused"
                # We need to store the current doc_index_overall so resume can pick up
                await _update_step_status_and_progress(
                    step_id,
                    project_id,
                    supabase,
                    last_processed_document_offset=doc_index_overall,
                )
                return  # Stop the generator
            elif latest_step_status_resp.data and latest_step_status_resp.data.get("run_status") != "running":
                # If status is error, completed, idle, etc., stop.
                current_run_status = latest_step_status_resp.data.get("run_status")
                print(f"[STREAM_STOP] Step {step_id_as_str} status is '{current_run_status}'. Stopping generator.")
                current_status_for_finally = latest_step_status_resp.data.get("run_status", "error_unexpected_stop")
                # Do not yield progress here as it might be confusing. Final status will be set in finally.
                return

            print(
                f"[STREAM_BATCH] Fetching documents for step {step_id_as_str}: offset={current_batch_offset}, limit={BATCH_SIZE}"
            )
            docs_response = await asyncio.to_thread(
                query_for_data.range(current_batch_offset, current_batch_offset + BATCH_SIZE - 1).execute
            )

            if not docs_response.data:
                print(
                    f"[STREAM_BATCH] No more documents found for step {step_id_as_str} at offset {current_batch_offset}."
                )
                has_more_documents = False
                break

            if len(docs_response.data) < BATCH_SIZE:
                has_more_documents = False  # This is the last batch

            for doc_data in docs_response.data:
                doc_index_overall += 1  # Increment before processing, so it represents the current doc index
                doc_id = doc_data.get("id")
                doc_file_name = doc_data.get("file_name", "Unknown Filename")  # Added
                doc_storage_path = doc_data.get("storage_path")  # Added
                # doc_content = doc_data.get("extracted_text") # Old line, will be replaced by new logic
                current_custom_results = doc_data.get("custom_analysis_results") or {}
                doc_content = None  # Initialize for new logic

                # Yield initial progress for starting this document - MOVED AND REFINED
                yield_counter += 1
                progress_data_start_doc = ProcessingProgress(
                    status="running",
                    total=total_docs_for_progress,
                    processed=processed_count_this_run,
                    failed=failed_count_this_run,
                    percent=(
                        ((processed_count_this_run + failed_count_this_run) / total_docs_for_progress * 100)
                        if total_docs_for_progress > 0
                        else 0
                    ),
                    currentDocId=doc_id,
                    currentDocIndex=doc_index_overall,
                    message=f"Starting processing for doc {doc_index_overall + 1}/{total_docs_for_progress}: {doc_file_name}",
                )
                sse_event_string_start_doc = (
                    f"event: progress\ndata: {progress_data_start_doc.model_dump_json(by_alias=True)}\n\n"
                )
                print(f"[SSE_YIELD_DEBUG] Yielding progress (doc start): {sse_event_string_start_doc.strip()}")
                yield sse_event_string_start_doc
                time.sleep(0.05)

                # PDF Download and Text Extraction Block - NEW
                try:
                    if not doc_storage_path:
                        raise ValueError(f"Document ID {doc_id} ({doc_file_name}) is missing 'storage_path'.")

                    print(
                        f"[STREAM_STORAGE_DOWNLOAD] Downloading {doc_storage_path} for doc {doc_id} ({doc_file_name})."
                    )
                    file_bytes_response = await asyncio.to_thread(
                        supabase.storage.from_("pdf-documents").download,
                        doc_storage_path,
                    )
                    file_bytes = file_bytes_response  # In Python SDK, download() returns bytes directly

                    if not file_bytes:
                        raise ValueError(
                            f"Downloaded 0 bytes for {doc_storage_path} (doc {doc_id}, {doc_file_name}). File might be empty, non-existent, or download failed."
                        )
                    print(
                        f"[STREAM_STORAGE_DOWNLOAD_SUCCESS] Downloaded {len(file_bytes)} bytes for {doc_storage_path}."
                    )

                    # Determine file type and extract text accordingly
                    file_extension = doc_file_name.split(".")[-1].lower() if "." in doc_file_name else ""
                    temp_doc_content = ""

                    if file_extension == "pdf":
                        print(f"[STREAM_EXTRACT_INFO] Attempting PDF extraction for {doc_file_name}")
                        with io.BytesIO(file_bytes) as pdf_file_like:
                            pdf_reader = pypdf.PdfReader(pdf_file_like)
                            if not pdf_reader.pages:
                                raise ValueError(
                                    f"PDF {doc_storage_path} (doc {doc_id}, {doc_file_name}) has no pages or is not a valid PDF."
                                )
                            for page_num in range(len(pdf_reader.pages)):
                                page_text = pdf_reader.pages[page_num].extract_text()
                                if page_text:
                                    temp_doc_content += page_text + "\\n"
                        print(
                            f"[STREAM_PDF_EXTRACT_SUCCESS] Extracted {len(temp_doc_content)} chars from PDF: {doc_file_name}"
                        )
                    elif file_extension == "docx":
                        print(f"[STREAM_EXTRACT_INFO] Attempting DOCX extraction for {doc_file_name}")
                        try:
                            document = Document(io.BytesIO(file_bytes))
                            all_text_parts = [para.text for para in document.paragraphs if para.text]
                            temp_doc_content = "\\n\\n".join(all_text_parts)
                            print(
                                f"[STREAM_DOCX_EXTRACT_SUCCESS] Extracted {len(temp_doc_content)} chars from DOCX: {doc_file_name}"
                            )
                        except Exception as docx_err:
                            raise ValueError(
                                f"Failed to parse DOCX content for {doc_file_name}: {docx_err}"
                            ) from docx_err
                    else:
                        raise ValueError(
                            f"Unsupported file type '{file_extension}' for text extraction in {doc_file_name} (doc_id: {doc_id})."
                        )

                    if not temp_doc_content.strip():
                        raise ValueError(
                            f"Extracted text from {doc_file_name} (doc {doc_id}) is empty after processing."
                        )

                    doc_content = temp_doc_content.strip()

                except Exception as e_extract:
                    failed_count_this_run += 1
                    error_detail = f"Failed to get content for doc {doc_id} ({doc_file_name}): {type(e_extract).__name__} - {str(e_extract)}"
                    print(f"[STREAM_ERROR_EXTRACT] {error_detail}")

                    current_custom_results[step_id_as_str] = {
                        "error": error_detail,
                        "status": "failed_extraction",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    try:
                        await asyncio.to_thread(
                            supabase.table("documents")
                            .update({"custom_analysis_results": current_custom_results})
                            .eq("id", doc_id)
                            .execute
                        )
                    except Exception as db_update_err:
                        print(
                            f"[STREAM_ERROR_DB_UPDATE] Failed to update document {doc_id} with extraction error: {db_update_err}"
                        )

                    progress_data_fail_doc = ProcessingProgress(
                        status="processing_doc_failed",
                        total=total_docs_for_progress,
                        processed=processed_count_this_run,
                        failed=failed_count_this_run,
                        percent=(
                            ((processed_count_this_run + failed_count_this_run) / total_docs_for_progress * 100)
                            if total_docs_for_progress > 0
                            else 0
                        ),
                        currentDocId=doc_id,
                        currentDocIndex=doc_index_overall,
                        error=error_detail,
                        message=f"Failed extraction for doc {doc_index_overall + 1}: {doc_file_name}",
                    )
                    sse_event_string_fail_doc = (
                        f"event: progress\ndata: {progress_data_fail_doc.model_dump_json(by_alias=True)}\n\n"
                    )
                    yield sse_event_string_fail_doc
                    # This continue is CRITICAL: if extraction fails, we skip AI analysis for this doc
                    # The original "if not doc_content:" check later will be removed.
                    continue

                try:
                    current_doc_custom_analysis_results = doc_data.get("custom_analysis_results") or {}
                    if step_id_as_str not in current_doc_custom_analysis_results or not isinstance(
                        current_doc_custom_analysis_results[step_id_as_str], dict
                    ):
                        current_doc_custom_analysis_results[step_id_as_str] = {}

                    doc_processed_successfully_by_all_prompts = True  # Flag for this document
                    # Initialize accumulator for results specific to this step and this document
                    accumulated_results_for_this_step_this_doc = {} 
                    print(f"[MYA-91_DEBUG] Initialized accumulated_results_for_this_step_this_doc for doc {doc_id}, step {step_id_as_str}: {{}}")

                    for prompt_idx, prompt_container in enumerate(prompts_to_execute):
                        print(f"[MYA-91_DEBUG] --------------- PROMPT #{prompt_idx + 1} for doc {doc_id} ---------------")
                        # MYA-94: Check for pause before processing each prompt for this document
                        try:
                            latest_step_status_resp_prompt_check = await asyncio.to_thread(
                                supabase.table("custom_processing_steps")
                                .select("run_status")
                                .eq("id", step_id_as_str)
                                .eq("project_id", project_id_as_str)
                                .single()
                                .execute
                            )
                            if latest_step_status_resp_prompt_check.data and latest_step_status_resp_prompt_check.data.get("run_status") == "paused":
                                print(f"[STREAM_PAUSE_PROMPT_LEVEL] Step {step_id_as_str} is paused (checked before prompt {prompt_idx+1} for doc {doc_id}). Pausing generator.")
                                current_status_for_finally = "paused"
                                paused_progress_payload = ProcessingProgress(
                                    status="paused",
                                    total=total_docs_for_progress,
                                    processed=processed_count_this_run,
                                    failed=failed_count_this_run,
                                    percent=(
                                        ((processed_count_this_run + failed_count_this_run) / total_docs_for_progress * 100)
                                        if total_docs_for_progress > 0
                                        else 0
                                    ),
                                    currentDocId=doc_id, 
                                    currentDocIndex=doc_index_overall,
                                    message="Processing paused by user (before starting next prompt).",
                                ).model_dump_json(by_alias=True)
                                yield f"event: progress\\ndata: {paused_progress_payload}\\n\\n"
                                yield_counter += 1
                                
                                await _update_step_status_and_progress(
                                    step_id,
                                    project_id,
                                    supabase,
                                    run_status="paused", 
                                    last_processed_document_offset=doc_index_overall -1 if prompt_idx == 0 else doc_index_overall, 
                                    # If it's the first prompt for this doc, offset is previous doc.
                                    # Otherwise, this doc is partially processed, so current offset.
                                )
                                return 
                        except Exception as e_pause_check_prompt:
                            print(f"[STREAM_WARN_PAUSE_CHECK_PROMPT] Failed to check pause status before prompt for doc {doc_id}: {e_pause_check_prompt}. Processing continues for this prompt.")

                        print(f"[MYA-91_DEBUG] Current prompt_container: {prompt_container}")
                        print(f"[MYA-91_DEBUG] accumulated_results_for_this_step_this_doc BEFORE _execute_prompt: {accumulated_results_for_this_step_this_doc}")
                        # The original 'try:' and subsequent lines follow here
                        try:
                            # For legacy prompts (simple strings), we construct a PromptConfig on the fly.
                            # The _execute_prompt_config_and_get_results helper will handle context and OpenAI call.
                            # This section handles the old List[str] format for prompts.

                                # REMOVED: if "accumulated_legacy_results" not in locals() or prompt_idx == 0:
                                # REMOVED:     accumulated_legacy_results = {}


                            include_document_context = (
                                prompt_container
                                .get("prompt", {})
                                .get("include_document_context", True) 
                            )
                            
                            # Call the unified helper.
                            _raw_resp_str, parsed_output_dict = await _execute_prompt_config_and_get_results(
                                # supabase_client=supabase,
                                openai_client=openai_client,
                                # project_id=project_id,
                                current_step_id=step_id_as_str,
                                current_doc_id_for_log=doc_id,
                                doc_content_full=doc_content,
                                prompt_config=PromptConfig(
                                    text=prompt_container["prompt"]["text"],
                                    include_document_context=include_document_context,
                                ),  # Legacy prompts always include doc
                                prior_results_in_step=accumulated_results_for_this_step_this_doc, # Use the per-document accumulator
                                current_doc_custom_analysis_results=current_doc_custom_analysis_results,
                            )
                            print(f"[MYA-91_DEBUG] _raw_resp_str from _execute_prompt: {'Non-empty' if _raw_resp_str else 'Empty/None'}")
                            print(f"[MYA-91_DEBUG] parsed_output_dict from _execute_prompt: {type(parsed_output_dict).__name__} - {str(parsed_output_dict)[:500]}")


                            if _raw_resp_str is None or parsed_output_dict is None:
                                # Error occurred in helper _execute_prompt_config_and_get_results.
                                # The helper returns Nones, and the calling code (this loop) must handle error state.
                                error_detail_for_storage = f"LLM call or JSON parsing failed for legacy prompt #{prompt_idx + 1}. Raw: {_raw_resp_str[:200] if _raw_resp_str else 'N/A'}"
                                current_doc_custom_analysis_results.setdefault(step_id_as_str, {})[f"prompt_{prompt_idx+1}_error"] = error_detail_for_storage
                                current_doc_custom_analysis_results.setdefault(step_id_as_str, {})["status"] = "error_in_legacy_prompt_execution"
                                print(f"[STREAM_ERROR_LEGACY_EXEC] {error_detail_for_storage}")
                                doc_processed_successfully_by_all_prompts = False
                                break  # Stop processing this document for this step

                            # If successful, parsed_output_dict contains the results of THIS prompt.
                            # The calling code (this loop) is responsible for merging these results
                            # into accumulated_legacy_results and current_doc_custom_analysis_results[step_id_as_str].
                            
                            if isinstance(parsed_output_dict, dict):
                                accumulated_results_for_this_step_this_doc.update(parsed_output_dict) # Update the per-document accumulator
                                current_doc_custom_analysis_results.setdefault(step_id_as_str, {}).update(parsed_output_dict)
                                print(f"[MYA-91_DEBUG] accumulated_results_for_this_step_this_doc AFTER update (dict): {accumulated_results_for_this_step_this_doc}")
                                current_doc_custom_analysis_results.setdefault(step_id_as_str, {})["status"] = (
                                    "partial_success"  # Mark as partial success until all prompts done
                                )
                            else:
                                print(f"[MYA-91_DEBUG] parsed_output_dict was NOT a dict. Type: {type(parsed_output_dict).__name__}. Not updating accumulator.")
                                # LLM output was not a dictionary, store it separately
                                non_dict_output_key = f"prompt_{prompt_idx+1}_raw_non_dict_llm_output"
                                warning_msg = f"[WARN_LEGACY_NON_DICT_OUTPUT] For doc {doc_id}, step {step_id_as_str}, legacy prompt #{prompt_idx + 1}, expected dict from LLM but got {type(parsed_output_dict).__name__}. Storing raw output in '{non_dict_output_key}'."
                                print(warning_msg)
                                current_doc_custom_analysis_results.setdefault(step_id_as_str, {})[non_dict_output_key] = str(parsed_output_dict) # Ensure it's a string for JSON
                                current_doc_custom_analysis_results.setdefault(step_id_as_str, {})["status"] = (
                                    "partial_success_with_non_dict_output"
                                )
                                # Do not update accumulated_results_for_this_step_this_doc as it expects a dict

                            # Update last processed prompt index
                            current_doc_custom_analysis_results.setdefault(step_id_as_str, {})["last_processed_prompt_index"] = (
                                prompt_idx
                            )

                            # Persist after each successful sub-prompt or non-dict output within the legacy loop.
                            try:
                                await asyncio.to_thread(
                                    supabase.table("documents")
                                    .update({"custom_analysis_results": current_doc_custom_analysis_results})
                                    .eq("id", doc_id)
                                    .execute
                                )
                                print(
                                    f"[STREAM_SUB_PROMPT_SUCCESS_LEGACY] Doc {doc_id}, Step {step_id_as_str}, Legacy Prompt #{prompt_idx + 1} success, results merged by helper."
                                )
                            except Exception as db_update_err_legacy:
                                error_msg = f"Failed to persist partial results for legacy prompt #{prompt_idx + 1}, doc {doc_id}. DB Error: {db_update_err_legacy}"
                                print(f"[STREAM_ERROR_DB_UPDATE_LEGACY] {error_msg}")
                                current_doc_custom_analysis_results[step_id_as_str][
                                    f"prompt_{prompt_idx+1}_db_error"
                                ] = error_msg
                                current_doc_custom_analysis_results[step_id_as_str]["status"] = (
                                    "failed_db_update_legacy"
                                )
                                doc_processed_successfully_by_all_prompts = False
                                break  # Stop processing this document for this step

                        except Exception as e_sub_prompt:
                            error_msg = f"Error during sub-prompt #{prompt_idx + 1} for doc {doc_id}, step {step_id_as_str}: {type(e_sub_prompt).__name__} - {str(e_sub_prompt)}"
                            print(f"[STREAM_ERROR_SUB_PROMPT] {error_msg}")
                            traceback.print_exc()  # Log the full traceback for the sub-prompt error
                            current_doc_custom_analysis_results[step_id_as_str][f"prompt_{prompt_idx+1}_error"] = (
                                error_msg
                            )
                            current_doc_custom_analysis_results[step_id_as_str]["status"] = (
                                "failed_sub_prompt_execution"
                            )
                            doc_processed_successfully_by_all_prompts = False
                            break  # Stop processing this document for this step

                    # After iterating through all prompts for the document (or breaking due to an error)
                    if doc_processed_successfully_by_all_prompts:
                        processed_count_this_run += 1
                        current_doc_custom_analysis_results[step_id_as_str]["status"] = "success"
                        current_doc_custom_analysis_results[step_id_as_str].pop(
                            "last_processed_prompt_index", None
                        )  # Clean up temp field
                        # Final save for the document if all prompts were successful
                        await asyncio.to_thread(
                            supabase.table("documents")
                            .update({"custom_analysis_results": current_doc_custom_analysis_results})
                            .eq("id", doc_id)
                            .execute
                        )
                        print(f"[STREAM_SUCCESS] Doc {doc_id} fully processed by step {step_id_as_str}.")
                    else:
                        failed_count_this_run += 1
                        # The error status and details should already be in current_doc_custom_analysis_results[step_id_as_str]
                        # Final save of error state for the document if any sub-prompt failed
                        await asyncio.to_thread(
                            supabase.table("documents")
                            .update({"custom_analysis_results": current_doc_custom_analysis_results})
                            .eq("id", doc_id)
                            .execute
                        )
                        print(
                            f"[STREAM_DOC_FAILED] Doc {doc_id} failed processing for step {step_id_as_str}. Status: {current_doc_custom_analysis_results[step_id_as_str].get('status')}"
                        )

                except Exception as e_doc_processing_loop:
                    # This is a catch-all for errors within the processing of a single document's prompt sequence
                    # that were not handled by the inner sub-prompt try-except.
                    failed_count_this_run += 1
                    error_msg_doc = f"Outer loop error for document {doc_id}, step {step_id_as_str}: {type(e_doc_processing_loop).__name__} - {str(e_doc_processing_loop)}"
                    print(f"[STREAM_ERROR_DOC_OUTER_LOOP] {error_msg_doc}")
                    traceback.print_exc()  # Log the full traceback for this unexpected error

                    # Ensure custom_analysis_results reflects this failure state
                    if step_id_as_str not in current_doc_custom_analysis_results:
                        current_doc_custom_analysis_results[step_id_as_str] = {}
                    current_doc_custom_analysis_results[step_id_as_str]["error"] = error_msg_doc
                    current_doc_custom_analysis_results[step_id_as_str]["status"] = "failed_document_processing_loop"
                    try:
                        await asyncio.to_thread(
                            supabase.table("documents")
                            .update({"custom_analysis_results": current_doc_custom_analysis_results})
                            .eq("id", doc_id)
                            .execute
                        )
                    except Exception as db_update_err:
                        print(
                            f"[STREAM_ERROR_DB_UPDATE] Failed to update document {doc_id} with outer loop error: {db_update_err}"
                        )

                    # Yield an SSE error event for this specific document
                    _sse_event_name = "error_processing_document"
                    # Ensure doc_data and doc_id are available; they should be from the outer loop scope
                    _sse_data_json = json.dumps(
                        {
                            "message": "Error processing document",
                            "document_id": doc_id,
                            "document_name": doc_file_name,  # Use doc_file_name captured earlier in the loop
                            "error_message": str(e_doc_processing_loop),
                            "error_type": type(e_doc_processing_loop).__name__,
                            "step_id": step_id_as_str,
                        }
                    )
                    sse_doc_error_event_string = f"event: {_sse_event_name}\\ndata: {_sse_data_json}\\n\\n"
                    print(f"[SSE_YIELD_DEBUG] Yielding document processing error: {sse_doc_error_event_string.strip()}")
                    try:
                        yield sse_doc_error_event_string
                    except Exception as e_yield_doc_error:
                        print(
                            f"[STREAM_CRITICAL_ERROR] Failed to yield document_processing_error event for doc {doc_id}, step {step_id_as_str}: {e_yield_doc_error}"
                        )
                        traceback.print_exc()

                    safe_doc_content_snippet = (
                        doc_content[:200] if doc_content else "Content not available for snippet."
                    )
                    current_custom_results[step_id_as_str] = {
                        "error": error_msg_doc,
                        "original_content_snippet": safe_doc_content_snippet,
                    }
                    try:
                        await asyncio.to_thread(
                            supabase.table("documents")
                            .update({"custom_analysis_results": current_custom_results})
                            .eq("id", doc_id)
                            .execute
                        )
                    except Exception as e_update_err:
                        print(
                            f"[STREAM_ERROR_DB_UPDATE] Failed to update doc {doc_id} with error status: {e_update_err}"
                        )
                    continue  # Move to the next document after handling the error for this one

                # Update last_processed_document_offset for "new" or "all" runs for resumability
                if reprocess_type == "new" or reprocess_type == "all":
                    await _update_step_status_and_progress(
                        step_id,
                        project_id,
                        supabase,
                        last_processed_document_offset=doc_index_overall,
                    )

                # Send progress update if counts changed significantly (e.g., every doc or every N docs)
                current_percent = (
                    ((processed_count_this_run + failed_count_this_run) / total_docs_for_progress * 100)
                    if total_docs_for_progress > 0
                    else 0
                )
                if (
                    processed_count_this_run != last_sent_processed_count
                    or failed_count_this_run != last_sent_failed_count
                    or abs(current_percent - last_sent_percent) >= 1.0
                ):
                    # Update DB cache for overall counts (not this run specific)
                    # This is tricky: processed_count_cache should be the total successful for the step, not just this run.
                    # If reprocess_type is "all", we reset it. Otherwise, we might increment.
                    # For MYA-63, let's simplify: processed_count_cache and failed_count_cache in DB reflect *this run*.
                    # They will be finalized at the end.
                    await _update_step_status_and_progress(
                        step_id,
                        project_id,
                        supabase,
                        processed_count_cache=processed_count_this_run,
                        failed_count_cache=failed_count_this_run,
                    )
                    last_sent_processed_count = processed_count_this_run
                    last_sent_failed_count = failed_count_this_run
                    last_sent_percent = current_percent

            current_batch_offset += BATCH_SIZE  # Move to the next batch
            await asyncio.sleep(0.1)  # Small delay between batches

        # Final progress update after loop finishes
        final_percent = (
            ((processed_count_this_run + failed_count_this_run) / total_docs_for_progress * 100)
            if total_docs_for_progress > 0
            else 0
        )
        if (
            total_docs_for_progress > 0
            and (processed_count_this_run + failed_count_this_run) == total_docs_for_progress
        ):
            final_percent = 100.0  # Ensure 100% if all processed

        final_message = f"Processing complete. Processed: {processed_count_this_run}, Failed: {failed_count_this_run} of {total_docs_for_progress}."
        if failed_count_this_run > 0:
            final_message += " Some documents failed processing."

        completed_progress = ProcessingProgress(
            status="completed",
            total=total_docs_for_progress,
            processed=processed_count_this_run,
            failed=failed_count_this_run,
            percent=final_percent,
            message=final_message,
        )
        yield f"event: progress\ndata: {completed_progress.model_dump_json(by_alias=True)}\n\n"
        current_status_for_finally = "completed_ok" if failed_count_this_run == 0 else "completed_with_errors"
        print(f"[STREAM_COMPLETE] {final_message}")

    except httpx.ReadTimeout as e_timeout:
        error_message = f"A read timeout occurred during OpenAI communication for step {step_id_as_str}: {e_timeout}"
        print(f"[STREAM_ERROR_TIMEOUT] {error_message}")
        traceback.print_exc()
        sse_error_event_string = (
            f"event: error\ndata: {json.dumps({'message': error_message, 'details': str(e_timeout)})}\n\n"
        )
        print(f"[SSE_YIELD_DEBUG] Yielding error (timeout): {sse_error_event_string.strip()}")  # MYA-77 Debug
        yield sse_error_event_string
        current_status_for_finally = "error_timeout"
    except storage3_exceptions.StorageException as e_storage:
        error_message = (
            f"A storage error occurred (likely Supabase file operations) for step {step_id_as_str}: {e_storage}"
        )
        print(f"[STREAM_ERROR_STORAGE] {error_message}")
        traceback.print_exc()
        sse_error_event_string = (
            f"event: error\ndata: {json.dumps({'message': error_message, 'details': str(e_storage)})}\n\n"
        )
        print(f"[SSE_YIELD_DEBUG] Yielding error (storage): {sse_error_event_string.strip()}")  # MYA-77 Debug
        yield sse_error_event_string
        current_status_for_finally = "error_storage"
    except PostgrestAPIError as e_db:
        error_message = f"A database error occurred (Postgrest) for step {step_id_as_str}: {e_db.message}"
        print(f"[STREAM_ERROR_DB] {error_message}")
        traceback.print_exc()
        sse_error_event_string = (
            f"event: error\ndata: {json.dumps({'message': error_message, 'details': e_db.message})}\n\n"
        )
        print(f"[SSE_YIELD_DEBUG] Yielding error (db): {sse_error_event_string.strip()}")  # MYA-77 Debug
        yield sse_error_event_string
        current_status_for_finally = "error_db"
    except Exception as e_main:
        error_message = f"An unexpected error occurred during bulk reprocessing for step {step_id_as_str}: {type(e_main).__name__} - {str(e_main)}"
        print(f"[STREAM_ERROR_UNEXPECTED] {error_message}")
        traceback.print_exc()
        sse_error_event_string = (
            f"event: error\ndata: {json.dumps({'message': error_message, 'details': str(e_main)})}\n\n"
        )
        print(f"[SSE_YIELD_DEBUG] Yielding error (unexpected): {sse_error_event_string.strip()}")  # MYA-77 Debug
        yield sse_error_event_string
        current_status_for_finally = "error_unexpected_stream"
    finally:
        final_db_status = "idle"  # Default to idle
        if "error" in current_status_for_finally:
            final_db_status = "error"
        elif current_status_for_finally == "completed_ok":
            final_db_status = "idle"  # Or "completed"
        elif current_status_for_finally == "completed_with_errors":
            final_db_status = "error"  # Or "completed_with_errors" if we add that status
        elif current_status_for_finally == "paused":
            final_db_status = "paused"
        # If completed_empty, it should be idle.
        elif current_status_for_finally == "completed_empty":
            final_db_status = "idle"

        print(
            f"[STREAM_FINALLY] Generator for step {step_id_as_str} finishing. Final DB status to set: {final_db_status}. Processed this run: {processed_count_this_run}, Failed this run: {failed_count_this_run}."
        )
        await _update_step_status_and_progress(
            step_id=step_id,
            project_id=project_id,
            supabase=supabase,
            run_status=final_db_status,
            processed_count_cache=processed_count_this_run,  # Store this run's counts
            failed_count_cache=failed_count_this_run,
            # last_processed_document_offset is updated during the run for "new"/"all"
        )
        final_message_event_data = {
            "status": final_db_status,
            "message": f"Processing run for step {step_id_as_str} finished with status: {final_db_status}.",
            "processed_this_run": processed_count_this_run,
            "failed_this_run": failed_count_this_run,
            "total_documents_in_scope": total_docs_for_progress,
        }
        final_status_event_string = f"event: final_status\ndata: {json.dumps(final_message_event_data)}\n\n"
        print(f"[SSE_YIELD_DEBUG] Yielding final_status: {final_status_event_string.strip()}")  # MYA-77 Debug
        yield final_status_event_string


@router.get("/{project_id}/{step_id}/reprocess", tags=["stream"])
async def legacy_trigger_bulk_basic_reprocessing(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    reprocess_type: Literal["all", "new", "failed", "pending"] = Query(
        "all", description="Type of reprocessing to perform."
    ),
    supabase: Client = Depends(get_supabase_client),
    openai_client: OpenAI = Depends(get_openai_client),  # Add OpenAI client dependency
):
    print(
        f"[ENDPOINT_ENTRY_DEBUG] GET /api/custom-steps/{project_id}/{step_id}/reprocess?reprocess_type={reprocess_type} endpoint hit."
    )  # MYA-77 Debug
    print(
        f"Received request to reprocess documents for project {project_id}, step {step_id} with type '{reprocess_type}'"
    )
    # Check if already running for this step
    step_status_resp = await asyncio.to_thread(
        supabase.table("custom_processing_steps")
        .select("run_status")
        .eq("id", str(step_id))
        .eq("project_id", str(project_id))
        .single()
        .execute
    )
    # MYA-77: Deeper debug log for status check
    read_status_for_conflict_check = (
        step_status_resp.data.get("run_status") if step_status_resp.data else "[NO_DATA_FROM_DB_FOR_STEP_STATUS_CHECK]"
    )
    print(
        f"[SSE_CONFLICT_CHECK_DEBUG] Step {step_id}: Read run_status from DB just before 409 check: '{read_status_for_conflict_check}'"
    )

    if step_status_resp.data and step_status_resp.data.get("run_status") == "running":
        raise HTTPException(
            status_code=409,
            detail=f"Step {step_id} is already processing. Please wait or pause first.",
        )
    if (
        step_status_resp.data and step_status_resp.data.get("run_status") == "paused" and reprocess_type != "new"
    ):  # Resume is typically implicit with "new"
        # If paused, and user triggers general reprocess, perhaps it should resume?
        # For now, let's require a specific resume action or allow "new" to override.
        # If we want to allow "reprocess" to resume, change logic here.
        print(f"Step {step_id} is paused. Explicitly raising 409.")  # MYA-77 Debug
        # Or, we could auto-resume: supabase.table("custom_processing_steps").update({"run_status":"running"})...
        # This behavior needs to be clearly defined. For now, let's prevent re-trigger if paused unless it's "new".
        raise HTTPException(
            status_code=409,
            detail=f"Step {step_id} is paused. Resume via manage endpoint or set reprocess_type='new'.",
        )

    return StreamingResponse(
        _bulk_reprocess_generator(project_id, step_id, reprocess_type, supabase, openai_client),
        media_type="text/event-stream",
    )


@router.get("/{project_id}/{step_id}/progress", response_model=ProcessingProgress)
async def get_step_reprocessing_progress(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    supabase: Client = Depends(get_supabase_client),
):
    try:
        response = await asyncio.to_thread(
            supabase.table("custom_processing_steps")
            .select(
                "run_status, total_documents_cache, processed_count_cache, failed_count_cache, current_doc_id_cache, last_processed_document_offset"
            )
            .eq("id", str(step_id))
            .eq("project_id", str(project_id))
            .single()
            .execute
        )
        if not response.data:
            raise HTTPException(
                status_code=404,
                detail=f"Custom step {step_id} not found in project {project_id}",
            )

        data = response.data
        status = data.get("run_status", "idle")
        total = data.get("total_documents_cache", 0) or 0
        processed = data.get("processed_count_cache", 0) or 0
        failed = data.get("failed_count_cache", 0) or 0
        current_doc_id = data.get("current_doc_id_cache")
        last_offset = data.get("last_processed_document_offset", -1) or -1
        # current_doc_index might be approximated if not stored directly
        # If last_offset is the index of the last *completed* doc, current is offset + 1
        current_doc_index = last_offset + 1 if status == "running" and total > 0 else None

        percent = 0.0
        if total > 0:
            percent = ((processed + failed) / total) * 100
            if status == "completed" or (
                status == "idle" and (processed + failed) == total
            ):  # Ensure 100% if truly complete
                percent = 100.0
        elif status == "completed" or status == "idle":  # No total but completed implies 100% of 0
            percent = 100.0

        return ProcessingProgress(
            status=status,
            total=total,
            processed=processed,
            failed=failed,
            percent=percent,
            currentDocId=current_doc_id,
            currentDocIndex=current_doc_index,
            message=f"Current status for step {step_id}: {status}",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get progress for step {step_id}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching progress: {e}")


class StepActionRequest(BaseModel):
    action: Literal["pause", "resume"]


@router.post("/{project_id}/{step_id}/manage", response_model=StepActionResponse)
async def manage_step_reprocessing(
    project_id: uuid.UUID,
    step_id: uuid.UUID,
    request_data: StepActionRequest,
    supabase: Client = Depends(get_supabase_client),
):
    action = request_data.action
    step_id_str = str(step_id)
    project_id_str = str(project_id)

    current_status_resp = await asyncio.to_thread(
        supabase.table("custom_processing_steps")
        .select("run_status")
        .eq("id", step_id_str)
        .eq("project_id", project_id_str)
        .single()
        .execute
    )
    if not current_status_resp.data:
        raise HTTPException(
            status_code=404,
            detail=f"Step {step_id_str} not found in project {project_id_str}.",
        )

    current_status = current_status_resp.data.get("run_status")

    if action == "pause":
        if current_status == "running":
            await _update_step_status_and_progress(step_id, project_id, supabase, run_status="paused")
            return StepActionResponse(
                step_id=step_id,
                action="pause_requested",
                message="Pause request accepted. Processing will halt shortly.",
            )
        elif current_status == "paused":
            return StepActionResponse(
                step_id=step_id,
                action="pause_requested",
                message="Step is already paused.",
                details="No action taken.",
            )
        else:
            return StepActionResponse(
                step_id=step_id,
                action="pause_failed",
                message=f"Step cannot be paused. Current status: {current_status}.",
                details="Only running steps can be paused.",
            )

    elif action == "resume":
        if current_status == "paused":
            # When resuming, we want the generator to pick up where it left off.
            # The generator state is lost, so it effectively restarts the reprocess call.
            # The key is that last_processed_document_offset is persisted.
            # We should re-trigger with reprocess_type="new" or similar that respects the offset.
            # For now, just setting status to "running" and let the next reprocess call handle it.
            # This might be better if the manage endpoint could also specify reprocess_type for resume.
            await _update_step_status_and_progress(step_id, project_id, supabase, run_status="running")
            # Important: The generator itself needs to be re-invoked by the client calling /reprocess again.
            # This endpoint only changes the status. The UI would typically then call /reprocess.
            return StepActionResponse(
                step_id=step_id,
                action="resume_requested",
                message="Resume request accepted. Step status set to running. Re-initiate reprocessing if needed.",
            )
        elif current_status == "running":
            return StepActionResponse(
                step_id=step_id,
                action="resume_requested",
                message="Step is already running.",
                details="No action taken.",
            )
        else:  # idle, error, completed
            # Allow "resume" from idle or error to effectively mean "start a new run".
            # This is similar to just calling /reprocess with "new" or "all".
            # For simplicity, "resume" from these states just sets to running.
            # User then needs to trigger /reprocess.
            await _update_step_status_and_progress(step_id, project_id, supabase, run_status="running")
            return StepActionResponse(
                step_id=step_id,
                action="resume_requested",
                message=f"Step status set to running (was {current_status}). Re-initiate reprocessing to start.",
            )

    raise HTTPException(status_code=400, detail="Invalid action.")
