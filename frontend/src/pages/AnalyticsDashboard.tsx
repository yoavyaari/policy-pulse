// ui/src/pages/AnalyticsDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Terminal, X, RefreshCw } from "lucide-react"; // Added RefreshCw // Added X icon
import brain from "brain";
// Assuming types are accessible, potentially adjust import path if needed
import { AnalyticsSummaryResponse } from "brain/data-contracts"; // Or import from "types" if re-exported
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart, 
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList
} from "recharts";
import { useFilterStore } from "utils/filterStore"; // Import Zustand store
import { useProjectStore } from "utils/projectStore"; // Import project store
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Define some colors for the chart segments
const COLORS = ["#00C49F", "#FF8042", "#FFBB28", "#0088FE", "#8884d8"];
const ACTIVE_COLOR = "#FF6347"; // Define a color for active bars, e.g., Tomato red
const DEFAULT_BAR_COLOR = "#8884d8"; // Default color for complexity bars
const DEFAULT_TOPIC_COLOR = "#82ca9d"; // Default color for topic bars

function AnalyticsDashboard() {
  console.log("AnalyticsDashboard rendering..."); // Check if component re-renders
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Get filter state and actions from Zustand store
  const {
    sentimentFilter,
    complexityFilter,
    topicFilter,
    setSentimentFilter,
    setComplexityFilter,
    setTopicFilter,
    clearChartFilters,
  } = useFilterStore();
  const { currentProjectId } = useProjectStore(); // Get currentProjectId

  // ADD THIS LOG: See filter values on every render
  console.log("AnalyticsDashboard rendering with filters:", { sentimentFilter, complexityFilter, topicFilter });


  // Define fetchData outside useEffect so it can be called directly
  const fetchData = useCallback(async (currentFilters: {
    sentiment?: string | null;
    complexity?: string | null;
    topic?: string | null;
  }, projectId?: string | null) => { // Added projectId parameter
    console.log("fetchData called with filters:", currentFilters, "and projectId:", projectId); // Log filters used
    // setLoading(true); // Removed: Will be set by the trigger (button click or useEffect)
    setError(null);

    if (!projectId) {
      console.log("No project ID provided to fetchData, skipping API call.");
      setData(null); // Clear existing data
      //setError("Please select a project to view analytics."); // Optional: set an error message
      setLoading(false);
      return;
    }

    setLoading(true); // Set loading true only if we are making an API call
    try {
      // Construct query parameters based on provided filters
      const queryParams: Record<string, any> = { project_id: projectId }; // Initialize with project_id
      if (currentFilters.sentiment) queryParams.sentiment_filter = currentFilters.sentiment;
      if (currentFilters.complexity) queryParams.complexity_filter = currentFilters.complexity;
      if (currentFilters.topic) queryParams.topic_filter = currentFilters.topic;

      console.log("Fetching analytics with queryParams:", queryParams);
      const response = await brain.get_analytics_summary(queryParams); // Pass params directly
      const summaryData: AnalyticsSummaryResponse = await response.json();

      if (response.ok) {
        if (summaryData.error) {
           console.error("API returned error in response:", summaryData.error);
           setError(`Failed to fetch analytics summary: ${summaryData.error}`);
        } else {
           setData(summaryData);
           console.log("Fetched analytics data:", summaryData);
        }
      } else {
         console.error("API request failed:", response.status, response.statusText);
         setError(`Failed to fetch analytics summary. Status: ${response.status}`);
      }
    } catch (err) {
      console.error("Error fetching analytics summary:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []); // Added useCallback dependency array

  // useEffect to fetch data when filters change or on initial mount
  useEffect(() => {
    console.log(
      "Effect triggered: Fetching data based on current filters:", 
      { sentimentFilter, complexityFilter, topicFilter }
    );
    // Fetch data using the current filters from the Zustand store
    fetchData({
      sentiment: sentimentFilter,
      complexity: complexityFilter,
      topic: topicFilter,
    }, currentProjectId); // Pass currentProjectId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentimentFilter, complexityFilter, topicFilter, currentProjectId, fetchData]); // Re-run when any filter or project changes

// Removed global loading check - handled within cards now
  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center h-64">
  //       <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  //     </div>
  //   );
  // }

  if (!currentProjectId) {
    return (
      <div className="container mx-auto p-4">
        <Alert className="max-w-2xl mx-auto">
          <Terminal className="h-4 w-4" />
          <AlertTitle>No Project Selected</AlertTitle>
          <AlertDescription>Please select a project to view its analytics.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Fetching Analytics</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
     return (
       <Alert className="max-w-2xl mx-auto">
         <Terminal className="h-4 w-4" />
         <AlertTitle>No Data</AlertTitle>
         <AlertDescription>No analytics data available yet.</AlertDescription>
       </Alert>
     );
  }

  // --- Derive chart data directly (Removed useMemo) ---
  const sentimentData = Object.entries(data.sentiment_distribution || {}).map(
    ([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })
  );
  // Define the desired order for document length categories
  const complexityOrder: { [key: string]: number } = {
    'single sentence': 1,
    'up to 2 paragraphs': 2,
    '1-2 pages': 3,
    'longer': 4,
    'unknown': 5, // Adjust order as needed
  };

  const complexityData = Object.entries(data.complexity_distribution || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      const orderA = complexityOrder[a.name] ?? Infinity; // Assign high value if key not found
      const orderB = complexityOrder[b.name] ?? Infinity;
      return orderA - orderB;
    });

  const topicsData = (data.top_topics || []).map(topic => ({ name: topic.topic_name, value: topic.count }));

  // Calculate active index directly before return
  let activeSentimentIndex = -1;
  if (sentimentFilter && sentimentData && sentimentData.length > 0) {
    activeSentimentIndex = sentimentData.findIndex(entry => entry.name.toLowerCase() === sentimentFilter);
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Policy Response Analytics</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true); // Set loading before fetch
            fetchData({}, currentProjectId); // Fetch data with no chart filters, but with current project ID
          }}
          disabled={loading} // Disable when loading
          className="ml-auto" // Push to the right
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Active Filters Display & Clear Button */}
      <div className="mb-4 p-3 border rounded-lg bg-muted/50 flex flex-wrap items-center gap-2 text-sm min-h-[50px]">
        <span className="font-medium mr-2">Active Chart Filters:</span>
        {sentimentFilter ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            Sentiment: {sentimentFilter}
            <button
              onClick={() => {
                console.log("Removing sentiment filter and refetching");
                setSentimentFilter(null);
                fetchData({ sentiment: null, complexity: complexityFilter, topic: topicFilter }, currentProjectId);
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Remove sentiment filter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {complexityFilter ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            Complexity: {complexityFilter}
            <button
              onClick={() => {
                console.log("Removing complexity filter and refetching");
                setComplexityFilter(null);
                fetchData({ sentiment: sentimentFilter, complexity: null, topic: topicFilter }, currentProjectId);
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Remove complexity filter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {topicFilter ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            Topic: {topicFilter}
            <button
              onClick={() => {
                console.log("Removing topic filter and refetching");
                setTopicFilter(null);
                fetchData({ sentiment: sentimentFilter, complexity: complexityFilter, topic: null }, currentProjectId);
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Remove topic filter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        
        {!(sentimentFilter || complexityFilter || topicFilter) && (
           <span className="text-muted-foreground italic">None</span>
        )}

        {(sentimentFilter || complexityFilter || topicFilter) && (
          <Button variant="outline" size="sm" onClick={() => {
              console.log("Clearing all chart filters and refetching");
              clearChartFilters(); // Clear state in the store
              fetchData({}, currentProjectId); // Refetch with empty chart filters for current project
            }} className="ml-auto">
            Clear All Filters
          </Button>
        )}
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sentiment Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : sentimentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => 
                       `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    onClick={(data, index) => {
                      const newFilter = data.name ? data.name.toLowerCase() : null;
                      // Prevent re-applying the same filter
                      if (newFilter === sentimentFilter) {
                        console.log("Sentiment filter already active:", newFilter);
                        return;
                      }
                      console.log("Setting sentiment filter and refetching:", newFilter);
                      setSentimentFilter(newFilter);
                      fetchData({ sentiment: newFilter, complexity: complexityFilter, topic: topicFilter });
                    }}
                    activeIndex={activeSentimentIndex} // Control active segment via prop
                    className="cursor-pointer"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  {/* <Legend /> */}{/* Legend can be added if needed */}
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No sentiment data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Complexity Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle>Document Length</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : complexityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={complexityData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} documents`, 'Count']} />
                  <Bar 
                    dataKey="value" 
                    onClick={(data) => {
                       const newFilter = data.name || null;
                       if (newFilter === complexityFilter) {
                          console.log("Complexity filter already active:", newFilter);
                          return;
                       }
                       console.log("Setting complexity filter and refetching:", newFilter);
                       setComplexityFilter(newFilter);
                       fetchData({ sentiment: sentimentFilter, complexity: newFilter, topic: topicFilter });
                    }}
                    className="cursor-pointer"
                   >
                    {complexityData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={complexityFilter === entry.name ? ACTIVE_COLOR : DEFAULT_BAR_COLOR}
                      />
                    ))}
                    <LabelList dataKey="value" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No complexity data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Top Topics Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle>Top Topics</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : topicsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={topicsData.slice(0, 5)} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={80} />
                  <Tooltip formatter={(value) => [`${value} occurrences`, 'Count']} />
                  <Bar 
                    dataKey="value" 
                    onClick={(data) => {
                       const newFilter = data.name || null;
                       if (newFilter === topicFilter) {
                          console.log("Topic filter already active:", newFilter);
                          return;
                       }
                       console.log("Setting topic filter and refetching:", newFilter);
                       setTopicFilter(newFilter);
                       fetchData({ sentiment: sentimentFilter, complexity: complexityFilter, topic: newFilter });
                     }}
                    className="cursor-pointer"
                  >
                     {topicsData.slice(0, 5).map((entry, index) => ( // Apply slice here too
                         <Cell
                             key={`cell-${index}`}
                             fill={topicFilter === entry.name ? ACTIVE_COLOR : DEFAULT_TOPIC_COLOR}
                         />
                     ))}
                    <LabelList dataKey="value" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No topic data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Document Stats Card */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Document Stats</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">Total Documents: {data.total_documents}</p>
             {/* Add more stats if needed */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
