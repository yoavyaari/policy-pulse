import React from "react";
import { Layout } from "components/Layout";
import { AuthForm } from "components/AuthForm";
import { useNavigate, Link } from "react-router-dom"; // Import Link
import { useAuthStore } from "utils/authStore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button"; // Import Button for link style

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithPassword, isLoading, error } = useAuthStore((state) => ({
    signInWithPassword: state.signInWithPassword,
    isLoading: state.loading,
    error: state.error,
  }));

  const handleLogin = async (email: string, password: string) => {
    const { error } = await signInWithPassword(email, password);

    if (error) {
      toast.error(error.message || "An unknown error occurred during login.");
      console.error("Login failed:", error);
    } else {
      toast.success("Login successful!");
      navigate("/"); // Redirect to home page on successful login
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"> {/* Centering container */}
        <AuthForm
          formType="login"
          onSubmit={handleLogin}
          isLoading={isLoading}
          error={error?.message}
        />
        {/* Add Forgot Password link below the form */}
        <div className="mt-4 text-center text-sm">
           <Link 
              to="/PasswordResetPage"
              className="underline text-primary hover:text-primary/80"
           >
             Forgot Password?
           </Link>
        </div>
      </div>
    </Layout>
  );
}
