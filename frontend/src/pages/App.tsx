import React, { useState } from "react"; // Import useState
import { Button } from "@/components/ui/button";
import { ChevronRight, BarChart3, FileText, Upload, Layers, Search, PieChart, Settings, ListChecks, FolderKanban } from "lucide-react"; // Added FolderKanban
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "utils/authStore";
import { Layout } from "components/Layout";
import { PdfUploader } from "components/PdfUploader"; // Import PdfUploader

// --- Logged-out Landing Page Sections ---

const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Transform Policy Feedback into Actionable Insights
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              PolicyPulse helps analysts process and analyze public response documents at scale, extracting key metadata and insights to inform better policy decisions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Navigate to signup page on button click */}
              <Button size="lg" className="flex items-center gap-2" onClick={() => navigate("/SignupPage")}>
                Get Started <ChevronRight className="h-4 w-4" />
              </Button>
              {/* Removed Learn More button for simplicity for now */}
              {/* <Button size="lg" variant="outline">Learn More</Button> */}
            </div>
          </div>
          <div className="rounded-lg bg-white shadow-xl border p-6 max-w-md">
            {/* Placeholder Illustration/Graphic */}
            <div className="rounded-md bg-blue-50 p-8 flex items-center justify-center">
              <FileText className="h-24 w-24 text-blue-500 opacity-80" />
            </div>
            <div className="mt-6 space-y-2">
              <div className="h-4 bg-gray-200 rounded-full w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded-full"></div>
              <div className="h-4 bg-gray-200 rounded-full w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FeaturesSection = () => (
  <section id="features" className="py-16 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Key Features</h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Powerful tools designed specifically for policy analysis and research
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Feature 1 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <div className="rounded-full bg-blue-100 p-3 w-12 h-12 flex items-center justify-center mb-4">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">PDF Upload & Processing</h3>
          <p className="text-gray-600">
            Upload thousands of PDF documents at once, with automatic queueing and processing to handle large volumes of data.
          </p>
        </div>
        {/* Feature 2 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <div className="rounded-full bg-blue-100 p-3 w-12 h-12 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Metadata Extraction</h3>
          <p className="text-gray-600">
            Automatically identify and extract key information like author, date, complexity, and sentiment from each document.
          </p>
        </div>
        {/* Feature 3 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <div className="rounded-full bg-blue-100 p-3 w-12 h-12 flex items-center justify-center mb-4">
            <Layers className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Topic Analysis</h3>
          <p className="text-gray-600">
            Identify key topics within each document, with detailed sentiment analysis and regulatory position for each topic.
          </p>
        </div>
        {/* Feature 4 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <div className="rounded-full bg-blue-100 p-3 w-12 h-12 flex items-center justify-center mb-4">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Visual Analytics</h3>
          <p className="text-gray-600">
            Visualize document metrics and trends with interactive charts and dashboards for deeper insights.
          </p>
        </div>
        {/* Feature 5 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <div className="rounded-full bg-blue-100 p-3 w-12 h-12 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Advanced Querying</h3>
          <p className="text-gray-600">
            Ask specific questions about your document collection to uncover patterns, trends, and insights.
          </p>
        </div>
        {/* Feature 6 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
          <div className="rounded-full bg-blue-100 p-3 w-12 h-12 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue-600">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Custom Reporting</h3>
          <p className="text-gray-600">
            Generate comprehensive reports on document sentiment, complexity, topics, and more for stakeholder presentations.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-gray-100 py-8">
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center space-x-2 mb-4 md:mb-0">
          <BarChart3 className="h-5 w-5 text-gray-500" />
          <span className="text-gray-600 font-medium">PolicyPulse</span>
        </div>
        <div className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} PolicyPulse. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
);

import { DocumentManager } from "pages/DocumentManager"; // Import the new component
import AnalyticsDashboard from "./AnalyticsDashboard"; // Import the AnalyticsDashboard page
import DocumentDetailsPage from "./DocumentDetailsPage"; // Import the DocumentDetailsPage
import ProcessingManagement from "./ProcessingManagement"; // Import the ProcessingManagement page
import ProjectsPage from "./ProjectsPage"; // ADDED: Import ProjectsPage
import { useProjectStore } from "utils/projectStore"; // Import project store
import { toast } from "sonner"; // For error notifications

const DashboardView = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'upload' | 'documentManager' | 'analytics' | 'processingManagement' | 'projects'>('dashboard'); // Add 'projects'
  const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null); // State for viewing details
  const navigate = useNavigate(); // Ensure navigate is here, it should be as ProjectsPage uses it, App.tsx might need it for this new button too.
  const { currentProjectId } = useProjectStore((state) => ({ currentProjectId: state.currentProjectId })); // Get current project ID

  // Handler to show document details
  const handleViewDocumentDetails = (documentId: string) => {
    if (!currentProjectId) {
      toast.error("Cannot view document details: No project is currently selected.");
      console.error("handleViewDocumentDetails: No currentProjectId found.");
      return;
    }
    setViewingDocumentId(documentId);
    // Optional: Keep sidebar highlighting 'Document Manager' 
    // if (activeView !== 'documentManager') {
    //   setActiveView('documentManager'); // Or maybe don't change activeView?
    // }
  };

  // Handler to go back from details to the manager view
  const handleBackToManager = () => {
    setViewingDocumentId(null);
    // Ensure the document manager view is active if we came from details
    if (activeView !== 'documentManager') {
      setActiveView('documentManager');
    }
  };


  return (
    <div className="flex h-[calc(100vh-theme(space.14))]"> {/* Full height minus header height */}
      {/* Sidebar */}
      <aside className="w-60 border-r bg-muted/40 p-4 flex flex-col">
        <nav className="flex flex-col space-y-2">
          {/* Dashboard Link */}
          <Button 
            variant={activeView === 'dashboard' ? "secondary" : "ghost"} // Highlight active link
            className="justify-start" 
            onClick={() => setActiveView('dashboard')}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          {/* Upload Link */}
          <Button 
            variant={activeView === 'upload' ? "secondary" : "ghost"} // Highlight active link
            className="justify-start" 
            onClick={() => setActiveView('upload')} // Set active view to 'upload'
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
          {/* Document Manager Link */}
          <Button 
            variant={activeView === 'documentManager' ? "secondary" : "ghost"} 
            className="justify-start" 
            onClick={() => setActiveView('documentManager')} 
          >
            <FileText className="mr-2 h-4 w-4" />
            Document Manager
          </Button>
          {/* Analytics Link */}
          <Button 
            variant={activeView === 'analytics' ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setActiveView('analytics')}
          >
            <PieChart className="mr-2 h-4 w-4" /> {/* Use PieChart icon */}
            Analytics
          </Button>
          {/* Processing Management Link */}
          <Button 
            variant={activeView === 'processingManagement' ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setActiveView('processingManagement')}
          >
            <Settings className="mr-2 h-4 w-4" /> {/* Use Settings icon */}
            Processing Manager
          </Button>
          {/* Projects Page Link */}
          <Button 
            variant={activeView === 'projects' ? "secondary" : "ghost"} 
            className="justify-start"
            onClick={() => {
              setActiveView('projects');
              // navigate('/ProjectsPage'); // Removed to rely on activeView for inline rendering
            }}
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            Projects
          </Button>
          {/* Add more links here later */}
        </nav> 
      </aside>

      {/* Main Content Area - Now handles details page */}
      <div className="flex-grow p-8 overflow-auto">
        {viewingDocumentId ? (
          // If viewing a document, render details page
          <DocumentDetailsPage 
            documentId={viewingDocumentId} 
            projectId={currentProjectId} // Pass currentProjectId as a prop
            onBack={handleBackToManager} 
          />
        ) : (
          // Otherwise, render based on activeView
          <>
            {activeView === 'dashboard' && (
              <>
                <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
                <p>Welcome to your PolicyPulse dashboard. Select an option from the sidebar to get started.</p>
              </>
            )}
            {activeView === 'upload' && (
              <>
                <h1 className="text-2xl font-semibold mb-6">Upload Documents</h1>
                <PdfUploader />
              </>
            )}
            {activeView === 'documentManager' && (
              // Pass the handler to DocumentManager
              <DocumentManager 
                key="doc-manager" 
                onViewDetails={handleViewDocumentDetails} 
              />
            )}
            {activeView === 'analytics' && (
              <AnalyticsDashboard /> // Render the AnalyticsDashboard
            )}
            {activeView === 'processingManagement' && (
              <ProcessingManagement /> // Render the ProcessingManagement page
            )}
            {activeView === 'projects' && (
              <ProjectsPage /> // Render the ProjectsPage
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const { session } = useAuthStore((state) => ({ session: state.session }));

  return (
    <Layout> {/* Wrap everything in the Layout component */}
      {session ? (
        // --- RENDER LOGGED-IN VIEW ---
        <DashboardView />
      ) : (
        // --- RENDER LOGGED-OUT LANDING PAGE ---
        <>
          <HeroSection />
          <FeaturesSection />
          {/* <CallToActionSection /> // Can add this back later if needed */}
          <Footer />
        </>
      )}
    </Layout>
  );
}
