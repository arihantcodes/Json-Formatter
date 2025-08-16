"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { Upload, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropProps {
  onFileUpload: (file: File) => void
  isDragging: boolean
  onDragStateChange: (isDragging: boolean) => void
  children: React.ReactNode
}

const SUPPORTED_EXTENSIONS = [".json", ".csv", ".xml", ".yaml", ".yml", ".txt"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function FileDrop({ onFileUpload, isDragging, onDragStateChange, children }: FileDropProps) {
  const [dragError, setDragError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }

    // Check file extension
    const extension = "." + file.name.split(".").pop()?.toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`
    }

    return null
  }

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!isDragging) {
        onDragStateChange(true)
        setDragError(null)
      }
    },
    [isDragging, onDragStateChange],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Only hide drag state if leaving the drop zone entirely
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        onDragStateChange(false)
        setDragError(null)
      }
    },
    [onDragStateChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onDragStateChange(false)

      const files = Array.from(e.dataTransfer.files)

      if (files.length === 0) {
        setDragError("No files detected")
        return
      }

      if (files.length > 1) {
        setDragError("Please drop only one file at a time")
        return
      }

      const file = files[0]
      const error = validateFile(file)

      if (error) {
        setDragError(error)
        return
      }

      setDragError(null)
      onFileUpload(file)
    },
    [onFileUpload, onDragStateChange],
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative transition-all duration-200",
        isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {children}

      {isDragging && (
        <motion.div
          className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-center space-y-2">
            <Upload className="h-8 w-8 text-primary mx-auto" />
            <div className="text-sm font-medium text-primary">Drop your file here</div>
            <div className="text-xs text-muted-foreground">Supports: {SUPPORTED_EXTENSIONS.join(", ")}</div>
          </div>
        </motion.div>
      )}

      {dragError && (
        <motion.div
          className="absolute inset-0 bg-destructive/5 border-2 border-dashed border-destructive rounded-lg flex items-center justify-center z-10"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onAnimationComplete={() => {
            setTimeout(() => setDragError(null), 3000)
          }}
        >
          <div className="text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <div className="text-sm font-medium text-destructive">{dragError}</div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
