import React from "react";
import { useNavigate } from "react-router-dom";
import { AuthForm } from "components/AuthForm"; // Correct path
import { useAuthStore } from "utils/authStore"; // Correct path
import { toast } from "sonner"; // Import toast
import { Layout } from "components/Layout"; // Import Layout

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp, isLoading, error } = useAuthStore((state) => ({
    signUp: state.signUp,
    isLoading: state.loading,
    error: state.error,
  }));

  const handleSignup = async (email: string, password: string) => {
    const { data, error } = await signUp(email, password);

    if (error) {
      toast.error(error.message || "An unknown error occurred during sign up.");
      console.error("Signup failed:", error);
    } else {
      // Check if Supabase returned a user and session directly (e.g., if email confirmation is off)
      if (data.user && data.session) {
          toast.success("Signup successful! You are now logged in.");
          navigate("/"); // Redirect to home if logged in directly
      } else {
         // Default behavior: assume email confirmation is required
         toast.success("Signup successful! Please check your email to confirm your account.");
         // Optional: redirect to a page informing the user to check their email
         // navigate("/check-email"); 
         // Or redirect to login page
         navigate("/LoginPage"); // Navigate to Login page after signup
      }
    }
  };

  return (
    <Layout> {/* Wrap in Layout */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"> {/* Optional: Add centering like LoginPage */}
        <AuthForm
          formType="signup"
          onSubmit={handleSignup}
          isLoading={isLoading}
          error={error?.message}
        />
      </div>
    </Layout>
  );
}
