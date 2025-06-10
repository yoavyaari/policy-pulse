import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "utils/authStore";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Layout } from "components/Layout"; // Import Layout

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const { resetPasswordForEmail, loading, error } = useAuthStore((state) => ({
    resetPasswordForEmail: state.resetPasswordForEmail,
    loading: state.loading, // Use loading state from store
    error: state.error,
  }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { error } = await resetPasswordForEmail(email);

    if (error) {
      toast.error(
        error.message || "An error occurred sending the password reset email."
      );
      console.error("Password reset request failed:", error);
    } else {
      toast.success(
        "Password reset email sent! Please check your inbox (and spam folder)."
      );
      // Optionally navigate back to login or show a confirmation message
      // navigate("/LoginPage");
    }
  };

  return (
    <Layout> {/* Wrap in Layout */}
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your email address below and we'll send you a link to reset
              your password.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error.message}</p>}
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send Reset Link
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate("/LoginPage")} // Link back to login
                className="p-0 h-auto text-sm"
              >
                Back to Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
