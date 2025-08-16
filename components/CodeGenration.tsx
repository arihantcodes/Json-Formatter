"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Code, Clipboard, Download, Settings, FileText, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CodeGenerator, type CodeGenOptions } from "@/lib/codegen"
import type { ApiRequest } from "@/lib/api"
import type { RequestCollection } from "@/lib/collection"

interface CodeGenerationProps {
  request: ApiRequest | null
  collection?: RequestCollection | null
  className?: string
}

export function CodeGeneration({ request, collection, className }: CodeGenerationProps) {
  const [options, setOptions] = useState<CodeGenOptions>({
    language: "javascript",
    framework: "browser",
    includeComments: true,
    useEnvironmentVariables: false,
    indentSize: 2,
    indentType: "spaces",
  })

  const [activeTab, setActiveTab] = useState("generate")

  const { toast } = useToast()

  const supportedLanguages = useMemo(() => CodeGenerator.getSupportedLanguages(), [])

  const generatedCode = useMemo(() => {
    if (!request) return null

    try {
      return CodeGenerator.generateCode(request, options)
    } catch (error) {
      console.error("Code generation failed:", error)
      return null
    }
  }, [request, options])

  const updateOptions = useCallback((updates: Partial<CodeGenOptions>) => {
    setOptions((prev) => ({ ...prev, ...updates }))
  }, [])

  const copyCode = useCallback(async () => {
    if (!generatedCode) return

    try {
      await navigator.clipboard.writeText(generatedCode.code)
      toast({
        title: "Code copied",
        description: "Generated code copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy code to clipboard",
        variant: "destructive",
      })
    }
  }, [generatedCode, toast])

  const downloadCode = useCallback(() => {
    if (!generatedCode) return

    try {
      const blob = new Blob([generatedCode.code], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = generatedCode.filename
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Code downloaded",
        description: `Code saved as ${generatedCode.filename}`,
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download code file",
        variant: "destructive",
      })
    }
  }, [generatedCode, toast])

  const exportCollection = useCallback(
    (format: "postman" | "openapi") => {
      if (!collection) return

      try {
        let exportData: string
        let filename: string

        if (format === "postman") {
          exportData = CodeGenerator.exportToPostmanCollection(collection)
          filename = `${collection.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.postman_collection.json`
        } else {
          exportData = CodeGenerator.exportToOpenAPI(collection)
          filename = `${collection.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.openapi.json`
        }

        const blob = new Blob([exportData], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)

        toast({
          title: "Collection exported",
          description: `Collection exported as ${format.toUpperCase()}`,
        })
      } catch (error) {
        toast({
          title: "Export failed",
          description: `Unable to export collection as ${format.toUpperCase()}`,
          variant: "destructive",
        })
      }
    },
    [collection, toast],
  )

  const selectedLanguage = supportedLanguages.find((lang) => lang.value === options.language)

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Generation & Export
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generate">
                <Zap className="h-3 w-3 mr-1" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-3 w-3 mr-1" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="export">
                <FileText className="h-3 w-3 mr-1" />
                Export
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Select value={options.language} onValueChange={(value) => updateOptions({ language: value })}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedLanguage?.frameworks && (
                  <Select value={options.framework} onValueChange={(value) => updateOptions({ framework: value })}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Framework" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedLanguage.frameworks.map((framework) => (
                        <SelectItem key={framework} value={framework}>
                          {framework}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex-1" />

                {generatedCode && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={copyCode}>
                      <Clipboard className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadCode}>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
              </div>

              {generatedCode ? (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{generatedCode.language}</Badge>
                        {generatedCode.framework && <Badge variant="secondary">{generatedCode.framework}</Badge>}
                        <span className="text-xs text-muted-foreground">{generatedCode.filename}</span>
                      </div>
                      {generatedCode.dependencies && generatedCode.dependencies.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Dependencies:</span>
                          {generatedCode.dependencies.map((dep) => (
                            <Badge key={dep} variant="outline" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto font-mono whitespace-pre">
                        {generatedCode.code}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : request ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Code generation failed</p>
                  <p className="text-xs">Please check your request configuration</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No request to generate code for</p>
                  <p className="text-xs">Configure a request to generate code snippets</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Code Generation Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-comments" className="text-sm">
                      Include Comments
                    </Label>
                    <Switch
                      id="include-comments"
                      checked={options.includeComments}
                      onCheckedChange={(checked) => updateOptions({ includeComments: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="use-env-vars" className="text-sm">
                      Use Environment Variables
                    </Label>
                    <Switch
                      id="use-env-vars"
                      checked={options.useEnvironmentVariables}
                      onCheckedChange={(checked) => updateOptions({ useEnvironmentVariables: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Indentation</Label>
                    <div className="flex gap-2">
                      <Select
                        value={options.indentType}
                        onValueChange={(value: "spaces" | "tabs") => updateOptions({ indentType: value })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spaces">Spaces</SelectItem>
                          <SelectItem value="tabs">Tabs</SelectItem>
                        </SelectContent>
                      </Select>

                      {options.indentType === "spaces" && (
                        <Select
                          value={options.indentSize.toString()}
                          onValueChange={(value) => updateOptions({ indentSize: Number.parseInt(value) })}
                        >
                          <SelectTrigger className="w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="8">8</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Export Collection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {collection ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{collection.name}</span>
                          <Badge variant="outline">{collection.requests.length} requests</Badge>
                        </div>
                        {collection.description && (
                          <p className="text-xs text-muted-foreground">{collection.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => exportCollection("postman")}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-3 w-3" />
                          Postman Collection
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => exportCollection("openapi")}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-3 w-3" />
                          OpenAPI Spec
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          <strong>Postman Collection:</strong> Import into Postman for team collaboration
                        </p>
                        <p>
                          <strong>OpenAPI Spec:</strong> Generate documentation and client SDKs
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No collection to export</p>
                      <p className="text-xs">Create a collection to export your API requests</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
