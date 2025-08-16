"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Minus, Edit, ArrowLeftRight, Copy, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { deepDiff, formatDiffPath, getDiffStats, type DiffResult } from "@/lib/diff"
import { convertToJson } from "@/lib/convert"
import { detectFormat } from "@/lib/detect"

interface DiffViewerProps {
  className?: string
}

export function DiffViewer({ className }: DiffViewerProps) {
  const [leftInput, setLeftInput] = useState("")
  const [rightInput, setRightInput] = useState("")
  const [leftJson, setLeftJson] = useState<any>(null)
  const [rightJson, setRightJson] = useState<any>(null)
  const [leftError, setLeftError] = useState<string>("")
  const [rightError, setRightError] = useState<string>("")
  const { toast } = useToast()

  const diffs = useMemo(() => {
    if (!leftJson || !rightJson) return []
    return deepDiff(leftJson, rightJson)
  }, [leftJson, rightJson])

  const stats = useMemo(() => getDiffStats(diffs), [diffs])

  const parseInput = async (input: string, side: "left" | "right") => {
    if (!input.trim()) {
      if (side === "left") {
        setLeftJson(null)
        setLeftError("")
      } else {
        setRightJson(null)
        setRightError("")
      }
      return
    }

    try {
      const format = detectFormat(input)
      const result = await convertToJson(input, format)

      if (result.success) {
        if (side === "left") {
          setLeftJson(result.data)
          setLeftError("")
        } else {
          setRightJson(result.data)
          setRightError("")
        }
      } else {
        const errorMsg = result.errors?.[0]?.message || "Invalid format"
        if (side === "left") {
          setLeftJson(null)
          setLeftError(errorMsg)
        } else {
          setRightJson(null)
          setRightError(errorMsg)
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Parse error"
      if (side === "left") {
        setLeftJson(null)
        setLeftError(errorMsg)
      } else {
        setRightJson(null)
        setRightError(errorMsg)
      }
    }
  }

  const handleSwap = () => {
    const tempInput = leftInput
    const tempJson = leftJson
    const tempError = leftError

    setLeftInput(rightInput)
    setLeftJson(rightJson)
    setLeftError(rightError)

    setRightInput(tempInput)
    setRightJson(tempJson)
    setRightError(tempError)

    toast({
      title: "Swapped",
      description: "Left and right inputs have been swapped",
    })
  }

  const handleClear = () => {
    setLeftInput("")
    setRightInput("")
    setLeftJson(null)
    setRightJson(null)
    setLeftError("")
    setRightError("")

    toast({
      title: "Cleared",
      description: "All diff data cleared",
    })
  }

  const copyDiffReport = async () => {
    if (diffs.length === 0) return

    const report = generateDiffReport(diffs, stats)

    try {
      await navigator.clipboard.writeText(report)
      toast({
        title: "Copied",
        description: "Diff report copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy diff report",
        variant: "destructive",
      })
    }
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">JSON Difference Viewer</span>
            {stats.total > 0 && (
              <div className="flex gap-1">
                <Badge variant="outline" className="text-xs">
                  <Plus className="h-3 w-3 mr-1 text-green-600" />
                  {stats.added}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Minus className="h-3 w-3 mr-1 text-red-600" />
                  {stats.removed}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Edit className="h-3 w-3 mr-1 text-yellow-600" />
                  {stats.modified}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={handleSwap} disabled={!leftInput && !rightInput}>
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              Swap
            </Button>
            <Button size="sm" variant="outline" onClick={copyDiffReport} disabled={diffs.length === 0}>
              <Copy className="h-3 w-3 mr-1" />
              Copy Report
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Original (Left)
                {leftError && (
                  <Badge variant="destructive" className="text-xs">
                    Error
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={leftInput}
                onChange={(e) => {
                  setLeftInput(e.target.value)
                  parseInput(e.target.value, "left")
                }}
                placeholder="Paste your original JSON, CSV, XML, or YAML here..."
                className="min-h-[200px] font-mono text-sm"
              />
              {leftError && <p className="text-sm text-red-600 mt-2">{leftError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Modified (Right)
                {rightError && (
                  <Badge variant="destructive" className="text-xs">
                    Error
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={rightInput}
                onChange={(e) => {
                  setRightInput(e.target.value)
                  parseInput(e.target.value, "right")
                }}
                placeholder="Paste your modified JSON, CSV, XML, or YAML here..."
                className="min-h-[200px] font-mono text-sm"
              />
              {rightError && <p className="text-sm text-red-600 mt-2">{rightError}</p>}
            </CardContent>
          </Card>
        </div>

        {diffs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Differences</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="list" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list">List View</TabsTrigger>
                  <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {diffs.map((diff, index) => (
                        <DiffItem key={index} diff={diff} />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="side-by-side" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Original</h4>
                      <ScrollArea className="h-[400px]">
                        <pre className="text-xs bg-muted p-3 rounded">{JSON.stringify(leftJson, null, 2)}</pre>
                      </ScrollArea>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Modified</h4>
                      <ScrollArea className="h-[400px]">
                        <pre className="text-xs bg-muted p-3 rounded">{JSON.stringify(rightJson, null, 2)}</pre>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function DiffItem({ diff }: { diff: DiffResult }) {
  const getIcon = () => {
    switch (diff.type) {
      case "added":
        return <Plus className="h-3 w-3 text-green-600" />
      case "removed":
        return <Minus className="h-3 w-3 text-red-600" />
      case "modified":
        return <Edit className="h-3 w-3 text-yellow-600" />
      default:
        return null
    }
  }

  const getBgColor = () => {
    switch (diff.type) {
      case "added":
        return "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
      case "removed":
        return "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
      case "modified":
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
      default:
        return "bg-muted"
    }
  }

  if (diff.type === "unchanged") return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg border ${getBgColor()}`}
    >
      <div className="flex items-start gap-2">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-xs font-mono bg-background px-1 py-0.5 rounded">{formatDiffPath(diff.path)}</code>
            <Badge variant="outline" className="text-xs">
              {diff.type}
            </Badge>
          </div>

          {diff.type === "added" && (
            <div className="text-sm">
              <span className="text-muted-foreground">Added: </span>
              <code className="bg-background px-1 py-0.5 rounded text-xs">{JSON.stringify(diff.newValue)}</code>
            </div>
          )}

          {diff.type === "removed" && (
            <div className="text-sm">
              <span className="text-muted-foreground">Removed: </span>
              <code className="bg-background px-1 py-0.5 rounded text-xs">{JSON.stringify(diff.oldValue)}</code>
            </div>
          )}

          {diff.type === "modified" && (
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">From: </span>
                <code className="bg-background px-1 py-0.5 rounded text-xs">{JSON.stringify(diff.oldValue)}</code>
              </div>
              <div>
                <span className="text-muted-foreground">To: </span>
                <code className="bg-background px-1 py-0.5 rounded text-xs">{JSON.stringify(diff.newValue)}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function generateDiffReport(diffs: DiffResult[], stats: ReturnType<typeof getDiffStats>): string {
  const lines = [
    "# JSON Difference Report",
    "",
    `## Summary`,
    `- Added: ${stats.added}`,
    `- Removed: ${stats.removed}`,
    `- Modified: ${stats.modified}`,
    `- Total changes: ${stats.added + stats.removed + stats.modified}`,
    "",
    "## Changes",
    "",
  ]

  for (const diff of diffs) {
    if (diff.type === "unchanged") continue

    const path = formatDiffPath(diff.path)
    const icon = diff.type === "added" ? "+" : diff.type === "removed" ? "-" : "~"

    lines.push(`### ${icon} ${path}`)
    lines.push(`**Type:** ${diff.type}`)

    if (diff.type === "added") {
      lines.push(`**Value:** \`${JSON.stringify(diff.newValue)}\``)
    } else if (diff.type === "removed") {
      lines.push(`**Value:** \`${JSON.stringify(diff.oldValue)}\``)
    } else if (diff.type === "modified") {
      lines.push(`**From:** \`${JSON.stringify(diff.oldValue)}\``)
      lines.push(`**To:** \`${JSON.stringify(diff.newValue)}\``)
    }

    lines.push("")
  }

  return lines.join("\n")
}
