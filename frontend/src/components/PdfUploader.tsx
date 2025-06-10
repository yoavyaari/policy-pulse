import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { supabase } from "utils/supabaseConfig"; // Ensure correct path
import { useAuthStore } from "utils/authStore"; // Ensure correct path
import { useProjectStore } from "utils/projectStore"; // Added for project context
import brain from "brain"; // Import brain client
import { ProcessPdfRequest } from "types"; // Import request type
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

interface UploadProgress {
  fileName: string;
  progress: number;
  error?: string;
}

export function PdfUploader() {
  const user = useAuthStore((state) => state.user);
  const currentProjectId = useProjectStore((state) => state.currentProjectId); // Get current project ID
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (!user) {
        toast.error("You must be logged in to upload files.");
        return;
      }

      // Check if a project is selected
      if (!currentProjectId) {
        toast.error("No project selected. Please select a project before uploading documents.");
        return;
      }

      // Handle rejected files (non-PDFs)
      if (fileRejections.length > 0) {
        fileRejections.forEach(({ file, errors }) => {
          toast.error(
            `File ${file.name} was rejected (only PDF and DOCX files are accepted): ${errors
              .map((e) => e.message)
              .join(", ")}`
          );
        });
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      setIsUploading(true);
      const initialProgress = acceptedFiles.map((file) => ({
        fileName: file.name,
        progress: 0,
      }));
      setUploadProgress(initialProgress);

      // Function to sanitize filenames
      const sanitizeFileName = (fileName: string): string => {
        const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        const extension = fileName.substring(fileName.lastIndexOf('.'));
        // Replace spaces with underscores, remove invalid characters
        const sanitizedName = nameWithoutExtension.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
        return sanitizedName + extension;
      };

      const uploadPromises = acceptedFiles.map(async (file, index) => {
        // Ensure project ID is available (redundant check due to useCallback dependency, but safe)
        if (!currentProjectId) {
           console.error("Upload started without a project ID somehow. Aborting file:", file.name);
           setUploadProgress((prev) =>
             prev.map((item, i) =>
               i === index ? { ...item, error: "Internal error: Project ID missing." } : item
             )
           );
           return;
        }

        // --- BEGIN NEW DIAGNOSTIC LOGGING ---
        try {
          const currentSession = await supabase.auth.getSession();
          console.log("[AUTH DIAGNOSTIC] Supabase session at time of upload:", currentSession);
          console.log("[AUTH DIAGNOSTIC] User from useAuthStore:", user);
          const authStoreUserId = user?.id;
          const sessionUserId = currentSession?.data?.session?.user?.id;
          console.log("[AUTH DIAGNOSTIC] User ID from useAuthStore used for path:", authStoreUserId);
          console.log("[AUTH DIAGNOSTIC] User ID from current Supabase session:", sessionUserId);

          if (authStoreUserId !== sessionUserId) {
              console.error(
                "CRITICAL AUTH MISMATCH: AuthStore user ID does not match Supabase session user ID!",
                { authStoreUserId, sessionUserId }
              );
              toast.error("Authentication mismatch. Please log out and log back in, then try again.");
              setUploadProgress((prev) =>
                prev.map((item, i) =>
                  i === index ? { ...item, error: "Auth mismatch. Re-login required." } : item
                )
              );
              // We might want to not proceed with the upload if there's a mismatch
              // return; // Uncomment to abort upload on mismatch
          }
        } catch (authError) {
          console.error("[AUTH DIAGNOSTIC] Error fetching Supabase session:", authError);
          toast.error("Could not verify authentication session. Please try again.");
        }
        // --- END NEW DIAGNOSTIC LOGGING ---


        const sanitizedFileName = sanitizeFileName(file.name);
        const filePath = `${user.id}/${currentProjectId}/${sanitizedFileName}`; // Store under user ID/project ID folder

        console.log("Attempting upload:", { userId: user.id, projectId: currentProjectId, fileName: file.name, sanitizedFileName, path: filePath });

        try {
          const { error } = await supabase.storage
            .from("pdf-documents") // Use the correct bucket name
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false, // Prevent overwriting for now
            });

          if (error) {
            // Handle potential duplicate file error specifically
             if (error.message?.includes('Duplicate')) {
               const specificError = `File '${file.name}' already exists in this project.`;
               toast.warning(specificError);
               setUploadProgress((prev) =>
                 prev.map((item, i) => (i === index ? { ...item, progress: 100, error: "Duplicate" } : item))
               );
               // Don't trigger backend processing for duplicates? Or let backend handle it?
               // For now, let's skip backend call for known duplicates.
               return; // Stop processing this file
             } else {
               throw error; // Rethrow other storage errors
             }
          }

          // Update progress for this file to 100 on success (simplified)
          setUploadProgress((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, progress: 100 } : item
            )
          );
           toast.success(`Successfully uploaded ${file.name}`);

          // --- Trigger backend processing ---
          console.log(`Triggering backend processing for: ${filePath}`);
          try {
            const processRequest: ProcessPdfRequest = {
              storage_path: filePath,
              user_id: user.id,
              file_name: sanitizedFileName, // Pass the sanitized filename
              project_id: currentProjectId, // Add the current project ID
            };
            const processResponse = await brain.process_pdf_endpoint(processRequest);
            // Log the response from the processing endpoint
            const responseData = await processResponse.json(); // Use .json() as it returns HttpResponse
            console.log(`Backend processing initiated for ${file.name}:`, responseData);
             toast.info(`Backend processing started for ${file.name}.`); // Inform user processing started
          } catch (processError: any) {
            console.error(`Failed to trigger backend processing for ${file.name}:`, processError);
            toast.error(`Could not start backend processing for ${file.name}: ${processError.message || 'Unknown error'}`);
            // Update the specific UploadProgress item with a processing error.
             setUploadProgress((prev) =>
               prev.map((item, i) =>
                 i === index ? { ...item, error: `Processing start failed: ${processError.message || 'Unknown error'}` } : item
               )
             );
          }
          // --- End Trigger backend processing ---

        } catch (error: any) {
           console.error("Upload error:", error);
          // Update progress for this file with error
          setUploadProgress((prev) =>
            prev.map((item, i) =>
              i === index
                ? {
                    ...item,
                    progress: 0, // Reset progress on error
                    error: error.message || "Upload failed",
                  }
                : item
            )
          );
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
        }
      });

      await Promise.allSettled(uploadPromises);
      setIsUploading(false);
      // Optionally clear progress after a delay or keep it visible
       // setTimeout(() => setUploadProgress([]), 5000); // Clear after 5 seconds - Let's keep them visible for now
    },
    [user, currentProjectId] // Add currentProjectId to dependencies
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    }, // Accept PDF and DOCX files
    noClick: true, // Prevent opening file dialog on click of the dropzone itself
    noKeyboard: true,
    disabled: isUploading || !user || !currentProjectId, // Disable while uploading, not logged in, or no project selected
  });

  const removeFile = (fileName: string) => {
     setUploadProgress(prev => prev.filter(f => f.fileName !== fileName));
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer 
                    ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}
                    ${isUploading || !user || !currentProjectId ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="font-semibold text-primary">Drop the PDF or DOCX files here ...</p>
        ) : (
           <p className="text-gray-500">
             {currentProjectId ? "Drag 'n' drop PDF or DOCX files here, or click button below" : "Select a project first"}
           </p>
        )}
         {!user && (
             <p className="text-sm text-red-600 mt-2">Please log in to upload files.</p>
         )}
         {user && !currentProjectId && (
             <p className="text-sm text-orange-600 mt-2">Please select a project from the dropdown above before uploading.</p>
         )}
      </div>
      <Button onClick={open} disabled={isUploading || !user || !currentProjectId} className="mt-4 w-full">
          Select PDF or DOCX Files for Current Project
      </Button>

      {uploadProgress.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Uploads</h3>
          {uploadProgress.map((item, index) => (
            <div key={`${item.fileName}-${index}`} className={`border p-3 rounded-lg ${item.error === 'Duplicate' ? 'bg-yellow-50 border-yellow-200' : 'bg-background'}`}>
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="h-6 w-6 text-gray-500 flex-shrink-0" />
                    <p className="text-sm font-medium truncate flex-grow" title={item.fileName}>{item.fileName}</p>
                 </div>
                 {!isUploading && (
                     <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFile(item.fileName)}>
                         <X className="h-4 w-4" />
                     </Button>
                 )}
              </div>
              {(item.progress > 0 || isUploading) && item.error !== 'Duplicate' && (
                 <Progress value={item.progress} className="mt-2 h-2" />
              )}
              {item.error && item.error !== 'Duplicate' && (
                <p className="text-xs text-red-600 mt-1">Error: {item.error}</p>
              )}
               {item.progress === 100 && !item.error && (
                <p className="text-xs text-green-600 mt-1">Upload complete. Processing started.</p>
              )}
               {item.error === 'Duplicate' && (
                 <p className="text-xs text-yellow-700 mt-1">Duplicate: File already exists in this project.</p>
               )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
