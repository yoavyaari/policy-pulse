import { create } from 'zustand';

// Define the types for our filter state
interface FilterState {
  searchTerm: string;
  statusFilter: string; // 'all', 'uploaded', 'processing', 'processed', 'error'
  sentimentFilter: string | null; // e.g., 'positive', 'negative', 'neutral'
  complexityFilter: string | null; // e.g., 'single sentence', 'short', 'medium', 'long'
  topicFilter: string | null; // Specific topic name
  // Add other potential filters here, e.g., topic-specific sentiment/risk/regulation needs
}

// Define the types for actions to update the state
interface FilterActions {
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setSentimentFilter: (sentiment: string | null) => void;
  setComplexityFilter: (complexity: string | null) => void;
  setTopicFilter: (topic: string | null) => void;
  clearChartFilters: () => void; // Action to clear filters derived from charts
  clearAllFilters: () => void; // Action to clear all filters
}

// Define the initial state
const initialState: FilterState = {
  searchTerm: '',
  statusFilter: 'all',
  sentimentFilter: null,
  complexityFilter: null,
  topicFilter: null,
};

// Create the Zustand store
export const useFilterStore = create<FilterState & FilterActions>((set) => ({
  // Initial state
  ...initialState,

  // Actions
  setSearchTerm: (term) => set({ searchTerm: term }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSentimentFilter: (sentiment) => set({ sentimentFilter: sentiment }),
  setComplexityFilter: (complexity) => set({ complexityFilter: complexity }),
  setTopicFilter: (topic) => set({ topicFilter: topic }),

  clearChartFilters: () => set({
    sentimentFilter: null,
    complexityFilter: null,
    topicFilter: null,
    // Add other chart-related filters here to clear
  }),

  clearAllFilters: () => set(initialState),
}));
