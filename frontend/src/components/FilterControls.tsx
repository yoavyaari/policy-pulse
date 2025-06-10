import React, { memo } from 'react';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Props {
  searchTerm: string;
  statusFilter: string;
  sentimentFilter: string | null; // Add sentiment filter prop
  complexityFilter: string | null; // Add complexity filter prop
  topicFilter: string | null; // Add topic filter prop
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
  // Removed reprocessing props
}

// Memoize the component to prevent unnecessary re-renders
export const FilterControls = memo(
  ({
    searchTerm,
    statusFilter,
    sentimentFilter, // Add sentiment filter prop
    complexityFilter, // Add complexity filter prop
    topicFilter, // Add topic filter prop
    onSearchChange,
    onStatusChange,
    onClearFilters,
    // Removed reprocessing props
  }: Props) => {
    console.log("Rendering FilterControls"); // Add log to see when it renders
    
    const disableClear = 
      statusFilter === "all" && 
      searchTerm === "" &&
      sentimentFilter === null && // Check sentiment filter
      complexityFilter === null && // Check complexity filter
      topicFilter === null; // Check topic filter

    // Removed disableReprocess

    return (
      <div className="flex flex-wrap items-end gap-4 mb-4" id="filter-controls-container">
        {/* Search Input */}
        <div className="grid gap-2 items-center">
          <Label htmlFor="search-filename">Search Filename</Label>
          <Input
            id="search-filename"
            placeholder="Search by filename..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-64"
          />
        </div>

        {/* Status Filter */}
        <div className="grid gap-2 items-center">
          <Label htmlFor="status-filter">Filter by Status</Label>
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger id="status-filter" className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-auto"> {/* Push buttons to the right */}
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="h-10"
            disabled={disableClear}
          >
            Clear Filters
          </Button>
          {/* Removed Reprocess Button */}
        </div>
      </div>
    );
  }
);

// Optional: Add display name for better debugging
FilterControls.displayName = 'FilterControls';
