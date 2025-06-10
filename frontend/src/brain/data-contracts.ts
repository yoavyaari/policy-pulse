/** AnalysisPipelineConfig */
export interface AnalysisPipelineConfig {
  /**
   * Data Collection Fields
   * Paths to fields to collect from documents for project-wide analysis.
   */
  data_collection_fields?: string[];
  /**
   * Global Aggregation Logic
   * Definition of operations to create global values from collected data.
   */
  global_aggregation_logic?: Record<string, any>;
  /**
   * Document Assignment Logic
   * Definition of operations to assign values to documents using global values.
   */
  document_assignment_logic?: Record<string, any>;
}

/** AnalyticsSummaryResponse */
export interface AnalyticsSummaryResponse {
  /** Total Documents */
  total_documents: number;
  /** Sentiment Distribution */
  sentiment_distribution?: Record<string, number>;
  /** Complexity Distribution */
  complexity_distribution?: Record<string, number>;
  /** Top Topics */
  top_topics?: TopicCount[];
  /** Error */
  error?: string | null;
}

/** BasicReprocessResponse */
export interface BasicReprocessResponse {
  /** Success */
  success: boolean;
  /** Message */
  message: string;
  /** Analysis Result */
  analysis_result?: Record<string, any> | null;
}

/** BulkBasicReprocessRequest */
export interface BulkBasicReprocessRequest {
  /** Document Ids */
  document_ids?: string[] | null;
  /** Statuses */
  statuses?: string[] | null;
  /** Project Id */
  project_id?: string | null;
}

/** BulkReprocessStartResponse */
export interface BulkReprocessStartResponse {
  /** Message */
  message: string;
  /** Task Count */
  task_count: number;
}

/** ConditionalBlockStructure */
export interface ConditionalBlockStructure {
  /**
   * Type
   * @default "conditional_block"
   */
  type?: "conditional_block";
  condition_prompt: PromptConfig;
  /** Action Prompts */
  action_prompts: PromptConfig[];
}

/** CreateProjectRequest */
export interface CreateProjectRequest {
  /**
   * Name
   * The name of the project.
   * @minLength 1
   * @maxLength 255
   */
  name: string;
  /**
   * Owner User Id
   * The ID of the user who owns the project.
   */
  owner_user_id: string;
}

/** CustomStepCreate */
export interface CustomStepCreate {
  /** Name */
  name: string;
  /** Description */
  description?: string | null;
  /** Prompts */
  prompts?: (StandardPromptStructure | ConditionalBlockStructure)[] | null;
  /**
   * Processing Mode
   * The processing mode for this step. 'document_by_document' is the default, 'project_wide_dynamic_analysis' enables multi-step project-level analysis.
   * @default "document_by_document"
   */
  processing_mode?: "document_by_document" | "project_wide_dynamic_analysis" | null;
  /** Configuration for project-wide dynamic analysis. Only applicable if processing_mode is 'project_wide_dynamic_analysis'. */
  analysis_pipeline_config?: AnalysisPipelineConfig | null;
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
}

/** CustomStepCreateRequest */
export interface CustomStepCreateRequest {
  /** Name */
  name: string;
  /** Description */
  description?: string | null;
}

/** CustomStepUpdate */
export interface CustomStepUpdate {
  /** Name */
  name?: string | null;
  /** Description */
  description?: string | null;
  /** Prompts */
  prompts?: (StandardPromptStructure | ConditionalBlockStructure)[] | null;
  /** Processing Mode */
  processing_mode?: "document_by_document" | "project_wide_dynamic_analysis" | null;
  analysis_pipeline_config?: AnalysisPipelineConfig | null;
}

/** CustomStepUpdateRequest */
export interface CustomStepUpdateRequest {
  /** Name */
  name: string;
  /** Description */
  description?: string | null;
}

/** DeleteStepResultsResponse */
export interface DeleteStepResultsResponse {
  /**
   * Step Id
   * @format uuid
   */
  step_id: string;
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
  /** Message */
  message: string;
  /** Results Cleared */
  results_cleared: boolean;
  /** Step Reset */
  step_reset: boolean;
}

