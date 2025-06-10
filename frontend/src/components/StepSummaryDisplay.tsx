import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StepResultsSummaryResponse, SimpleValueDistribution, KeyValueDistribution, NestedKeyValueSummary } from 'types';

// Helper function to aggregate inner keys from a distribution of objects
function aggregateInnerKeys(valueDistribution: SimpleValueDistribution[]): Map<string, SimpleValueDistribution[]> {
  const aggregatedMap = new Map<string, Map<any, number>>(); // Inner Map: value -> count

  for (const vd of valueDistribution) {
    if (typeof vd.value === 'object' && vd.value !== null && !Array.isArray(vd.value)) {
      for (const [innerKey, innerVal] of Object.entries(vd.value)) {
        if (!aggregatedMap.has(innerKey)) {
          aggregatedMap.set(innerKey, new Map<any, number>());
        }
        const valueCountsForInnerKey = aggregatedMap.get(innerKey)!;
        // Use the count from the parent SimpleValueDistribution item (vd.count)
        valueCountsForInnerKey.set(innerVal, (valueCountsForInnerKey.get(innerVal) || 0) + vd.count);
      }
    }
  }

  const result = new Map<string, SimpleValueDistribution[]>();
  for (const [innerKey, valueCounts] of aggregatedMap.entries()) {
    const finalDistribution: SimpleValueDistribution[] = [];
    for (const [value, count] of valueCounts.entries()) {
      finalDistribution.push({ value, count });
    }
    finalDistribution.sort((a, b) => b.count - a.count); // Sort by count descending
    result.set(innerKey, finalDistribution);
  }
  return result;
}

// Define the props for the component
interface Props {
  summaryType: StepResultsSummaryResponse['summary_type'];
  summaryData?: StepResultsSummaryResponse['summary_data']; // Make data optional
}

// Helper to format value for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'object') {
    try {
      // Try to stringify objects/arrays nicely
      return JSON.stringify(value);
    } catch {
      return '[Object]'; // Fallback for complex/circular objects
    }
  }
  // Attempt to parse stringified JSON (e.g., for nested objects stored as strings)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      // If it parses back to an object/array, stringify it again for display
      if (typeof parsed === 'object' && parsed !== null) {
        return JSON.stringify(parsed, null, 2); // Pretty print
      }
      // If it parses to a simple type, just return the original string
      // This handles cases like "__unhashable__" or simple strings
      return value;
    } catch {
      // If parsing fails, it's just a regular string
      return value;
    }
  }
  return String(value); // Default string conversion
};


