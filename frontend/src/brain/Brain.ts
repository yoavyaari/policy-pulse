import {
  BulkBasicReprocessRequest,
  CheckHealthData,
  CreateCustomStepData,
  CreateCustomStepError,
  CreateProjectData,
  CreateProjectError,
  CreateProjectRequest,
  CustomStepCreate,
  CustomStepCreateRequest,
  CustomStepUpdate,
  CustomStepUpdateRequest,
  DeleteCustomStepData,
  DeleteCustomStepError,
  DeleteCustomStepParams,
  DeleteStepResultsAndResetProgressData,
  DeleteStepResultsAndResetProgressError,
  DeleteStepResultsAndResetProgressParams,
  ExecuteDocumentAssignmentEndpointData,
  ExecuteDocumentAssignmentEndpointError,
  ExecuteDocumentAssignmentEndpointParams,
  ExportProjectToCsvData,
  ExportProjectToCsvError,
  ExportProjectToCsvParams,
  GetAnalyticsSummaryData,
  GetAnalyticsSummaryError,
  GetAnalyticsSummaryParams,
  GetDocumentDetailsData,
  GetDocumentDetailsError,
  GetDocumentDetailsParams,
  GetStepReprocessingProgressData,
  GetStepReprocessingProgressError,
  GetStepReprocessingProgressParams,
  GetStepResultsSummaryData,
  GetStepResultsSummaryError,
  GetStepResultsSummaryParams,
  LegacyCreateCustomStepData,
  LegacyCreateCustomStepError,
  LegacyDeleteCustomStepData,
  LegacyDeleteCustomStepError,
  LegacyDeleteCustomStepParams,
  LegacyListCustomStepsData,
  LegacyTriggerBulkBasicReprocessingData,
  LegacyTriggerBulkBasicReprocessingError,
  LegacyTriggerBulkBasicReprocessingParams,
  LegacyUpdateCustomStepData,
  LegacyUpdateCustomStepError,
  LegacyUpdateCustomStepParams,
  ListCustomStepsForProjectData,
  ListCustomStepsForProjectError,
  ListCustomStepsForProjectParams,
  ListDocumentsData,
  ListDocumentsError,
  ListDocumentsParams,
  ListProjectsData,
  ManageStepReprocessingData,
  ManageStepReprocessingError,
  ManageStepReprocessingParams,
  ProcessPdfEndpointData,
  ProcessPdfEndpointError,
  ProcessPdfRequest,
  ProjectUpdateRequest,
  ReprocessBasicAnalysisEndpointData,
  ReprocessBasicAnalysisEndpointError,
  ReprocessBasicAnalysisEndpointParams,
  StepActionRequest,
  TriggerBulkBasicReprocessingData,
  TriggerBulkBasicReprocessingError,
  UpdateCustomStepData,
  UpdateCustomStepError,
  UpdateCustomStepParams,
  UpdateProjectNameData,
  UpdateProjectNameError,
  UpdateProjectNameParams,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Brain<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/_healthz`,
      method: "GET",
      ...params,
    });

  /**
   * @description Fetches aggregated analytics data, applying filters if provided.
   *
   * @tags dbtn/module:analytics
   * @name get_analytics_summary
   * @summary Get Analytics Summary
   * @request GET:/routes/summary
   */
  get_analytics_summary = (query: GetAnalyticsSummaryParams, params: RequestParams = {}) =>
    this.request<GetAnalyticsSummaryData, GetAnalyticsSummaryError>({
      path: `/routes/summary`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Exports all documents associated with a specific project to a CSV file. The CSV includes standard document fields and flattens the \`custom_analysis_results\` JSON into separate columns for each top-level key found across the documents.
   *
   * @tags Projects, stream, dbtn/module:projects
   * @name export_project_to_csv
   * @summary Export Project Documents to CSV
   * @request GET:/routes/projects/{project_id}/export-csv
   */
  export_project_to_csv = ({ projectId, ...query }: ExportProjectToCsvParams, params: RequestParams = {}) =>
    this.requestStream<ExportProjectToCsvData, ExportProjectToCsvError>({
      path: `/routes/projects/${projectId}/export-csv`,
      method: "GET",
      ...params,
    });

  /**
   * @description Retrieve a list of all projects.
   *
   * @tags dbtn/module:projects
   * @name list_projects
   * @summary List Projects
   * @request GET:/routes/projects/
   */
  list_projects = (params: RequestParams = {}) =>
    this.request<ListProjectsData, any>({
      path: `/routes/projects/`,
      method: "GET",
      ...params,
    });

  /**
   * @description Create a new project.
   *
   * @tags dbtn/module:projects
   * @name create_project
   * @summary Create Project
   * @request POST:/routes/projects/
   */
  create_project = (data: CreateProjectRequest, params: RequestParams = {}) =>
    this.request<CreateProjectData, CreateProjectError>({
      path: `/routes/projects/`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Updates the name of a specific project.
   *
   * @tags dbtn/module:projects
   * @name update_project_name
   * @summary Update Project Name
   * @request PATCH:/routes/projects/{project_id}
   */
  update_project_name = (
    { projectId, ...query }: UpdateProjectNameParams,
    data: ProjectUpdateRequest,
    params: RequestParams = {},
  ) =>
    this.request<UpdateProjectNameData, UpdateProjectNameError>({
      path: `/routes/projects/${projectId}`,
      method: "PATCH",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Updates an existing custom processing step.
   *
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_update_custom_step
   * @summary Legacy Update Custom Step
   * @request PUT:/routes/processing-steps/{step_id}
   */
  legacy_update_custom_step = (
    { stepId, ...query }: LegacyUpdateCustomStepParams,
    data: CustomStepUpdateRequest,
    params: RequestParams = {},
  ) =>
    this.request<LegacyUpdateCustomStepData, LegacyUpdateCustomStepError>({
      path: `/routes/processing-steps/${stepId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Deletes a custom processing step.
   *
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_delete_custom_step
   * @summary Legacy Delete Custom Step
   * @request DELETE:/routes/processing-steps/{step_id}
   */
  legacy_delete_custom_step = ({ stepId, ...query }: LegacyDeleteCustomStepParams, params: RequestParams = {}) =>
    this.request<LegacyDeleteCustomStepData, LegacyDeleteCustomStepError>({
      path: `/routes/processing-steps/${stepId}`,
      method: "DELETE",
      ...params,
    });

  /**
   * @description Retrieves all custom processing steps.
   *
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_list_custom_steps
   * @summary Legacy List Custom Steps
   * @request GET:/routes/processing-steps
   */
  legacy_list_custom_steps = (params: RequestParams = {}) =>
    this.request<LegacyListCustomStepsData, any>({
      path: `/routes/processing-steps`,
      method: "GET",
      ...params,
    });

  /**
   * @description Creates a new custom processing step.
   *
   * @tags Processing Steps, dbtn/module:processing_steps
   * @name legacy_create_custom_step
   * @summary Legacy Create Custom Step
   * @request POST:/routes/processing-steps
   */
  legacy_create_custom_step = (data: CustomStepCreateRequest, params: RequestParams = {}) =>
    this.request<LegacyCreateCustomStepData, LegacyCreateCustomStepError>({
      path: `/routes/processing-steps`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Creates a document record and starts background processing (download, text extraction, basic AI analysis) for a PDF uploaded to storage. Takes storage path, user ID, filename, and project ID as input.
   *
   * @tags documents, dbtn/module:documents
   * @name process_pdf_endpoint
   * @summary Process Uploaded PDF
   * @request POST:/routes/documents/process-pdf
   */
  process_pdf_endpoint = (data: ProcessPdfRequest, params: RequestParams = {}) =>
    this.request<ProcessPdfEndpointData, ProcessPdfEndpointError>({
      path: `/routes/documents/process-pdf`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Fetches a list of documents, optionally filtered by the currently selected project ID.
   *
   * @tags documents, dbtn/module:documents
   * @name list_documents
   * @summary List Documents by Project
   * @request GET:/routes/documents/
   */
  list_documents = (query: ListDocumentsParams, params: RequestParams = {}) =>
    this.request<ListDocumentsData, ListDocumentsError>({
      path: `/routes/documents/`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Downloads a PDF, re-runs the standard initial analysis, and updates the 'analysis' field for the specified document ID.
   *
   * @tags documents, dbtn/module:documents
   * @name reprocess_basic_analysis_endpoint
   * @summary Reprocess Basic Analysis
   * @request POST:/routes/documents/{document_id}/reprocess-basic
   */
  reprocess_basic_analysis_endpoint = (
    { documentId, ...query }: ReprocessBasicAnalysisEndpointParams,
    params: RequestParams = {},
  ) =>
    this.request<ReprocessBasicAnalysisEndpointData, ReprocessBasicAnalysisEndpointError>({
      path: `/routes/documents/${documentId}/reprocess-basic`,
      method: "POST",
      ...params,
    });

  /**
   * @description Starts basic analysis reprocessing for specified documents, or all documents in a project, optionally filtered by status.
   *
   * @tags documents, bulk, dbtn/module:documents
   * @name trigger_bulk_basic_reprocessing
   * @summary Start Bulk Reprocess Basic Analysis
   * @request POST:/routes/documents/bulk-reprocess-basic
   */
  trigger_bulk_basic_reprocessing = (data: BulkBasicReprocessRequest, params: RequestParams = {}) =>
    this.request<TriggerBulkBasicReprocessingData, TriggerBulkBasicReprocessingError>({
      path: `/routes/documents/bulk-reprocess-basic`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Fetches details for a specific document, ensuring it belongs to the specified project. Retrieves analysis results directly from the 'documents.analysis' JSON field.
   *
   * @tags documents, dbtn/module:documents
   * @name get_document_details
   * @summary Get Document Details
   * @request GET:/routes/documents/{document_id}
   */
  get_document_details = ({ documentId, ...query }: GetDocumentDetailsParams, params: RequestParams = {}) =>
    this.request<GetDocumentDetailsData, GetDocumentDetailsError>({
      path: `/routes/documents/${documentId}`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name create_custom_step
   * @summary Create Custom Step
   * @request POST:/routes/api/custom-steps
   */
  create_custom_step = (data: CustomStepCreate, params: RequestParams = {}) =>
    this.request<CreateCustomStepData, CreateCustomStepError>({
      path: `/routes/api/custom-steps`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name list_custom_steps_for_project
   * @summary List Custom Steps For Project
   * @request GET:/routes/api/custom-steps
   */
  list_custom_steps_for_project = (query: ListCustomStepsForProjectParams, params: RequestParams = {}) =>
    this.request<ListCustomStepsForProjectData, ListCustomStepsForProjectError>({
      path: `/routes/api/custom-steps`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name update_custom_step
   * @summary Update Custom Step
   * @request PUT:/routes/api/custom-steps/{project_id}/{step_id}
   */
  update_custom_step = (
    { projectId, stepId, ...query }: UpdateCustomStepParams,
    data: CustomStepUpdate,
    params: RequestParams = {},
  ) =>
    this.request<UpdateCustomStepData, UpdateCustomStepError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name delete_custom_step
   * @summary Delete Custom Step
   * @request DELETE:/routes/api/custom-steps/{project_id}/{step_id}
   */
  delete_custom_step = ({ projectId, stepId, ...query }: DeleteCustomStepParams, params: RequestParams = {}) =>
    this.request<DeleteCustomStepData, DeleteCustomStepError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}`,
      method: "DELETE",
      ...params,
    });

  /**
   * @description Deletes all analysis results associated with a specific custom processing step for all documents in a project and resets the step's progress and status.
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name delete_step_results_and_reset_progress
   * @summary Delete Step Results And Reset Progress
   * @request DELETE:/routes/api/custom-steps/{project_id}/{step_id}/results
   */
  delete_step_results_and_reset_progress = (
    { projectId, stepId, ...query }: DeleteStepResultsAndResetProgressParams,
    params: RequestParams = {},
  ) =>
    this.request<DeleteStepResultsAndResetProgressData, DeleteStepResultsAndResetProgressError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}/results`,
      method: "DELETE",
      ...params,
    });

  /**
   * @description Triggers the document assignment logic defined in a project-wide dynamic analysis step. For initial operations (MYA-73), this supports a predefined criteria like 'Set a test_processed field'.
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name execute_document_assignment_endpoint
   * @summary Execute Document Assignment Logic for a Project-Wide Custom Step
   * @request POST:/routes/api/custom-steps/{project_id}/{step_id}/execute-assignment
   */
  execute_document_assignment_endpoint = (
    { projectId, stepId, ...query }: ExecuteDocumentAssignmentEndpointParams,
    params: RequestParams = {},
  ) =>
    this.request<ExecuteDocumentAssignmentEndpointData, ExecuteDocumentAssignmentEndpointError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}/execute-assignment`,
      method: "POST",
      ...params,
    });

  /**
   * @description Retrieve a summary of analysis results for a specific custom processing step within a project.
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name get_step_results_summary
   * @summary Get Step Results Summary
   * @request GET:/routes/api/custom-steps/{project_id}/{step_id}/results-summary
   */
  get_step_results_summary = (
    { projectId, stepId, ...query }: GetStepResultsSummaryParams,
    params: RequestParams = {},
  ) =>
    this.request<GetStepResultsSummaryData, GetStepResultsSummaryError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}/results-summary`,
      method: "GET",
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, stream, dbtn/module:custom_steps
   * @name legacy_trigger_bulk_basic_reprocessing
   * @summary Legacy Trigger Bulk Basic Reprocessing
   * @request GET:/routes/api/custom-steps/{project_id}/{step_id}/reprocess
   */
  legacy_trigger_bulk_basic_reprocessing = (
    { projectId, stepId, ...query }: LegacyTriggerBulkBasicReprocessingParams,
    params: RequestParams = {},
  ) =>
    this.requestStream<LegacyTriggerBulkBasicReprocessingData, LegacyTriggerBulkBasicReprocessingError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}/reprocess`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name get_step_reprocessing_progress
   * @summary Get Step Reprocessing Progress
   * @request GET:/routes/api/custom-steps/{project_id}/{step_id}/progress
   */
  get_step_reprocessing_progress = (
    { projectId, stepId, ...query }: GetStepReprocessingProgressParams,
    params: RequestParams = {},
  ) =>
    this.request<GetStepReprocessingProgressData, GetStepReprocessingProgressError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}/progress`,
      method: "GET",
      ...params,
    });

  /**
   * No description
   *
   * @tags Processing Steps, dbtn/module:custom_steps
   * @name manage_step_reprocessing
   * @summary Manage Step Reprocessing
   * @request POST:/routes/api/custom-steps/{project_id}/{step_id}/manage
   */
  manage_step_reprocessing = (
    { projectId, stepId, ...query }: ManageStepReprocessingParams,
    data: StepActionRequest,
    params: RequestParams = {},
  ) =>
    this.request<ManageStepReprocessingData, ManageStepReprocessingError>({
      path: `/routes/api/custom-steps/${projectId}/${stepId}/manage`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
}
