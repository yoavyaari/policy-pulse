# src/app/apis/processing_steps/__init__.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional # Added Optional
import databutton as db
from supabase import create_client, Client
from postgrest.exceptions import APIError # Added APIError import
import logging # Keep logging import, even if not used actively, for consistency if enabled later
from datetime import datetime

# Configure logging
# Using print for Databutton compatibility instead of logging module
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

router = APIRouter(prefix="/processing-steps", tags=["Processing Steps"])

def get_supabase_client() -> Client:
    """Dependency to get Supabase client."""
    url = db.secrets.get("SUPABASE_URL")
    key = db.secrets.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase URL or Service Role Key secret not set.")
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    try:
        return create_client(url, key)
    except Exception as e:
        print(f"[ERROR] Failed to create Supabase client: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to database")

# --- Pydantic Models ---

class CustomStepBase(BaseModel):
    name: str
    description: Optional[str] = None # Made description optional

class CustomStepCreateRequest(CustomStepBase):
    pass

class CustomStepUpdateRequest(CustomStepBase):
    pass # For now, same fields as create, but separate model for clarity

class CustomStepResponse(CustomStepBase):
    id: str # UUID stored as string
    created_at: datetime

class ListCustomStepsResponse(BaseModel):
    steps: List[CustomStepResponse]

# --- API Endpoints ---

@router.put("/{step_id}", response_model=CustomStepResponse)
def legacy_update_custom_step(
    step_id: str, # Changed from UUID to str for simplicity
    request: CustomStepUpdateRequest,
    supabase: Client = Depends(get_supabase_client),
):
    """Updates an existing custom processing step."""
    print(f"Received request to update step ID: {step_id} with data: {request.model_dump()}")
    try:
        response = supabase.table('custom_processing_steps') \
            .update({'name': request.name, 'description': request.description}) \
            .eq('id', step_id) \
            .execute()

        # Check if the update operation resulted in any changed rows.
        # response.data contains a list of the updated records.
        # If no record matched step_id, response.data will be an empty list.
        if not response.data:
            print(f"[WARN] No step found with ID {step_id} to update, or update had no effect.")
            raise HTTPException(status_code=404, detail=f"Step with ID {step_id} not found or no changes made.")

        # Assuming ID is unique, one record should have been updated.
        updated_item_data = response.data[0]
        print(f"Successfully updated step ID: {updated_item_data.get('id')}")

        # Pydantic will handle the conversion of fields like 'created_at' (ISO string to datetime)
        return CustomStepResponse(**updated_item_data)

    except APIError as e: # Catch specific PostgREST errors first
        print(f"[ERROR] APIError updating step {step_id}: Code: {e.code}, Message: {e.message}, Details: {e.details}, Hint: {e.hint}")
        if e.code == '23505':  # PostgreSQL unique_violation error code for duplicate name
            # Attempt to extract the conflicting name if possible from details or message for a better error for the user
            detail_msg = f"Another processing step with the name '{request.name}' already exists."
            # Example parsing, might need adjustment based on actual e.details format for unique constraint
            # if "Key (name)=({request.name}) already exists" in str(e.details):
            #     pass # Already using request.name which is the conflicting one
            raise HTTPException(status_code=409, detail=detail_msg)
        # Add other specific APIError code handling here if needed
        raise HTTPException(status_code=500, detail=f"Database error during update: {e.message or 'Unknown database error'}")
    except HTTPException as http_exc: # Re-raise already formed HTTPExceptions
        print(f"[INFO] Re-raising HTTPException for step {step_id}: {http_exc.detail}")
        raise http_exc
    except Exception as e: # Catch any other unexpected errors
        print(f"[ERROR] Unexpected error updating step {step_id}: {type(e).__name__} - {str(e)}")
        # traceback.print_exc() # Consider adding for more detailed logs in Databutton if print doesn't capture enough
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while updating the step: {str(e)}")


