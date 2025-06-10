import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Pencil, Trash2, Settings, Loader2, AlertCircle, RefreshCw, Play, BarChartHorizontal, AlertTriangle, XCircle, HelpCircle, Pause } from "lucide-react"; // Added summary icons, HelpCircle, Pause

import { DefineCustomStepModal, AnalysisPipelineConfigInput } from "components/DefineCustomStepModal"; // Added AnalysisPipelineConfigInput
import brain from "brain";
import { CustomStepResponse, StepStatsResponse, StepResultsSummaryResponse } from "types"; // Added StepResultsSummaryResponse
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Added Dialog imports
import { Progress } from "@/components/ui/progress"; // Added Progress component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Added Tooltip
import { useProjectStore } from "utils/projectStore"; // Import project store
import { useProcessingStore, ProcessingProgress, initialProgressState } from "../utils/processingStore"; // Added initialProgressState, removed selectProgress // Added Zustand store imports
import { API_URL } from "app"; // Added API_URL
import StepSummaryDisplay from "components/StepSummaryDisplay"; // Added import for the new component (MYA-28)

// Interface for stats state including loading/error (Keep existing)
interface StepStatsState extends Partial<StepResultsSummaryResponse> { // Changed to StepResultsSummaryResponse
  isLoading: boolean;
  error: string | null;
}


