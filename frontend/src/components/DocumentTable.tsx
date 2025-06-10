import React, { memo } from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Interface for the document data (matching DocumentManager)
interface Document {
  id: string;
  file_name: string;
  status: "uploaded" | "processing" | "processed" | "error";
  ai_analysis_error: string | null;
  created_at: string;
  processed_at: string | null;
}

// Type for badge variants based on status
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface Props {
  documents: Document[];
  loading: boolean;
  error: string | null;
  selectedDocuments: Set<string>;
  isAllSelected: boolean;
  isRefreshing: boolean;
  onSelectDocument: (docId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  getStatusBadgeVariant: (status: Document["status"]) => BadgeVariant;
  formatDate: (dateString: string | null) => string;
  onRowClick: (documentId: string) => void; // Prop to handle row click
  
}

export const DocumentTable = memo(
  ({
    documents,
    loading,
    error,
    selectedDocuments,
    isAllSelected,
    onSelectDocument,
    onSelectAll,
    getStatusBadgeVariant,
    formatDate,
    isRefreshing,
    onRowClick, // Added prop
  }: Props) => {

    console.log("Rendering DocumentTable");

    if (loading) { 
      return (
        <div className="flex items-center justify-center h-64 border rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading documents...</span>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertTitle>Error Loading Documents</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="border rounded-lg" id="document-table-container">
        <Table id="document-table">
          <TableCaption>
            A list of your uploaded documents and their processing status.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  aria-label="Select all rows"
                />
              </TableHead>
              <TableHead>Filename</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded At</TableHead>
              <TableHead>Processed At</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody id="document-table-body">
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No documents found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocuments.has(doc.id);
                return (
                  <TableRow 
                    key={doc.id} 
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => onRowClick(doc.id)} // Call prop on row click
                    className="cursor-pointer hover:bg-muted/50" // Add cursor and hover to row
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          // Prevent row click from triggering when checkbox is clicked
                          checked?.valueOf() !== 'indeterminate' && onSelectDocument(doc.id, Boolean(checked)); 
                        }}
                        onClick={(e) => e.stopPropagation()} // Stop propagation on checkbox click
                        aria-label={`Select row ${doc.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium break-all">
                      {/* Removed navigation logic from here */}
                      {doc.file_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(doc.status)}>
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(doc.created_at)}</TableCell>
                    <TableCell>{formatDate(doc.processed_at)}</TableCell>
                    <TableCell className="text-red-600 text-xs max-w-[200px] truncate" title={doc.ai_analysis_error ?? ''}>
                       {doc.ai_analysis_error}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  }
);

DocumentTable.displayName = "DocumentTable";

