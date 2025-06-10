import {
  BulkBasicReprocessRequest,
  CheckHealthData,
  CreateCustomStepData,
  CreateProjectData,
  CreateProjectRequest,
  CustomStepCreate,
  CustomStepCreateRequest,
  CustomStepUpdate,
  CustomStepUpdateRequest,
  DeleteCustomStepData,
  DeleteStepResultsAndResetProgressData,
  ExecuteDocumentAssignmentEndpointData,
  ExportProjectToCsvData,
  GetAnalyticsSummaryData,
  GetDocumentDetailsData,
  GetStepReprocessingProgressData,
  GetStepResultsSummaryData,
  LegacyCreateCustomStepData,
  LegacyDeleteCustomStepData,
  LegacyListCustomStepsData,
  LegacyTriggerBulkBasicReprocessingData,
  LegacyUpdateCustomStepData,
  ListCustomStepsForProjectData,
  ListDocumentsData,
  ListProjectsData,
  ManageStepReprocessingData,
  ProcessPdfEndpointData,
  ProcessPdfRequest,
  ProjectUpdateRequest,
  ReprocessBasicAnalysisEndpointData,
  StepActionRequest,
  TriggerBulkBasicReprocessingData,
  UpdateCustomStepData,
  UpdateProjectNameData,
} from "./data-contracts";

export namespace Brain {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  export namespace check_health {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = CheckHealthData;
  }

  /**
   * @description Fetches aggregated analytics data, applying filters if provided.
   * @tags dbtn/module:analytics
   * @name get_analytics_summary
   * @summary Get Analytics Summary
   * @request GET:/routes/summary
   */
  export namespace get_analytics_summary {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * Project Id
       * Filter analytics by project ID
       */
      project_id?: string | null;
      /** Sentiment Filter */
      sentiment_filter?: string | null;
      /** Complexity Filter */
      complexity_filter?: string | null;
      /** Topic Filter */
      topic_filter?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetAnalyticsSummaryData;
  }

  /**
   * @description Exports all documents associated with a specific project to a CSV file. The CSV includes standard document fields and flattens the \`custom_analysis_results\` JSON into separate columns for each top-level key found across the documents.
   * @tags Projects, stream, dbtn/module:projects
   * @name export_project_to_csv
   * @summary Export Project Documents to CSV
   * @request GET:/routes/projects/{project_id}/export-csv
   */
  export namespace export_project_to_csv {
    export type RequestParams = {
      /**
       * Project Id
       * The ID of the project to export
       * @format uuid
       */
      projectId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ExportProjectToCsvData;
  }

  /**
   * @description Retrieve a list of all projects.
   * @tags dbtn/module:projects
   * @name list_projects
   * @summary List Projects
   * @request GET:/routes/projects/
   */
  export namespace list_projects {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListProjectsData;
  }

  /**
   * @description Create a new project.
   * @tags dbtn/module:projects
   * @name create_project
   * @summary Create Project
   * @request POST:/routes/projects/
   */
  export namespace create_project {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CreateProjectRequest;
    export type RequestHeaders = {};
    export type ResponseBody = CreateProjectData;
  }

  /**
   * @description Updates the name of a specific project.
   * @tags dbtn/module:projects
   * @name update_project_name
   * @summary Update Project Name
   * @request PATCH:/routes/projects/{project_id}
   */
  export namespace update_project_name {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = ProjectUpdateRequest;
    export type RequestHeaders = {};
    export type ResponseBody = UpdateProjectNameData;
  }

  /**
   * @description Updates an existing custom processing step.
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_update_custom_step
   * @summary Legacy Update Custom Step
   * @request PUT:/routes/processing-steps/{step_id}
   */
  export namespace legacy_update_custom_step {
    export type RequestParams = {
      /** Step Id */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = CustomStepUpdateRequest;
    export type RequestHeaders = {};
    export type ResponseBody = LegacyUpdateCustomStepData;
  }

  /**
   * @description Deletes a custom processing step.
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_delete_custom_step
   * @summary Legacy Delete Custom Step
   * @request DELETE:/routes/processing-steps/{step_id}
   */
  export namespace legacy_delete_custom_step {
    export type RequestParams = {
      /** Step Id */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = LegacyDeleteCustomStepData;
  }

  /**
   * @description Retrieves all custom processing steps.
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_list_custom_steps
   * @summary Legacy List Custom Steps
   * @request GET:/routes/processing-steps
   */
  export namespace legacy_list_custom_steps {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = LegacyListCustomStepsData;
  }

  /**
   * @description Creates a new custom processing step.
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_create_custom_step
   * @summary Legacy Create Custom Step
   * @request POST:/routes/processing-steps
   */
  export namespace legacy_create_custom_step {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CustomStepCreateRequest;
    export type RequestHeaders = {};
    export type ResponseBody = LegacyCreateCustomStepData;
  }

  /**
   * @description Creates a document record and starts background processing (download, text extraction, basic AI analysis) for a PDF uploaded to storage. Takes storage path, user ID, filename, and project ID as input.
   * @tags documents, dbtn/module:documents
   * @name process_pdf_endpoint
   * @summary Process Uploaded PDF
   * @request POST:/routes/documents/process-pdf
   */
  export namespace process_pdf_endpoint {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = ProcessPdfRequest;
    export type RequestHeaders = {};
    export type ResponseBody = ProcessPdfEndpointData;
  }

  /**
   * @description Fetches a list of documents, optionally filtered by the currently selected project ID.
   * @tags documents, dbtn/module:documents
   * @name list_documents
   * @summary List Documents by Project
   * @request GET:/routes/documents/
   */
  export namespace list_documents {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * Project Id
       * @format uuid
       */
      project_id: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListDocumentsData;
  }

