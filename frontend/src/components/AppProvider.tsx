import React, { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
// Removed incorrect ThemeProvider import
import { Toaster } from "@/components/ui/sonner"; // Use sonner for toasts
import { useAuthStore } from "utils/authStore"; // Correct path
import { useProjectStore } from "utils/projectStore"; // Import the project store

interface Props {
  children: React.ReactNode;
}

export function AppProvider({ children }: Props) {

  const user = useAuthStore((state) => state.user);
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const listenToAuthState = useAuthStore((state) => state.listenToAuthState);

  // Debug: Log AppProvider render and user ID
  console.log(`AppProvider Render - User ID: ${user?.id}`);

  useEffect(() => {
    // Start listening to auth changes when the provider mounts
    const { data: authListener } = listenToAuthState();

    // Stop listening when the provider unmounts
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [listenToAuthState]);

  // Fetch projects when user logs in
  useEffect(() => {
    // Debug: Log when the effect runs
    console.log(`AppProvider Effect Triggered - User ID: ${user?.id}`);
    if (user) {
      console.log("User logged in, fetching projects...");
      fetchProjects();
    }
    // We could clear projects on logout if needed, but the store handles its own state.
    // else {
    //   // Optionally clear projects or selected project on logout
    // }
  }, [user?.id]); // Only depend on user ID

  // Return children wrapped in TooltipProvider and Toaster (No ThemeProvider here)
  return (
    <>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster richColors position="top-right" /> {/* Add Toaster here */}
    </>
  );
}