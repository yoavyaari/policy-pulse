import React from "react";
import { Header } from "./Header"; // Import the Header component

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children} {/* Render the page-specific content */}
      </main>
      {/* Add a Footer component here later if needed */}
      {/* <Footer /> */}
    </div>
  );
}
