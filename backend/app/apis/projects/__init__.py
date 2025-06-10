# src/app/apis/projects/__init__.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, Path
from supabase.client import Client
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any # Added Dict, Any
from datetime import datetime
from postgrest.exceptions import APIError # ADDED

# Assuming get_supabase_client is defined elsewhere, e.g., in a shared dependencies file
# from app.dependencies import get_supabase_client 
# For now, let's assume it's in this file or accessible
from app.apis.documents.__init__ import get_supabase_client # Temporary, move to a central spot

# Imports for CSV Export
from fastapi.responses import StreamingResponse
import io
import csv
import json
import traceback


router = APIRouter()

# --- Helper function for flattening JSON ---
def flatten_json(data: Any, parent_key: str = '', sep: str = '_') -> Dict[str, Any]:
    items = {}
    if isinstance(data, dict):
        for k, v in data.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, (dict, list)):
                items.update(flatten_json(v, new_key, sep=sep))
            else:
                items[new_key] = v
    elif isinstance(data, list):
        # If the list contains dictionaries, flatten them with indexed keys
        # Otherwise, join list items into a string or handle as appropriate
        for i, item in enumerate(data):
            new_key = f"{parent_key}{sep}{i}" if parent_key else str(i)
            if isinstance(item, (dict, list)):
                items.update(flatten_json(item, new_key, sep=sep))
            else:
                items[new_key] = item
    else:
        # For non-dict/list items at the top level of a field (e.g. analysis itself is a string)
        # This case might need adjustment based on how `analysis` is structured if it's not always a dict.
        # If parent_key is provided, it means this is a terminal value from a nested structure.
        # If parent_key is not provided, it means the original data itself is a scalar.
        # For the purpose of this function, we assume it's called with a dict or list initially.
        # If `data` itself is a scalar and parent_key is empty, we could return {parent_key or 'value': data}
        # However, the main use case expects `data` to be a dict.
        if parent_key: # Only assign if it's part of a larger structure
             items[parent_key] = data
        # else: items['value'] = data # Or handle scalar data differently if needed at root

    return items


# --- Pydantic Models for Projects ---
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="The name of the project.")
    owner_user_id: str = Field(..., description="The ID of the user who owns the project.")

class CreateProjectRequest(ProjectBase):
    pass

class ProjectUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="The new name for the project.")

class ProjectResponse(ProjectBase):
    id: uuid.UUID
    created_at: datetime
    # user_id: Optional[str] = None # Temporarily removed

    class Config:
        from_attributes = True

class ListProjectsResponse(BaseModel):
    projects: List[ProjectResponse]


