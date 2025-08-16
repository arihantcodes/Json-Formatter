"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, Share2, Copy, Trash2, Settings, CheckCircle, XCircle, Link } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getShareUrl } from "@/lib/share"

import { HistoryControls } from "@/components/HistoryControls"
import type { FormatOptions, ParsedData } from "@/app/page"

interface ToolbarProps {
  formatOptions: FormatOptions
  onFormatChange: (options: FormatOptions) => void
  onFileUpload: () => void
  onClear: () => void
  parsedData: ParsedData | null
  input: string
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  historySize?: number
}

export function Toolbar({
  formatOptions,
  onFormatChange,
  onFileUpload,
  onClear,
  parsedData,
  input,
  canUndo = false,
  canRedo = false,
  onUndo = () => {},
  onRedo = () => {},
  historySize = 0,
}: ToolbarProps) {
  const { toast } = useToast()

  const handleCopy = async () => {
    if (!parsedData?.formatted) return

    try {
      await navigator.clipboard.writeText(parsedData.formatted)
      toast({
        title: "Copied to clipboard",
        description: "JSON data copied successfully",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleDownload = (format: "json" | "ndjson" = "json") => {
    if (!parsedData?.formatted) return

    const content =
      format === "ndjson" && Array.isArray(parsedData.json)
        ? parsedData.json.map((item) => JSON.stringify(item)).join("\n")
        : parsedData.formatted

    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `formatted-data.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Download started",
      description: `File saved as formatted-data.${format}`,
    })
  }

  const handleShare = async () => {
    if (typeof window === "undefined") return

    try {
      const shareUrl = getShareUrl(input, formatOptions)
      await navigator.clipboard.writeText(shareUrl)

      toast({
        title: "Share URL copied",
        description: "URL with current state copied to clipboard",
        action: (
          <Button size="sm" variant="outline" onClick={() => window.open(shareUrl, "_blank")} className="h-8">
            <Link className="h-3 w-3 mr-1" />
            Open
          </Button>
        ),
      })
    } catch (error) {
      toast({
        title: "Share failed",
        description: "Unable to generate share URL",
        variant: "destructive",
      })
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleShare()
      return
    }

    try {
      const shareUrl = getShareUrl(input, formatOptions)
      await navigator.share({
        title: "JSON Formatter - Shared Data",
        text: "Check out this formatted JSON data",
        url: shareUrl,
      })

      toast({
        title: "Shared successfully",
        description: "Data shared via native share",
      })
    } catch (error) {
      // Fallback to clipboard copy
      handleShare()
    }
  }

  const updateFormatOptions = (updates: Partial<FormatOptions>) => {
    onFormatChange({ ...formatOptions, ...updates })
  }

  return (
    <div className="space-y-4 p-4 bg-card border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Format Options</span>
          {parsedData && (
            <Badge variant={parsedData.errors.length > 0 ? "destructive" : "default"} className="text-xs">
              {parsedData.errors.length > 0 ? (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  {parsedData.errors.length} errors
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Valid
                </>
              )}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            historySize={historySize}
          />
          <Separator orientation="vertical" className="h-6 mx-1" />
         
          <Button size="sm" variant="outline" onClick={onFileUpload}>
            <Upload className="h-3 w-3 mr-1" />
            Upload
          </Button>
          <Button size="sm" variant="outline" onClick={onClear}>
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="indent-select" className="text-xs font-medium">
            Indentation
          </Label>
          <Select
            value={formatOptions.indent.toString()}
            onValueChange={(value) =>
              updateFormatOptions({
                indent: value === "tab" ? "tab" : (Number.parseInt(value) as 2 | 4),
              })
            }
          >
            <SelectTrigger id="indent-select" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 spaces</SelectItem>
              <SelectItem value="4">4 spaces</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Options</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="sort-keys"
                checked={formatOptions.sortKeys}
                onCheckedChange={(checked) => updateFormatOptions({ sortKeys: checked })}
              />
              <Label htmlFor="sort-keys" className="text-xs">
                Sort keys
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="remove-empty"
                checked={formatOptions.removeEmpty}
                onCheckedChange={(checked) => updateFormatOptions({ removeEmpty: checked })}
              />
              <Label htmlFor="remove-empty" className="text-xs">
                Remove empty
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Output</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="minify"
              checked={formatOptions.minify}
              onCheckedChange={(checked) => updateFormatOptions({ minify: checked })}
            />
            <Label htmlFor="minify" className="text-xs">
              Minify
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Actions</Label>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={!parsedData?.formatted}
              className="h-8 px-2 bg-transparent"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload("json")}
              disabled={!parsedData?.formatted}
              className="h-8 px-2"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNativeShare}
              disabled={!input.trim()}
              className="h-8 px-2 bg-transparent"
            >
              <Share2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