  /**
   * @description Downloads a PDF, re-runs the standard initial analysis, and updates the 'analysis' field for the specified document ID.
   * @tags documents, dbtn/module:documents
   * @name reprocess_basic_analysis_endpoint
   * @summary Reprocess Basic Analysis
   * @request POST:/routes/documents/{document_id}/reprocess-basic
   */
  export namespace reprocess_basic_analysis_endpoint {
    export type RequestParams = {
      /**
       * Document Id
       * @format uuid
       */
      documentId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ReprocessBasicAnalysisEndpointData;
  }

  /**
   * @description Starts basic analysis reprocessing for specified documents, or all documents in a project, optionally filtered by status.
   * @tags documents, bulk, dbtn/module:documents
   * @name trigger_bulk_basic_reprocessing
   * @summary Start Bulk Reprocess Basic Analysis
   * @request POST:/routes/documents/bulk-reprocess-basic
   */
  export namespace trigger_bulk_basic_reprocessing {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = BulkBasicReprocessRequest;
    export type RequestHeaders = {};
    export type ResponseBody = TriggerBulkBasicReprocessingData;
  }

  /**
   * @description Fetches details for a specific document, ensuring it belongs to the specified project. Retrieves analysis results directly from the 'documents.analysis' JSON field.
   * @tags documents, dbtn/module:documents
   * @name get_document_details
   * @summary Get Document Details
   * @request GET:/routes/documents/{document_id}
   */
  export namespace get_document_details {
    export type RequestParams = {
      /**
       * Document Id
       * @format uuid
       */
      documentId: string;
    };
    export type RequestQuery = {
      /**
       * Project Id
       * @format uuid
       */
      project_id: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetDocumentDetailsData;
  }

  /**
   * No description
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name create_custom_step
   * @summary Create Custom Step
   * @request POST:/routes/api/custom-steps
   */
  export namespace create_custom_step {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CustomStepCreate;
    export type RequestHeaders = {};
    export type ResponseBody = CreateCustomStepData;
  }

  /**
   * No description
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name list_custom_steps_for_project
   * @summary List Custom Steps For Project
   * @request GET:/routes/api/custom-steps
   */
  export namespace list_custom_steps_for_project {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * Project Id
       * @format uuid
       */
      project_id: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListCustomStepsForProjectData;
  }

  /**
   * No description
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name update_custom_step
   * @summary Update Custom Step
   * @request PUT:/routes/api/custom-steps/{project_id}/{step_id}
   */
  export namespace update_custom_step {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = CustomStepUpdate;
    export type RequestHeaders = {};
    export type ResponseBody = UpdateCustomStepData;
  }

  /**
   * No description
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name delete_custom_step
   * @summary Delete Custom Step
   * @request DELETE:/routes/api/custom-steps/{project_id}/{step_id}
   */
  export namespace delete_custom_step {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = DeleteCustomStepData;
  }

  /**
   * @description Deletes all analysis results associated with a specific custom processing step for all documents in a project and resets the step's progress and status.
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name delete_step_results_and_reset_progress
   * @summary Delete Step Results And Reset Progress
   * @request DELETE:/routes/api/custom-steps/{project_id}/{step_id}/results
   */
  export namespace delete_step_results_and_reset_progress {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = DeleteStepResultsAndResetProgressData;
  }

  /**
   * @description Triggers the document assignment logic defined in a project-wide dynamic analysis step. For initial operations (MYA-73), this supports a predefined criteria like 'Set a test_processed field'.
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name execute_document_assignment_endpoint
   * @summary Execute Document Assignment Logic for a Project-Wide Custom Step
   * @request POST:/routes/api/custom-steps/{project_id}/{step_id}/execute-assignment
   */
  export namespace execute_document_assignment_endpoint {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ExecuteDocumentAssignmentEndpointData;
  }

  /**
   * @description Retrieve a summary of analysis results for a specific custom processing step within a project.
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name get_step_results_summary
   * @summary Get Step Results Summary
   * @request GET:/routes/api/custom-steps/{project_id}/{step_id}/results-summary
   */
  export namespace get_step_results_summary {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetStepResultsSummaryData;
  }

  /**
   * No description
   * @tags Processing Steps, stream, dbtn/module:custom_steps
   * @name legacy_trigger_bulk_basic_reprocessing
   * @summary Legacy Trigger Bulk Basic Reprocessing
   * @request GET:/routes/api/custom-steps/{project_id}/{step_id}/reprocess
   */
  export namespace legacy_trigger_bulk_basic_reprocessing {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {
      /**
       * Reprocess Type
       * Type of reprocessing to perform.
       * @default "all"
       */
      reprocess_type?: "all" | "new" | "failed" | "pending";
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = LegacyTriggerBulkBasicReprocessingData;
  }

  /**
   * No description
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name get_step_reprocessing_progress
   * @summary Get Step Reprocessing Progress
   * @request GET:/routes/api/custom-steps/{project_id}/{step_id}/progress
   */
  export namespace get_step_reprocessing_progress {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetStepReprocessingProgressData;
  }

  /**
   * No description
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name manage_step_reprocessing
   * @summary Manage Step Reprocessing
   * @request POST:/routes/api/custom-steps/{project_id}/{step_id}/manage
   */
  export namespace manage_step_reprocessing {
    export type RequestParams = {
      /**
       * Project Id
       * @format uuid
       */
      projectId: string;
      /**
       * Step Id
       * @format uuid
       */
      stepId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = StepActionRequest;
    export type RequestHeaders = {};
    export type ResponseBody = ManageStepReprocessingData;
  }
}