@router.get(
    "/projects/{project_id}/export-csv", 
    response_class=StreamingResponse,
    tags=["Projects", "stream"], # Added "stream" tag
    summary="Export Project Documents to CSV",
    description="""Exports all documents associated with a specific project to a CSV file. 
    The CSV includes standard document fields and flattens the \`custom_analysis_results\` JSON 
    into separate columns for each top-level key found across the documents."""
)
async def export_project_to_csv(
    project_id: uuid.UUID = Path(..., description="The ID of the project to export"),
    supabase: Client = Depends(get_supabase_client)
):
    """Generates and streams a CSV file of documents for the given project."""
    try:
        # 0. Fetch custom processing step names
        step_names_map = {}
        try:
            steps_response = supabase.table("custom_processing_steps").select("id, name").execute()
            if steps_response.data:
                for step in steps_response.data:
                    step_names_map[str(step['id'])] = step['name']
            # print(f"Fetched step names map: {step_names_map}") # Debugging
        except Exception as e_steps:
            print(f"Could not fetch custom processing step names: {e_steps}")
            # Decide if this is critical; for now, we'll proceed, and headers will use IDs if map is empty

        # 1. Fetch project documents, now including the 'analysis' field
        docs_response = (
            supabase.table("documents")
            .select("id, file_name, created_at, status, custom_analysis_results, analysis, project_id") # Added 'analysis'
            .eq("project_id", str(project_id))
            .execute()
        )

        if hasattr(docs_response, 'error') and docs_response.error:
            error_message = docs_response.error.message if hasattr(docs_response.error, 'message') else str(docs_response.error)
            print(f"Supabase error fetching documents for project {project_id}: {error_message}")
            raise HTTPException(status_code=500, detail=f"Supabase error fetching documents: {error_message}")
        
        documents = docs_response.data

        # 2. Determine CSV Headers
        standard_headers = ["document_id", "document_file_name", "created_at", "status"]
        # Dynamically collect all possible keys from analysis and custom_analysis_results
        analysis_field_keys = set()
        custom_results_field_keys = set()

        if documents:
            for doc in documents:
                # Process 'analysis' field
                if doc.get("analysis") and isinstance(doc["analysis"], dict):
                    flat_analysis = flatten_json(doc["analysis"], parent_key="analysis") # Prefix with 'analysis'
                    analysis_field_keys.update(flat_analysis.keys())
                
                # Process 'custom_analysis_results' field
                if doc.get("custom_analysis_results") and isinstance(doc["custom_analysis_results"], dict):
                    for step_id, step_data in doc["custom_analysis_results"].items():
                        step_name = step_names_map.get(step_id, step_id) # Use name if available, else ID
                        # Sanitize step_name to be a valid part of a header
                        safe_step_name = "".join(c if c.isalnum() else '_' for c in step_name)
                        if isinstance(step_data, dict):
                            flat_custom_step = flatten_json(step_data, parent_key=safe_step_name)
                            custom_results_field_keys.update(flat_custom_step.keys())
                        elif step_data is not None: # Handle cases where step_data might be a scalar
                            custom_results_field_keys.add(safe_step_name) # Add the step name itself as a key
        
        # Combine and sort headers
        sorted_analysis_keys = sorted(list(analysis_field_keys))
        sorted_custom_results_keys = sorted(list(custom_results_field_keys))
        
        all_headers = standard_headers + sorted_analysis_keys + sorted_custom_results_keys

        # 3. Prepare CSV Data in-memory
        string_io = io.StringIO()
        writer = csv.writer(string_io)
        writer.writerow(all_headers)

        if documents:
            for doc in documents:
                # Prepare data for the current row based on all_headers
                row_data = {}

                # Standard fields
                row_data["document_id"] = str(doc.get("id", ""))
                row_data["document_file_name"] = doc.get("file_name", "")
                row_data["created_at"] = str(doc.get("created_at", ""))
                row_data["status"] = doc.get("status", "")

                # Flattened 'analysis' field
                doc_analysis = doc.get("analysis")
                if doc_analysis and isinstance(doc_analysis, dict):
                    flat_analysis_data = flatten_json(doc_analysis, parent_key="analysis")
                    row_data.update(flat_analysis_data)
                
                # Flattened 'custom_analysis_results' field
                doc_custom_results = doc.get("custom_analysis_results")
                if doc_custom_results and isinstance(doc_custom_results, dict):
                    for step_id, step_data in doc_custom_results.items():
                        step_name = step_names_map.get(str(step_id), str(step_id)) # Ensure step_id is string for map lookup
                        safe_step_name = "".join(c if c.isalnum() else '_' for c in step_name)
                        
                        if isinstance(step_data, dict):
                            flat_custom_data = flatten_json(step_data, parent_key=safe_step_name)
                            row_data.update(flat_custom_data)
                        elif step_data is not None:
                            row_data[safe_step_name] = step_data # Store scalar value directly under sanitized step name
                
                # Construct the row in the order of all_headers
                current_row_values = []
                for header in all_headers:
                    value = row_data.get(header)
                    # Ensure consistent string representation, especially for None or complex types not fully flattened (shouldn't happen with current flatten_json)
                    if value is None:
                        current_row_values.append("")
                    elif isinstance(value, (dict, list)): # Fallback for any unflattened complex types
                        current_row_values.append(json.dumps(value))
                    else:
                        current_row_values.append(str(value))
                writer.writerow(current_row_values)
        
        
        # 4. Return CSV Response
        string_io.seek(0)
        project_name_cleaned = str(project_id) 
        try:
            project_info_resp = supabase.table("projects").select("name").eq("id", str(project_id)).single().execute()
            if project_info_resp.data and project_info_resp.data.get("name"):
                temp_name = "".join(c if c.isalnum() or c in (' ', '_', '-') else '' for c in project_info_resp.data["name"]).strip().replace(' ', '_')
                if temp_name: 
                    project_name_cleaned = temp_name
        except Exception as e_proj_name:
            print(f"Could not fetch project name for CSV filename (project_id: {project_id}): {e_proj_name}. Using ID as fallback.")
            
        filename = f"{project_name_cleaned}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        response_content = string_io.getvalue()
        string_io.close()

        return StreamingResponse(
            iter([response_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException as http_exc:
        print(f"HTTPException in export_project_to_csv for project {project_id}: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Unexpected error in export_project_to_csv for project {project_id}: {type(e).__name__} - {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while exporting project to CSV: {str(e)}")


# --- API Endpoints ---

@router.post("/projects/", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_data: CreateProjectRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """
    Create a new project.
    """
    try:
        # TODO: Get user_id if projects are user-specific. For now, omitting user_id or making it nullable.
        # For instance, if using some auth dependency: user_id = current_user.id
        new_project_data = project_data.model_dump()
        # new_project_data["user_id"] = "some_user_id" # Example if user_id is needed
        
        response = supabase.table("projects").insert(new_project_data).execute()
        
        if response.data and len(response.data) > 0:
            created_project = response.data[0]
            # Ensure created_at is set if not auto-set by db, or fetch it if needed
            if 'created_at' not in created_project:
                 created_project['created_at'] = datetime.now() # Placeholder if not returned
            return ProjectResponse(**created_project)
        else:
            raise HTTPException(status_code=500, detail="Failed to create project in database.")
            
    except Exception as e:
        print(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/projects/", response_model=ListProjectsResponse)
async def list_projects(supabase: Client = Depends(get_supabase_client)):
    """
    Retrieve a list of all projects.
    """
    try:
        response = supabase.table("projects").select("id, name, created_at, owner_user_id").order("created_at", desc=True).execute()
        if response.data:
            # Validate data with Pydantic model
            projects = [ProjectResponse(**item) for item in response.data]
            return ListProjectsResponse(projects=projects)
        return ListProjectsResponse(projects=[])
    except Exception as e:
        print(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve projects: {str(e)}")


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project_name(
    project_id: uuid.UUID,
    project_update: ProjectUpdateRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """Updates the name of a specific project."""
    try:
        # Check if project exists by trying to select it - maybe_single returns data or None
        check_response = supabase.table("projects").select("id").eq("id", str(project_id)).maybe_single().execute()
        if check_response.data is None:
            print(f"Error updating project: Project with ID '{project_id}' not found.")
            raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found.")

        # Update the project name. execute() on update will raise APIError on failure.
        supabase.table("projects").update({"name": project_update.name}).eq("id", str(project_id)).execute()

        # Fetch the updated project details to return. single() raises an error if not found.
        updated_project_response = (
            supabase.table("projects")
            .select("id, name, created_at, owner_user_id")
            .eq("id", str(project_id))
            .single()
            .execute()
        )
        
        # If single() did not find the row (unexpected after successful update), it would have raised an APIError caught below.
        # So, if we are here, updated_project_response.data should exist.
        print(f"Project '{project_id}' updated successfully. New name: '{project_update.name}'")
        return ProjectResponse(**updated_project_response.data)

    except APIError as e:
        # Handle known PostgREST errors that imply a 404
        # PGRST116: "Searched for a single row to update, but 0 rows matched the filter"
        # PGRST204: "Searched for a single row, but 0 rows matched the filter" (for the .single() call)
        if e.code in ["PGRST116", "PGRST204"] or (hasattr(e, 'details') and isinstance(e.details, str) and "0 rows" in e.details.lower()):
             print(f"APIError (interpreted as 404) updating/fetching project '{project_id}': {e.message}")
             raise HTTPException(status_code=404, detail=f"Project with ID '{project_id}' not found or could not be updated.")
        
        error_message = f"Database error processing project '{project_id}': {e.message or str(e)}"
        print(f"APIError: {error_message} (Code: {e.code if hasattr(e, 'code') else 'N/A'}, Details: {e.details if hasattr(e, 'details') else 'N/A'})")
        raise HTTPException(status_code=500, detail=error_message)
    except HTTPException as http_exc: # Re-raise other HTTPExceptions directly
        raise http_exc
    except Exception as e:
        error_msg = f"An unexpected error occurred while updating project '{project_id}': {str(e)}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
