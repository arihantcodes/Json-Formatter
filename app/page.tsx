"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Editor } from "@/components/Editor";
import { JsonTree } from "@/components/JsonTree";
import { Toolbar } from "@/components/Toolbar";
import { StatsBar } from "@/components/StatsBar";
import { FileDrop } from "@/components/FileDrop";
import { DiffViewer } from "@/components/DiffViewer";
import { ApiIntegration } from "@/components/ApiIntegration";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useHistory } from "@/hooks/use-history";
import { detectFormat } from "@/lib/detect";
import { convertToJson } from "@/lib/convert";
import { formatJson } from "@/lib/pretty";
import { loadStateFromUrl, getShareUrl } from "@/lib/share";
import { parseWorker, shouldUseWorker } from "@/lib/worker";

export interface ParsedData {
  json: any;
  formatted: string;
  stats: {
    size: number;
    lines: number;
    keys: number;
    arrays: number;
    depth: number;
  };
  errors: Array<{
    line: number;
    column: number;
    message: string;
    snippet: string;
  }>;
}

export interface FormatOptions {
  indent: 2 | 4 | "tab";
  sortKeys: boolean;
  removeEmpty: boolean;
  minify: boolean;
}

export default function JsonFormatterPage() {
  const {
    state: input,
    setState: setInput,
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
    historySize,
  } = useHistory("");

  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    indent: 2,
    sortKeys: false,
    removeEmpty: false,
    minify: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("formatter");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) {
          undo();
          toast({
            title: "Undone",
            description: "Reverted to previous state",
          });
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
          toast({
            title: "Redone",
            description: "Restored next state",
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo, toast]);

  useEffect(() => {
    const savedState = loadStateFromUrl();
    if (savedState) {
      setInput(savedState.input);
      setFormatOptions(savedState.options);

      if (savedState.input.trim()) {
        handleParse(savedState.input);
      }

      toast({
        title: "State restored",
        description: "Loaded data from shared URL",
      });
    }
  }, [setInput]);

  useEffect(() => {
    if (
      input ||
      Object.values(formatOptions).some((v) => v !== false && v !== 2)
    ) {
      const newUrl = getShareUrl(input, formatOptions);
      const currentUrl = window.location.href.split("?")[0];

      if (newUrl !== currentUrl) {
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [input, formatOptions]);

  useEffect(() => {
    return () => {
      parseWorker.terminate();
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, []);

  const handleParse = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setParsedData(null);
        return;
      }

      // Clear any existing timeout
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }

      setIsLoading(true);
      setParseProgress(0);

      const useWorker = shouldUseWorker(text);
      if (useWorker) {
        setShowProgress(true);
      }

      try {
        let result;

        if (useWorker) {
          // Use Web Worker for large files
          const format = detectFormat(text);
          result = await parseWorker.parseInWorker(
            text,
            format,
            formatOptions,
            (progress) => {
              setParseProgress(progress);
            }
          );

          // Handle worker result format
          if (result.success) {
            const formatted = formatJson(result.data, formatOptions);
            const stats = calculateStats(result.data, formatted);

            setParsedData({
              json: result.data,
              formatted,
              stats,
              errors: [],
            });

            toast({
              title: "Parse successful",
              description: `Converted ${result.format} to JSON (${(
                result.originalSize / 1024
              ).toFixed(1)}KB)`,
            });
          } else {
            setParsedData({
              json: null,
              formatted: "",
              stats: { size: 0, lines: 0, keys: 0, arrays: 0, depth: 0 },
              errors: result.errors || [],
            });

            toast({
              title: "Parse failed",
              description: result.errors?.[0]?.message || "Invalid format",
              variant: "destructive",
            });
          }
        } else {
          // Use main thread for smaller files
          const format = detectFormat(text);
          result = await convertToJson(text, format);

          if (result.success) {
            const formatted = formatJson(result.data, formatOptions);
            const stats = calculateStats(result.data, formatted);

            setParsedData({
              json: result.data,
              formatted,
              stats,
              errors: [],
            });

            toast({
              title: "Parse successful",
              description: `Converted ${format} to JSON`,
            });
          } else {
            setParsedData({
              json: null,
              formatted: "",
              stats: { size: 0, lines: 0, keys: 0, arrays: 0, depth: 0 },
              errors: result.errors || [],
            });

            toast({
              title: "Parse failed",
              description: result.errors?.[0]?.message || "Invalid format",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        toast({
          title: "Parse error",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setShowProgress(false);
        setParseProgress(0);
      }
    },
    [formatOptions, toast]
  );

  const handleFormatOptionsChange = useCallback(
    (newOptions: FormatOptions) => {
      setFormatOptions(newOptions);

      if (parsedData?.json) {
        const formatted = formatJson(parsedData.json, newOptions);
        const stats = calculateStats(parsedData.json, formatted);

        setParsedData((prev) =>
          prev
            ? {
                ...prev,
                formatted,
                stats,
              }
            : null
        );
      }
    },
    [parsedData?.json]
  );

  const handleFileUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setInput(content);
        handleParse(content);
      };
      reader.readAsText(file);
    },
    [handleParse]
  );

  const handleClear = useCallback(() => {
    setInput("");
    setParsedData(null);
    clearHistory();

    window.history.replaceState({}, "", window.location.pathname);

    toast({
      title: "Cleared",
      description: "All data, history, and URL state cleared",
    });
  }, [setInput, clearHistory, toast]);

  const handleApiDataReceived = useCallback(
    (data: string) => {
      setInput(data);
      handleParse(data);
      setActiveTab("formatter"); // Switch to formatter tab to show the result
    },
    [setInput, handleParse]
  );

  const calculateStats = (json: any, formatted: string) => {
    const size = new Blob([formatted]).size;
    const lines = formatted.split("\n").length;

    let keys = 0;
    let arrays = 0;
    let depth = 0;

    const traverse = (obj: any, currentDepth = 0) => {
      depth = Math.max(depth, currentDepth);

      if (Array.isArray(obj)) {
        arrays++;
        obj.forEach((item) => traverse(item, currentDepth + 1));
      } else if (obj && typeof obj === "object") {
        keys += Object.keys(obj).length;
        Object.values(obj).forEach((value) =>
          traverse(value, currentDepth + 1)
        );
      }
    };

    if (json) traverse(json);

    return { size, lines, keys, arrays, depth };
  };

  // Debounced parsing to avoid excessive re-parsing
  const debouncedParse = useCallback(
    (text: string) => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }

      parseTimeoutRef.current = setTimeout(() => {
        handleParse(text);
      }, 300); // 300ms debounce
    },
    [handleParse]
  );

  return (
    <>
      <div className="min-h-screen">
        <div className="container mx-auto p-4 max-w-7xl">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="formatter">Formatter</TabsTrigger>
              <TabsTrigger value="diff">Diff Viewer</TabsTrigger>
              <TabsTrigger value="api">API Integration</TabsTrigger>
            </TabsList>

            <TabsContent value="formatter" className="space-y-4">
              {showProgress && (
                <motion.div
                  className="mb-4 p-3 bg-card border rounded-lg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Processing large file...</span>
                    <span>{Math.round(parseProgress)}%</span>
                  </div>
                  <Progress value={parseProgress} className="h-2" />
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)]">
                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Toolbar
                    formatOptions={formatOptions}
                    onFormatChange={handleFormatOptionsChange}
                    onFileUpload={() => fileInputRef.current?.click()}
                    onClear={handleClear}
                    parsedData={parsedData}
                    input={input}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                    historySize={historySize}
                  />

                  <FileDrop
                    onFileUpload={handleFileUpload}
                    isDragging={isDragging}
                    onDragStateChange={setIsDragging}
                  >
                    <Editor
                      value={input}
                      onChange={setInput}
                      onParse={debouncedParse}
                      isLoading={isLoading}
                    />
                  </FileDrop>

                  <StatsBar parsedData={parsedData} />
                </motion.div>

                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <JsonTree data={parsedData} formatOptions={formatOptions} />
                </motion.div>
              </div>
            </TabsContent>

            <TabsContent value="diff" className="space-y-4">
              <DiffViewer className="h-[calc(100vh-280px)]" />
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <ApiIntegration
                onDataReceived={handleApiDataReceived}
                className="h-[calc(100vh-280px)]"
              />
            </TabsContent>
          </Tabs>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.xml,.yaml,.yml,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="hidden"
          />
        </div>
      </div>
      <Toaster />
    </>
  );
}
