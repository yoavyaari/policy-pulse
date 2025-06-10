import React, { useEffect, useState } from "react";
import { useProjectStore } from "../utils/projectStore";
// Removed unused useAuthStore and other Dialog related imports
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
// Removed brain, toast, ProjectResponse imports as they are related to creation dialog

export const ProjectSelector: React.FC = () => {
  const {
    projects,
    currentProjectId,
    isLoading,
    error,
    fetchProjects,
    setCurrentProjectId,
    // Removed addProject as it's part of the creation dialog
  } = useProjectStore();
  // Removed user, isCreateDialogOpen, newProjectName, isCreating states

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectChange = (projectId: string) => {
    setCurrentProjectId(projectId);
  };

  // Removed handleCreateProject function

  if (isLoading) return <div className="text-sm text-gray-500">Loading projects...</div>;
  if (error) return <div className="text-sm text-red-500">Error loading projects: {error}</div>;

  return (
    <div className="flex items-center space-x-2 p-2 bg-white shadow rounded-md">
      <Label htmlFor="project-select" className="text-sm font-medium text-gray-700">
        Current Project:
      </Label>
      <Select value={currentProjectId || ""} onValueChange={handleProjectChange} disabled={projects.length === 0 && !currentProjectId}>
        <SelectTrigger id="project-select" className="w-[200px] bg-gray-50 border-gray-300 focus:ring-blue-500 focus:border-blue-500">
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.length > 0 ? (
            projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="no-projects" disabled>
              No projects available.
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {/* Removed Dialog and DialogTrigger for project creation */}
    </div>
  );
};