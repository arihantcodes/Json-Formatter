"use client"

import type React from "react"

import { useMemo, useCallback, useRef, useEffect } from "react"
import { FixedSizeList as List } from "react-window"
import { Button } from "@/components/ui/button"
import { Copy, ChevronRight, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface VirtualizedTreeProps {
  data: any
  searchTerm: string
  expandedNodes: Set<string>
  onToggleNode: (path: string) => void
  height: number
}

interface TreeItem {
  id: string
  path: string[]
  data: any
  level: number
  isExpandable: boolean
  isExpanded: boolean
  key?: string
  parentType?: "object" | "array"
}

const ITEM_HEIGHT = 32

export function VirtualizedTree({ data, searchTerm, expandedNodes, onToggleNode, height }: VirtualizedTreeProps) {
  const { toast } = useToast()
  const listRef = useRef<List>(null)

  const flattenedItems = useMemo(() => {
    const items: TreeItem[] = []

    const traverse = (obj: any, path: string[] = ["root"], level = 0, parentType?: "object" | "array") => {
      const pathStr = path.join(".")
      const isExpandable = obj && typeof obj === "object"
      const isExpanded = expandedNodes.has(pathStr)

      // Add current item
      items.push({
        id: pathStr,
        path,
        data: obj,
        level,
        isExpandable,
        isExpanded,
        key: path.length > 1 ? path[path.length - 1] : undefined,
        parentType,
      })

      // Add children if expanded
      if (isExpanded && isExpandable) {
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            traverse(item, [...path, index.toString()], level + 1, "array")
          })
        } else {
          Object.entries(obj).forEach(([key, value]) => {
            traverse(value, [...path, key], level + 1, "object")
          })
        }
      }
    }

    if (data !== null && data !== undefined) {
      traverse(data)
    }

    return items
  }, [data, expandedNodes])

  const filteredItems = useMemo(() => {
    if (!searchTerm) return flattenedItems

    return flattenedItems.filter((item) => {
      const keyMatch = item.key?.toLowerCase().includes(searchTerm.toLowerCase())
      const valueMatch = String(item.data).toLowerCase().includes(searchTerm.toLowerCase())
      return keyMatch || valueMatch
    })
  }, [flattenedItems, searchTerm])

  const handleCopyValue = useCallback(
    async (value: any) => {
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
    },
    [toast],
  )

  const getValueIcon = (value: any) => {
    if (Array.isArray(value)) return "[]"
    if (value && typeof value === "object") return "{}"
    if (typeof value === "string") return '"'
    if (typeof value === "number") return "#"
    if (typeof value === "boolean") return "⚡"
    return "•"
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

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = filteredItems[index]
      if (!item) return null

      const { data, level, isExpandable, isExpanded, key, parentType, path } = item

      return (
        <div style={style} className="flex items-center hover:bg-muted/50 group">
          <div
            className="flex items-center gap-2 py-1 px-2 cursor-pointer flex-1 min-w-0"
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => isExpandable && onToggleNode(path.join("."))}
          >
            <div className="flex items-center gap-1 flex-shrink-0">
              {isExpandable ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )
              ) : (
                <div className="w-4 h-4 flex items-center justify-center text-xs text-muted-foreground">
                  {getValueIcon(data)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 min-w-0 flex-1">
              {key && <span className="text-sm font-medium text-foreground flex-shrink-0">{highlightMatch(key)}:</span>}
              <span className={cn("text-sm font-mono truncate", getValueColor(data))}>
                {highlightMatch(formatValue(data))}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              handleCopyValue(data)
            }}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mr-2"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )
    },
    [filteredItems, onToggleNode, handleCopyValue, searchTerm],
  )

  // Auto-scroll to first search result
  useEffect(() => {
    if (searchTerm && filteredItems.length > 0 && listRef.current) {
      listRef.current.scrollToItem(0, "start")
    }
  }, [searchTerm, filteredItems.length])

  if (filteredItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">No items to display</p>
          {searchTerm && <p className="text-xs">Try a different search term</p>}
        </div>
      </div>
    )
  }

  return (
    <List ref={listRef} height={height} itemCount={filteredItems.length} itemSize={ITEM_HEIGHT} className="scrollbar">
      {Row}
    </List>
  )
}