@router.delete("/{step_id}", status_code=204) # 204 No Content on successful deletion
def legacy_delete_custom_step(
    step_id: str, # Changed from UUID to str
    supabase: Client = Depends(get_supabase_client),
):
    """Deletes a custom processing step."""
    print(f"Received request to delete step ID: {step_id}")
    try:
        # Delete data from the table
        data, count = supabase.table('custom_processing_steps') \
            .delete() \
            .eq('id', step_id) \
            .execute()

        # Check if any row was deleted (data[1] should be the list of deleted items)
        if not data or not isinstance(data, tuple) or len(data) < 2 or not data[1]:
            print(f"[WARN] No step found with ID {step_id} to delete.")
            raise HTTPException(status_code=404, detail=f"Step with ID {step_id} not found")

        print(f"Successfully deleted step ID: {step_id}")
        # No response body needed for 204

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"[ERROR] Error deleting step {step_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while deleting the step: {e}")



@router.post("", response_model=CustomStepResponse)
def legacy_create_custom_step(
    request: CustomStepCreateRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """Creates a new custom processing step."""
    print(f"Received request to create custom step: {request.name}")
    try:
        # Insert data into the table
        data, count = supabase.table('custom_processing_steps') \
            .insert({'name': request.name, 'description': request.description}) \
            .execute()

        # Check response type and content more carefully
        if not data or not isinstance(data, tuple) or len(data) < 2 or not data[1]:
             print(f"[ERROR] Supabase insert returned unexpected data structure or empty list: {data}")
             raise HTTPException(status_code=500, detail="Failed to create step, unexpected database response")

        inserted_data = data[1][0] # Get the first element of the second item in the tuple
        print(f"Successfully inserted step ID: {inserted_data.get('id')}")

        # Convert to Pydantic model, handle potential missing keys gracefully
        response_data = CustomStepResponse(
            id=str(inserted_data.get('id', 'Unknown ID')), # Ensure ID is string
            created_at=inserted_data.get('created_at', datetime.now()), # Provide default if missing
            name=inserted_data.get('name', request.name),
            description=inserted_data.get('description', request.description)
        )
        return response_data

    except HTTPException as http_exc: # Re-raise known HTTP exceptions
        raise http_exc
    except Exception as e:
        # Check if it's a unique constraint violation (specific error code for PostgreSQL)
        if hasattr(e, 'code') and e.code == '23505': # PostgreSQL unique violation code
             print(f"[WARN] Attempted to create duplicate step name: {request.name}")
             raise HTTPException(status_code=409, detail=f"A processing step with the name '{request.name}' already exists.")
        else:
             print(f"[ERROR] Error creating custom step '{request.name}': {e}")
             # Consider inspecting the exception type and message for more specific errors
             raise HTTPException(status_code=500, detail=f"An unexpected error occurred while creating the step: {e}")

@router.get("", response_model=ListCustomStepsResponse)
def legacy_list_custom_steps(
    supabase: Client = Depends(get_supabase_client)
):
    """Retrieves all custom processing steps."""
    print("Received request to list custom steps")
    try:
        data, count = supabase.table('custom_processing_steps') \
            .select('id, created_at, name, description') \
            .order('created_at', desc=False) \
            .execute()

        # Check response structure
        if not data or not isinstance(data, tuple) or len(data) < 2:
            print(f"[ERROR] Supabase select returned unexpected data structure: {data}")
            raise HTTPException(status_code=500, detail="Failed to retrieve steps, unexpected database response")

        steps_data = data[1] # Get the list of steps
        print(f"Retrieved {len(steps_data)} steps from database")

        # Convert list of dicts to list of Pydantic models
        steps = [CustomStepResponse(**step) for step in steps_data]
        return ListCustomStepsResponse(steps=steps)

    except HTTPException as http_exc: # Re-raise known HTTP exceptions
        raise http_exc
    except Exception as e:
        print(f"[ERROR] Error listing custom steps: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while retrieving steps: {e}")
