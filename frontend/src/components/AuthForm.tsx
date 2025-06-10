import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react"; // For loading indicator

interface Props {
  formType: "login" | "signup";
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export function AuthForm({ formType, onSubmit, isLoading, error }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoading) {
      onSubmit(email, password);
    }
  };

  const title = formType === "login" ? "Log In" : "Sign Up";
  const description = formType === "login"
    ? "Enter your email below to log in to your account."
    : "Enter your email below to create an account.";
  const buttonText = formType === "login" ? "Log In" : "Sign Up";

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
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
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
             {error && (
               <p className="text-sm text-red-600">{error}</p>
             )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {buttonText}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
