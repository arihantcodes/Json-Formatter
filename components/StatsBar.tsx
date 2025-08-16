"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { FileText, Hash, Layers, BarChart3, HardDrive, AlertTriangle, TrendingUp, Clock } from "lucide-react"
import type { ParsedData } from "@/app/page"

interface StatsBarProps {
  parsedData: ParsedData | null
}

export function StatsBar({ parsedData }: StatsBarProps) {
  if (!parsedData) {
    return (
      <motion.div
        className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-dashed"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <FileText className="h-4 w-4" />
          <span>No data parsed yet</span>
        </motion.div>
      </motion.div>
    )
  }

  const { stats, errors } = parsedData
  const hasErrors = errors.length > 0

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const getComplexityColor = (depth: number): string => {
    if (depth <= 3) return "text-green-600 dark:text-green-400"
    if (depth <= 6) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  const getComplexityLabel = (depth: number): string => {
    if (depth <= 3) return "Simple"
    if (depth <= 6) return "Moderate"
    return "Complex"
  }

  const getPerformanceScore = () => {
    let score = 100
    if (stats.size > 1024 * 1024) score -= 20 // Large file penalty
    if (stats.depth > 10) score -= 15 // Deep nesting penalty
    if (stats.keys > 1000) score -= 10 // Many keys penalty
    if (hasErrors) score -= 30 // Error penalty
    return Math.max(0, score)
  }

  const performanceScore = getPerformanceScore()

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <AnimatePresence>
        {hasErrors && (
          <motion.div
            className="p-4 bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 rounded-lg"
            initial={{ opacity: 0, scale: 0.95, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="flex items-center gap-2 mb-3"
              animate={{ x: [-1, 1, -1, 1, 0] }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {errors.length} Parse Error{errors.length > 1 ? "s" : ""}
              </span>
            </motion.div>
            <div className="space-y-2">
              {errors.slice(0, 3).map((error, index) => (
                <motion.div
                  key={index}
                  className="text-xs text-destructive/80 bg-destructive/5 p-2 rounded"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.1 }}
                >
                  <div className="font-mono text-destructive/60 mb-1">
                    Line {error.line}, Col {error.column}
                  </div>
                  <div>{error.message}</div>
                </motion.div>
              ))}
              {errors.length > 3 && (
                <motion.div
                  className="text-xs text-destructive/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  +{errors.length - 3} more errors...
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="p-4 bg-gradient-to-r from-card to-card/50 border rounded-lg shadow-sm"
        whileHover={{ boxShadow: "0 8px 25px rgba(0,0,0,0.1)" }}
        transition={{ duration: 0.2 }}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3 }}
            >
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </motion.div>
            <div>
              <div className="text-xs text-muted-foreground">Size</div>
              <motion.div
                className="text-sm font-medium"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {formatBytes(stats.size)}
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Lines</div>
              <motion.div
                className="text-sm font-medium"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {stats.lines.toLocaleString()}
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Keys</div>
              <motion.div
                className="text-sm font-medium"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {stats.keys.toLocaleString()}
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Arrays</div>
              <motion.div
                className="text-sm font-medium"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {stats.arrays.toLocaleString()}
              </motion.div>
            </div>
          </motion.div>

          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <Layers className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Depth</div>
              <div className="flex items-center gap-2">
                <motion.span
                  className="text-sm font-medium"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {stats.depth}
                </motion.span>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Badge variant="outline" className={`text-xs ${getComplexityColor(stats.depth)}`}>
                    {getComplexityLabel(stats.depth)}
                  </Badge>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Performance Score */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Performance Score</span>
            </div>
            <motion.span
              className={`text-xs font-medium ${
                performanceScore >= 80
                  ? "text-green-600 dark:text-green-400"
                  : performanceScore >= 60
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.3, delay: 0.8 }}
            >
              {performanceScore}/100
            </motion.span>
          </div>
          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.8, delay: 0.9 }}>
            <Progress value={performanceScore} className="h-2" />
          </motion.div>
        </motion.div>

        {/* Complexity Indicator */}
        {stats.size > 0 && (
          <motion.div
            className="mt-3 space-y-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <div className="flex justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Complexity</span>
              </div>
              <span>{Math.min(100, (stats.depth / 10) * 100).toFixed(0)}%</span>
            </div>
            <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.6, delay: 1.1 }}>
              <Progress value={Math.min(100, (stats.depth / 10) * 100)} className="h-1" />
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
