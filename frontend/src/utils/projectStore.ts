import { create } from "zustand";
import brain from "../brain"; 
import { ProjectResponse } from "../brain/data-contracts";

interface ProjectState {
  projects: ProjectResponse[];
  currentProjectId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  setCurrentProjectId: (projectId: string | null) => void;
  addProject: (project: ProjectResponse) => void; // New action
  updateProjectInStore: (project: ProjectResponse) => void; // Added for editing
  // getProjectById: (projectId: string) => ProjectResponse | undefined;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: localStorage.getItem("currentProjectId") || null,
  isLoading: false,
  error: null,
  fetchProjects: async () => {
    console.log("[projectStore] fetchProjects called"); // New Log
    set({ isLoading: true, error: null });
    try {
      console.log("[projectStore] Fetching projects from brain..."); // Updated Log
      const response = await brain.list_projects();
      console.log("[projectStore] list_projects response status:", response.status); // New Log
      if (!response.ok) {
        let errorDetail = "Failed to fetch projects";
        try {
            const errorData = await response.json();
            console.error("[projectStore] Error data from list_projects:", errorData); // New Log
            errorDetail = errorData.detail || errorDetail;
        } catch (jsonErr) {
            console.error("[projectStore] Could not parse error JSON from list_projects:", jsonErr); // New Log
        }
        throw new Error(errorDetail);
      }
      const data: { projects: ProjectResponse[] } = await response.json();
      console.log("[projectStore] Projects fetched from brain:", data.projects); // Updated Log
      set({ projects: data.projects, isLoading: false });
      
      const currentId = get().currentProjectId;
      console.log(`[projectStore] After fetch - currentId from get(): ${currentId}, data.projects.length: ${data.projects.length}`); // New Log

      if (data.projects.length > 0) {
        if (!currentId || !data.projects.find(p => p.id === currentId)) {
          const newCurrentId = data.projects[0].id;
          console.log("[projectStore] Attempting to set currentProjectId to first project:", newCurrentId); // New Log
          set({ currentProjectId: newCurrentId });
          localStorage.setItem("currentProjectId", newCurrentId);
          console.log("[projectStore] Successfully set current project ID to first project:", newCurrentId); // New Log
        } else {
          console.log("[projectStore] Current project ID already valid and found in fetched projects:", currentId); // New Log
        }
      } else {
        console.log("[projectStore] No projects available after fetch."); // New Log
        if (currentId) {
            console.log("[projectStore] Clearing current project ID as no projects are available."); // New Log
            set({ currentProjectId: null });
            localStorage.removeItem("currentProjectId");
            console.log("[projectStore] Successfully cleared current project ID."); // New Log
        }
      }
    } catch (err: any) {
      console.error("[projectStore] Error in fetchProjects:", err.message, err.stack); // Updated Log
      set({ error: err.message, isLoading: false });
    }
  },
  setCurrentProjectId: (projectId: string | null) => {
    set({ currentProjectId: projectId });
    if (projectId) {
      localStorage.setItem("currentProjectId", projectId);
      console.log("Current project ID set to:", projectId);
    } else {
      localStorage.removeItem("currentProjectId");
      console.log("Current project ID cleared.");
    }
  },
  addProject: (project: ProjectResponse) => {
    set((state) => ({
      projects: [...state.projects, project].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    }));
    console.log("Project added to store:", project);
  },
  updateProjectInStore: (project: ProjectResponse) => {
    set((state) => ({
      projects: state.projects.map((p) => 
        p.id === project.id ? project : p
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), // Keep sorted
    }));
    console.log("Project updated in store:", project);
  },
  // getProjectById: (projectId: string) => {
  //   return get().projects.find(p => p.id === projectId);
  // }
}));