/** DocumentAnalysis */
export interface DocumentAnalysis {
  /** Submitter Name */
  submitter_name?: string | null;
  /** Response Date */
  response_date?: string | null;
  /** Complexity Level */
  complexity_level?: "single sentence" | "up to 2 paragraphs" | "1-2 pages" | "longer" | null;
  /** Depth Level */
  depth_level?: "superficial" | "moderate" | "in-depth" | "detailed" | null;
  /** Overall Sentiment */
  overall_sentiment?: "positive" | "negative" | "neutral" | null;
  /** Topics */
  topics?: TopicDetail[] | null;
}

/** DocumentDetailsResponse */
export interface DocumentDetailsResponse {
  /**
   * Id
   * @format uuid
   */
  id: string;
  /** File Name */
  file_name: string;
  /** Status */
  status: string;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
  /** Processed At */
  processed_at?: string | null;
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
  /** Storage Path */
  storage_path: string;
  /** User Id */
  user_id?: string | null;
  analysis?: DocumentAnalysis | null;
  /** Custom Analysis Results */
  custom_analysis_results?: Record<string, any> | null;
  /** Ai Analysis Error */
  ai_analysis_error?: string | null;
}

/** DocumentListItem */
export interface DocumentListItem {
  /**
   * Id
   * @format uuid
   */
  id: string;
  /** File Name */
  file_name: string;
  /** Status */
  status: string;
  /** Complexity */
  complexity?: "single sentence" | "up to 2 paragraphs" | "1-2 pages" | "longer" | null;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
  /** Ai Analysis Error */
  ai_analysis_error?: string | null;
  /** Processed At */
  processed_at?: string | null;
}

