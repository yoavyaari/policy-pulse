import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PdfUploader } from "components/PdfUploader"; // Ensure correct path
import { useAuthStore } from "utils/authStore"; // Ensure correct path

export default function UploadPage() {
  const navigate = useNavigate();
  const { session, isLoading } = useAuthStore((state) => ({
      session: state.session,
      isLoading: state.loading, // Use loading state to prevent premature redirect
  }));

  useEffect(() => {
    // If finished loading and there's no session, redirect to login
    if (!isLoading && !session) {
      navigate('/LoginPage');
    }
  }, [session, isLoading, navigate]);

  // Optional: Show loading state or null while checking auth
  if (isLoading) {
     return <div>Loading...</div>; // Or a spinner component
  }
  
  // If redirecting, render nothing or a message
  if (!session) {
     return <div>Redirecting to login...</div>;
  }

  // Render the uploader if logged in
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Upload Policy Documents</h1>
      <p className="text-center text-gray-600 mb-8 max-w-xl mx-auto">
        Upload your PDF documents here. They will be stored securely and linked to your account.
        You can upload multiple files at once.
      </p>
      <PdfUploader />
    </div>
  );
}