const ProcessingManagement: React.FC = () => {
  const currentProjectId = useProjectStore((state) => state.currentProjectId); // Get current project ID
  console.log("[ProcessingManagement] Initial currentProjectId:", currentProjectId);

  // --- Existing State ---
  const [isSaving, setIsSaving] = useState(false);
  const [isDefineModalOpen, setIsDefineModalOpen] = useState(false);
  const [steps, setSteps] = useState<CustomStepResponse[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [stepToEdit, setStepToEdit] = useState<CustomStepResponse | null>(null);
  const [stats, setStats] = useState<Record<string, StepStatsState>>({});
  const [reprocessConfirmStep, setReprocessConfirmStep] = useState<{ id: string; name: string } | null>(null);
  const [stepToDeleteResults, setStepToDeleteResults] = useState<{ id: string; name: string } | null>(null);
  const [newRuleToConfirmRun, setNewRuleToConfirmRun] = useState<{ id: string; name: string } | null>(null);

  // --- State for Results Summary Modal (MYA-28) ---
  const [summaryModalState, setSummaryModalState] = useState<{
    isOpen: boolean;
    stepName: string | null;
    isLoading: boolean;
    data: StepResultsSummaryResponse | null; // Updated type (MYA-28)
    error: string | null;
  }>({ isOpen: false, stepName: null, isLoading: false, data: null, error: null });

  // --- Fetch all progress state once ---
  const allProgress = useProcessingStore((state) => state.progress);

  // --- Zustand Store Integration ---
  const {
    updateProgress,
    startProcessing,
    finishProcessing, // Keep finishProcessing if needed elsewhere, though current logic uses updateProgress
    setError: setStoreError,
    resetProgress,
    setStepRunStatus, // Added for pause/resume
  } = useProcessingStore();

  // --- Ref for EventSources ---
  const eventSourcesRef = useRef<Record<string, EventSource>>({});

  // --- EventSource Management Functions ---
  const closeEventSource = useCallback((stepId: string, reason?: "paused" | "completed" | "failed" | "manual") => {
    console.log(`[SSE_CLOSE_DEBUG] Attempting to close EventSource for step ${stepId}. Reason: ${reason || 'unknown'}. Current ref:`, eventSourcesRef.current[stepId]);
    if (eventSourcesRef.current[stepId]) {
      console.log(`[SSE_CLOSE_DEBUG] EventSource for step ${stepId} exists.readyState BEFORE close: ${eventSourcesRef.current[stepId].readyState}`);
      eventSourcesRef.current[stepId].close();
      console.log(`[SSE_CLOSE_DEBUG] eventSourcesRef.current[stepId].close() CALLED for step ${stepId}.`);
      delete eventSourcesRef.current[stepId];
      console.log(`[SSE_CLOSE_DEBUG] EventSource for step ${stepId} DELETED from eventSourcesRef.current.`);

      // MYA-94: Immediately update store to a non-active status when closing due to pause/completion/failure
      // This helps prevent the main useEffect from trying to reconnect based on a stale "running" status.
      const { steps, setStepRunStatus, updateProgress } = useProcessingStore.getState();
      const storeSteps = useProcessingStore.getState().steps;
      const currentStepState = storeSteps ? storeSteps[stepId] : undefined;

      if (currentStepState && currentStepState.runStatus !== "completed" && currentStepState.runStatus !== "failed_permanently" && currentStepState.runStatus !== "complete_with_errors") {
        let newStatus: StepRunStatus = "idle"; // Default to idle
        if (reason === "paused") newStatus = "paused";
        else if (reason === "completed") newStatus = "completed";
        else if (reason === "failed") newStatus = "failed_permanently"; // Or some other failed status
        
        console.log(`[SSE_CLOSE_STORE_UPDATE] Step ${stepId} current status: ${currentStepState.runStatus}. New status due to close (reason: ${reason}): ${newStatus}`);
        // Using updateProgress to ensure all relevant fields like effectiveRunStatus are also updated
        // Provide minimal progress data, focusing on the status change.
        updateProgress(stepId, {
          status: newStatus,
          percent: newStatus === "paused" || newStatus === "idle" ? currentStepState.progress : (newStatus === "completed" ? 100 : currentStepState.progress),
          // Keep other metrics as they are or reset if appropriate
          total: currentStepState.totalDocs, 
          processed: currentStepState.processedDocs,
          failed: currentStepState.failedDocs,
        });
      }
    } else {
      console.log(`[SSE_CLOSE_DEBUG] No EventSource found in ref for step ${stepId} to close.`);
    }
  }, []); // Removed dependencies as we use getState() for store access; // No dependencies needed

  // Declare fetchStepStats first - accepts stepId and stepName
  const fetchStepStats = useCallback(async (stepId: string, stepName: string) => {
    if (!currentProjectId) {
      console.warn("Skipping fetchStepStats - no project selected");
      // Optionally set stats to an empty/default state or show a message
      setStats((prev) => ({
        ...prev,
        [stepId]: { total_documents_analyzed: 0, summary_type: "empty", step_name: stepName, isLoading: false, error: "No project selected" },
      }));
      return;
    }
    setStats((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], step_name: stepName, isLoading: true, error: null }, // Store stepName
    }));
    try {
      console.log(`Fetching stats for step Name: ${stepName}, ID: ${stepId}, Project: ${currentProjectId}...`);
      // Calling get_step_results_summary with stepId and projectId
      const response = await brain.get_step_results_summary({ stepId, projectId: currentProjectId }); // Removed include_details
      const data: StepResultsSummaryResponse = await response.json();
      setStats((prev) => ({
        ...prev,
        [stepId]: { ...data, isLoading: false, error: null }, // Keyed by stepId
      }));
      // Removed verbose success log
    } catch (err) {
      console.error(`Error fetching stats for step ${stepId} (Name: ${stepName}):`, err);
      const errorMsg =
        err instanceof Error ? err.message : "An unknown error occurred";
      setStats((prev) => ({
        ...prev,
        [stepId]: {
          ...prev[stepId],
          step_name: stepName, // Ensure step_name is included in the error state object
          isLoading: false,
          error: `Failed to fetch stats: ${errorMsg}`,
        },
      }));
    }
  }, [currentProjectId]); // Add currentProjectId dependency


  const startEventSource = useCallback((stepId: string, stepName: string, reprocessType: "all" | "new" | "failed" | "pending") => {
    // MYA-94: Safety check for store access and pause state
    const stepsState = useProcessingStore.getState().steps;
    const currentStepStoreData = stepsState ? stepsState[stepId] : undefined;

    if (currentStepStoreData?.runStatus === "paused" || currentStepStoreData?.runStatus === "pausing") {
      console.warn(`[SSE_START_PREVENTED] Step ${stepId} (${stepName}) is already 'paused' in store. SSE connection aborted.`);
      return;
    }

    // Close existing connection for this stepId if any
    closeEventSource(stepId);

    if (!currentProjectId) {
      console.error("SSE: Cannot start event source, currentProjectId is missing.");
      toast.error(`Cannot start processing for "${stepName}": Project context is missing.`);
      return;
    }

    const url = `${API_URL}/api/custom-steps/${currentProjectId}/${stepId}/reprocess?reprocess_type=${reprocessType}`;
    console.log(`SSE: Attempting to connect to ${url} for step ${stepId} with reprocessType: ${reprocessType}`);
    toast.info(`Starting processing for "${stepName}"...`);

    const eventSource = new EventSource(url, { withCredentials: true });
    eventSourcesRef.current[stepId] = eventSource;

    eventSource.onopen = () => { // Added onopen handler
      console.log(`SSE: Connection OPENED for step ${stepId} to ${url}`);
    };

    eventSource.addEventListener('processing_paused', (event) => {
      try {
        const eventData = (event as MessageEvent).data as string;
        const data: ProcessingProgress = JSON.parse(eventData);
        console.log(`SSE: Received 'processing_paused' for ${stepId}:`, data);

        updateProgress(stepId, data); // Update progress with paused state metrics
        setStepRunStatus(stepId, 'paused'); // Explicitly set runStatus in store

        toast.info(`Processing for "${stepName}" is now paused.`);
      } catch (e) {
        const eventData = (event as MessageEvent).data;
        console.error(`SSE: Error parsing data for 'processing_paused' on step ${stepId}:`, e, eventData);
        // Potentially set a generic error or log, but avoid toast.error if it's just a brief pause feedback
      } finally {
        // Always close the event source when backend confirms paused state via SSE
        // This is important because the backend might stop sending updates, 
        // and we don't want a dangling connection.
        console.log(`SSE: 'processing_paused' received, closing connection for ${stepId}`);
        closeEventSource(stepId, "paused"); // Pass "paused" as the reason
        fetchStepStats(stepId, stepName); // Refresh stats to show persisted paused state
      }
    });

    // Listener for named "progress" events
    eventSource.addEventListener('progress', (event) => {
      try {
        const eventData = (event as MessageEvent).data as string;
        const data: ProcessingProgress = JSON.parse(eventData);
        // console.log(`SSE: Raw event data string for 'progress' on step ${stepId}:`, eventData);
        // console.log(`SSE: Parsed data for 'progress' on step ${stepId}:`, data);
        // console.log(
        //   `SSE_DATA_CHECK for ${stepId} (event: progress): total=${data.total}, percent=${data.percent}, processed=${data.processed}, failed=${data.failed}, currentDocIndex=${data.currentDocIndex}, status='${data.status}'`
        // );

        updateProgress(stepId, data);

        // Check for terminal statuses and close the event source
        const terminalStatuses: StepRunStatus[] = ["completed", "failed_permanently", "complete", "complete_with_errors"];
        if (data.status && terminalStatuses.includes(data.status)) {
          console.log(`SSE: 'progress' received terminal status (${data.status}), closing connection for ${stepId}`);
          closeEventSource(stepId, data.status as "completed" | "failed_permanently"); // Pass the status as reason
          fetchStepStats(stepId, stepName); // Refresh stats after completion/failure
        } else if (data.status === "paused") { // Also handle explicit pause from progress event
          console.log(`SSE: 'progress' received paused status, closing connection for ${stepId}`);
          closeEventSource(stepId, "paused");
          fetchStepStats(stepId, stepName);
        }

      } catch (e) {
        const eventData = (event as MessageEvent).data;
        console.error(`SSE: Error parsing data for 'progress' on step ${stepId}:`, e, eventData);
        setStoreError(stepId, "Error parsing progress update (progress).");
        // Do not close connection here, might be a single malformed message
      }
    });

    // Listener for named "processing_complete" events
    eventSource.addEventListener('processing_complete', (event) => {
      let reason: StepRunStatus = "completed"; // Default reason
      try {
        const eventData = (event as MessageEvent).data as string;
        const data: ProcessingProgress = JSON.parse(eventData);
        console.log(`SSE: Received 'processing_complete' for ${stepId}:`, data);
        reason = data.status === "complete_with_errors" ? "complete_with_errors" : "completed";

        updateProgress(stepId, data); // Ensure final state is updated

        if (data.status === 'complete') {
          toast.success(`Processing complete for "${stepName}". Processed: ${data.processed}, Failed: ${data.failed}.`);
        } else if (data.status === 'complete_with_errors') {
          toast.warning(`Processing complete for "${stepName}" with errors. Processed: ${data.processed}, Failed: ${data.failed}. Message: ${data.message || data.error || 'Check logs'}`);
        } else {
          toast.info(`Processing finished for "${stepName}". Status: ${data.status || 'unknown'}. Processed: ${data.processed || '-'}, Failed: ${data.failed || '-'}.`);
        }
      } catch (e) {
        const eventData = (event as MessageEvent).data;
        console.error(`SSE: Error parsing data for 'processing_complete' on step ${stepId}:`, e, eventData);
        setStoreError(stepId, "Error parsing final progress update.");
        toast.error(`Processing for "${stepName}" finished, but result data was unclear.`);
        reason = "failed"; // If parsing fails, consider it a failure for closure
      } finally {
        console.log(`SSE: 'processing_complete' received, closing connection for ${stepId} with reason: ${reason}`);
        closeEventSource(stepId, reason as "completed" | "complete_with_errors" | "failed");
        fetchStepStats(stepId, stepName);
      }
    });

    // Listener for named "processing_error" events from the backend stream
    eventSource.addEventListener('processing_error', (event) => {
      try {
        const eventData = (event as MessageEvent).data as string;
        const data: Partial<ProcessingProgress> = JSON.parse(eventData);
        console.error(`SSE: Received 'processing_error' for step ${stepId}:`, data);

        const errorMessage = data.error || (typeof data === 'string' ? data : "An unknown processing error occurred.");
        setStoreError(stepId, errorMessage);
        toast.error(`Processing failed for "${stepName}": ${errorMessage}`);
      } catch (e) {
        const eventData = (event as MessageEvent).data;
        console.error(`SSE: Error parsing data for 'processing_error' on step ${stepId} (or event data was not JSON):`, e, eventData);
        setStoreError(stepId, "A processing error occurred, and its details could not be parsed.");
        toast.error(`Processing failed for "${stepName}": Unreadable error details received.`);
      } finally {
        console.log(`SSE: 'processing_error' received, closing connection for ${stepId}`);
        closeEventSource(stepId, "failed_permanently"); 
        fetchStepStats(stepId, stepName);
      }
    });

    // General network/connection error for the EventSource itself (e.g. if the server goes down)
    eventSource.addEventListener('final_status', (event) => {
      let finalStatusReason: StepRunStatus | "failed" = "completed"; // Default reason
      try {
        const eventData = (event as MessageEvent).data as string;
        const data = JSON.parse(eventData) as { status: StepRunStatus, message?: string }; 
        console.log(`SSE: Received 'final_status' for ${stepId}:`, data);
        finalStatusReason = data.status || "completed";
        toast.info(`Processing for "${stepName}" officially finalized with status: ${finalStatusReason}.`);
        // Any other UI updates based on final_status data can go here
      } catch (e) {
        const eventData = (event as MessageEvent).data;
        console.error(`SSE: Error parsing data for 'final_status' on step ${stepId}:`, e, eventData);
        finalStatusReason = "failed"; // If parsing fails, assume a failure
        toast.warn(`Could not fully parse final status for "${stepName}", but processing stream ended.`);
      } finally {
        console.log(`SSE: 'final_status' received, closing connection for ${stepId} with reason: ${finalStatusReason}`);
        closeEventSource(stepId, finalStatusReason as "completed" | "failed_permanently" | "paused" | "complete_with_errors" | "failed");
        fetchStepStats(stepId, stepName); // Refresh stats one last time
      }
    });

    eventSource.onerror = (error) => {
      // This error is for the EventSource object itself, not for data parsing errors within messages.
      if (eventSourcesRef.current[stepId]) { // Check if connection still exists
        const currentStepRunStatus = useProcessingStore.getState().steps[stepId]?.runStatus;
        // If readyState is CLOSED, it means the connection was already closed, possibly intentionally.
        if (eventSourcesRef.current[stepId].readyState === EventSource.CLOSED) {
          console.log(`SSE: onerror called for ${stepId}, but readyState is CLOSED. Likely already handled.`);
          // Safeguard: if store status is not terminal, update it.
          if (currentStepRunStatus && !["completed", "failed_permanently", "paused", "complete_with_errors"].includes(currentStepRunStatus)) {
            console.warn(`SSE: onerror (CLOSED state) for ${stepId}: status was ${currentStepRunStatus}, setting to idle/manual via closeEventSource.`);
            closeEventSource(stepId, "manual"); 
          }
          return; 
        }
        // Only log and close if it's not already an error from the specific listeners above that closed it.
        console.error(`SSE: General Connection ERROR for step ${stepId} to ${url}:`, error);
        setStoreError(stepId, "Connection error during processing.");
        closeEventSource(stepId, "failed"); // Close connection on general error
        toast.error(`Processing connection critically failed for "${stepName}". Check console for details.`);
        fetchStepStats(stepId, stepName); // Refresh stats
      }
    };

  }, [closeEventSource, startProcessing, updateProgress, setStoreError, fetchStepStats, API_URL]); // Removed stats, Added API_URL dependency

  // --- Fetch Logic (fetchStepStats, fetchSteps) - Keep existing --- 
  const fetchSteps = useCallback(async () => {

    setIsLoadingSteps(true);
    setStepsError(null);
    setStats({});
    try {
      console.log("[ProcessingManagement] fetchSteps - currentProjectId:", currentProjectId);
      if (!currentProjectId) {
        console.warn("[ProcessingManagement] fetchSteps - No currentProjectId, skipping API call.");
        setSteps([]);
        setStats({});
        setIsLoadingSteps(false);
        return;
      }
      const response = await brain.list_custom_steps_for_project({ project_id: currentProjectId });
      console.log("[ProcessingManagement] fetchSteps - API response:", response);
      const data = await response.json();
      console.log("[ProcessingManagement] fetchSteps - API response data (JSON):", data);
      const fetchedSteps = Array.isArray(data) ? data : [];
      console.log("[ProcessingManagement] fetchSteps - fetchedSteps array:", fetchedSteps);
      setSteps(fetchedSteps);


      if (fetchedSteps.length > 0 && currentProjectId) { // Check for currentProjectId

        // Reset progress state for all fetched steps before fetching stats
        fetchedSteps.forEach(step => resetProgress(step.id));
        // Pass both id and name
        await Promise.all(fetchedSteps.map(step => fetchStepStats(step.id, step.name)));

      } else if (!currentProjectId) {
        console.warn("Skipping fetching stats for steps - no project selected.");
        // Clear stats if no project is selected
        setStats({});
      }

    } catch (err) {
      console.error("Error fetching custom steps:", err);
      const errorMsg =
        err instanceof Error ? err.message : "An unknown error occurred";
      setStepsError(`Failed to fetch processing steps: ${errorMsg}`);
      toast.error(`Error fetching steps: ${errorMsg}`);
    } finally {
      setIsLoadingSteps(false);
    }
  }, [fetchStepStats, resetProgress, currentProjectId]); // Added currentProjectId dependency

  // --- Results Summary Fetch (MYA-28) ---
  const handleShowSummary = useCallback(async (stepId: string, stepName: string) => { // Added stepId, kept stepName for modal title
    if (!currentProjectId) {
      toast.error("Please select a project first.");
      setSummaryModalState({ isOpen: false, stepName: null, isLoading: false, data: null, error: "No project selected" });
      return;
    }
    setSummaryModalState({ isOpen: true, stepName, isLoading: true, data: null, error: null });
    try {
      console.log(`Fetching summary for step ID: ${stepId} (Name: ${stepName}), Project: ${currentProjectId}`);
      // Pass stepId directly
      const response = await brain.get_step_results_summary({ stepId: stepId, projectId: currentProjectId }); // Removed include_details
      const summaryData = await response.json(); // Assuming the structure matches StepResultsSummaryResponse

      if (!response.ok || summaryData.error) {
        // Use the error from the response body if available
        throw new Error(summaryData.error || `Failed to fetch summary for step ${stepName}. Status: ${response.status}`);
      }

      console.log(`Summary fetched successfully for ${stepName}:`, summaryData);
      setSummaryModalState(prev => ({ ...prev, isLoading: false, data: summaryData }));

    } catch (err: any) {
      setStepRunStatus(stepId, originalStatus); // Revert on error
      console.error("Error fetching step summary:", err);
      const errorMessage = err.message || "An unknown error occurred while fetching the summary.";
      setSummaryModalState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      // Optionally show a toast, but the modal will show the error
      // toast.error(`Failed to load summary: ${errorMessage}`);
    }
  }, [currentProjectId]); // Added currentProjectId dependency

  // --- Effect for Fetching Steps ---
  useEffect(() => {
    if (currentProjectId) {
      console.log("[ProcessingManagement_FetchEffect] Project ID present, fetching steps:", currentProjectId);
      fetchSteps();
    } else {
      console.log("[ProcessingManagement_FetchEffect] No Project ID, clearing steps and event sources.");
      setSteps([]); // Clear local steps state
      Object.keys(eventSourcesRef.current).forEach(stepId => {
        closeEventSource(stepId, "manual"); // Clear existing event sources
      });
    }
  }, [currentProjectId, fetchSteps]); // fetchSteps is a useCallback, its stability is derived from its own dependencies (currentProjectId)

  // --- Effect for Managing SSE Connections ---
  useEffect(() => {
    console.log("[ProcessingManagement_SSE_Effect] Running. Number of local steps:", steps.length);
    steps.forEach(stepDefinition => {
      const stepId = stepDefinition.id;
      // Defensive name access, using 'name' first, then 'step_name' as a fallback
      const stepName = stepDefinition.name || stepDefinition.step_name || "Unknown Step"; 
      
      // Get the most current run status from the Zustand store
      const currentStoreState = useProcessingStore.getState();
      // MYA-94: Ensure currentStoreState.steps exists before trying to access a property on it
      const stepInStore = currentStoreState.steps ? currentStoreState.steps[stepId] : undefined;
      const runStatusInStore = stepInStore?.runStatus;

      // Active statuses that might require an SSE connection
      const activeStatuses: StepRunStatus[] = ["running", "pending_reprocessing", "starting"];
      // Terminal/Idle statuses where an SSE connection should NOT be active or be started
      // 'pausing' is included here to prevent reconnection attempts while a pause is being processed.
      const terminalOrIdleStatuses: StepRunStatus[] = ["completed", "failed_permanently", "idle", "paused", "pausing", "complete_with_errors"];

      if (runStatusInStore && activeStatuses.includes(runStatusInStore)) {
        if (!eventSourcesRef.current[stepId]) {
          console.log(`[SSE_Effect] Step ${stepName} (${stepId}) is '${runStatusInStore}' and no EventSource exists. Starting one.`);
          // Ensure last_reprocess_type is available on stepDefinition or stepInStore
          const reprocessType = stepInStore?.last_reprocess_type || stepDefinition.last_reprocess_type || "all";
          startEventSource(stepId, stepName, reprocessType);
        }
      } else if (runStatusInStore && terminalOrIdleStatuses.includes(runStatusInStore)) {
        if (eventSourcesRef.current[stepId]) {
          console.log(`[SSE_Effect] Step ${stepName} (${stepId}) is '${runStatusInStore}' and an EventSource exists. Closing it.`);
          closeEventSource(stepId, runStatusInStore as "paused" | "completed" | "failed"); // Pass appropriate reason
        }
      } else if (!runStatusInStore && eventSourcesRef.current[stepId]) {
        // If the step is not in the store (e.g., after deletion) but an SSE connection exists, clean it up.
         console.log(`[SSE_Effect] Step ${stepId} not in store but EventSource exists. Closing it.`);
         closeEventSource(stepId, "manual");
      }
    });

    // Cleanup function to close all event sources on component unmount
    return () => {
      console.log("[ProcessingManagement_SSE_Effect] Component unmounting. Cleaning up all event sources.");
      Object.keys(eventSourcesRef.current).forEach(stepId => {
        closeEventSource(stepId, "manual");
      });
    };
  }, [steps, startEventSource, closeEventSource]); // Depends on local 'steps' and stable SSE handlers

  // --- Modal Handlers (handleOpenDefineModal, handleCloseDefineModal) - Keep existing ---
  const handleOpenDefineModal = () => {
    setStepToEdit(null);
    setIsDefineModalOpen(true);
  };

  const handleCloseDefineModal = () => {
    setIsDefineModalOpen(false);
    setStepToEdit(null);
  };

  // --- Save Handler (Modified Confirmation Logic) ---
  const handleSaveCustomStep = async (
    name: string, 
    prompts: string[], // Changed from description to prompts
    processingMode: string, 
    analysisPipelineConfig: AnalysisPipelineConfigInput | null
  ) => {
    console.log(
      `Attempting to ${stepToEdit ? "update" : "save"} custom step via API:`,
      {
        id: stepToEdit?.id,
        name,
        prompts, // Changed from description
        processing_mode: processingMode, 
        analysis_pipeline_config: analysisPipelineConfig,
      },
    );
    const action = stepToEdit ? "update" : "create";
    const actionPresentTense = stepToEdit ? "updating" : "creating";
    
    const payload: any = {
      name,
      prompts, // Changed from description
      processing_mode: processingMode,
      analysis_pipeline_config: analysisPipelineConfig,
    };

    if (action === 'create' && currentProjectId) {
      payload.project_id = currentProjectId;
    }

    // Check for duplicate name if creating a new step
    if (!stepToEdit && currentProjectId) {
      try {
        const existingStepsResponse = await brain.list_custom_steps_for_project({ project_id: currentProjectId });
        const existingSteps = await existingStepsResponse.json();
        const isDuplicateName = existingSteps.some(
          (step) => step.name.toLowerCase() === payload.name.toLowerCase()
        );

        if (isDuplicateName) {
          toast.error("A custom step with this name already exists for this project. Please choose a different name.");
          setIsSaving(false); // Reset saving state
          return;
        }
      } catch (error) {
        console.error("Error checking for existing custom steps:", error);
        toast.error("Could not verify if step name is unique. Please try again.");
        setIsSaving(false); // Reset saving state
        return;
      }
    }

    const apiCall = stepToEdit
      ? brain.update_custom_step({ stepId: stepToEdit.id, projectId: currentProjectId }, payload)
      : brain.create_custom_step(payload);

    try {
      const response = await apiCall;
      const savedStep = await response.json();

      toast.success(
        `Custom step "${savedStep.name}" ${action}d successfully!`,
      );
      handleCloseDefineModal(); // Close the edit/create modal

      // --- MODIFICATION ---
      if (action === 'update' && stepToEdit) {
        // If update, ask to reprocess (will use startEventSource)
        setReprocessConfirmStep({ id: stepToEdit.id, name: savedStep.name });
        // Refresh stats after potential changes
        fetchStepStats(stepToEdit.id, savedStep.name); // Pass savedStep.name
        // Refresh list potentially? Depends if name changed etc. Let's refresh.
        fetchSteps();
      } else if (action === 'create') {
        // If create, refresh list FIRST, then ask to run (will use startEventSource)
        await fetchSteps(); // Wait for list refresh
        setNewRuleToConfirmRun({ id: savedStep.id, name: savedStep.name }); // Trigger confirmation
      }
      // --- END MODIFICATION ---
    } catch (error: any) {
      console.error(`[handleSaveCustomStep] RAW Error object for ${actionPresentTense} custom step:`, error);
      // Further detailed logging removed for brevity as core issue identified

      let errorMessage = `Failed to ${actionPresentTense} custom step. Please try again.`;
      const status = error.status || error.response?.status;

      if (status === 409) {
        console.warn(
          "[handleSaveCustomStep] Received 409 (Conflict). " +
          "The brain client does not easily expose the detailed server response body on the error object for this status code. " +
          "Showing a generic duplicate name error.",
        );
        errorMessage = "A custom step with this name already exists (either in this project or globally). Please choose a different name.";
      } else if (error.message && typeof error.message === 'string' && error.message.trim() !== "") {
        // Use error.message if it's available and not empty, for non-409 errors
        errorMessage = error.message;
      }
      // If it's not a 409, and error.message is empty, the default generic message will be used.

      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Edit/Delete Handlers (handleEditClick, handleDeleteClick, handleDeleteResultsClick, confirmDeleteResults, handleDeleteStepAndResults) - Keep existing, ensure they fetchSteps/fetchStats ---
  const handleEditClick = (step: CustomStepResponse) => {
    setStepToEdit(step);
    setIsDefineModalOpen(true);
  };

  const handleDeleteClick = async (stepId: string, stepName: string) => {
    // Make sure to close any running event source before deleting
    closeEventSource(stepId);
    resetProgress(stepId);
    console.log(`Attempting to delete step ID: ${stepId}`);
    try {
      await brain.delete_custom_step({ stepId: stepId });
      toast.success(`Custom step "${stepName}" deleted successfully!`);
      fetchSteps(); // Refresh the list
    } catch (err: any) {
      console.error(`Error deleting step ${stepId}:`, err);
      let errorDetail = "An unknown error occurred.";
      if (err && err.body && typeof err.body.detail === "string") {
        errorDetail = err.body.detail;
      } else if (err instanceof Error) {
        errorDetail = err.message;
      }
      toast.error(`Failed to delete step \"${stepName}\": ${errorDetail}`);
    }
  };

  const handleDeleteResultsClick = (stepId: string, stepName: string) => {
    setStepToDeleteResults({ id: stepId, name: stepName });
  };

  const confirmDeleteResults = async () => {
    if (!stepToDeleteResults || !currentProjectId) {
      toast.error("Cannot delete results: Missing step information or project context.");
      setStepToDeleteResults(null);
      return;
    }
    // Make sure to close any running event source before deleting results
    closeEventSource(stepToDeleteResults.id);
    // Do not reset progress here, the backend handles resetting the step's status & progress.

    const { id: stepId, name: stepName } = stepToDeleteResults;
    console.log(`Deleting results and resetting progress for step: ${stepName} (${stepId}) in project ${currentProjectId}`);
    toast.info(`Processing request to delete results for step "${stepName}"...`);

    try {
      // Use the new endpoint: deleteStepResultsAndResetProgress
      const response = await brain.delete_step_results_and_reset_progress({ projectId: currentProjectId, stepId });
      const data = await response.json(); // Assuming it returns a body like DeleteStepResultsResponse

      if (response.ok) {
        toast.success(data.message || `Results deleted and step "${stepName}" reset successfully.`);
        console.log(`[confirmDeleteResults] Success for step ${stepId}:`, data);
      } else {
        // If backend sends a specific error message in `detail` or `message`
        const errorMessage = data.detail || data.message || "Failed to delete results and reset step.";
        throw new Error(errorMessage);
      }
      
      fetchStepStats(stepId, stepName); // Refresh stats for this specific step
    } catch (err: any) {
      console.error(`Error deleting results/resetting step ${stepId}:`, err);
      // Prefer error message from caught error object if available, else use a generic one
      const errorDetail = err.message || (err.body?.detail) || "An unknown error occurred.";
      toast.error(`Failed to delete results for step "${stepName}": ${errorDetail}`);
    } finally {
      setStepToDeleteResults(null); // Close the dialog
    }
  };

  const handleDeleteStepAndResults = async (stepId: string, stepName: string) => {
    if (!currentProjectId) {
      toast.error("Cannot delete rule and results: Missing project context.");
      return;
    }
    // Make sure to close any running event source before deleting
    closeEventSource(stepId);
    // Backend handles resetting progress. Zustand progress state will be reset by fetchSteps -> resetProgress(step.id)

    console.log(`Attempting to delete rule AND results for ID: ${stepId} in project ${currentProjectId}`);
    toast.info(`Requesting deletion of results and rule for "${stepName}"...`);

    let stepResetSuccessfully = false;
    try {
      console.log(`Deleting results and resetting step progress first for rule: ${stepName}`);
      // Use the new endpoint: deleteStepResultsAndResetProgress
      const resultsResponse = await brain.delete_step_results_and_reset_progress({ projectId: currentProjectId, stepId });
      const resultsData = await resultsResponse.json();

      if (resultsResponse.ok && resultsData.step_reset) { // Check if step was reset
        stepResetSuccessfully = true;
        console.log(`Results cleared and step progress reset successfully for rule: ${stepName}. Message: ${resultsData.message}`);
        toast.info(`Results cleared and step "${stepName}" reset. Proceeding to delete rule definition...`);
      } else {
        // If step_reset is false, or response not ok, throw error to prevent deleting step definition
        const errorMessage = resultsData.detail || resultsData.message || `Failed to clear results or reset step "${stepName}". Rule definition not deleted.`;
        throw new Error(errorMessage);
      }
    } catch (resultsErr: any) {
      console.error(`Error deleting results/resetting step ${stepId} during combined delete:`, resultsErr);
      const errorDetail = resultsErr.message || (resultsErr.body?.detail) || "Unknown error during results deletion/step reset.";
      toast.error(`Operation failed for "${stepName}". Rule definition was not deleted. Error: ${errorDetail}`);
      fetchStepStats(stepId, stepName); // Refresh stats to show current state
      return;
    }

    if (stepResetSuccessfully) {
      try {
        console.log(`Proceeding to delete rule definition: ${stepName}`);
        // Ensure project_id is passed if API requires (delete_custom_step expects {stepId, projectId})
        await brain.delete_custom_step({ stepId: stepId, project_id: currentProjectId }); 
        toast.success(`Successfully deleted rule "${stepName}" and its associated data.`);
        fetchSteps(); // Refresh the list; this will also re-fetch stats and reset progress via its internal logic
      } catch (stepErr: any) {
        console.error(`Error deleting rule definition ${stepId} after clearing results:`, stepErr);
        const errorDetail = stepErr.message || (stepErr.body?.detail) || "Unknown error deleting rule definition.";
        // At this point, results are cleared and step is reset, but definition delete failed.
        // This is a partial success/failure.
        toast.error(`Results cleared and step "${stepName}" was reset, but failed to delete the rule definition. Error: ${errorDetail}`);
        fetchSteps(); // Refresh list anyway, as step might still exist but be reset
      }
    }
  };


  // --- Reprocessing Handlers (DISABLED - Backend endpoints missing) ---
  const handleReprocessAll = useCallback((stepId: string, stepName: string) => {
    if (!currentProjectId) {
      toast.error("Please select a project first.");
      return;
    }

    startEventSource(stepId, stepName, "all");
  }, [startEventSource, currentProjectId]); // Dependency on the memoized startEventSource

  const handleReprocessNew = useCallback((stepId: string, stepName: string) => {
    if (!currentProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    startEventSource(stepId, stepName, "new");
  }, [startEventSource, currentProjectId]);

  // --- Pause/Resume Handlers (MYA-63) ---
  const handlePauseProcessing = useCallback(async (stepId: string, stepName: string) => {
    if (!currentProjectId) {
      toast.error("No project selected. Cannot pause processing.");
      return;
    }
    const storeState = useProcessingStore.getState();
    const { steps, setStepRunStatus } = storeState;

    if (!steps || !steps[stepId]) {
      console.error(`[handlePauseProcessing] Step ${stepId} not found in store. Steps:`, steps);
      toast.error(`Cannot pause processing for "${stepName}": Step details not found. Please refresh.`);
      return;
    }
    const originalStatus = steps[stepId]?.runStatus || 'idle';

    console.log(`Attempting to pause processing for step: ${stepName} (${stepId}). Original status: ${originalStatus}`);
    toast.info(`Requesting pause for "${stepName}"...`);
    setStepRunStatus(stepId, 'pausing'); // Optimistic update

    try {
      const response = await brain.manage_step_reprocessing({ projectId: currentProjectId, stepId }, { action: "pause" });
      const responseData = await response.json();

      if (response.ok && responseData.message && responseData.message.includes("pause requested")) { // Adjusted condition to match actual API response
        setStepRunStatus(stepId, 'paused');
        toast.success(`Processing for "${stepName}" paused. Waiting for confirmation via stream event...`);
        // Backend will send a 'processing_paused' event via SSE stream.
        // The event listener for 'processing_paused' will then close the eventSource.
        // No need to call closeEventSource(stepId) here directly,
        // as we want to wait for the SSE confirmation that it has indeed paused its loop.
      } else if (!response.ok) { // Only throw an error if the response was not ok
        throw new Error(responseData.message || responseData.details || "Failed to request pause from server.");
      }
    } catch (err: any) {
      console.error(`Error pausing processing for step ${stepId}:`, err);
      const errorDetail = err.message || (err.body?.detail) || "An unknown error occurred.";
      toast.error(`Failed to pause processing for "${stepName}": ${errorDetail}. Status reverted to ${originalStatus}.`);
    }
  }, [currentProjectId, setStepRunStatus]);

  const handleResumeProcessing = useCallback(async (stepId: string, stepName: string) => {
    if (!currentProjectId) {
      toast.error("No project selected. Cannot resume processing.");
      return;
    }
    console.log(`Attempting to resume processing for step: ${stepName} (${stepId})`);
    toast.info(`Resuming processing for "${stepName}"...`);
    try {
      const storeState = useProcessingStore.getState();
      const currentSteps = storeState.steps; // Use local const for clarity inside this handler

      if (!currentSteps || !currentSteps[stepId]) {
        console.error(`[handleResumeProcessing] Step ${stepId} not found in store. Steps:`, currentSteps);
        toast.error(`Cannot resume processing for "${stepName}": Step details not found. Please refresh.`);
        return;
      }

      const resumeResponse = await brain.resume_processing_step({ stepId, project_id: currentProjectId });
      const resumeData = await resumeResponse.json();

      if (resumeResponse.ok && resumeData.action === "resume_requested") {
        setStepRunStatus(stepId, 'starting');
        toast.success(`Processing for "${stepName}" resumed. Attempting to restart stream...`);

        // Find the step details to get last_reprocess_type
        // Find the step details from the locally fetched and validated currentSteps
        // The 'steps' from useCallback's closure might be stale, use currentSteps from getState()
        const stepDetails = storeState.steps ? storeState.steps[stepId] : undefined; // Access directly by ID

        if (stepDetails && stepDetails.last_reprocess_type) {
          // The backend now supports 'all', 'new', 'failed', 'pending'. 
          // We'll use last_reprocess_type if it's one of these, otherwise default or error.
          const validReprocessTypes = ["all", "new", "failed", "pending"];
          if (stepDetails.last_reprocess_type && validReprocessTypes.includes(stepDetails.last_reprocess_type)) {
            // Type assertion as we've validated it's one of the allowed literals
            const reprocessType = stepDetails.last_reprocess_type as "all" | "new" | "failed" | "pending";
            console.log(`Restarting event source for ${stepId} with reprocessType: ${reprocessType}`);
            startEventSource(stepId, stepName, reprocessType); // Restart the SSE stream
          } else {
            console.error(`Unknown or invalid last_reprocess_type: ${stepDetails.last_reprocess_type} for step ${stepId}`);
            toast.warn(`Could not automatically restart stream for "${stepName}". Invalid reprocess type stored. Please click reprocess manually.`);
            return;
          }
        } else {
          console.error(`Could not find step details or last_reprocess_type for step ${stepId} to auto-restart stream.`);
          toast.warn(`Could not automatically restart stream for "${stepName}". Missing details. Please click reprocess manually.`);
        }

      } else {
        throw new Error(resumeData.message || resumeData.details || "Failed to request resume from server.");
      }
    } catch (err: any) {
      console.error(`Error resuming processing for step ${stepId}:`, err);
      const errorDetail = err.message || (err.body?.detail) || "An unknown error occurred.";
      toast.error(`Failed to resume processing for "${stepName}": ${errorDetail}`);
    }
  }, [currentProjectId, setStepRunStatus, startEventSource]); // Removed 'steps' from dependencies as we get it from store


  // --- JSX Rendering (MODIFIED) ---
  return (
    <div className="container mx-auto p-4 md:p-6" data-testid="processing-management-page">
      {/* Header and Define Button (Keep existing) */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Processing Rule Management</h1> {/* Changed Step to Rule */}
        <Button onClick={handleOpenDefineModal} data-testid="define-new-rule-button">
          <Settings className="mr-2 h-4 w-4" />
          Define New Rule
        </Button>
      </div>

      {/* Loading/Error States for Steps List (Keep existing) */}
      {isLoadingSteps && (
        <div className="flex justify-center items-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading rules...</span> {/* Changed Step to Rule */}
        </div>
      )}
      {stepsError && !isLoadingSteps && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Rules</AlertTitle> {/* Changed Step to Rule */}
          <AlertDescription>{stepsError}</AlertDescription>
        </Alert>
      )}

      {/* Content Area - List of Steps/Rules */}
      {!isLoadingSteps && !stepsError && (
        <Card>
          <CardHeader>
            <CardTitle>Defined Processing Rules</CardTitle> {/* Changed Step to Rule */}
            <CardDescription>
              Manage and run your custom processing rules here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <p className="text-muted-foreground">
                No custom processing rules defined yet. Click "Define New Rule" to add one.
              </p>
            ) : (
              <ul className="space-y-4" data-testid="processing-rules-list">
                {steps.map((step) => {
                  // --- MODIFICATION: Use Zustand selector ---
                  // Access progress from the state fetched at the top level
                  const progress = allProgress[step.id] || { ...initialProgressState, stepId: step.id };
                  const isRunning = progress.isRunning;
                  const runStatus = progress.runStatus; // Get runStatus
                  const stepStats = stats[step.id]; // Keep stats for display when not running
                  // --- END MODIFICATION ---

                  // --- Add console.log for debugging button disabled state ---
                  const statsLoading = stepStats?.isLoading ?? true; // Default to true if stepStats or isLoading is undefined
                  const isDisabled = !currentProjectId || statsLoading;
                  const isProcessing = runStatus === "processing_all" || runStatus === "processing_new";
                  const isPaused = runStatus === "paused";
                  // Further refined disable logic for individual buttons will be based on these
                  console.log(`[Button disabled check] Step ID: ${step.id}, currentProjectId: ${currentProjectId}, isRunning: ${isRunning}, statsLoading: ${statsLoading}, isDisabled: ${isDisabled}`);
                  // --- End console.log ---

                  return (
                    <li
                      key={step.id}
                      className="border p-4 rounded-md bg-card flex flex-col space-y-3"
                      data-testid={`processing-rule-item-${step.id}`}
                    >
                      {/* Top section: Name, Description, Edit/Delete Buttons */}
                      <div className="flex justify-between items-start"> {/* Title and Buttons Row */}
                        <p className="font-medium text-lg flex-grow mr-4" data-testid={`rule-name-${step.id}`}>{step.name}</p>
                        <div className="flex space-x-2 flex-shrink-0"> {/* Buttons container, ml-4 removed */}
                          {/* Edit Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(step)}
                            disabled={isRunning} // Disable if running
                            data-testid={`edit-rule-button-${step.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          {/* Summary Button (MYA-28) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowSummary(step.id, step.name)} // Pass step.id and step.name
                            disabled={isRunning} // Disable if running
                            data-testid={`view-summary-button-${step.id}`}
                          >
                            <BarChartHorizontal className="h-4 w-4 mr-1" /> Summary
                          </Button>
                          {/* Delete Results Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteResultsClick(step.id, step.name)}
                            disabled={isRunning} // Disable if running
                            data-testid={`delete-results-button-${step.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete Results
                          </Button>
                          {/* Delete Rule & Results Dialog Trigger */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={isRunning} data-testid={`delete-rule-trigger-button-${step.id}`}>

                                <Trash2 className="h-4 w-4 mr-1" /> Delete Rule
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent data-testid={`delete-rule-dialog-${step.id}`}>

                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You are about to delete the rule "<strong>{step.name}</strong>".<br />
                                  Do you want to delete only the rule definition, or delete both the rule and all associated processing results? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="outline"
                                  onClick={() => handleDeleteClick(step.id, step.name)} data-testid={`delete-rule-only-button-${step.id}`}

                                >
                                  Delete Rule Only
                                </AlertDialogAction>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDeleteStepAndResults(step.id, step.name)} data-testid={`delete-rule-and-results-button-${step.id}`}

                                >
                                  Delete Rule & Results
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {/* Description as a new row below title/buttons */}
                      <p className="text-sm text-muted-foreground mt-1 w-full break-words" data-testid={`rule-description-${step.id}`}>
                        {step.description}
                      </p>

                      {/* Middle section: Statistics or Progress */}
                      <div className="text-sm text-muted-foreground pt-2 border-t border-border min-h-[40px]" data-testid={`rule-status-area-${step.id}`}>
                        {/* Added min-height */}
                        {/* --- MODIFICATION: Show Progress OR Stats --- */}
                        {isRunning ? (
                          <div className="space-y-1">
                            <Progress value={progress.percent} className="w-full h-2" data-testid={`rule-progress-bar-${step.id}`} />
                            <div className="flex justify-between text-xs">
                              <span>
                                {progress.status === 'processing_doc' && progress.currentDocIndex !== undefined // Original status check for specific message
                                  ? `Processing doc ${progress.currentDocIndex} / ${progress.total || '?'}`
                                  : runStatus === 'paused'
                                    ? 'Paused'
                                    : progress.message || `Processing...`}
                              </span>
                              <span data-testid={`rule-progress-text-${step.id}`}>{progress.percent}%</span>
                            </div>
                            {progress.error && (
                              <span className="text-destructive block text-xs">Error: {progress.error}</span>
                            )}
                          </div>
                        ) : (
                          // Show stats loading/error/data only when NOT running
                          <>
                            {stepStats?.isLoading && (
                              <div className="flex items-center">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span>Loading stats...</span>
                              </div>
                            )}
                            {stepStats?.error && !stepStats.isLoading && (
                              <div className="flex items-center text-destructive">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                <span>{stepStats.error}</span>
                              </div>
                            )}
                            {stepStats && !stepStats.isLoading && !stepStats.error && (
                              <span data-testid={`rule-stats-text-${step.id}`}>
                                Total documents analyzed: <strong>{stepStats.total_documents_analyzed ?? "N/A"} / {stepStats.total_project_documents ?? "?"}</strong>
                              </span>
                            )}
                            {!stepStats && !isLoadingSteps && ( // Fallback if stats never loaded
                              <span>Stats not available.</span>
                            )}
                            {/* Display final error from last run if any */}
                            {(progress.status === 'error' || progress.status === 'complete_with_errors') && !isRunning && (
                              <div className="flex items-center text-destructive mt-1 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span>Last run failed: {progress.error || progress.message || "Unknown error"}</span>
                              </div>
                            )}
                          </>
                        )}
                        {/* --- END MODIFICATION --- */}
                      </div>

                      {/* Bottom section: Reprocessing, Pause, Resume Buttons */}
                      <div className="flex space-x-2 pt-3 items-center">
                        {/* Reprocess All Button */}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleReprocessAll(step.id, step.name)}
                          disabled={!currentProjectId || isRunning || runStatus === 'paused' || runStatus === 'pausing' || (stats[step.id]?.isLoading ?? true)}
                          data-testid={`process-all-button-${step.id}`}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Process All
                        </Button>
                        {/* Reprocess New Button */}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleReprocessNew(step.id, step.name)}
                          disabled={!currentProjectId || isRunning || runStatus === 'paused' || runStatus === 'pausing' || (stats[step.id]?.isLoading ?? true)}
                          data-testid={`process-new-button-${step.id}`}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Process New
                        </Button>

                        {/* MYA-63: Pause Button */}
                        {isRunning && runStatus !== 'paused' && runStatus !== 'pausing' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-600 border-amber-600 hover:bg-amber-100 hover:text-amber-700"
                            onClick={() => handlePauseProcessing(step.id, step.name)}
                            disabled={!currentProjectId} // isRunning is already true here
                            data-testid={`pause-rule-button-${step.id}`}
                          >
                            <Pause className="h-4 w-4 mr-1" /> Pause
                          </Button>
                        )}
                        {/* MYA-63: Resume Button */}
                        {runStatus === 'paused' && !isRunning && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600 hover:bg-green-100 hover:text-green-700"
                            onClick={() => handleResumeProcessing(step.id, step.name)}
                            disabled={!currentProjectId}
                            data-testid={`resume-rule-button-${step.id}`}
                          >
                            <Play className="h-4 w-4 mr-1" /> Resume
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal (Keep existing) */}
      <DefineCustomStepModal
        isOpen={isDefineModalOpen} data-testid="define-rule-modal"
        onClose={handleCloseDefineModal}
        onSave={handleSaveCustomStep}
        initialData={stepToEdit ?? undefined}
      />

      {/* Confirmation Dialogs (MODIFIED onClick actions to use new handlers) */}
      {/* Reprocess Confirmation Dialog after Edit */}
      <AlertDialog open={reprocessConfirmStep !== null} onOpenChange={() => { if (reprocessConfirmStep) { setReprocessConfirmStep(null); /* fetchSteps(); Removed: fetch happens in save handler */ } }}>
        <AlertDialogContent data-testid={`reprocess-confirm-dialog-${reprocessConfirmStep?.id}`}>

          <AlertDialogHeader>
            <AlertDialogTitle>Reprocess Documents?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to reprocess all documents using the updated rule "<strong>{reprocessConfirmStep?.name}</strong>"? This may take some time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setReprocessConfirmStep(null); /* fetchSteps(); Removed */ }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (reprocessConfirmStep) {
                  // --- MODIFICATION: Call new handler ---
                  handleReprocessAll(reprocessConfirmStep.id, reprocessConfirmStep.name);
                  // --- END MODIFICATION ---
                }
                setReprocessConfirmStep(null);
              }}
              data-testid={`reprocess-confirm-button-${reprocessConfirmStep?.id}`}>
              Process All {/* Changed from Reprocess All */}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Step Results Confirmation Dialog (Keep existing logic) */}
      <AlertDialog open={stepToDeleteResults !== null} onOpenChange={() => setStepToDeleteResults(null)}>
        <AlertDialogContent data-testid={`delete-results-dialog-${stepToDeleteResults?.id}`}>

          <AlertDialogHeader>
            <AlertDialogTitle>Delete Processing Results?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all processing results for the rule "<strong>{stepToDeleteResults?.name}</strong>"? This action cannot be undone. The rule definition itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStepToDeleteResults(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteResults} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid={`delete-results-confirm-button-${stepToDeleteResults?.id}`}>
              Delete Results
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Run Confirmation Dialog after Create */}
      <AlertDialog open={newRuleToConfirmRun !== null} onOpenChange={() => setNewRuleToConfirmRun(null)}>
        <AlertDialogContent data-testid={`run-new-rule-dialog-${newRuleToConfirmRun?.id}`}>

          <AlertDialogHeader>
            <AlertDialogTitle>Run New Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to run the new rule "<strong>{newRuleToConfirmRun?.name}</strong>" against all documents immediately? This may take some time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewRuleToConfirmRun(null)}>Later</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (newRuleToConfirmRun) {
                  // --- MODIFICATION: Call new handler ---
                  handleReprocessAll(newRuleToConfirmRun.id, newRuleToConfirmRun.name);
                  // --- END MODIFICATION ---
                }
                setNewRuleToConfirmRun(null);
              }}
              data-testid={`run-new-rule-confirm-button-${newRuleToConfirmRun?.id}`}>
              Run Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- Results Summary Modal (MYA-28) --- */}
      <Dialog open={summaryModalState.isOpen} onOpenChange={(open) => setSummaryModalState(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[600px]" data-testid={`results-summary-modal-${summaryModalState.stepName?.replace(/\s+/g, '-').toLowerCase()}`}>

          <DialogHeader>
            <DialogTitle>Results Summary: {summaryModalState.stepName}</DialogTitle>
            <DialogDescription>
              Distribution of results from the "{summaryModalState.stepName}" step across analyzed documents.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {summaryModalState.isLoading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading summary...</span>
              </div>
            )}
            {summaryModalState.error && (
              <div className="flex flex-col items-center justify-center p-8 text-destructive">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p className="font-semibold mb-1">Error Loading Summary</p>
                <p className="text-sm text-center">{summaryModalState.error}</p>
              </div>
            )}
            {!summaryModalState.isLoading && !summaryModalState.error && summaryModalState.data && (
              <div>
                <p className="text-sm mb-2">Total Documents Analyzed: <strong>{summaryModalState.data.total_documents_analyzed ?? 'N/A'} / {summaryModalState.data.total_project_documents ?? '?'}</strong></p>
                <p className="text-sm mb-4">Detected Result Type: <code className="bg-muted px-1 py-0.5 rounded text-xs">{summaryModalState.data.summary_type ?? 'N/A'}</code></p>

                {/* Use StepSummaryDisplay component here (MYA-28) */}
                <StepSummaryDisplay
                  summaryType={summaryModalState.data.summary_type}
                  summaryData={summaryModalState.data.summary_data}
                />
              </div>
            )}
            {!summaryModalState.isLoading && !summaryModalState.error && !summaryModalState.data && (
              <p className="text-muted-foreground italic mt-4 text-center">No summary data available.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryModalState(prev => ({ ...prev, isOpen: false }))} data-testid="results-summary-modal-close-button">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ProcessingManagement;
