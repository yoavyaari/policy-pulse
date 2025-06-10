import { create } from "zustand";

// Define the new RunStatus type
export type RunStatus =
  | "idle"
  | "starting" // New: Explicit status for when a process is initiated
  | "fetching_docs" // From backend SSE
  | "processing_doc_start" // From backend SSE
  | "processing_doc_success" // From backend SSE
  | "processing_doc_failed" // From backend SSE
  | "paused" // New: For pause/resume functionality
  | "completed" // From backend SSE & existing frontend
  | "completed_with_errors" // From backend SSE & existing frontend
  | "error"; // From backend SSE & existing frontend

// Define the structure for progress data of a single processing task
export const initialProgressState: Omit<ProcessingProgress, 'stepId'> = {
  runStatus: 'idle', // Changed from status to runStatus
  processed: 0,
  failed: 0,
  total: 0,
  percent: 0,
  isRunning: false, // isRunning will be derived or explicitly set based on runStatus
  message: null,
  error: null,
  currentDocIndex: undefined,
};

export interface ProcessingProgress {
  stepId: string;
  runStatus: RunStatus; // Changed from status to runStatus
  processed: number;
  failed: number;
  total: number;
  percent: number;
  currentDocIndex?: number; // Optional: Index of the doc being processed
  docId?: string; // Optional: ID of the doc being processed
  message?: string; // General message (e.g., "No new documents found")
  error?: string | null; // Error message if status is 'error' or 'complete_with_errors'
  isRunning: boolean; // Flag to easily check if processing is active
}

// Define the structure for the store's state
interface ProcessingState {
  // Use a Record to store progress keyed by stepId
  progress: Record<string, ProcessingProgress>;
  // Action to initialize or update progress for a specific step
  updateProgress: (stepId: string, data: Partial<Omit<ProcessingProgress, 'stepId' | 'runStatus'> & { runStatus?: RunStatus }>) => void;
  // Action to mark processing as started
  startProcessing: (stepId: string, total: number) => void;
  // Action to mark processing as finished (completed or errored)
  finishProcessing: (stepId: string, finalStatus: RunStatus, message?: string, error?: string | null) => void;
  // Action to reset progress for a specific step (e.g., on page load or error clear)
  resetProgress: (stepId: string) => void;
  // Action to set an error state explicitly
  setError: (stepId: string, error: string) => void;
  // New action to specifically set the run status and derive isRunning
  setStepRunStatus: (stepId: string, runStatus: RunStatus) => void;
}


