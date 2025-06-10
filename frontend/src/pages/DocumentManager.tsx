import React, { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button"; // Ensure Button is imported
import { supabase } from "utils/supabaseConfig";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Loader2, RefreshCcw } from "lucide-react"; // Add Settings icon, Add RefreshCcw
import { Badge } from "@/components/ui/badge"; // Import Badge
import brain from "brain";
import { toast } from "sonner";
import { FilterControls } from "components/FilterControls";
import { DocumentTable } from "components/DocumentTable";
import { useFilterStore } from "utils/filterStore"; // Import the filter store
import { useProjectStore } from "utils/projectStore"; // Import the project store


// Define props for DocumentManager
interface DocumentManagerProps {
  onViewDetails: (documentId: string) => void;
}

// Interface for the document data
interface Document {
  id: string;
  file_name: string;
  status: "uploaded" | "processing" | "processed" | "error";
  ai_analysis_error: string | null;
  created_at: string;
  processed_at: string | null;
}

export const DocumentManager = memo(function DocumentManager({ onViewDetails }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReprocessingAll, setIsReprocessingAll] = useState(false); // Add state for button
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
    new Set()
  );

  // Get filters and actions from Zustand store
  const {
    searchTerm,
    statusFilter,
    sentimentFilter,
    complexityFilter,
    topicFilter,
    setSearchTerm,
    setStatusFilter,
    clearAllFilters
  } = useFilterStore();

  // Get current project ID and loading state from project store
  const { currentProjectId, isLoading: projectsLoading } = useProjectStore(
    (state) => ({ currentProjectId: state.currentProjectId, isLoading: state.isLoading })
  );
  console.log(`DocumentManager render - currentProjectId: ${currentProjectId}, projectsLoading: ${projectsLoading}`); // DEBUG LOG

  // --- Fetch Documents ---
  const fetchDocuments = useCallback(async () => {
    // Wait until projects are loaded and one is selected
    if (projectsLoading) {
      console.log("Project store is loading, skipping document fetch.");
      // We might want to keep the current documents or clear them
      // setDocuments([]); // Option: Clear documents while projects load
      setLoading(true); // Keep outer loading true if projects are loading
      return;
    }
    if (!currentProjectId) {
      console.log("No project selected, clearing documents.");
      setDocuments([]); // Clear documents if no project is selected
      setError(null); // Clear any previous errors
      setLoading(false); // Not technically loading if no project
      return; // Exit early
    }

    console.log(`Fetching documents for project ID: ${currentProjectId}`);
    // Use setLoading for the main fetch operation
    setLoading(true);
    setIsRefreshing(true); // Also set refreshing state
    setError(null);
    try {
      // Call the brain API endpoint
      const response = await brain.list_documents({ project_id: currentProjectId });

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) {
            // Ignore if response body is not JSON or empty
            console.error("Could not parse error response JSON:", jsonError);
        }
        throw new Error(errorDetail);
      }

      const data = await response.json(); // Type should be ListDocumentsResponse from types.ts

      console.log("Raw documents from API:", data.documents); // DEBUG: Log raw documents
      console.log("Fetched documents data from API:", data.documents);
      // Apply client-side filtering (searchTerm, statusFilter, etc.) if needed
      // TODO: Implement filtering based on store values
      const filteredDocs = (data.documents || []).filter(doc => {
        // Status Filter (already handled by server? Double-check)
        if (statusFilter !== "all" && doc.status !== statusFilter) return false;
        // Search Term Filter (simple file name search)
        if (searchTerm && !doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        // TODO: Add filtering for sentiment, complexity, topic if needed
        return true;
      });
      setDocuments(filteredDocs);
    } catch (err: any) {
      console.error("Error fetching documents:", err);
      setError(`Failed to fetch documents: ${err.message}`);
      setDocuments([]); // Clear documents on error
    } finally {
      setIsRefreshing(false);
      setLoading(false); // Stop loading after fetch completes (success or error)
    }
  }, [
    currentProjectId,
    projectsLoading, // Add projectsLoading dependency
    statusFilter,
    searchTerm,
    // We remove other filters as dependencies for now, assuming fetch gets all
    // and filtering happens client-side based on latest store values
    // sentimentFilter,
    // complexityFilter,
    // topicFilter,
  ]);

  // Callback to clear filters - Use Zustand action
  const handleClearFilters = useCallback(() => {
    clearAllFilters();
  }, [clearAllFilters]);

  // Handler for Reprocess All button
  const handleReprocessAll = () => { 
    if (!currentProjectId) {
      toast.error("No project selected. Please select a project to reprocess.");
      return;
    }
    setIsReprocessingAll(true);
    console.log(`Triggering bulk basic reprocessing for project ID: ${currentProjectId}`);

    toast.promise(
      brain.trigger_bulk_basic_reprocessing({ project_id: currentProjectId }), 
      {
        loading: "Starting bulk basic reprocessing for all documents in this project...",
        success: (response) => {
          if (!response.ok) {
             return response.json().then(errData => {
               throw new Error(errData.detail || `HTTP error! status: ${response.status}`);
             }).catch(() => {
               throw new Error(`HTTP error! status: ${response.status}`);
             });
          }
          return response.json().then(data => {
            return data.message || "Bulk basic reprocessing started successfully.";
          });
        },
        error: (err) => {
          console.error("Error triggering bulk basic reprocessing:", err);
          return `Error starting bulk basic reprocessing: ${err.message || 'Unknown error'}`;
        },
        finally: () => {
          setIsReprocessingAll(false); 
        }
      }
    );
  };

  // Effect to fetch documents when projects finish loading or selection/filters change
  useEffect(() => {
    console.log(`Effect triggered: Fetching documents. Projects loading: ${projectsLoading}, Project ID: ${currentProjectId}`);
    // Only fetch if projects are NOT loading and a project IS selected
    if (!projectsLoading && currentProjectId) {
      fetchDocuments();
    }
    // If projects finished loading but no project is selected, we might want
    // to ensure the document list is empty (handled within fetchDocuments)
    else if (!projectsLoading && !currentProjectId) {
        console.log("Projects loaded but none selected, ensuring docs are clear.")
        setDocuments([]);
        setLoading(false);
    }
  }, [
    projectsLoading, // Run when loading state changes
    currentProjectId, // Run when selected project changes
    fetchDocuments, // Run when filters used by fetchDocuments change
  ]);


  // Helper to format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Invalid Date";
    }
  };

  // Handle selecting/deselecting a single document
  const handleSelectDocument = (docId: string, isSelected: boolean) => {
    setSelectedDocuments((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (isSelected) {
        newSelected.add(docId);
      } else {
        newSelected.delete(docId);
      }
      return newSelected;
    });
  };

  // Handle selecting/deselecting all documents
  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allIds = new Set(documents.map((doc) => doc.id));
      setSelectedDocuments(allIds);
    } else {
      setSelectedDocuments(new Set());
    }
  };

  // Check if all documents are selected
  const isAllSelected =
    documents.length > 0 && selectedDocuments.size === documents.length;

  // Helper to determine badge variant based on status
  const getStatusBadgeVariant = (
    status: Document["status"]
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "processed":
        return "default";
      case "processing":
        return "secondary";
      case "error":
        return "destructive";
      case "uploaded":
        return "outline";
      default:
        return "secondary";
    }
  };


  // --- Render Logic ---

  // Show loading indicator only during the initial loading phase
  if (loading && documents.length === 0 && !error) {
     return (
       <div className="flex items-center justify-center h-32">
         <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
         <span className="ml-2 text-muted-foreground">Loading documents...</span>
       </div>
     );
   }


  // Otherwise, render the table and controls
  return (
    <div id="document-manager-container">
      <h2 className="text-2xl font-semibold mb-4">Document Manager</h2>

      {error && !loading && ( // Show error only if not loading
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Display Active Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(sentimentFilter || complexityFilter || topicFilter) && (
           <span className="text-sm font-medium text-muted-foreground">Active Filters:</span>
        )}
        {sentimentFilter && (
          <Badge variant="secondary">Sentiment: {sentimentFilter}</Badge>
        )}
        {complexityFilter && (
          <Badge variant="secondary">Complexity: {complexityFilter}</Badge>
        )}
        {topicFilter && (
          <Badge variant="secondary">Topic: {topicFilter}</Badge>
        )}
      </div>

      <FilterControls
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        sentimentFilter={sentimentFilter} // Pass sentiment filter
        complexityFilter={complexityFilter} // Pass complexity filter
        topicFilter={topicFilter} // Pass topic filter
        onSearchChange={setSearchTerm}
        onStatusChange={setStatusFilter}
        onClearFilters={handleClearFilters}
        // removed reprocessing props
      />
      
      {/* Reprocess All Button */}
      <div className="my-4">
        <Button 
          onClick={handleReprocessAll}
          disabled={isReprocessingAll}
          variant="destructive"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${isReprocessingAll ? 'animate-spin' : ''}`} />
          {isReprocessingAll ? "Reprocessing..." : "Reprocess All Documents"}
        </Button>
      </div>

      <DocumentTable
        documents={documents}
        // loading={isRefreshing} // Use isRefreshing for table's internal loading state if needed
        loading={loading} // Pass main loading state
        error={null} // Main error is handled above
        selectedDocuments={selectedDocuments}
        isAllSelected={isAllSelected}
        onSelectDocument={handleSelectDocument}
        onSelectAll={handleSelectAll}
        getStatusBadgeVariant={getStatusBadgeVariant}
        formatDate={formatDate}
        isRefreshing={isRefreshing} // Pass isRefreshing for potential visual feedback
        onRowClick={onViewDetails} // Pass the onViewDetails prop down
        />
    </div>
  );
});