/** ExecuteAssignmentResponse */
export interface ExecuteAssignmentResponse {
  /** Success */
  success: boolean;
  /** Message */
  message: string;
  /** Total Documents In Project */
  total_documents_in_project: number;
  /** Documents Updated */
  documents_updated: number;
  /**
   * Step Id
   * @format uuid
   */
  step_id: string;
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthResponse */
export interface HealthResponse {
  /** Status */
  status: string;
}

/** KeyValueDistribution */
export interface KeyValueDistribution {
  /** Key Name */
  key_name: string;
  /** Total Occurrences */
  total_occurrences: number;
  /** Value Distribution */
  value_distribution: SimpleValueDistribution[];
}

/** ListCustomStepsResponse */
export interface ListCustomStepsResponse {
  /** Steps */
  steps: AppApisProcessingStepsCustomStepResponse[];
}

/** ListDocumentsResponse */
export interface ListDocumentsResponse {
  /** Documents */
  documents: DocumentListItem[];
}

/** ListProjectsResponse */
export interface ListProjectsResponse {
  /** Projects */
  projects: ProjectResponse[];
}

/** NestedKeyValueSummary */
export interface NestedKeyValueSummary {
  /** Outer Key Name */
  outer_key_name: string;
  /** Inner Key Summary */
  inner_key_summary: KeyValueDistribution[];
}

/**
 * ProcessPdfRequest
 * Data needed to start processing a newly uploaded PDF.
 */
export interface ProcessPdfRequest {
  /**
   * Storage Path
   * The path to the PDF file in Supabase Storage.
   */
  storage_path: string;
  /**
   * User Id
   * The ID of the user who uploaded the file.
   */
  user_id: string;
  /**
   * File Name
   * Original name of the uploaded file.
   */
  file_name: string;
  /**
   * Project Id
   * The ID of the project this document belongs to.
   * @format uuid
   */
  project_id: string;
}

/**
 * ProcessPdfResponse
 * Response after initiating PDF processing.
 */
export interface ProcessPdfResponse {
  /** Success */
  success: boolean;
  /** Message */
  message: string;
  /** Document Id */
  document_id?: string | null;
}

/** ProcessingProgress */
export interface ProcessingProgress {
  /** Status */
  status: string;
  /**
   * Total
   * @default 0
   */
  total?: number;
  /**
   * Processed
   * @default 0
   */
  processed?: number;
  /**
   * Failed
   * @default 0
   */
  failed?: number;
  /**
   * Percent
   * @default 0
   */
  percent?: number;
  /** Currentdocid */
  currentDocId?: string | null;
  /** Currentdocindex */
  currentDocIndex?: number | null;
  /** Message */
  message?: string | null;
  /** Error */
  error?: string | null;
}

/** ProjectResponse */
export interface ProjectResponse {
  /**
   * Name
   * The name of the project.
   * @minLength 1
   * @maxLength 255
   */
  name: string;
  /**
   * Owner User Id
   * The ID of the user who owns the project.
   */
  owner_user_id: string;
  /**
   * Id
   * @format uuid
   */
  id: string;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
}

/** ProjectUpdateRequest */
export interface ProjectUpdateRequest {
  /**
   * Name
   * The new name for the project.
   * @minLength 1
   * @maxLength 255
   */
  name: string;
}

/** PromptConfig */
export interface PromptConfig {
  /** Text */
  text: string;
  /**
   * Include Document Context
   * @default true
   */
  include_document_context?: boolean;
}

/** SimpleValueDistribution */
export interface SimpleValueDistribution {
  /** Value */
  value: any;
  /** Count */
  count: number;
}

/** StandardPromptStructure */
export interface StandardPromptStructure {
  /**
   * Type
   * @default "standard_prompt"
   */
  type?: "standard_prompt";
  prompt: PromptConfig;
}

/** StepActionRequest */
export interface StepActionRequest {
  /** Action */
  action: "pause" | "resume";
}

/** StepActionResponse */
export interface StepActionResponse {
  /**
   * Step Id
   * @format uuid
   */
  step_id: string;
  /** Action */
  action: "pause_requested" | "resume_requested" | "pause_failed" | "resume_failed";
  /** Message */
  message: string;
  /** Details */
  details?: string | null;
}

/** StepResultsSummaryResponse */
export interface StepResultsSummaryResponse {
  /** Step Name */
  step_name: string;
  /** Total Documents Analyzed */
  total_documents_analyzed: number;
  /** Total Project Documents */
  total_project_documents: number;
  /** Summary Type */
  summary_type: "simple_value" | "key_value" | "nested_key_value" | "mixed" | "error" | "no_results" | "empty";
  /**
   * Summary Data
   * Distribution summary, depends on summary_type
   */
  summary_data?: SimpleValueDistribution[] | KeyValueDistribution[] | NestedKeyValueSummary | null;
  /** Error */
  error?: string | null;
}

/** TopicCount */
export interface TopicCount {
  /** Topic Name */
  topic_name: string;
  /** Count */
  count: number;
}

/** TopicDetail */
export interface TopicDetail {
  /** Name */
  name?: string | null;
  /** Sentiment */
  sentiment?: "positive" | "negative" | "neutral" | null;
  /** Risks */
  risks?: string[] | null;
  /** Regulation Needed */
  regulation_needed?: boolean | null;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

/** CustomStepResponse */
export interface AppApisCustomStepsCustomStepResponse {
  /** Name */
  name: string;
  /** Description */
  description?: string | null;
  /** Prompts */
  prompts?: (StandardPromptStructure | ConditionalBlockStructure)[] | null;
  /**
   * Processing Mode
   * The processing mode for this step. 'document_by_document' is the default, 'project_wide_dynamic_analysis' enables multi-step project-level analysis.
   * @default "document_by_document"
   */
  processing_mode?: "document_by_document" | "project_wide_dynamic_analysis" | null;
  /** Configuration for project-wide dynamic analysis. Only applicable if processing_mode is 'project_wide_dynamic_analysis'. */
  analysis_pipeline_config?: AnalysisPipelineConfig | null;
  /**
   * Id
   * @format uuid
   */
  id: string;
  /** Project Id */
  project_id?: string | null;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
  /** Updated At */
  updated_at?: string | null;
  /** Last Reprocess Type */
  last_reprocess_type?: string | null;
  /** Run Status */
  run_status?: string | null;
}

/** CustomStepResponse */
export interface AppApisProcessingStepsCustomStepResponse {
  /** Name */
  name: string;
  /** Description */
  description?: string | null;
  /** Id */
  id: string;
  /**
   * Created At
   * @format date-time
   */
  created_at: string;
}

export type CheckHealthData = HealthResponse;

export interface GetAnalyticsSummaryParams {
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
}

export type GetAnalyticsSummaryData = AnalyticsSummaryResponse;

export type GetAnalyticsSummaryError = HTTPValidationError;

export interface ExportProjectToCsvParams {
  /**
   * Project Id
   * The ID of the project to export
   * @format uuid
   */
  projectId: string;
}

export type ExportProjectToCsvData = any;

export type ExportProjectToCsvError = HTTPValidationError;

export type ListProjectsData = ListProjectsResponse;

export type CreateProjectData = ProjectResponse;

export type CreateProjectError = HTTPValidationError;

export interface UpdateProjectNameParams {
  /**
   * Project Id
   * @format uuid
   */
  projectId: string;
}

export type UpdateProjectNameData = ProjectResponse;

export type UpdateProjectNameError = HTTPValidationError;

export interface LegacyUpdateCustomStepParams {
  /** Step Id */
  stepId: string;
}

export type LegacyUpdateCustomStepData = AppApisProcessingStepsCustomStepResponse;

export type LegacyUpdateCustomStepError = HTTPValidationError;

export interface LegacyDeleteCustomStepParams {
  /** Step Id */
  stepId: string;
}

export type LegacyDeleteCustomStepData = any;

export type LegacyDeleteCustomStepError = HTTPValidationError;

export type LegacyListCustomStepsData = ListCustomStepsResponse;

export type LegacyCreateCustomStepData = AppApisProcessingStepsCustomStepResponse;

export type LegacyCreateCustomStepError = HTTPValidationError;

export type ProcessPdfEndpointData = ProcessPdfResponse;

export type ProcessPdfEndpointError = HTTPValidationError;

export interface ListDocumentsParams {
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
}

export type ListDocumentsData = ListDocumentsResponse;

export type ListDocumentsError = HTTPValidationError;

export interface ReprocessBasicAnalysisEndpointParams {
  /**
   * Document Id
   * @format uuid
   */
  documentId: string;
}

export type ReprocessBasicAnalysisEndpointData = BasicReprocessResponse;

export type ReprocessBasicAnalysisEndpointError = HTTPValidationError;

export type TriggerBulkBasicReprocessingData = BulkReprocessStartResponse;

export type TriggerBulkBasicReprocessingError = HTTPValidationError;

export interface GetDocumentDetailsParams {
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
  /**
   * Document Id
   * @format uuid
   */
  documentId: string;
}

export type GetDocumentDetailsData = DocumentDetailsResponse;

export type GetDocumentDetailsError = HTTPValidationError;

export type CreateCustomStepData = AppApisCustomStepsCustomStepResponse;

export type CreateCustomStepError = HTTPValidationError;

export interface ListCustomStepsForProjectParams {
  /**
   * Project Id
   * @format uuid
   */
  project_id: string;
}

/** Response List Custom Steps For Project */
export type ListCustomStepsForProjectData = AppApisCustomStepsCustomStepResponse[];

export type ListCustomStepsForProjectError = HTTPValidationError;

export interface UpdateCustomStepParams {
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
}

export type UpdateCustomStepData = AppApisCustomStepsCustomStepResponse;

export type UpdateCustomStepError = HTTPValidationError;

export interface DeleteCustomStepParams {
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
}

export type DeleteCustomStepData = any;

export type DeleteCustomStepError = HTTPValidationError;

export interface DeleteStepResultsAndResetProgressParams {
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
}

export type DeleteStepResultsAndResetProgressData = DeleteStepResultsResponse;

export type DeleteStepResultsAndResetProgressError = HTTPValidationError;

export interface ExecuteDocumentAssignmentEndpointParams {
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
}

export type ExecuteDocumentAssignmentEndpointData = ExecuteAssignmentResponse;

export type ExecuteDocumentAssignmentEndpointError = HTTPValidationError;

export interface GetStepResultsSummaryParams {
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
}

export type GetStepResultsSummaryData = StepResultsSummaryResponse;

export type GetStepResultsSummaryError = HTTPValidationError;

export interface LegacyTriggerBulkBasicReprocessingParams {
  /**
   * Reprocess Type
   * Type of reprocessing to perform.
   * @default "all"
   */
  reprocess_type?: "all" | "new" | "failed" | "pending";
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
}

export type LegacyTriggerBulkBasicReprocessingData = any;

export type LegacyTriggerBulkBasicReprocessingError = HTTPValidationError;

export interface GetStepReprocessingProgressParams {
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
}

export type GetStepReprocessingProgressData = ProcessingProgress;

export type GetStepReprocessingProgressError = HTTPValidationError;

export interface ManageStepReprocessingParams {
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
}

export type ManageStepReprocessingData = StepActionResponse;

export type ManageStepReprocessingError = HTTPValidationError;
