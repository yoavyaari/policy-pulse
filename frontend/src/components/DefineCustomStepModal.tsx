import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomStepResponse, StandardPromptStructure, ConditionalBlockStructure, PromptConfig } from "types"; // Import the type for initial data
import { PlusCircle, Trash2, Sparkles, ArrowDownUp } from "lucide-react"; // Added icons for prompt management and conditional blocks

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select

// Define the structure for analysis pipeline configuration
export interface AnalysisPipelineConfigInput {
  data_collection_fields: string[];
  global_aggregation_logic: Record<string, string>; // e.g., { "avg_sentiment": "avg(sentiment)" }
  document_assignment_logic: Record<string, string>; // e.g., { "is_positive": "sentiment > 0.5" }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string, 
    prompts: (StandardPromptStructure | ConditionalBlockStructure)[], // Changed to new structure
    processingMode: string, 
    analysisPipelineConfig: AnalysisPipelineConfigInput | null
  ) => Promise<void>; 
  initialData?: CustomStepResponse; 
}

export const DefineCustomStepModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState("");
  // const [description, setDescription] = useState(""); // Replaced with prompts state
  const [prompts, setPrompts] = useState<(StandardPromptStructure | ConditionalBlockStructure)[]>([]); // New state for structured prompts
  const [processingMode, setProcessingMode] = useState<"document_by_document" | "project_wide_dynamic_analysis">("document_by_document");
  
  // State for Project-Wide Dynamic Analysis
  const [dataCollectionFields, setDataCollectionFields] = useState<string[]>([]);
  const [currentDataCollectionField, setCurrentDataCollectionField] = useState("");
  // const [globalAggregationRules, setGlobalAggregationRules] = useState<{ name: string; formula: string }[]>([]); // Removed
  // const [currentGlobalAggregationRuleName, setCurrentGlobalAggregationRuleName] = useState(""); // Removed
  // const [currentGlobalAggregationRuleFormula, setCurrentGlobalAggregationRuleFormula] = useState(""); // Removed
  const [globalAggregationLogicPrompt, setGlobalAggregationLogicPrompt] = useState(""); // Added
  // MYA-75: Add state for Document Assignment Logic string (for textarea)
  const [documentAssignmentLogicString, setDocumentAssignmentLogicString] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // Use useEffect to set initial values when initialData changes (e.g., opening for edit)
  // Also runs when `isOpen` changes to reset the form when re-opening for 'create'
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        // setDescription(initialData.description); // Legacy, handled by prompts
        if (initialData.prompts && initialData.prompts.length > 0) {
          // Check if the first prompt is a string (legacy) or an object (new structure)
          const firstPrompt = initialData.prompts[0];
          if (typeof firstPrompt === 'string') {
            // Legacy: array of strings
            setPrompts(initialData.prompts.map(pText => ({
              type: "standard_prompt",
              prompt: { text: pText as string, include_document_context: true }
            } as StandardPromptStructure)));
          } else if (typeof firstPrompt === 'object' && firstPrompt !== null && ('type' in firstPrompt)){
            // New structure: array of StandardPromptStructure | ConditionalBlockStructure
            setPrompts(initialData.prompts as (StandardPromptStructure | ConditionalBlockStructure)[]);
          } else {
            // Fallback for unexpected format, or empty array
            setPrompts([]); 
          }
        } else if (initialData.description) {
          // Legacy: single description string
          setPrompts([{
            type: "standard_prompt",
            prompt: { text: initialData.description, include_document_context: true }
          } as StandardPromptStructure]);
        } else {
          // Default for new or truly empty prompts
          setPrompts([]); 
        }
        const mode = initialData.processing_mode || "document_by_document";
        setProcessingMode(mode as "document_by_document" | "project_wide_dynamic_analysis");

        if (mode === "project_wide_dynamic_analysis" && initialData.analysis_pipeline_config) {
          setDataCollectionFields(initialData.analysis_pipeline_config.data_collection_fields || []);
          // const rules = initialData.analysis_pipeline_config.global_aggregation_logic || {}; // Removed
          // setGlobalAggregationRules(Object.entries(rules).map(([name, formula]) => ({ name, formula: String(formula) }))); // Removed
          const aggLogic = initialData.analysis_pipeline_config.global_aggregation_logic;
          if (aggLogic && typeof aggLogic === 'object' && Object.keys(aggLogic).length > 0) {
            // If it's an object, take the value of the first key as the prompt
            setGlobalAggregationLogicPrompt(String(Object.values(aggLogic)[0] || ""));
          } else if (typeof aggLogic === 'string') { // Should not happen based on type, but good fallback
            setGlobalAggregationLogicPrompt(aggLogic);
          } else {
            setGlobalAggregationLogicPrompt("");
          }
          // MYA-75: Load document assignment logic string
          const docAssignLogic = initialData.analysis_pipeline_config.document_assignment_logic;
          if (docAssignLogic && typeof docAssignLogic === 'object' && Object.keys(docAssignLogic).length > 0) {
            setDocumentAssignmentLogicString(String(Object.values(docAssignLogic)[0] || ""));
          } else {
            setDocumentAssignmentLogicString(""); // Default to empty if not found or not an object with values
          }
        } else {
          setDataCollectionFields([]);
          // setGlobalAggregationRules([]); // Removed
          setGlobalAggregationLogicPrompt(""); // Reset prompt
          // MYA-75: Reset document assignment logic string
          setDocumentAssignmentLogicString(""); 
        }
        // Reset current input fields for sub-forms when loading initial data or switching mode away from project-wide
        setCurrentDataCollectionField("");
        // setCurrentGlobalAggregationRuleName(""); // Removed
        // setCurrentGlobalAggregationRuleFormula(""); // Removed
      } else {
        // Reset form when opening for creation
        setName("");
        // setDescription(""); // Replaced
        setPrompts([]); // Reset prompts for new
        setProcessingMode("document_by_document");
        setDataCollectionFields([]);
        setCurrentDataCollectionField("");
        // setGlobalAggregationRules([]); // Removed
        setGlobalAggregationLogicPrompt(""); // Reset prompt
        // setCurrentGlobalAggregationRuleName(""); // Removed
        // setCurrentGlobalAggregationRuleFormula(""); // Removed
        // MYA-75: Reset document assignment logic string
        setDocumentAssignmentLogicString("");
      }
    } else {
      // Optionally, reset if closed and not just isOpen changing between true states
      // This ensures clean state if dialog is closed and then reopened for create without unmounting
        setName("");
        // setDescription(""); // Replaced
        setPrompts([]); // Reset prompts when closed
        setProcessingMode("document_by_document");
        setDataCollectionFields([]);
        setCurrentDataCollectionField("");
        // setGlobalAggregationRules([]); // Removed
        setGlobalAggregationLogicPrompt(""); // Reset prompt
        // setCurrentGlobalAggregationRuleName(""); // Removed
        // setCurrentGlobalAggregationRuleFormula(""); // Removed
        // MYA-75: Reset document assignment logic string
        setDocumentAssignmentLogicString("");
    }
  }, [initialData, isOpen]); // Rerun effect if initialData or isOpen changes

  // Effect to clear project-wide fields if mode changes away from it
  useEffect(() => {
    if (processingMode !== "project_wide_dynamic_analysis") {
        setDataCollectionFields([]);
        // setGlobalAggregationRules([]); // Removed
        setGlobalAggregationLogicPrompt(""); // Clear prompt if not project-wide
        // MYA-75: Clear document assignment logic string if not project-wide
        setDocumentAssignmentLogicString("");
        setCurrentDataCollectionField("");
        // setCurrentGlobalAggregationRuleName(""); // Removed
        // setCurrentGlobalAggregationRuleFormula(""); // Removed
    }
  }, [processingMode]);

  const handleSaveClick = async () => {
    if (processingMode === "document_by_document" && prompts.length === 0) {
      alert("Please add at least one prompt for document-by-document mode.");
      return;
    }
    // Further validation could be added here to check if prompt texts are empty for standard prompts
    // or if conditional blocks have their required parts.
    if (!name.trim()) { // Name is always required
      alert("Please enter a name for the processing step.");
      return;
    }
    setIsSaving(true);
    try {
      let pipelineConfig: AnalysisPipelineConfigInput | null = null;
      if (processingMode === "project_wide_dynamic_analysis") {
        pipelineConfig = {
          data_collection_fields: dataCollectionFields.filter(field => field.trim() !== ""), // Filter out empty strings
          global_aggregation_logic: globalAggregationLogicPrompt.trim() 
            ? { "custom_prompt": globalAggregationLogicPrompt.trim() } 
            : {},
          // MYA-75: Convert document assignment logic string to Record<string, string>
          document_assignment_logic: documentAssignmentLogicString.trim()
            ? { "custom_criteria": documentAssignmentLogicString.trim() }
            : {},
        };
      }
      await onSave(name, prompts, processingMode, pipelineConfig);
    } catch (error) {
      console.error("Save failed in modal:", error);
      // Consider showing an error toast to the user here
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // When dialog is closed (open becomes false), call the parent's onClose.
      // The useEffect hook listening to `isOpen` will handle resetting state for the next open.
      onClose();
    }
    // If `open` is true, the dialog is being opened. `useEffect` handles state initialization.
  };

  return (
    // Use onOpenChange for better close handling
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit" : "Define New"} Processing Step</DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the details for this custom processing step."
              : "Define a new custom step to analyze document aspects not covered by default."}
          </DialogDescription>
        </DialogHeader>

        {/* Main wrapper for all form content below the header */}
        <div className="py-4 space-y-4">
          {/* Processing Mode Selector */}
          <div className="grid grid-cols-4 items-center gap-x-4">
            <Label htmlFor="processing-mode" className="text-right col-span-1">
              Processing Mode
            </Label>
            <div className="col-span-3">
              <Select value={processingMode} onValueChange={setProcessingMode} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Select processing mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document_by_document">Document-by-Document</SelectItem>
                  <SelectItem value="project_wide_dynamic_analysis">Project-Wide Dynamic Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Name Field */}
          <div className="grid grid-cols-4 items-center gap-x-4">
            <Label htmlFor="step-name" className="text-right col-span-1">
              Name
            </Label>
            <Input
              id="step-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Sentiment Analysis"
              disabled={isSaving} 
            />
          </div>

                    {/* Conditional Description Field / Prompts List */}
          {processingMode === "document_by_document" && (
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Prompts (Sequential)
              </Label>
              {prompts.map((item, index) => (
                <div key={index} className="p-3 border rounded-md shadow-sm bg-white">
                  {item.type === "standard_prompt" && (
                    <div className="space-y-2">
                      <Label htmlFor={`prompt-text-${index}`}>Prompt Instruction</Label>
                      <Textarea
                        id={`prompt-text-${index}`}
                        value={item.prompt.text}
                        onChange={(e) => {
                          const newPrompts = [...prompts];
                          (newPrompts[index] as StandardPromptStructure).prompt.text = e.target.value;
                          setPrompts(newPrompts);
                        }}
                        className="w-full"
                        placeholder={`Enter prompt instruction...`}
                        rows={3}
                        disabled={isSaving}
                      />
                      <div className="flex items-center space-x-2 pt-1">
                        <Input
                          type="checkbox"
                          id={`include-doc-${index}`}
                          checked={item.prompt.include_document_context}
                          onChange={(e) => {
                            const newPrompts = [...prompts];
                            (newPrompts[index] as StandardPromptStructure).prompt.include_document_context = e.target.checked;
                            setPrompts(newPrompts);
                          }}
                          className="h-4 w-4 accent-sky-600"
                          disabled={isSaving}
                        />
                        <Label htmlFor={`include-doc-${index}`} className="text-sm font-normal text-gray-700">
                          Include full document text in context for this prompt
                        </Label>
                      </div>
                    </div>
                  )}
                  {item.type === "conditional_block" && (
                    <div className="space-y-2 p-3 border border-dashed border-amber-500 rounded-md bg-amber-50/30">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="font-semibold text-amber-700">Conditional Block</Label>
                        {/* Optional: Icon or brief explanation here */}
                      </div>
                      {/* Condition Prompt */}
                      <div className="space-y-1 p-2 border border-amber-400 rounded bg-amber-50">
                        <Label htmlFor={`condition-prompt-text-${index}`} className="text-sm font-medium text-amber-800">Condition Prompt</Label>
                        <Textarea
                          id={`condition-prompt-text-${index}`}
                          value={item.condition_prompt.text}
                          onChange={(e) => {
                            const newPrompts = [...prompts];
                            const currentItem = newPrompts[index] as ConditionalBlockStructure;
                            currentItem.condition_prompt.text = e.target.value;
                            setPrompts(newPrompts);
                          }}
                          className="w-full text-sm"
                          placeholder={`If the document meets this condition (e.g., mentions 'AI ethics')...`}
                          rows={2}
                          disabled={isSaving}
                        />
                        <div className="flex items-center space-x-2 pt-1">
                          <Input
                            type="checkbox"
                            id={`condition-include-doc-${index}`}
                            checked={item.condition_prompt.include_document_context}
                            onChange={(e) => {
                              const newPrompts = [...prompts];
                              const currentItem = newPrompts[index] as ConditionalBlockStructure;
                              currentItem.condition_prompt.include_document_context = e.target.checked;
                              setPrompts(newPrompts);
                            }}
                            className="h-4 w-4 accent-amber-600"
                            disabled={isSaving}
                          />
                          <Label htmlFor={`condition-include-doc-${index}`} className="text-xs font-normal text-gray-600">
                            Include document context for condition
                          </Label>
                        </div>
                      </div>

                      {/* Action Prompts */}
                      <div className="space-y-2 mt-3">
                        <Label className="text-sm font-medium text-gray-700">Action Prompts (if condition is met):</Label>
                        {item.action_prompts.map((actionPrompt, actionIndex) => (
                          <div key={actionIndex} className="p-2 border border-sky-300 rounded bg-sky-50/50 ml-4 space-y-1">
                            <div className="flex justify-between items-center">
                                <Label htmlFor={`action-prompt-text-${index}-${actionIndex}`} className="text-xs font-medium text-sky-800">Action Prompt #{actionIndex + 1}</Label>
                                <Button
                                    variant="ghost"
                                    size="icon_sm"
                                    onClick={() => {
                                        const newPrompts = [...prompts];
                                        const currentBlock = newPrompts[index] as ConditionalBlockStructure;
                                        currentBlock.action_prompts = currentBlock.action_prompts.filter((_, apIndex) => apIndex !== actionIndex);
                                        setPrompts(newPrompts);
                                    }}
                                    disabled={isSaving}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-100 p-1 h-6 w-6"
                                    aria-label="Remove this action prompt"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <Textarea
                              id={`action-prompt-text-${index}-${actionIndex}`}
                              value={actionPrompt.text}
                              onChange={(e) => {
                                const newPrompts = [...prompts];
                                const currentBlock = newPrompts[index] as ConditionalBlockStructure;
                                currentBlock.action_prompts[actionIndex].text = e.target.value;
                                setPrompts(newPrompts);
                              }}
                              className="w-full text-sm"
                              placeholder={`Then, perform this action (e.g., Extract key concerns)...`}
                              rows={2}
                              disabled={isSaving}
                            />
                            <div className="flex items-center space-x-2 pt-1">
                                <Input
                                type="checkbox"
                                id={`action-include-doc-${index}-${actionIndex}`}
                                checked={actionPrompt.include_document_context}
                                onChange={(e) => {
                                    const newPrompts = [...prompts];
                                    const currentBlock = newPrompts[index] as ConditionalBlockStructure;
                                    currentBlock.action_prompts[actionIndex].include_document_context = e.target.checked;
                                    setPrompts(newPrompts);
                                }}
                                className="h-4 w-4 accent-sky-600"
                                disabled={isSaving}
                                />
                                <Label htmlFor={`action-include-doc-${index}-${actionIndex}`} className="text-xs font-normal text-gray-600">
                                Include document context for this action
                                </Label>
                            </div>
                          </div>
                        ))}
                        {item.action_prompts.length === 0 && (
                            <p className="text-xs text-slate-500 text-center py-1 ml-4">No action prompts defined. Add one below.</p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newPrompts = [...prompts];
                            const currentBlock = newPrompts[index] as ConditionalBlockStructure;
                            currentBlock.action_prompts.push({ text: "", include_document_context: true });
                            setPrompts(newPrompts);
                          }}
                          disabled={isSaving}
                          className="mt-1 ml-4 text-xs border-sky-500 text-sky-700 hover:bg-sky-50"
                        >
                          <PlusCircle className="h-3 w-3 mr-1.5" />
                          Add Action Prompt
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newPrompts = prompts.filter((_, i) => i !== index);
                        setPrompts(newPrompts);
                      }}
                      disabled={isSaving}
                      className="text-red-500 hover:text-red-700 hover:bg-red-100"
                      aria-label="Remove this item"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
              {prompts.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-2">No prompts defined yet. Add one below.</p>
              )}
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPrompts([
                      ...prompts,
                      {
                        type: "standard_prompt",
                        prompt: { text: "", include_document_context: true },
                      } as StandardPromptStructure,
                    ])
                  }
                  disabled={isSaving}
                  className="mt-1"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Standard Prompt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPrompts([
                      ...prompts,
                      {
                        type: "conditional_block",
                        condition_prompt: { text: "", include_document_context: true },
                        action_prompts: [],
                      } as ConditionalBlockStructure,
                    ])
                  }
                  disabled={isSaving}
                  className="mt-1"
                >
                  <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                  Add Conditional Block
                </Button>
              </div>
            </div>
          )}

          {/* Conditional Sections for Project-Wide Dynamic Analysis */}
          {processingMode === "project_wide_dynamic_analysis" && (
            <>
              {/* Data Collection Fields Section */}
              <div className="p-3 border rounded-md bg-slate-50/50">
                <Label className="font-semibold text-md block mb-1">Data Collection Fields</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Define document fields to collect for global analysis (e.g., metadata.author, results.sentiment_score).
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="text"
                    placeholder="Enter field path (e.g., metadata.source)"
                    value={currentDataCollectionField}
                    onChange={(e) => setCurrentDataCollectionField(e.target.value)}
                    className="flex-grow"
                    disabled={isSaving}
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      if (currentDataCollectionField.trim()) {
                        setDataCollectionFields([...dataCollectionFields, currentDataCollectionField.trim()]);
                        setCurrentDataCollectionField("");
                      }
                    }}
                    disabled={isSaving || !currentDataCollectionField.trim()}
                  >
                    Add Field
                  </Button>
                </div>
                {dataCollectionFields.length > 0 && (
                  <div className="space-y-1 max-h-28 overflow-y-auto border p-2 rounded-md bg-white">
                    {dataCollectionFields.map((field, index) => (
                      <div key={index} className="flex items-center justify-between text-sm p-1 bg-slate-100 rounded">
                        <span>{field}</span>
                        <Button 
                          variant="ghost" 
                          size="icon_sm" 
                          onClick={() => setDataCollectionFields(dataCollectionFields.filter((_, i) => i !== index))}
                          disabled={isSaving}
                          className="text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {dataCollectionFields.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-1">No fields added yet.</p>
                )}
              </div>

              {/* Global Aggregation Logic Section - Textarea */}
              <div className="p-3 border rounded-md bg-slate-50/50">
                <Label htmlFor="global-aggregation-prompt" className="font-semibold text-md block mb-1">
                  Global Aggregation Logic / AI Prompt
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Provide instructions or a prompt for the AI to perform project-wide analysis using the collected data fields.
                </p>
                <Textarea
                  id="global-aggregation-prompt"
                  value={globalAggregationLogicPrompt}
                  onChange={(e) => setGlobalAggregationLogicPrompt(e.target.value)}
                  className="w-full" // Use w-full for Textarea within this flow
                  placeholder="e.g., Based on the collected sentiment scores and author types, identify the top 3 concerns and common positive feedback..."
                  rows={6} 
                  disabled={isSaving}
                />
              </div>

              {/* MYA-75: Document Assignment Logic Section */}
              <div className="p-3 border rounded-md bg-slate-50/50">
                <Label htmlFor="document-assignment-logic" className="font-semibold text-md block mb-1">
                  Document Assignment Logic / Criteria
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Define criteria for assigning documents to this analysis step (e.g., based on metadata or content keywords).
                </p>
                <Textarea
                  id="document-assignment-logic"
                  value={documentAssignmentLogicString} // Use the new string state
                  onChange={(e) => setDocumentAssignmentLogicString(e.target.value)}
                  className="w-full"
                  placeholder="Enter criteria description, e.g., documents containing 'AI ethics' AND created after '2023-01-01'..."
                  rows={4} 
                  disabled={isSaving}
                />
              </div>
            </>
          )}
        </div>
        
        <DialogFooter>
          {/* Use the explicit onClose from props for the Cancel button */}
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveClick} disabled={isSaving}>
            {isSaving
              ? "Saving..."
              : initialData
              ? "Update Step"
              : "Save Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
