import React from "react";
// Removed useSearchParams, useNavigate
import { DocumentDetailsDisplay } from "components/DocumentDetailsDisplay"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Define props for the page
interface Props {
  documentId: string;
  projectId: string | null; // Added projectId
  onBack: () => void;
}

const DocumentDetailsPage: React.FC<Props> = ({ documentId, projectId, onBack }) => {
  // Removed hooks for searchParams and navigate
  // documentId and onBack now come directly from props

  if (!documentId || !projectId) { // Check for projectId as well
    return (
      <div className="container mx-auto p-4">
         <Alert variant="destructive" className="m-4">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error Loading Document</AlertTitle>
           {!documentId && <AlertDescription>Document ID was not provided.</AlertDescription>}
           {!projectId && <AlertDescription>Project ID was not provided.</AlertDescription>}
         </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 flex justify-center">
       {/* Render the display component, passing props directly */}
      <DocumentDetailsDisplay documentId={documentId} projectId={projectId} onBack={onBack} />
    </div>
  );
};

export default DocumentDetailsPage;
