"use client"

import { useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Eye,
  EyeOff,
  ExpandIcon,
  ShrinkIcon,
  FileText,
  Hash,
  Type,
  ToggleLeft,
  Brackets,
  Braces,
  Zap,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { VirtualizedTree } from "./VirtualizedTree"
import { AdvancedSearch } from "./AdvancedSearch"
import type { SearchResult } from "@/lib/search"
import type { ParsedData, FormatOptions } from "@/app/page"

interface JsonTreeProps {
  data: ParsedData | null
  formatOptions: FormatOptions
}

interface TreeNodeProps {
  data: any
  path: string[]
  searchTerm: string
  expandedNodes: Set<string>
  onToggleNode: (path: string) => void
  level: number
  isLast?: boolean
  parentType?: "object" | "array"
  highlightedPaths?: Set<string>
}

const LARGE_TREE_THRESHOLD = 1000 // Use virtualization for trees with 1000+ nodes

export function JsonTree({ data, formatOptions }: JsonTreeProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["root"]))
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set())
  const [showRawJson, setShowRawJson] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [activeTab, setActiveTab] = useState("tree")
  const { toast } = useToast()

  const toggleNode = useCallback((path: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])

  const handleSearchResultSelect = useCallback(
    (result: SearchResult) => {
      const pathStr = result.path.join(".")

      // Expand all parent nodes to make the result visible
      const pathParts = result.path.slice(0, -1)
      const newExpanded = new Set(expandedNodes)

      for (let i = 0; i <= pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join(".")
        if (parentPath) {
          newExpanded.add(parentPath)
        }
      }
      newExpanded.add("root")

      setExpandedNodes(newExpanded)

      // Highlight the result path
      setHighlightedPaths(new Set([pathStr]))

      // Switch to tree view if not already there
      setActiveTab("tree")

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedPaths(new Set())
      }, 3000)
    },
    [expandedNodes],
  )

  const expandAll = useCallback(() => {
    if (!data?.json) return

    setIsProcessing(true)
    setProcessingProgress(0)

    // Use requestIdleCallback for non-blocking expansion
    const expandInChunks = () => {
      const allPaths = new Set<string>()
      let processed = 0
      let total = 0

      const countNodes = (obj: any, currentPath: string[] = []) => {
        total++
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            countNodes(item, [...currentPath, index.toString()])
          })
        } else if (obj && typeof obj === "object") {
          Object.keys(obj).forEach((key) => {
            countNodes(obj[key], [...currentPath, key])
          })
        }
      }

      const traverse = (obj: any, currentPath: string[] = []) => {
        const pathStr = currentPath.join(".")
        if (pathStr) allPaths.add(pathStr)

        processed++
        if (processed % 100 === 0) {
          setProcessingProgress((processed / total) * 100)
        }

        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            traverse(item, [...currentPath, index.toString()])
          })
        } else if (obj && typeof obj === "object") {
          Object.keys(obj).forEach((key) => {
            traverse(obj[key], [...currentPath, key])
          })
        }
      }

      countNodes(data.json, ["root"])
      traverse(data.json, ["root"])

      setExpandedNodes(allPaths)
      setIsProcessing(false)
      setProcessingProgress(0)

      toast({
        title: "Expanded all nodes",
        description: `${allPaths.size} nodes expanded`,
      })
    }

    // Use setTimeout to allow UI to update
    setTimeout(expandInChunks, 10)
  }, [data?.json, toast])

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(["root"]))
    setHighlightedPaths(new Set())
    toast({
      title: "Collapsed all nodes",
      description: "Tree collapsed to root level",
    })
  }, [toast])

  const handleCopyFormatted = async () => {
    if (!data?.formatted) return

    try {
      await navigator.clipboard.writeText(data.formatted)
      toast({
        title: "Copied to clipboard",
        description: "Formatted JSON copied successfully",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const filteredData = useMemo(() => {
    if (!data?.json || !searchTerm) return data?.json

    const filterObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map((item) => filterObject(item)).filter((item) => item !== null && item !== undefined)
      }

      if (obj && typeof obj === "object") {
        const filtered: any = {}
        let hasMatch = false

        for (const [key, value] of Object.entries(obj)) {
          if (key.toLowerCase().includes(searchTerm.toLowerCase())) {
            filtered[key] = value
            hasMatch = true
          } else {
            const filteredValue = filterObject(value)
            if (filteredValue !== null && filteredValue !== undefined) {
              if (typeof filteredValue === "object" && Object.keys(filteredValue).length > 0) {
                filtered[key] = filteredValue
                hasMatch = true
              } else if (typeof filteredValue !== "object") {
                filtered[key] = filteredValue
                hasMatch = true
              }
            }
          }
        }

        return hasMatch ? filtered : null
      }

      const stringValue = String(obj).toLowerCase()
      return stringValue.includes(searchTerm.toLowerCase()) ? obj : null
    }

    return filterObject(data.json)
  }, [data?.json, searchTerm])

  // Calculate tree complexity to determine if virtualization is needed
  const treeComplexity = useMemo(() => {
    if (!data?.json) return 0

    let nodeCount = 0
    const traverse = (obj: any) => {
      nodeCount++
      if (Array.isArray(obj)) {
        obj.forEach(traverse)
      } else if (obj && typeof obj === "object") {
        Object.values(obj).forEach(traverse)
      }
    }

    traverse(data.json)
    return nodeCount
  }, [data?.json])

  const shouldUseVirtualization = treeComplexity > LARGE_TREE_THRESHOLD

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 mx-auto opacity-50" />
          <p className="text-sm">No data to display</p>
          <p className="text-xs">Parse some data to see the tree view</p>
        </div>
      </div>
    )
  }

  if (data.errors.length > 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-destructive">
            <Hash className="h-12 w-12 mx-auto mb-2" />
            <h3 className="font-medium">Parse Errors</h3>
          </div>
          <div className="space-y-2 text-sm">
            {data.errors.slice(0, 3).map((error, index) => (
              <div key={index} className="p-2 bg-destructive/10 rounded text-left">
                <div className="font-mono text-xs text-muted-foreground">
                  Line {error.line}, Column {error.column}
                </div>
                <div className="text-destructive">{error.message}</div>
                {error.snippet && <div className="mt-1 font-mono text-xs bg-muted p-1 rounded">{error.snippet}</div>}
              </div>
            ))}
            {data.errors.length > 3 && (
              <div className="text-xs text-muted-foreground">+{data.errors.length - 3} more errors</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">JSON Explorer</span>
            <Badge variant="secondary" className="text-xs">
              {Array.isArray(data.json) ? "Array" : typeof data.json === "object" ? "Object" : typeof data.json}
            </Badge>
            {shouldUseVirtualization && (
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Virtualized ({treeComplexity.toLocaleString()} nodes)
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={expandAll}
              disabled={isProcessing}
              className="h-7 bg-transparent"
            >
              <ExpandIcon className="h-3 w-3 mr-1" />
              Expand
            </Button>
            <Button size="sm" variant="outline" onClick={collapseAll} className="h-7 bg-transparent">
              <ShrinkIcon className="h-3 w-3 mr-1" />
              Collapse
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyFormatted} className="h-7 bg-transparent">
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRawJson(!showRawJson)} className="h-7">
              {showRawJson ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {showRawJson ? "Tree" : "Raw"}
            </Button>
          </div>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Expanding nodes...</span>
              <span>{Math.round(processingProgress)}%</span>
            </div>
            <Progress value={processingProgress} className="h-1" />
          </div>
        )}
      </div>

      <Separator />

      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tree">Tree View</TabsTrigger>
            <TabsTrigger value="search">Advanced Search</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="flex-1 mt-4">
            <div className="space-y-3 h-full flex flex-col">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Quick search keys and values..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-8"
                />
              </div>

              <div className="flex-1 min-h-0">
                {filteredData !== null && filteredData !== undefined ? (
                  shouldUseVirtualization ? (
                    <VirtualizedTree
                      data={filteredData}
                      searchTerm={searchTerm}
                      expandedNodes={expandedNodes}
                      onToggleNode={toggleNode}
                      height={400}
                    />
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="p-2">
                        <TreeNode
                          data={filteredData}
                          path={["root"]}
                          searchTerm={searchTerm}
                          expandedNodes={expandedNodes}
                          onToggleNode={toggleNode}
                          level={0}
                          highlightedPaths={highlightedPaths}
                        />
                      </div>
                    </ScrollArea>
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No matches found</p>
                    <p className="text-xs">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="search" className="flex-1 mt-4">
            <AdvancedSearch data={data.json} onResultSelect={handleSearchResultSelect} className="h-full" />
          </TabsContent>

          <TabsContent value="raw" className="flex-1 mt-4">
            <ScrollArea className="h-full">
              <pre className="text-xs font-mono p-4 bg-muted/30 rounded-lg overflow-x-auto">{data.formatted}</pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function TreeNode({
  data,
  path,
  searchTerm,
  expandedNodes,
  onToggleNode,
  level,
  isLast = true,
  parentType,
  highlightedPaths = new Set(),
}: TreeNodeProps) {
  const { toast } = useToast()
  const pathStr = path.join(".")
  const isExpanded = expandedNodes.has(pathStr)
  const isExpandable = data && typeof data === "object"
  const isHighlighted = highlightedPaths.has(pathStr)

  const handleCopyValue = async (value: any) => {
    try {
      const textValue = typeof value === "string" ? value : JSON.stringify(value, null, 2)
      await navigator.clipboard.writeText(textValue)
      toast({
        title: "Copied to clipboard",
        description: "Value copied successfully",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy value",
        variant: "destructive",
      })
    }
  }

  const getValueIcon = (value: any) => {
    if (Array.isArray(value)) return <Brackets className="h-3 w-3" />
    if (value && typeof value === "object") return <Braces className="h-3 w-3" />
    if (typeof value === "string") return <Type className="h-3 w-3" />
    if (typeof value === "number") return <Hash className="h-3 w-3" />
    if (typeof value === "boolean") return <ToggleLeft className="h-3 w-3" />
    return <FileText className="h-3 w-3" />
  }

  const getValueColor = (value: any) => {
    if (value === null) return "text-muted-foreground"
    if (typeof value === "string") return "text-green-600 dark:text-green-400"
    if (typeof value === "number") return "text-blue-600 dark:text-blue-400"
    if (typeof value === "boolean") return "text-purple-600 dark:text-purple-400"
    return "text-foreground"
  }

  const formatValue = (value: any) => {
    if (value === null) return "null"
    if (typeof value === "string") return `"${value}"`
    if (typeof value === "boolean") return value.toString()
    if (typeof value === "number") return value.toString()
    if (Array.isArray(value)) return `Array(${value.length})`
    if (typeof value === "object") return `Object(${Object.keys(value).length})`
    return String(value)
  }

  const highlightMatch = (text: string) => {
    if (!searchTerm) return text

    const regex = new RegExp(`(${searchTerm})`, "gi")
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  if (!isExpandable) {
    const key = path[path.length - 1]
    return (
      <motion.div
        className={cn(
          "flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2 group",
          isHighlighted && "bg-primary/10 border border-primary/20",
        )}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: level * 0.05 }}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1 text-muted-foreground">{getValueIcon(data)}</div>
          {parentType && <span className="text-sm font-medium text-foreground">{highlightMatch(key)}:</span>}
          <span className={cn("text-sm font-mono", getValueColor(data))}>{highlightMatch(formatValue(data))}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleCopyValue(data)}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: level * 0.05 }}
    >
      <div
        className={cn(
          "flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2 cursor-pointer group",
          isHighlighted && "bg-primary/10 border border-primary/20",
        )}
        onClick={() => onToggleNode(pathStr)}
      >
        <div className="flex items-center gap-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {getValueIcon(data)}
        </div>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          {path.length > 1 && (
            <span className="text-sm font-medium text-foreground">{highlightMatch(path[path.length - 1])}:</span>
          )}
          <span className="text-sm text-muted-foreground">
            {Array.isArray(data) ? `Array(${data.length})` : `Object(${Object.keys(data).length})`}
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            handleCopyValue(data)
          }}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="ml-4 border-l border-muted-foreground/20 pl-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {Array.isArray(data)
              ? data.map((item, index) => (
                  <TreeNode
                    key={index}
                    data={item}
                    path={[...path, index.toString()]}
                    searchTerm={searchTerm}
                    expandedNodes={expandedNodes}
                    onToggleNode={onToggleNode}
                    level={level + 1}
                    isLast={index === data.length - 1}
                    parentType="array"
                    highlightedPaths={highlightedPaths}
                  />
                ))
              : Object.entries(data).map(([key, value], index, entries) => (
                  <TreeNode
                    key={key}
                    data={value}
                    path={[...path, key]}
                    searchTerm={searchTerm}
                    expandedNodes={expandedNodes}
                    onToggleNode={onToggleNode}
                    level={level + 1}
                    isLast={index === entries.length - 1}
                    parentType="object"
                    highlightedPaths={highlightedPaths}
                  />
                ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