export const StepSummaryDisplay: React.FC<Props> = ({ summaryType, summaryData }) => {
  // Handle cases with no data or specific types without data
  if (!summaryData || summaryData.length === 0) {
    // Use summaryType to provide context if data is empty
    if (summaryType === 'no_results') {
       return <p className="text-muted-foreground italic mt-4 text-center">No results found for this step.</p>;
    }
    if (summaryType === 'empty') {
      return <p className="text-muted-foreground italic mt-4 text-center">Results were found but were all empty/null.</p>;
    }
     if (summaryType === 'mixed') {
      return <p className="text-orange-600 mt-4 text-center">Results contain a mix of data types and could not be automatically summarized.</p>;
    }
     if (summaryType === 'error') {
      // The error message itself is handled in the parent modal
      return <p className="text-destructive italic mt-4 text-center">An error occurred while generating the summary.</p>;
    }
    // Default fallback if data is empty/null for simple/key_value types
    return <p className="text-muted-foreground italic mt-4 text-center">No summary data available to display.</p>;
  }

  // Render based on summary type
  switch (summaryType) {
    case 'simple_value':
      // Ensure data is SimpleValueDistribution[]
      const simpleData = summaryData as SimpleValueDistribution[];
      return (
        <div className="mt-4 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70%]">Value</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simpleData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium break-words"> {/* Allow long values to wrap */}
                     <pre className="whitespace-pre-wrap text-xs">{formatValue(item.value)}</pre>
                  </TableCell>
                  <TableCell className="text-right">{item.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );

    case 'key_value':
      // Ensure data is KeyValueDistribution[]
      const kvData = summaryData as KeyValueDistribution[];
      return (
        <Accordion type="single" collapsible className="w-full mt-4">
          {kvData.map((item, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger>
                <div className="flex justify-between w-full pr-4">
                   <span className="font-medium truncate mr-2">{item.key_name}</span>
                   <span className="text-sm text-muted-foreground flex-shrink-0">
                      ({item.total_occurrences} occurrences)
                   </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-1 px-1">
                {(() => {
                  // Check if the first value in the distribution is an object to decide rendering strategy
                  const firstValueIsObject = item.value_distribution?.find(
                    (vd) => typeof vd.value === 'object' && vd.value !== null && !Array.isArray(vd.value)
                  );

                  if (firstValueIsObject) {
                    const innerKeySummaries = aggregateInnerKeys(item.value_distribution);
                    if (innerKeySummaries.size === 0) {
                      return <p className="text-xs text-muted-foreground italic px-4 pb-2">Dictionary values are empty or not structured as expected.</p>;
                    }
                    return (
                      <Accordion type="multiple" collapsible className="w-full space-y-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-sm">
                        {Array.from(innerKeySummaries.entries()).map(([innerKeyName, innerValueDistribution], innerIndex) => (
                          <AccordionItem value={`${item.key_name}-inner-${innerIndex}-${innerKeyName}`} key={`${item.key_name}-inner-${innerKeyName}`} className="py-0 my-0 border rounded-md bg-card">
                            <AccordionTrigger className="text-xs font-normal py-1.5 px-2 hover:no-underline">
                              <span className="truncate mr-2">{innerKeyName}</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-1 pb-2 pl-2 pr-1">
                              {innerValueDistribution && innerValueDistribution.length > 0 ? (
                                <div className="border rounded-sm max-h-60 overflow-y-auto">
                                  <Table className="text-xs">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="h-7 w-[70%]">Value</TableHead>
                                        <TableHead className="h-7 text-right">Count</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {innerValueDistribution.map((valItem, valIndex) => (
                                        <TableRow key={valIndex} className="h-7">
                                          <TableCell className="font-medium break-words py-1">
                                            <pre className="whitespace-pre-wrap text-xs">{formatValue(valItem.value)}</pre>
                                          </TableCell>
                                          <TableCell className="text-right py-1">{valItem.count}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic px-4 py-2">No distribution data for this inner key.</p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    );
                  } else if (item.value_distribution && item.value_distribution.length > 0) {
                    // Fallback: Original table for non-object values or if object display (cm-551) is preferred for some reason
                    return (
                      <div className="border rounded-md max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[70%]">Value</TableHead>
                              <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.value_distribution.map((valItem, valIndex) => (
                              <TableRow key={valIndex}>
                                <TableCell className="font-medium break-words">
                                  {/* This is where the simple object listing from cm-551 was. We revert to pure formatValue if not doing aggregation. */}
                                  <pre className="whitespace-pre-wrap text-xs">{formatValue(valItem.value)}</pre>
                                </TableCell>
                                <TableCell className="text-right">{valItem.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  } else {
                    return <p className="text-sm text-muted-foreground italic px-4 pb-4">No value distribution data available for this key.</p>;
                  }
                })()}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );

    case 'nested_key_value':
      // Ensure data is NestedKeyValueSummary
      const nestedData = summaryData as NestedKeyValueSummary;
      if (!nestedData || !nestedData.inner_key_summary || nestedData.inner_key_summary.length === 0) {
        return <p className="text-muted-foreground italic mt-4 text-center">No inner summary data available for nested key: {nestedData?.outer_key_name || 'N/A'}</p>;
      }

      return (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-gray-600">
             Analysis based on: <span className="font-bold text-gray-800">{nestedData.outer_key_name}</span>
          </p>
          <Accordion type="single" collapsible className="w-full border rounded-md p-2 bg-gray-50">
            {nestedData.inner_key_summary.map((item, index) => (
              <AccordionItem value={`item-${index}`} key={index} className="border-b last:border-b-0">
                <AccordionTrigger>
                  <div className="flex justify-between w-full pr-4">
                     <span className="font-medium truncate mr-2">{item.key_name}</span>
                     <span className="text-sm text-muted-foreground flex-shrink-0">
                        ({item.total_occurrences} occurrences)
                     </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {item.value_distribution && item.value_distribution.length > 0 ? (
                    <div className="border rounded-md bg-white shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[70%]">Value</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.value_distribution.map((valItem, valIndex) => (
                            <TableRow key={valIndex}>
                              <TableCell className="font-medium break-words">
                                 <pre className="whitespace-pre-wrap text-xs">{formatValue(valItem.value)}</pre>
                              </TableCell>
                              <TableCell className="text-right">{valItem.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic px-4 pb-4">No value distribution data available for this key.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      );

    // Fallback for types that shouldn't have summaryData (handled above) or unexpected types
    default:
       return <p className="text-muted-foreground italic mt-4 text-center">Cannot display summary for type: {summaryType}</p>;
  }
};

// Export the component for use
export default StepSummaryDisplay;

