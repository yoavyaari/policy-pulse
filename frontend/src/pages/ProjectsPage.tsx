import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "utils/projectStore";
import { useAuthStore } from "utils/authStore"; // Added for user context
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Added Label for create dialog
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Added DialogClose
import { toast } from "sonner";
import brain from "brain";
import { ProjectResponse } from "types";
import { Download } from "lucide-react"; // Added for export icon

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projects, fetchProjects, setCurrentProjectId, updateProjectInStore, addProject } = useProjectStore();
  const user = useAuthStore((state) => state.user); // Get user from auth store

  // State for editing project name
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectResponse | null>(null);
  const [editProjectName, setEditProjectName] = useState(""); // Renamed from newProjectName to avoid conflict

  // State for creating new project
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState(""); // Specific for new project input
  const [isCreating, setIsCreating] = useState(false);

  // State for CSV export
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleEditClick = (project: ProjectResponse) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setIsEditDialogOpen(true);
  };

  const handleSaveName = async () => {
    if (!editingProject || !editProjectName.trim()) {
      toast.error("Project name cannot be empty.");
      return;
    }
    try {
      const response = await brain.update_project_name({ projectId: editingProject.id }, { name: editProjectName.trim() });
      if (response.ok) {
        const updatedProject = await response.json();
        updateProjectInStore(updatedProject);
        toast.success(`Project "${updatedProject.name}" updated successfully.`);
        setIsEditDialogOpen(false);
        setEditingProject(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || "Failed to update project name.");
      }
    } catch (error) {
      console.error("Failed to update project name:", error);
      toast.error("An unexpected error occurred while updating project name.");
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectNameInput.trim()) {
      toast.error("Project name cannot be empty.");
      return;
    }
    if (!user || !user.id) {
      toast.error("You must be logged in to create a project.");
      return;
    }
    setIsCreating(true);
    try {
      const response = await brain.create_project({ name: newProjectNameInput.trim(), owner_user_id: user.id });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create project");
      }
      const createdProject: ProjectResponse = await response.json();
      addProject(createdProject); // Add to store
      setCurrentProjectId(createdProject.id); // Optionally select the new project
      toast.success(`Project "${createdProject.name}" created successfully!`);
      setNewProjectNameInput("");
      setIsCreateDialogOpen(false);
    } catch (err: any) {
      console.error("Error creating project:", err);
      toast.error(`Failed to create project: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportCSV = async (project: ProjectResponse) => {
    setExportingProjectId(project.id);
    const chunks: (string | Uint8Array)[] = [];
    let success = false;

    try {
      // Directly iterate the stream from the brain client for the export_project_to_csv endpoint
      const stream = brain.export_project_to_csv({ projectId: project.id });

      for await (const chunk of stream) {
        chunks.push(chunk);
        success = true; // Mark as successful if we receive at least one chunk
      }

      if (success && chunks.length > 0) {
        const blob = new Blob(chunks, { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const projectNameCleaned = project.name.replace(/[^a-z0-9_\-\s]/gi, "_").replace(/\s+/g, "_");
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, ""); // YYYYMMDDHHMMSS
        a.download = `${projectNameCleaned || project.id}_export_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success(`Successfully exported project "${project.name}" to CSV.`);
      } else if (!success && chunks.length === 0) {
        // Stream was empty, and no actual data chunks were processed, or an error occurred before any chunk.
        // This branch might be hit if the stream completes without yielding anything, 
        // or if an error is thrown before the first yield (caught below).
        // If the catch block doesn't catch an error, and we end up here, it means empty stream.
        console.warn(`CSV export for project "${project.name}" resulted in an empty stream without explicit error.`);
        toast.error(`Failed to export project "${project.name}": No data received from server.`);
      }
      // If success is false but chunks were somehow collected (unlikely with current logic), it's an undefined state.
      // The above conditions should cover success, and errors should be caught below.

    } catch (error: any) {
      console.error(`Failed to export project "${project.name}" to CSV (exception caught):`, error);
      let errorDetail = `Failed to export project "${project.name}".`;

      // Attempt to get a more specific error message
      if (error && typeof error === "object") {
        if (error.detail) { // FastAPI-like error
          errorDetail = error.detail;
        } else if (error.message) { // Standard JS Error object
          errorDetail = error.message;
        } else if (error.status && error.statusText) { // HttpResponse-like error (if client throws this)
           errorDetail = `Server error: ${error.status} ${error.statusText}`;
        } else {
          try {
            // Try to stringify if it's an unknown object structure
            const errorString = JSON.stringify(error);
            if (errorString !== "{}") { // Avoid just showing "{}"
                errorDetail = `An unexpected error occurred: ${errorString}`;
            } else {
                errorDetail = "An unexpected error occurred. Check console for details.";
            }
          } catch (stringifyError) {
            errorDetail = "An unexpected error occurred, and error details could not be stringified.";
          }
        }
      } else if (typeof error === "string") {
        errorDetail = error;
      }
      toast.error(errorDetail);
    } finally {
      setExportingProjectId(null);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        {/* Removed Back to Dashboard button, navigation is via sidebar */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New Project</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter a name for your new project. Click save when you"re done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-project-name" className="text-right">
                  Name
                </Label>
                <Input 
                  id="new-project-name" 
                  value={newProjectNameInput} 
                  onChange={(e) => setNewProjectNameInput(e.target.value)} 
                  className="col-span-3" 
                  placeholder="E.g., Q3 Initiative Analysis"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                   <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" onClick={handleCreateProject} disabled={isCreating || !newProjectNameInput.trim()}>
                {isCreating ? "Creating..." : "Save Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">No projects found. Click "Create New Project" to get started.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>ID: {project.id}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Ensure created_at exists and is a valid date string before formatting */}
              {project.created_at && (
                <p className="text-sm text-gray-600">Created: {new Date(project.created_at).toLocaleDateString()}</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end space-x-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleEditClick(project)}
              >
                Edit Name
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExportCSV(project)} 
                disabled={exportingProjectId === project.id}
              >
                {exportingProjectId === project.id ? (
                  "Exporting..."
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {exportingProjectId !== project.id && "Export CSV"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Edit Project Dialog */}
      {editingProject && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project Name</DialogTitle>
              <DialogDescription>
                Update the name for project "{editingProject.name}".
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                id="projectName"
                value={editProjectName} // Use editProjectName state here
                onChange={(e) => setEditProjectName(e.target.value)} // Update editProjectName state
                placeholder="Enter new project name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveName}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ProjectsPage;