export const useProcessingStore = create<ProcessingState>((set, get) => ({
  progress: {},

  updateProgress: (stepId, data) => {
    set((state) => {
      const currentStepProgress = state.progress[stepId] || { ...initialProgressState, stepId };
      
      // Determine the runStatus to be used for deriving isRunning
      let effectiveRunStatus = data.runStatus ?? currentStepProgress.runStatus;
      // Determine the runStatus to be used for deriving isRunning
      // The `data.status` here is the `status` field from the backend's ProcessingProgress model via SSE.
      // The `currentStepProgress.runStatus` is the store's current knowledge of the step's overall run status.
      // The `data.runStatus` (if it existed on the SSE payload, which it doesn't directly) would be an explicit override from SSE.

      const sseEventStatus = data.status as RunStatus; // Status from the SSE event
      let newIsRunning;

      // Define active statuses that mean the process is ongoing
      const activeProcessingStatuses: RunStatus[] = [
        'starting',
        'fetching_docs',
        'processing_doc_start',
        'processing_doc_success',
        'processing_doc_failed',
        // 'running' itself is not a RunStatus, but these detailed statuses imply running
      ];

      // Define terminal statuses that mean the process has stopped
      const terminalStatuses: RunStatus[] = [
        "completed",
        "completed_with_errors", // From backend SSE & existing frontend
        "error", // Explicitly set by setError or other logic
        "failed_permanently", // From backend SSE
        "idle", // Initial state or after explicit reset
      ];
      
      if (sseEventStatus === 'running' || (sseEventStatus && activeProcessingStatuses.includes(sseEventStatus))) {
        // If the SSE event's status indicates active processing, update the store's runStatus
        // If it's just 'running', default to 'processing_doc_start' or another suitable active status.
        effectiveRunStatus = sseEventStatus === 'running' ? 'processing_doc_start' : sseEventStatus;
        newIsRunning = true;
      } else if (sseEventStatus && terminalStatuses.includes(sseEventStatus)) {
        // If the SSE event's status is terminal, update accordingly
        effectiveRunStatus = sseEventStatus;
        newIsRunning = false;
      } else {
        // Otherwise, maintain current runStatus or use one from data if explicitly provided (though data.runStatus isn't typical for SSE progress)
        effectiveRunStatus = data.runStatus ?? currentStepProgress.runStatus;
        // And derive isRunning based on that effectiveRunStatus
        newIsRunning = activeProcessingStatuses.includes(effectiveRunStatus);
      }
      
      console.log(`[processingStore] updateProgress for step ${stepId}: SSE status: "${sseEventStatus}", effectiveRunStatus: "${effectiveRunStatus}", newIsRunning: ${newIsRunning}, incoming data:`, data);

      // Ensure numeric fields are handled correctly, defaulting to current or 0
      const processed = data.processed ?? currentStepProgress.processed;
      const failed = data.failed ?? currentStepProgress.failed;
      // Keep total if provided, otherwise use current; important for ongoing processes
      const total = data.total ?? currentStepProgress.total;
      const percent = data.percent !== undefined && data.percent !== null ? Math.round(data.percent) : currentStepProgress.percent;
      const currentDocIndex = data.currentDocIndex ?? currentStepProgress.currentDocIndex;
      const docId = data.docId ?? currentStepProgress.docId;

      return {
        progress: {
          ...state.progress,
          [stepId]: {
            ...currentStepProgress, // Start with current state
            ...data, // Apply incoming data (potentially including runStatus)
            runStatus: effectiveRunStatus, // Explicitly set runStatus
            isRunning: newIsRunning, // Set derived isRunning
            // Overwrite with validated/defaulted numbers
            processed,
            failed,
            total,
            percent,
            currentDocIndex,
            docId,
          },
        },
      };
    });
  },

  startProcessing: (stepId, total) => {
     set((state) => ({
       progress: {
         ...state.progress,
         [stepId]: {
           ...initialProgressState, // Reset to initial which now includes runStatus: 'idle'
           stepId,
           total: total, // Set initial total if known
           runStatus: "starting", // Set to 'starting' instead of "processing_doc"
           isRunning: true,
           percent: 0, // Start at 0%
           message: "Processing initiated...", // Optional: Provide an initial message
         },
       },
     }));
  },

  finishProcessing: (stepId, finalStatus: RunStatus, message, error = null) => {
    set((state) => {
      const current = state.progress[stepId] || initialProgressState;
      return {
        progress: {
          ...state.progress,
          [stepId]: {
            ...current,
            runStatus: finalStatus, // Changed from status to runStatus
            percent: 100, // Always 100% when finished
            isRunning: false,
            message: message ?? current.message,
            error: error ?? current.error, // Keep existing error if new one isn't provided
          },
        },
      };
    });
  },
  
  setError: (stepId, error) => {
     set((state) => {
       const current = state.progress[stepId] || initialProgressState;
       return {
         progress: {
           ...state.progress,
           [stepId]: {
             ...current,
             runStatus: 'error', // Set runStatus to 'error'
             error: error,
             isRunning: false, // Ensure isRunning is false
             percent: current.percent // Keep last known percentage on error
           }
         }
       }
     })
  },

  resetProgress: (stepId) => {
    set((state) => {
      // Create a new object excluding the specific stepId
      const newProgress = { ...state.progress };
      delete newProgress[stepId];
      return { progress: newProgress };
      // Or, to reset to idle state instead of removing:
      // return {
      //   progress: {
      //     ...state.progress,
      //     [stepId]: { ...initialProgressState, stepId },
      //   },
      // };
    });
  },

  setStepRunStatus: (stepId, runStatus) => {
    set((state) => {
      const currentStepProgress = state.progress[stepId] || { ...initialProgressState, stepId };
      const activeStatuses: RunStatus[] = [
        'starting',
        'fetching_docs',
        'processing_doc_start',
        'processing_doc_success',
        'processing_doc_failed'
      ];
      const newIsRunning = activeStatuses.includes(runStatus);

      return {
        progress: {
          ...state.progress,
          [stepId]: {
            ...currentStepProgress,
            runStatus: runStatus,
            isRunning: newIsRunning,
            // Potentially clear message/error if moving to a non-terminal/non-error state
            message: newIsRunning || runStatus === 'paused' ? currentStepProgress.message : null,
            error: newIsRunning || runStatus === 'paused' ? currentStepProgress.error : null, 
          },
        },
      };
    });
  },

}));

// Selector to get progress for a specific step
export const selectProgress = (stepId: string) => (state: ProcessingState) =>
  state.progress[stepId] || { ...initialProgressState, stepId };
