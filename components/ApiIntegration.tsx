"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Globe,
  Send,
  Save,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Key,
  Plus,
  Minus,
  Copy,
  BookOpen,
  Upload,
  Code,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ApiClient, EndpointStorage, type ApiRequest, type ApiResponse, type SavedEndpoint } from "@/lib/api"
import { CodeGeneration } from "./CodeGenration"
import { CollectionManager, type CollectionRequest } from "@/lib/collection"

interface ApiIntegrationProps {
  onDataReceived: (data: string) => void
  className?: string
  selectedCollectionRequest?: CollectionRequest | null
}

interface QueryParam {
  key: string
  value: string
  enabled: boolean
}

type BodyType = "none" | "json" | "form-data" | "x-www-form-urlencoded" | "raw" | "binary"

function isSensitiveHeader(key: string): boolean {
  const lower = key.toLowerCase()
  return lower === "authorization" ||
    lower.includes("key") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("password")
}

function maskHeaderValue(value: string): string {
  if (value.length <= 8) return "***"
  const bearerMatch = value.match(/^(Bearer\s+)(.+)$/i)
  if (bearerMatch) {
    const token = bearerMatch[2]
    if (token.length <= 8) return `${bearerMatch[1]}***`
    return `${bearerMatch[1]}${token.slice(0, 4)}***${token.slice(-4)}`
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

export function ApiIntegration({ onDataReceived, className, selectedCollectionRequest }: ApiIntegrationProps) {
  const [request, setRequest] = useState<ApiRequest>({
    url: "",
    method: "GET",
    headers: ApiClient.getCommonHeaders(),
    body: "",
    timeout: 30000,
  })

  const [queryParams, setQueryParams] = useState<QueryParam[]>([])
  const [bodyType, setBodyType] = useState<BodyType>("none")
  const [revealedHeaders, setRevealedHeaders] = useState<Set<string>>(new Set())


  // Interpolate a value using the current active environment (called at render/send time)
  const interpolateValue = useCallback((text: string): string => {
    const activeEnv = CollectionManager.getActiveEnvironment()
    if (!activeEnv) return text
    return CollectionManager.interpolateVariables(text, activeEnv)
  }, [])

  // Load postman collection request when selected — store RAW templates, interpolate at render/send time
  useEffect(() => {
    if (selectedCollectionRequest) {
      setRevealedHeaders(new Set())

      // Store raw template values — NOT interpolated
      const originalHeaders = selectedCollectionRequest.headers || {}
      const finalHeaders = Object.keys(originalHeaders).length > 0
        ? { ...originalHeaders }
        : ApiClient.getCommonHeaders()

      setRequest({
        url: selectedCollectionRequest.url,
        method: selectedCollectionRequest.method,
        headers: finalHeaders,
        body: selectedCollectionRequest.body || "",
        timeout: 30000,
      })

      if (selectedCollectionRequest.queryParams && selectedCollectionRequest.queryParams.length > 0) {
        setQueryParams(selectedCollectionRequest.queryParams.map(param => ({
          ...param,
        })))
      } else {
        setQueryParams([])
      }

      // Set body type based on content
      if (selectedCollectionRequest.body) {
        try {
          JSON.parse(selectedCollectionRequest.body)
          setBodyType("json")
        } catch {
          setBodyType("raw")
        }
      } else {
        setBodyType("none")
      }
    }
  }, [selectedCollectionRequest])
  const [formData, setFormData] = useState<
    Array<{ key: string; value: string; type: "text" | "file"; enabled: boolean }>
  >([])

  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savedEndpoints, setSavedEndpoints] = useState<SavedEndpoint[]>(EndpointStorage.getEndpoints())
  const [showAuthConfig, setShowAuthConfig] = useState(false)
  const [authType, setAuthType] = useState<"none" | "bearer" | "apikey" | "basic">("none")
  const [authCredentials, setAuthCredentials] = useState({
    token: "",
    key: "",
    value: "",
    username: "",
    password: "",
  })

  const [useCorsProxy, setUseCorsProxy] = useState(false)
  const [corsProxyUrl, setCorsProxyUrl] = useState("https://cors-anywhere.herokuapp.com/")

  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [endpointName, setEndpointName] = useState("")

  const { toast } = useToast()

  const updateRequest = useCallback(
    (updates: Partial<ApiRequest>) => {
      setRequest((prev) => {
        const newRequest = { ...prev, ...updates }

        if (updates.url !== undefined || queryParams.length > 0) {
          const baseUrl = updates.url ?? prev.url
          const enabledParams = queryParams.filter((p) => p.enabled && p.key && p.value)

          if (enabledParams.length > 0) {
            const url = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`)
            enabledParams.forEach((param) => {
              url.searchParams.set(param.key, param.value)
            })
            newRequest.url = url.toString()
          } else {
            newRequest.url = baseUrl
          }
        }

        return newRequest
      })
    },
    [queryParams],
  )

  const addQueryParam = useCallback(() => {
    setQueryParams((prev) => [...prev, { key: "", value: "", enabled: true }])
  }, [])

  const updateQueryParam = useCallback((index: number, updates: Partial<QueryParam>) => {
    setQueryParams((prev) => prev.map((param, i) => (i === index ? { ...param, ...updates } : param)))
  }, [])

  const removeQueryParam = useCallback((index: number) => {
    setQueryParams((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const addFormField = useCallback(() => {
    setFormData((prev) => [...prev, { key: "", value: "", type: "text", enabled: true }])
  }, [])

  const updateFormField = useCallback((index: number, updates: any) => {
    setFormData((prev) => prev.map((field, i) => (i === index ? { ...field, ...updates } : field)))
  }, [])

  const removeFormField = useCallback((index: number) => {
    setFormData((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const getRequestBody = useCallback(() => {
    switch (bodyType) {
      case "json":
        return request.body
      case "form-data":
        const formDataObj = new FormData()
        formData
          .filter((f) => f.enabled && f.key)
          .forEach((field) => {
            formDataObj.append(field.key, field.value)
          })
        return formDataObj
      case "x-www-form-urlencoded":
        const params = new URLSearchParams()
        formData
          .filter((f) => f.enabled && f.key)
          .forEach((field) => {
            params.append(field.key, field.value)
          })
        return params.toString()
      case "raw":
        return request.body
      default:
        return ""
    }
  }, [bodyType, request.body, formData])

  const addHeader = useCallback(() => {
    const key = `header-${Date.now()}`
    updateRequest({
      headers: { ...request.headers, [key]: "" },
    })
  }, [request.headers, updateRequest])

  const updateHeader = useCallback(
    (oldKey: string, newKey: string, value: string) => {
      const newHeaders = { ...request.headers }
      if (oldKey !== newKey) {
        delete newHeaders[oldKey]
      }
      if (newKey) {
        newHeaders[newKey] = value
      }
      updateRequest({ headers: newHeaders })
    },
    [request.headers, updateRequest],
  )

  const removeHeader = useCallback(
    (key: string) => {
      const newHeaders = { ...request.headers }
      delete newHeaders[key]
      updateRequest({ headers: newHeaders })
    },
    [request.headers, updateRequest],
  )

  const applyAuth = useCallback(() => {
    const authHeaders = ApiClient.getAuthHeaders(authType as any, authCredentials)
    updateRequest({
      headers: { ...request.headers, ...authHeaders },
    })
    setShowAuthConfig(false)

    toast({
      title: "Authentication applied",
      description: `${authType} authentication headers added`,
    })
  }, [authType, authCredentials, request.headers, updateRequest, toast])

  const makeRequest = useCallback(async () => {
    if (!request.url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setResponse(null)

    try {
      // Interpolate any {{VAR}} patterns in headers/url/body using current environment
      const activeEnv = CollectionManager.getActiveEnvironment()
      const interpolateNow = (text: string): string => {
        if (!activeEnv) return text
        return CollectionManager.interpolateVariables(text, activeEnv)
      }

      const sendHeaders: Record<string, string> = {}
      Object.entries(request.headers).forEach(([key, value]) => {
        sendHeaders[interpolateNow(key)] = interpolateNow(value)
      })

      // Warn if any {{VAR}} templates are still unresolved
      const unresolvedVars: string[] = []
      Object.entries(sendHeaders).forEach(([key, value]) => {
        const matches = value.match(/\{\{(\w+)\}\}/g)
        if (matches) unresolvedVars.push(...matches)
      })
      if (unresolvedVars.length > 0) {
        const envInfo = activeEnv
          ? `Active env: "${activeEnv.name}" (${activeEnv.variables.filter(v => v.enabled).map(v => v.key).join(", ")})`
          : "No active environment set"
        toast({
          title: "Unresolved variables",
          description: `${unresolvedVars.join(", ")} not found. ${envInfo}`,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      let finalUrl = interpolateNow(request.url)
      const isLocalhost =
        finalUrl.includes("localhost") || finalUrl.includes("127.0.0.1") || finalUrl.includes("0.0.0.0")

      if (useCorsProxy && isLocalhost) {
        finalUrl = corsProxyUrl + finalUrl
      }

      const rawBody = getRequestBody()
      const safeBody = typeof rawBody === "string" ? interpolateNow(rawBody) : undefined

      const result = await ApiClient.makeRequest({
        url: finalUrl,
        method: request.method,
        headers: sendHeaders,
        body: safeBody,
        timeout: request.timeout,
      });
      setResponse(result);

      if (result.success && result.data) {
        const dataString = typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)
        onDataReceived(dataString)

        toast({
          title: "Request successful",
          description: `Received ${typeof result.data === "object" ? "JSON" : "text"} data (${result.responseTime}ms)`,
        })
      } else {
        toast({
          title: "Request failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Request error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [request, getRequestBody, onDataReceived, toast, useCorsProxy, corsProxyUrl])

  const saveEndpoint = useCallback(() => {
    if (!request.url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL to save",
        variant: "destructive",
      })
      return
    }

    setEndpointName("")
    setShowSaveDialog(true)
  }, [request, toast])

  const handleSaveConfirm = useCallback(() => {
    if (!endpointName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the endpoint",
        variant: "destructive",
      })
      return
    }

    try {
      const saved = EndpointStorage.saveEndpoint({
        name: endpointName.trim(),
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
      })

      setSavedEndpoints(EndpointStorage.getEndpoints())
      setShowSaveDialog(false)
      setEndpointName("")

      toast({
        title: "Endpoint saved",
        description: `"${saved.name}" has been saved`,
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save endpoint",
        variant: "destructive",
      })
    }
  }, [endpointName, request, toast])

  const loadEndpoint = useCallback(
    (endpoint: SavedEndpoint) => {
      setRequest({
        url: endpoint.url,
        method: endpoint.method,
        headers: endpoint.headers,
        body: endpoint.body || "",
        timeout: 30000,
      })

      toast({
        title: "Endpoint loaded",
        description: `Loaded "${endpoint.name}"`,
      })
    },
    [toast],
  )

  const deleteEndpoint = useCallback(
    (id: string, name: string) => {
      if (confirm(`Delete endpoint "${name}"?`)) {
        EndpointStorage.deleteEndpoint(id)
        setSavedEndpoints(EndpointStorage.getEndpoints())

        toast({
          title: "Endpoint deleted",
          description: `"${name}" has been deleted`,
        })
      }
    },
    [toast],
  )

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

  return (
    <div className={className}>
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save API Endpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint-name">Endpoint Name</Label>
              <Input
                id="endpoint-name"
                placeholder="Enter a name for this endpoint"
                value={endpointName}
                onChange={(e) => setEndpointName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveConfirm()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>Method:</strong> {request.method}
              </p>
              <p>
                <strong>URL:</strong> {request.url}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfirm} disabled={!endpointName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save Endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">API Integration</span>
          </div>

          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={saveEndpoint} disabled={!request.url.trim()}>
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {(request.url.includes("localhost") ||
          request.url.includes("127.0.0.1") ||
          request.url.includes("0.0.0.0")) && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <strong>Localhost API Detected:</strong> You may encounter CORS errors when testing localhost APIs
                    from the browser.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cors-proxy"
                      checked={useCorsProxy}
                      onChange={(e) => setUseCorsProxy(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="cors-proxy" className="text-sm">
                      Use CORS proxy
                    </Label>
                  </div>
                  {useCorsProxy && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="CORS proxy URL"
                        value={corsProxyUrl}
                        onChange={(e) => setCorsProxyUrl(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCorsProxyUrl("https://cors-anywhere.herokuapp.com/")}
                        className="h-8 px-2 text-xs"
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="request" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Request Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={request.method} onValueChange={(value: any) => updateRequest({ method: value })}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="HEAD">HEAD</SelectItem>
                      <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                      <SelectItem value="CONNECT">CONNECT</SelectItem>
                      <SelectItem value="TRACE">TRACE</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="https://api.example.com/data"
                    value={request.url}
                    onChange={(e) => updateRequest({ url: e.target.value })}
                    className="flex-1"
                  />

                  <Button onClick={makeRequest} disabled={isLoading || !request.url.trim()}>
                    <Send className="h-3 w-3 mr-1" />
                    {isLoading ? "Sending..." : "Send"}
                  </Button>
                </div>

                <Card className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Query Parameters</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addQueryParam}
                      className="h-6 px-2 text-xs bg-transparent"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {queryParams.map((param, index) => (
                        <div key={index} className="flex gap-1 items-center">
                          <input
                            type="checkbox"
                            checked={param.enabled}
                            onChange={(e) => updateQueryParam(index, { enabled: e.target.checked })}
                            className="w-3 h-3"
                          />
                          <Input
                            placeholder="Key"
                            value={param.key}
                            onChange={(e) => updateQueryParam(index, { key: e.target.value })}
                            className="h-7 text-xs"
                          />
                          <Input
                            placeholder="Value"
                            value={param.value}
                            onChange={(e) => updateQueryParam(index, { value: e.target.value })}
                            className="h-7 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeQueryParam(index)}
                            className="h-7 px-2"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Headers</Label>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAuthConfig(!showAuthConfig)}
                          className="h-6 px-2 text-xs"
                        >
                          <Key className="h-3 w-3 mr-1" />
                          Auth
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={addHeader}
                          className="h-6 px-2 text-xs bg-transparent"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {showAuthConfig && (
                      <Card className="p-3">
                        <div className="space-y-3">
                          <Select value={authType} onValueChange={(value: any) => setAuthType(value)}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Authentication</SelectItem>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="apikey">API Key</SelectItem>
                              <SelectItem value="basic">Basic Auth</SelectItem>
                            </SelectContent>
                          </Select>

                          {authType === "bearer" && (
                            <Input
                              placeholder="Token"
                              value={authCredentials.token}
                              onChange={(e) => setAuthCredentials((prev) => ({ ...prev, token: e.target.value }))}
                              className="h-8"
                            />
                          )}

                          {authType === "apikey" && (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Header name"
                                value={authCredentials.key}
                                onChange={(e) => setAuthCredentials((prev) => ({ ...prev, key: e.target.value }))}
                                className="h-8"
                              />
                              <Input
                                placeholder="API key"
                                value={authCredentials.value}
                                onChange={(e) => setAuthCredentials((prev) => ({ ...prev, value: e.target.value }))}
                                className="h-8"
                              />
                            </div>
                          )}

                          {authType === "basic" && (
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Username"
                                value={authCredentials.username}
                                onChange={(e) => setAuthCredentials((prev) => ({ ...prev, username: e.target.value }))}
                                className="h-8"
                              />
                              <Input
                                placeholder="Password"
                                type="password"
                                value={authCredentials.password}
                                onChange={(e) => setAuthCredentials((prev) => ({ ...prev, password: e.target.value }))}
                                className="h-8"
                              />
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button size="sm" onClick={applyAuth} disabled={authType === "none"}>
                              Apply
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAuthConfig(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}

                    <ScrollArea className="h-32">
                      <div className="space-y-1">
                        {Object.entries(request.headers).map(([key, value]) => {
                          const sensitive = isSensitiveHeader(key)
                          const revealed = revealedHeaders.has(key)
                          const hasTemplate = value.includes("{{")
                          const interpolated = interpolateValue(value)
                          const displayValue = sensitive && !revealed ? maskHeaderValue(interpolated) : interpolated

                          return (
                            <div key={key} className="space-y-0.5">
                              <div className="flex gap-1">
                                <Input
                                  placeholder="Header name"
                                  value={key}
                                  onChange={(e) => updateHeader(key, e.target.value, value)}
                                  className="h-7 text-xs"
                                />
                                <Input
                                  placeholder="Header value"
                                  value={displayValue}
                                  onChange={(e) => updateHeader(key, key, e.target.value)}
                                  className="h-7 text-xs font-mono"
                                  readOnly={sensitive && !revealed}
                                />
                                {sensitive && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setRevealedHeaders((prev) => {
                                        const next = new Set(prev)
                                        if (next.has(key)) next.delete(key)
                                        else next.add(key)
                                        return next
                                      })
                                    }
                                    className="h-7 px-2"
                                  >
                                    {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => removeHeader(key)} className="h-7 px-2">
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </div>
                              {hasTemplate && (
                                <div className="text-[10px] text-muted-foreground font-mono pl-1">
                                  <span className="text-blue-500">{value}</span>
                                  {" → "}
                                  <span className={interpolated === value ? "text-red-500" : "text-green-500"}>
                                    {sensitive ? maskHeaderValue(interpolated) : interpolated}
                                  </span>
                                  {interpolated === value && (
                                    <span className="text-red-500 ml-1">(env variable not found)</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Request Body</Label>
                      <Select value={bodyType} onValueChange={(value: BodyType) => setBodyType(value)}>
                        <SelectTrigger className="w-32 h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                          <SelectItem value="form-data">Form Data</SelectItem>
                          <SelectItem value="x-www-form-urlencoded">URL Encoded</SelectItem>
                          <SelectItem value="raw">Raw</SelectItem>
                          <SelectItem value="binary">Binary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {bodyType === "json" || bodyType === "raw" ? (
                      <Textarea
                        placeholder={bodyType === "json" ? '{\n  "key": "value"\n}' : "Raw request body"}
                        value={request.body}
                        onChange={(e) => updateRequest({ body: e.target.value })}
                        className="h-32 text-xs font-mono"
                      />
                    ) : bodyType === "form-data" || bodyType === "x-www-form-urlencoded" ? (
                      <Card className="p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">Form Fields</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={addFormField}
                            className="h-6 px-2 text-xs bg-transparent"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <ScrollArea className="max-h-24">
                          <div className="space-y-1">
                            {formData.map((field, index) => (
                              <div key={index} className="flex gap-1 items-center">
                                <input
                                  type="checkbox"
                                  checked={field.enabled}
                                  onChange={(e) => updateFormField(index, { enabled: e.target.checked })}
                                  className="w-3 h-3"
                                />
                                <Input
                                  placeholder="Key"
                                  value={field.key}
                                  onChange={(e) => updateFormField(index, { key: e.target.value })}
                                  className="h-6 text-xs"
                                />
                                <Input
                                  placeholder="Value"
                                  value={field.value}
                                  onChange={(e) => updateFormField(index, { value: e.target.value })}
                                  className="h-6 text-xs"
                                />
                                {bodyType === "form-data" && (
                                  <Select
                                    value={field.type}
                                    onValueChange={(value: "text" | "file") => updateFormField(index, { type: value })}
                                  >
                                    <SelectTrigger className="w-16 h-6 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">Text</SelectItem>
                                      <SelectItem value="file">File</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFormField(index)}
                                  className="h-6 px-2"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </Card>
                    ) : bodyType === "binary" ? (
                      <div className="h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <Upload className="h-6 w-6 mx-auto mb-1" />
                          <p className="text-xs">Binary file upload</p>
                          <p className="text-xs opacity-75">Feature coming soon</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="timeout" className="text-xs">
                      Timeout:
                    </Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={request.timeout}
                      onChange={(e) => updateRequest({ timeout: Number.parseInt(e.target.value) || 30000 })}
                      className="w-20 h-7 text-xs"
                      min="1000"
                      max="300000"
                      step="1000"
                    />
                    <span className="text-xs text-muted-foreground">ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Request Preview
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const previewText = `${request.method} ${request.url}\n\n` +
                        `Headers:\n${Object.entries(request.headers).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n\n` +
                        `Body:\n${getRequestBody() || '(empty)'}`;
                      await navigator.clipboard.writeText(previewText);
                      toast({ title: "Copied", description: "Request preview copied to clipboard" });
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Method & URL</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 bg-primary text-primary-foreground">
                        {request.method}
                      </span>
                      {request.url || <span className="text-muted-foreground italic">No URL specified</span>}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      Headers ({Object.keys(request.headers).length})
                    </Label>
                    <ScrollArea className="mt-1 h-32">
                      <div className="p-3 bg-muted rounded-lg font-mono text-xs space-y-1">
                        {Object.keys(request.headers).length > 0 ? (
                          Object.entries(request.headers).map(([key, value]) => (
                            <div key={key} className="flex">
                              <span className="text-blue-600 dark:text-blue-400 min-w-[140px]">{key}:</span>
                              <span className="text-green-600 dark:text-green-400 break-all">
                                {isSensitiveHeader(key) ? maskHeaderValue(interpolateValue(value)) : interpolateValue(value)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground italic">No headers</span>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">
                      Request Body {bodyType !== "none" && `(${bodyType})`}
                    </Label>
                    <ScrollArea className="mt-1 h-48">
                      <pre className="p-3 bg-muted rounded-lg font-mono text-xs whitespace-pre-wrap break-all">
                        {(() => {
                          const body = getRequestBody();
                          if (!body) return <span className="text-muted-foreground italic">No body</span>;
                          if (typeof body === "string") {
                            try {
                              return JSON.stringify(JSON.parse(body), null, 2);
                            } catch {
                              return body;
                            }
                          }
                          return String(body);
                        })()}
                      </pre>
                    </ScrollArea>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">cURL Command</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-xs break-all">
                      <code>
                        curl -X {request.method} &apos;{request.url}&apos;
                        {Object.entries(request.headers).map(([k, v]) => { const iv = interpolateValue(v); return ` \\\n  -H '${k}: ${isSensitiveHeader(k) ? maskHeaderValue(iv) : iv}'` }).join('')}
                        {getRequestBody() && ` \\\n  -d '${typeof getRequestBody() === 'string' ? getRequestBody() : ''}'`}
                      </code>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            {response ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Response</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={response.success ? "default" : "destructive"}>
                        {response.success ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {response.status || "Error"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {response.responseTime}ms
                      </Badge>
                      <Button size="sm" variant="outline" onClick={copyResponse} disabled={!response.data}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {response.error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
                      {response.error}
                    </div>
                  )}

                  {response.data && (
                    <ScrollArea className="h-64">
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                        {typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2)}
                      </pre>
                    </ScrollArea>
                  )}

                  {response.headers && Object.keys(response.headers).length > 0 && (
                    <div className="mt-4">
                      <Label className="text-xs font-medium">Response Headers</Label>
                      <ScrollArea className="h-20 mt-1">
                        <div className="text-xs space-y-1">
                          {Object.entries(response.headers).map(([key, value]) => (
                            <div key={key} className="flex">
                              <span className="font-mono text-muted-foreground w-32 flex-shrink-0">{key}:</span>
                              <span className="font-mono">{value}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
                  <div className="text-center">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No response yet. Make a request to see results.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Generate Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeGeneration request={request} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Saved Endpoints ({savedEndpoints.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {savedEndpoints.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {savedEndpoints.map((endpoint) => (
                        <motion.div
                          key={endpoint.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {endpoint.method}
                              </Badge>
                              <span className="font-medium text-sm truncate">{endpoint.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{endpoint.url}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadEndpoint(endpoint)}
                              className="h-7 px-2"
                            >
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteEndpoint(endpoint.id, endpoint.name)}
                              className="h-7 px-2"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No saved endpoints yet.</p>
                    <p className="text-xs">Configure a request and click "Save" to store it.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
