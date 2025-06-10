import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { useAuthStore } from "utils/authStore";
import { toast } from "sonner";
import { ProjectSelector } from "./ProjectSelector"; // Import the new component

export function Header() {
  const navigate = useNavigate();
  const { session, user, signOut } = useAuthStore((state) => ({
    session: state.session,
    user: state.user,
    signOut: state.signOut,
  }));

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(`Logout failed: ${error.message}`);
    } else {
      toast.success("Successfully logged out");
      navigate("/"); // Navigate to home page after logout
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between mx-auto px-4">
        {/* Logo/Brand Name - Adjusted Link */}
        <Link to="/" className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">PolicyPulse</span>
        </Link>
        {/* Navigation Links Removed */}

        {/* Conditional Auth Buttons & Links */}
        <div className="flex items-center space-x-3">
          {session ? (
            <>
              {/* Project Selector Added Here */}
              <ProjectSelector />

              {/* Upload Link Removed from Header */}

              {user?.email && (
                <span className="text-sm text-gray-600 mr-2 hidden sm:inline">
                  {user.email}
                </span>
              )}
              <Button variant="outline" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => navigate("/LoginPage")}>
                Log in
              </Button>
              <Button onClick={() => navigate("/SignupPage")}>Sign up</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
