# src/app/apis/analytics/__init__.py
import databutton as db
from fastapi import APIRouter, HTTPException, Depends, Query # Import Query
from pydantic import BaseModel, Field
from supabase.client import Client, create_client
from typing import List, Dict, Any, Optional # Import Optional
import uuid # Added for project_id type hint
from collections import Counter

# --- Supabase Client Dependency ---
# (Keep the get_supabase_client function as is)
def get_supabase_client() -> Client:
    """Initializes and returns a Supabase client.
    Raises HTTPException if secrets are missing or client creation fails.
    """
    try:
        supabase_url: str = db.secrets.get("SUPABASE_URL")
        supabase_key: str = db.secrets.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
            print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret not found.")
            raise HTTPException(status_code=500, detail="Server configuration error: Supabase secrets missing.")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        return supabase
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        raise HTTPException(status_code=500, detail=f"Server configuration error: Could not connect to Supabase: {e}")

router = APIRouter()

# --- Pydantic Models ---
# (Keep the Pydantic models as is)
class TopicCount(BaseModel):
    topic_name: str
    count: int

class AnalyticsSummaryResponse(BaseModel):
    total_documents: int
    sentiment_distribution: Dict[str, int] = Field(default_factory=dict)
    complexity_distribution: Dict[str, int] = Field(default_factory=dict)
    top_topics: List[TopicCount] = Field(default_factory=list)
    error: str | None = None

# --- API Endpoint ---
@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    supabase: Client = Depends(get_supabase_client),
    project_id: uuid.UUID | None = Query(None, description="Filter analytics by project ID"), # ADDED
    sentiment_filter: Optional[str] = Query(None),
    complexity_filter: Optional[str] = Query(None),
    topic_filter: Optional[str] = Query(None)
) -> AnalyticsSummaryResponse:
    """Fetches aggregated analytics data, applying filters if provided."""
    print(f"Fetching analytics summary data with project_id: '{project_id}', filters: sentiment='{sentiment_filter}', complexity='{complexity_filter}', topic='{topic_filter}'")
    
    sentiment_dist = Counter()
    complexity_dist = Counter()
    topic_counts = Counter()
    total_docs = 0
    filtered_doc_ids = []
    
    try:
        # --- Filtering Logic ---
        document_ids_from_topic_filter = None
        if topic_filter:
            # 1. Find document IDs matching the topic filter (case-insensitive)
            topic_query = supabase.table('document_topics')\
                .select('document_id')\
                .ilike('topic_name', f'%{topic_filter.strip()}%') # Case-insensitive partial match
                
            topic_response = topic_query.execute()
            
            if topic_response.data:
                document_ids_from_topic_filter = list(set([item['document_id'] for item in topic_response.data]))
                if not document_ids_from_topic_filter:
                     print(f"No documents found for topic filter: '{topic_filter}'")
                     # Return empty results if topic filter matches nothing
                     return AnalyticsSummaryResponse(total_documents=0)
            else:
                 print(f"No documents found for topic filter: '{topic_filter}'")
                 return AnalyticsSummaryResponse(total_documents=0)

        # --- Document Query Construction ---
        # Fetch 'analysis' field instead of 'complexity'
        documents_query = supabase.table('documents')\
            .select('id, overall_sentiment, analysis', count='exact')\
            .eq('status', 'processed') # Always filter by processed status

        if project_id:
            documents_query = documents_query.eq('project_id', str(project_id))

        # Apply filters conditionally
        if sentiment_filter:
            documents_query = documents_query.eq('overall_sentiment', sentiment_filter.strip().lower())
        if complexity_filter:
            # Filter based on the 'complexity_level' within the 'analysis' JSON field
            documents_query = documents_query.eq('analysis->>complexity_level', complexity_filter.strip())
        # Apply topic filter (if any results were found)
        if document_ids_from_topic_filter is not None:
             # Ensure we only query for IDs if the topic filter yielded results
             if document_ids_from_topic_filter:
                 documents_query = documents_query.in_('id', document_ids_from_topic_filter)
             else:
                 # If topic filter resulted in empty list, no documents match all criteria
                 print("Topic filter resulted in no matching document IDs.")
                 return AnalyticsSummaryResponse(total_documents=0)

        # --- Execute Document Query ---
        documents_response = documents_query.execute()

        if documents_response.data:
            documents = documents_response.data
            total_docs = documents_response.count if documents_response.count is not None else len(documents)
            filtered_doc_ids = [doc['id'] for doc in documents] # Get IDs of filtered docs
            print(f"Processing {len(documents)} filtered documents (total matching count: {total_docs}) for analytics.")
            
            # Calculate distributions based on FILTERED documents
            for doc in documents:
                # Sentiment
                sentiment = doc.get('overall_sentiment')
                if sentiment:
                    sentiment_dist[str(sentiment).strip().lower()] += 1
                else:
                    sentiment_dist['unknown'] += 1
                
                # Complexity from analysis field
                analysis_data = doc.get('analysis')
                complexity = None
                if isinstance(analysis_data, dict):
                    complexity = analysis_data.get('complexity_level')
                    
                if complexity:
                    complexity_dist[str(complexity).strip()] += 1 
                else:
                    complexity_dist['unknown'] += 1
        else:
            # No documents matched the combined filters
            total_docs = documents_response.count if documents_response.count is not None else 0
            print("No documents found matching the specified filters.")
            return AnalyticsSummaryResponse(total_documents=0)

        # --- Topic Query Construction (based on filtered documents) ---
        if filtered_doc_ids:
             topics_query = supabase.table('document_topics')\
                 .select('topic_name')\
                 .in_('document_id', filtered_doc_ids) # Filter by the documents we actually found

             topics_response = topics_query.execute()
                 
             if topics_response.data:
                 print(f"Processing {len(topics_response.data)} topic entries from filtered documents.")
                 for topic_entry in topics_response.data:
                     topic_name = topic_entry.get('topic_name')
                     if topic_name:
                         normalized_topic = str(topic_name).strip().lower()
                         if normalized_topic:
                             topic_counts[normalized_topic] += 1
             else:
                 print("No topics found for the filtered documents.")
        else:
             # This case should ideally not happen if we returned earlier when documents_response.data was empty
             print("Skipping topic query as no documents matched filters (or filtered_doc_ids list is empty).")
             
        # --- Prepare Top Topics ---
        top_n = 10 # Limit to top 10 topics
        top_topics_list = [
            TopicCount(topic_name=name.capitalize(), count=count) 
            for name, count in topic_counts.most_common(top_n)
        ]
        print(f"Top topics identified for filtered data: {top_topics_list}")

        # --- Return successful response with filtered data ---
        return AnalyticsSummaryResponse(
            total_documents=total_docs,
            sentiment_distribution=dict(sentiment_dist),
            complexity_distribution=dict(complexity_dist),
            top_topics=top_topics_list
        )

    except Exception as e:
        error_msg = f"Failed to fetch analytics summary: {e}"
        print(f"Error: {error_msg}")
        # In case of error, return an error message, total_docs might be 0 or a partial count
        return AnalyticsSummaryResponse(error=error_msg, total_documents=total_docs)

