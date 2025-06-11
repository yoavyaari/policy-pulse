import React, { useState, useEffect, useCallback } from "react"; // Add useCallback
// import { useProjectStore } from "utils/projectStore"; // REMOVE THIS LINE
// Removed useSearchParams, useNavigate
import brain from "brain";
import { DocumentDetailsResponse, TopicDetail, CustomStepResponse } from "types"; // Added CustomStepResponse 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, AlertCircle, RefreshCw } from "lucide-react"; // Add RefreshCw icon
import { toast } from "sonner";

// Define Props interface
interface Props {
    documentId: string;
    projectId: string | null; // Added projectId
    onBack: () => void;
}

// Rename component and use named export
export const DocumentDetailsDisplay: React.FC<Props> = ({ documentId, projectId, onBack }) => {
  // Removed searchParams and navigate hooks
  // Document ID now comes from props

  const [documentDetails, setDocumentDetails] = useState<DocumentDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isReprocessing, setIsReprocessing] = useState<boolean>(false); // State for basic reprocessing button
  const [isReprocessingAll, setIsReprocessingAll] = useState<boolean>(false); // State for full reprocessing button
  const [customSteps, setCustomSteps] = useState<CustomStepResponse[]>([]); // State for custom steps/rules

  // REMOVED useProjectStore hook call for currentProjectId and isProjectsLoading

  // --- Fetch custom steps/rules ---
  const fetchCustomSteps = useCallback(async () => {
    if (!projectId) {
      console.warn("Skipping fetchCustomSteps - no project ID");
      setCustomSteps([]);
      return;
    }
    try {
      console.log(`Fetching custom steps for project: ${projectId}`);
      const response = await brain.list_custom_steps_for_project({ project_id: projectId });
      if (response.ok) {
        const data: CustomStepResponse[] = await response.json();
        setCustomSteps(data || []);
        console.log("Fetched custom steps:", data);
      } else {
        console.error("Failed to fetch custom steps:", response.statusText);
        toast.warn("Could not load rule names for custom analysis results.");
        setCustomSteps([]);
      }
    } catch (err: any) {
      console.error("Error fetching custom steps:", err);
      toast.warn("An error occurred while loading rule names.");
      setCustomSteps([]);
    }
  }, [projectId]);

  // --- Fetch function wrapped in useCallback ---
  const fetchDetails = useCallback(async () => {
    // Use documentId from props
    if (!documentId) {
      setError("Document ID was not provided.");
      setIsLoading(false);
      toast.error("Cannot load details: Document ID missing.");
      return;
    }
    // Add check for project ID (now from props)
    if (!projectId) {
      setError("Project ID was not provided. Cannot load document details.");
      setIsLoading(false);
      toast.error("Cannot load details: Project ID missing.");
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log(`Fetching details for document ID: ${documentId} in project: ${projectId}`);

    try {
      // Pass documentId and project_id (from props) in a single object
      const response = await brain.get_document_details({
        documentId: documentId,
        project_id: projectId, // Use projectId from props
      });

      if (response.ok) {
        const data: DocumentDetailsResponse = await response.json();
        console.log("Fetched document details:", data);
        setDocumentDetails(data);
      } else {
        let errorText = `HTTP error! status: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorText = errorData.detail || errorText;
        } catch (jsonError) {
          console.warn("Could not parse error response JSON:", jsonError);
        }
        console.error(`Failed to fetch document details: ${errorText}`);
        setError(errorText);
        toast.error(`Failed to load details: ${errorText}`);
      }
    } catch (err: any) {
      console.error("Error fetching document details:", err);
      const errorMessage = err.message || "An unexpected error occurred.";
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, projectId]); // Depend on documentId AND projectId from props

  // --- useEffect to call fetchDetails on mount/change --- 
  useEffect(() => {
    // Fetch details and steps when documentId or projectId changes and both are valid
    if (documentId && projectId) {
      console.log(`Effect triggered: Fetching document details for doc ${documentId} in project ${projectId}.`);
      fetchDetails();
      fetchCustomSteps(); // Fetch custom steps as well
    } else {
      console.log(`Effect triggered: Waiting for documentId or projectId. Doc: ${documentId}, Proj: ${projectId}`);
      // Clear details if project or document context becomes invalid
      setDocumentDetails(null);
      // Clear custom steps if project context becomes invalid
      setCustomSteps([]);
      setIsLoading(false);
      if (!projectId) {
         setError("No project ID provided. Cannot display document details.");
      }
      if (!documentId) {
         setError("No document ID provided. Cannot display document details."); // Should be caught by parent, but good practice
      }
    }
  }, [documentId, projectId, fetchDetails, fetchCustomSteps]); // Added fetchCustomSteps to dependencies


  // --- Handler for Basic Reprocessing ---
  const handleReprocessBasic = async () => {
    if (!documentId) {
        toast.error("Cannot reprocess: Document ID missing.");
        return;
    }
    
    setIsReprocessing(true);
    toast.info("Starting basic reprocessing...");
    console.log(`Starting basic reprocessing for document ID: ${documentId}`);

    try {
        const response = await brain.reprocess_basic_analysis_endpoint({ documentId });
        const data = await response.json(); // Try to parse JSON even on error for details

        if (response.ok && data.success) {
            console.log("Basic reprocessing successful:", data);
            toast.success(data.message || "Basic reprocessing completed successfully!");
            // Refresh details after successful reprocessing
            await fetchDetails(); 
        } else {
            const errorMsg = data.message || `HTTP error ${response.status}: Reprocessing failed.`;
            console.error("Basic reprocessing failed:", data || response.statusText);
            toast.error(`Reprocessing failed: ${errorMsg}`);
        }
    } catch (err: any) {
        console.error("Error during basic reprocessing call:", err);
        const errorMessage = err.message || "An unexpected network or client error occurred.";
        toast.error(`Reprocessing error: ${errorMessage}`);
    } finally {
        setIsReprocessing(false);
    }
  };

  // --- Handler for Full Reprocessing (Basic + Custom) ---
  const handleReprocessAll = async () => {
    if (!documentId) {
        toast.error("Cannot reprocess: Document ID missing.");
        return;
    }
    
    setIsReprocessingAll(true);
    toast.info("Starting full reprocessing (basic + custom)...", { duration: 5000 }); // Longer toast duration
    console.log(`Starting full reprocessing for document ID: ${documentId}`);

    try {
        // Assuming the endpoint name from MYA-38 is reprocess_full_analysis_endpoint
        const response = await brain.reprocess_full_analysis_endpoint({ documentId });
        const data = await response.json(); // Try to parse JSON even on error for details

        if (response.ok && data.success) {
            console.log("Full reprocessing successful:", data);
            toast.success(data.message || "Full reprocessing completed successfully!");
            // Refresh details after successful reprocessing
            await fetchDetails(); 
        } else {
            const errorMsg = data.message || `HTTP error ${response.status}: Full reprocessing failed.`;
            console.error("Full reprocessing failed:", data || response.statusText);
            toast.error(`Full reprocessing failed: ${errorMsg}`);
        }
    } catch (err: any) {
        console.error("Error during full reprocessing call:", err);
        const errorMessage = err.message || "An unexpected network or client error occurred.";
        toast.error(`Full reprocessing error: ${errorMessage}`);
    } finally {
        setIsReprocessingAll(false);
    }
  };


  // --- Rendering logic remains largely the same --- 

  const renderLoading = () => (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-4 w-1/3" /> <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" /> <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" /> <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" /> <Skeleton className="h-4 w-2/3" />
      </div>
      <Separator />
      <Skeleton className="h-8 w-1/4 mb-4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  const renderError = () => (
    <Alert variant="destructive" className="m-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Document</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString(undefined, { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
    } catch (e) {
      console.warn(`Failed to parse date: ${dateString}`, e);
      return dateString; 
    }
  };

  const renderDetails = () => {
    if (!documentDetails) return null;

    return (
      <>
        {/* Existing Details Card */}
        <Card className="m-4 border shadow-sm rounded-lg">
          <CardHeader className="bg-gray-50 rounded-t-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800 break-all">{documentDetails.file_name || "Unnamed Document"}</CardTitle>
                <CardDescription className="text-xs text-gray-500">ID: {documentDetails.id}</CardDescription>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <Badge
                  variant={documentDetails.status === 'processed' ? 'default' : documentDetails.status === 'error' ? 'destructive' : 'secondary'}
                  className="text-xs font-medium"
                > 
                  {documentDetails.status?.toUpperCase() || "UNKNOWN"}
                </Badge>
                {documentDetails.document_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(documentDetails.document_url!, '_blank')} 
                    className="mt-1"
                  >
                    View Document
                  </Button>
                )}
                {/* Reprocess Buttons */}
                <Button
                  variant="secondary" 
                  size="sm" 
                  onClick={handleReprocessBasic}
                  disabled={isLoading || isReprocessing} // Disable while loading details or reprocessing
                  className="mt-1"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} /> 
                  {isReprocessing ? "Reprocessing..." : "Reprocess Basic"}
                </Button>
                <Button
                  variant="outline" // Use outline to differentiate slightly
                  size="sm" 
                  onClick={handleReprocessAll}
                  disabled={isLoading || isReprocessing || isReprocessingAll} // Disable while loading or any reprocessing
                  className="mt-1"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isReprocessingAll ? 'animate-spin' : ''}`} /> 
                  {isReprocessingAll ? "Reprocessing All..." : "Reprocess All Analysis"}
                </Button>
              </div>
            </div>
            {documentDetails.ai_analysis_error && (
              <Alert variant="destructive" className="mt-2 text-xs p-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                <AlertTitle className="font-semibold">Processing Error</AlertTitle>
                <AlertDescription>{documentDetails.ai_analysis_error}</AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="p-4">
            <Separator className="my-3" />
            
            <h3 className="text-base font-semibold mb-2 text-gray-700">Metadata & Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
              <div className="flex justify-between"><span className="font-medium text-gray-500">Submitter:</span> <span className="text-gray-800">{documentDetails.analysis?.submitter_name || "N/A"}</span></div>
              <div className="flex justify-between"><span className="font-medium text-gray-500">Response Date:</span> <span className="text-gray-800">{formatDate(documentDetails.analysis?.response_date)}</span></div>
              <div className="flex justify-between"><span className="font-medium text-gray-500">Complexity:</span> <span className="text-gray-800">{documentDetails.analysis?.complexity_level || "N/A"}</span></div>
              <div className="flex justify-between"><span className="font-medium text-gray-500">Depth:</span> <span className="text-gray-800">{documentDetails.analysis?.depth_level || "N/A"}</span></div>
              <div className="flex justify-between col-span-1 md:col-span-2"><span className="font-medium text-gray-500">Overall Sentiment:</span> <span className="text-gray-800">{documentDetails.analysis?.overall_sentiment || "N/A"}</span></div>
              <div className="flex justify-between"><span className="font-medium text-gray-500">Uploaded At:</span> <span className="text-gray-800">{formatDate(documentDetails.created_at)}</span></div>
              <div className="flex justify-between"><span className="font-medium text-gray-500">Processed At:</span> <span className="text-gray-800">{formatDate(documentDetails.processed_at)}</span></div>
            </div>

            <Separator className="my-3" />

            <h3 className="text-base font-semibold mb-2 text-gray-700">Topics Discussed</h3>
            {documentDetails.analysis?.topics && documentDetails.analysis.topics.length > 0 ? (
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-600">Topic</TableHead>
                    <TableHead className="font-semibold text-gray-600">Sentiment</TableHead>
                    <TableHead className="font-semibold text-gray-600">Regulation Needed?</TableHead>
                    <TableHead className="font-semibold text-gray-600">Risks Mentioned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentDetails.analysis.topics.map((topic: TopicDetail, index: number) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-800">{topic.name}</TableCell>
                      <TableCell className="text-gray-700">{topic.sentiment || "N/A"}</TableCell>
                      <TableCell className="text-gray-700">{topic.regulation_needed === null ? "N/A" : topic.regulation_needed ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-gray-700">{topic.risks && topic.risks.length > 0 ? topic.risks.join("; ") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-gray-500 italic">No specific topics were identified in this document.</p>
            )}

            <Separator className="my-3" />


            <h3 className="text-base font-semibold mb-2 text-gray-700">Custom Analysis Results</h3>
            {/* --- Recursive JSON Renderer --- */}
            {documentDetails.custom_analysis_results && Object.keys(documentDetails.custom_analysis_results).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(documentDetails.custom_analysis_results).map(([stepId, value]) => {
                  const rule = customSteps.find(s => s.id === stepId);
                  const ruleName = rule ? rule.name : stepId.replace(/_/g, ' '); // Fallback to formatted ID
                  return (
                    <div key={stepId} className="border-t pt-3">
                      <h4 className="text-sm font-semibold mb-2 capitalize text-gray-600">{ruleName}</h4>
                      <div className="pl-4 text-sm">
                        {renderJsonValue(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No custom analysis results available for this document.</p>
            )}

          </CardContent>
        </Card>

        {/* New Card for Raw Analysis Data */}
        <Card className="m-4 mt-6 border shadow-sm rounded-lg">
           <CardHeader className="bg-gray-50 rounded-t-lg p-4">
            <CardTitle className="text-lg font-semibold text-gray-800">Raw Analysis Data</CardTitle>
            <CardDescription className="text-xs text-gray-500">Complete JSON output from the AI analysis process.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {documentDetails.analysis ? (
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto font-mono">
                <code>{JSON.stringify(documentDetails.analysis, null, 2)}</code>
              </pre>
            ) : (
              <p className="text-sm text-gray-500 italic">No raw analysis data available.</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    // Changed container div for better alignment within DocumentManager
    <div className="max-w-4xl w-full">
       {/* Use onBack prop for the back button */}
       <Button variant="outline" size="sm" onClick={onBack} className="mb-4">
         <ArrowLeft className="mr-2 h-4 w-4" /> Back to Document Manager
       </Button>
      {isLoading ? renderLoading() : error ? renderError() : renderDetails()}
    </div>
  );
};


// --- Helper function to recursively render JSON values ---
const renderJsonValue = (value: any): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">N/A</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    // Check if it's an array of simple values or objects
    if (value.length === 0) {
      return <span className="text-gray-500 italic">Empty list</span>;
    }

    // Simple array check (only strings, numbers, booleans)
    const isSimpleArray = value.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null);

    if (isSimpleArray) {
      return (
        <ul className="list-disc pl-5 space-y-1">
          {value.map((item, index) => (
            <li key={index}>{renderJsonValue(item)}</li>
          ))}
        </ul>
      );
    }

    // Array of objects - Render as table
    // Assuming all objects have the same keys, based on the first item
    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      const headers = Object.keys(firstItem);
      return (
        <Table className="my-2 border rounded">
          <TableHeader className="bg-gray-50">
            <TableRow>
              {headers.map(header => (
                <TableHead key={header} className="font-semibold text-gray-600 capitalize px-3 py-2">{header.replace(/_/g, ' ')}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((item, index) => (
              <TableRow key={index} className="hover:bg-gray-50">
                {headers.map(header => (
                  <TableCell key={`${index}-${header}`} className="px-3 py-1.5 align-top">
                    {/* Recursively render cell value */}
                    {renderJsonValue(item[header])} 
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
     // Fallback for arrays with mixed/complex types not fitting table structure
     return <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto font-mono">{JSON.stringify(value, null, 2)}</pre>;
  }

  if (typeof value === 'object') {
    return (
      <div className="space-y-1 pl-4 border-l ml-2">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key}>
            <strong className="capitalize font-medium text-gray-600">{key.replace(/_/g, ' ')}:</strong>
            <div className="pl-3">{renderJsonValue(nestedValue)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback for unknown types
  return String(value);
};


// Removed default export

