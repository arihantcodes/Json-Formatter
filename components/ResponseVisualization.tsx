"use client"

import { useState, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Eye,
  Code,
  BarChart3,
  Shield,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Download,
  Clipboard,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ResponseTester, type TestResult } from "@/lib/testing"
import type { ApiResponse } from "@/lib/api"

interface ResponseVisualizationProps {
  response: ApiResponse | null
  className?: string
}

export function ResponseVisualization({ response, className }: ResponseVisualizationProps) {
  const [activeTab, setActiveTab] = useState("formatted")
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunningTests, setIsRunningTests] = useState(false)

  const { toast } = useToast()

  const analysis = useMemo(() => {
    if (!response || !response.success) return null

    return ResponseTester.analyzeResponse(
      response.data,
      response.headers || {},
      response.status || 0,
      response.responseTime || 0,
      typeof response.data === "string" ? response.data : JSON.stringify(response.data),
    )
  }, [response])

  const runTests = useCallback(async () => {
    if (!response || !response.success) return

    setIsRunningTests(true)

    try {
      const defaultTests = ResponseTester.getDefaultTests()
      const results = await ResponseTester.runTests(
        defaultTests,
        response.data,
        response.headers || {},
        response.status || 0,
        response.responseTime || 0,
      )

      setTestResults(results)

      const passed = results.filter((r) => r.passed).length
      const total = results.length

      toast({
        title: "Tests completed",
        description: `${passed}/${total} tests passed`,
        variant: passed === total ? "default" : "destructive",
      })
    } catch (error) {
      toast({
        title: "Test execution failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsRunningTests(false)
    }
  }, [response, toast])

  const copyResponse = useCallback(async () => {
    if (!response?.data) return

    try {
      const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2)
      await navigator.clipboard.writeText(text)

      toast({
        title: "Copied",
        description: "Response data copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy response data",
        variant: "destructive",
      })
    }
  }, [response, toast])

  const downloadResponse = useCallback(() => {
    if (!response?.data) return

    try {
      const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2)
      const blob = new Blob([text], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `response_${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded",
        description: "Response saved to file",
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to save response",
        variant: "destructive",
      })
    }
  }, [response, toast])

  const formatResponseData = useCallback(() => {
    if (!response?.data) return ""

    if (typeof response.data === "string") {
      try {
        const parsed = JSON.parse(response.data)
        return JSON.stringify(parsed, null, 2)
      } catch {
        return response.data
      }
    }

    return JSON.stringify(response.data, null, 2)
  }, [response])

  const getPerformanceColor = (rating: string) => {
    switch (rating) {
      case "excellent":
        return "text-green-600 dark:text-green-400"
      case "good":
        return "text-blue-600 dark:text-blue-400"
      case "fair":
        return "text-yellow-600 dark:text-yellow-400"
      case "poor":
        return "text-red-600 dark:text-red-400"
      default:
        return "text-muted-foreground"
    }
  }

  if (!response) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No response to visualize</p>
              <p className="text-xs">Make a request to see response analysis</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Response Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={response.success ? "default" : "destructive"}>
                {response.success ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                {response.status || "Error"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {response.responseTime}ms
              </Badge>
              <Button size="sm" variant="outline" onClick={copyResponse}>
                <Clipboard className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={downloadResponse}>
                <Download className="h-3 w-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="formatted">
                <Code className="h-3 w-3 mr-1" />
                Formatted
              </TabsTrigger>
              <TabsTrigger value="raw">
                <FileText className="h-3 w-3 mr-1" />
                Raw
              </TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="analysis">
                <BarChart3 className="h-3 w-3 mr-1" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="tests">
                <CheckCircle className="h-3 w-3 mr-1" />
                Tests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="formatted" className="mt-4">
              <ScrollArea className="h-96">
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto font-mono">{formatResponseData()}</pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="raw" className="mt-4">
              <ScrollArea className="h-96">
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap">
                  {typeof response.data === "string" ? response.data : JSON.stringify(response.data)}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="headers" className="mt-4">
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {response.headers && Object.keys(response.headers).length > 0 ? (
                    Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 p-2 bg-muted rounded">
                        <span className="font-mono text-xs font-medium text-muted-foreground min-w-0 flex-shrink-0">
                          {key}:
                        </span>
                        <span className="font-mono text-xs break-all">{value}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No response headers</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="analysis" className="mt-4">
              {analysis ? (
                <div className="space-y-4">
                  {/* Performance Analysis */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Response Time</span>
                        <Badge variant="outline" className={getPerformanceColor(analysis.performance.rating)}>
                          {analysis.performance.responseTime}ms ({analysis.performance.rating})
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">Response Size</span>
                        <span className="text-sm font-mono">{(analysis.size.total / 1024).toFixed(1)} KB</span>
                      </div>

                      {analysis.performance.suggestions.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Suggestions:</span>
                          {analysis.performance.suggestions.map((suggestion, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Security Analysis */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Security Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Security Score</span>
                        <div className="flex items-center gap-2">
                          <Progress value={analysis.security.score} className="w-20 h-2" />
                          <span className="text-sm font-mono">{analysis.security.score}/100</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {analysis.security.headers.map((header) => (
                          <div key={header.name} className="flex items-center justify-between text-xs">
                            <span className="font-mono">{header.name}</span>
                            <Badge variant={header.present ? "default" : "secondary"}>
                              {header.present ? "Present" : "Missing"}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      {analysis.security.issues.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Issues:</span>
                          {analysis.security.issues.map((issue, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                              <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              {issue}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Format Analysis */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Format Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Content Type</span>
                        <Badge variant="outline">{analysis.format.type.toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm">Valid Format</span>
                        <Badge variant={analysis.format.isValid ? "default" : "destructive"}>
                          {analysis.format.isValid ? "Valid" : "Invalid"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No analysis available</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tests" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Response Tests</span>
                    {testResults.length > 0 && (
                      <Badge variant="outline">
                        {testResults.filter((r) => r.passed).length}/{testResults.length} passed
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" onClick={runTests} disabled={isRunningTests || !response.success}>
                    {isRunningTests ? "Running..." : "Run Tests"}
                  </Button>
                </div>

                <ScrollArea className="h-64">
                  {testResults.length > 0 ? (
                    <div className="space-y-2">
                      {testResults.map((result) => (
                        <motion.div
                          key={result.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-lg border ${
                            result.passed
                              ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                              : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              )}
                              <span className="font-medium text-sm">{result.name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {result.duration}ms
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{result.message}</p>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No test results yet</p>
                      <p className="text-xs">Run tests to validate the response</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
