"use client";

import type React from "react";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Play,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { detectFormat, getFormatDescription } from "@/lib/detect";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onParse: (value: string) => void;
  isLoading: boolean;
}

export function Editor({ value, onChange, onParse, isLoading }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [detectedFormat, setDetectedFormat] = useState<string>("unknown");
  const [hasError, setHasError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (value.trim()) {
      const format = detectFormat(value);
      setDetectedFormat(format);
      setHasError(format === "unknown");
    } else {
      setDetectedFormat("unknown");
      setHasError(false);
    }
  }, [value]);

  useEffect(() => {
    // Auto-parse when content changes (debounced)
    const timer = setTimeout(() => {
      if (value.trim()) {
        onParse(value);
        if (detectedFormat !== "unknown") {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, onParse, detectedFormat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to parse
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onParse(value);
    }

    // Tab support
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);

      onChange(newValue);

      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lineCount = value.split("\n").length;
  const charCount = value.length;

  return (
    <div className="space-y-3">
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isLoading ? 360 : 0 }}
            transition={{
              duration: 1,
              repeat: isLoading ? Number.POSITIVE_INFINITY : 0,
              ease: "linear",
            }}
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
          </motion.div>
          <span className="text-sm font-medium">Input</span>
          <AnimatePresence mode="wait">
            {detectedFormat !== "unknown" && (
              <motion.div
                key={detectedFormat}
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <Badge
                  variant={hasError ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {hasError && <AlertCircle className="h-3 w-3 mr-1" />}
                  {showSuccess && !hasError && (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  {getFormatDescription(detectedFormat as any)}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          <motion.span
            className="text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {lineCount} lines, {charCount.toLocaleString()} chars
          </motion.span>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="sm"
              onClick={() => onParse(value)}
              disabled={!value.trim() || isLoading}
              className="h-7"
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Parse
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        whileHover={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
      >
        <motion.div
          animate={
            hasError && value.trim() ? { x: [-2, 2, -2, 2, 0] } : { x: 0 }
          }
          transition={{ duration: 0.4 }}
        >
         <Textarea
  ref={textareaRef}
  value={value}
  onChange={(e) => onChange(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder={`Paste your data here…

Supported formats:
  • JSON  – JavaScript Object Notation
  • CSV   – Comma Separated Values  
  • XML   – eXtensible Markup Language
  • YAML  – YAML Ain’t Markup Language
  • NDJSON – Newline Delimited JSON
  • Query Strings – URL parameters

Keyboard shortcuts:
  • Ctrl/Cmd + Enter → Parse
  • Tab → Insert spaces`}
  className={`min-h-[400px] font-mono text-sm resize-none focus:ring-2 transition-all duration-200 ${
    hasError && value.trim()
      ? "focus:ring-destructive/20 border-destructive/50"
      : "focus:ring-primary/20"
  }`}
  spellCheck={false}
/>

        </motion.div>

        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-lg border shadow-lg"
                initial={{ scale: 0.9, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 10 }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing...
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success indicator */}
        <AnimatePresence>
          {showSuccess && !hasError && (
            <motion.div
              className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Parsed
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
