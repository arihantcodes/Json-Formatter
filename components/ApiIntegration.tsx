"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ApiClient,
  EndpointStorage,
  type ApiRequest,
  type ApiResponse,
  type SavedEndpoint,
} from "@/lib/api";

interface ApiIntegrationProps {
  onDataReceived: (data: string) => void;
  className?: string;
}

interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

type BodyType =
  | "none"
  | "json"
  | "form-data"
  | "x-www-form-urlencoded"
  | "raw"
  | "binary";

export function ApiIntegration({
  onDataReceived,
  className,
}: ApiIntegrationProps) {
  const [request, setRequest] = useState<ApiRequest>({
    url: "",
    method: "GET",
    headers: ApiClient.getCommonHeaders(),
    body: "",
    timeout: 30000,
  });

  const [queryParams, setQueryParams] = useState<QueryParam[]>([]);
  const [bodyType, setBodyType] = useState<BodyType>("json");
  const [formData, setFormData] = useState<
    Array<{
      key: string;
      value: string;
      type: "text" | "file";
      enabled: boolean;
    }>
  >([]);

  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedEndpoints, setSavedEndpoints] = useState<SavedEndpoint[]>(
    EndpointStorage.getEndpoints()
  );
  const [showAuthConfig, setShowAuthConfig] = useState(false);
  const [authType, setAuthType] = useState<
    "none" | "bearer" | "apikey" | "basic"
  >("none");
  const [authCredentials, setAuthCredentials] = useState({
    token: "",
    key: "",
    value: "",
    username: "",
    password: "",
  });

  const { toast } = useToast();

  const updateRequest = useCallback(
    (updates: Partial<ApiRequest>) => {
      setRequest((prev) => {
        const newRequest = { ...prev, ...updates };

        if (updates.url !== undefined || queryParams.length > 0) {
          const baseUrl = updates.url ?? prev.url;
          const enabledParams = queryParams.filter(
            (p) => p.enabled && p.key && p.value
          );

          if (enabledParams.length > 0) {
            const url = new URL(
              baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`
            );
            enabledParams.forEach((param) => {
              url.searchParams.set(param.key, param.value);
            });
            newRequest.url = url.toString();
          } else {
            newRequest.url = baseUrl;
          }
        }

        return newRequest;
      });
    },
    [queryParams]
  );

  const addQueryParam = useCallback(() => {
    setQueryParams((prev) => [...prev, { key: "", value: "", enabled: true }]);
  }, []);

  const updateQueryParam = useCallback(
    (index: number, updates: Partial<QueryParam>) => {
      setQueryParams((prev) =>
        prev.map((param, i) => (i === index ? { ...param, ...updates } : param))
      );
    },
    []
  );

  const removeQueryParam = useCallback((index: number) => {
    setQueryParams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addFormField = useCallback(() => {
    setFormData((prev) => [
      ...prev,
      { key: "", value: "", type: "text", enabled: true },
    ]);
  }, []);

  const updateFormField = useCallback((index: number, updates: any) => {
    setFormData((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  }, []);

  const removeFormField = useCallback((index: number) => {
    setFormData((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getRequestBody = useCallback(() => {
    switch (bodyType) {
      case "json":
        return request.body;
      case "form-data":
        const formDataObj = new FormData();
        formData
          .filter((f) => f.enabled && f.key)
          .forEach((field) => {
            formDataObj.append(field.key, field.value);
          });
        return formDataObj;
      case "x-www-form-urlencoded":
        const params = new URLSearchParams();
        formData
          .filter((f) => f.enabled && f.key)
          .forEach((field) => {
            params.append(field.key, field.value);
          });
        return params.toString();
      case "raw":
        return request.body;
      default:
        return "";
    }
  }, [bodyType, request.body, formData]);

  const addHeader = useCallback(() => {
    const key = `header-${Date.now()}`;
    updateRequest({
      headers: { ...request.headers, [key]: "" },
    });
  }, [request.headers, updateRequest]);

  const updateHeader = useCallback(
    (oldKey: string, newKey: string, value: string) => {
      const newHeaders = { ...request.headers };
      if (oldKey !== newKey) {
        delete newHeaders[oldKey];
      }
      if (newKey) {
        newHeaders[newKey] = value;
      }
      updateRequest({ headers: newHeaders });
    },
    [request.headers, updateRequest]
  );

  const removeHeader = useCallback(
    (key: string) => {
      const newHeaders = { ...request.headers };
      delete newHeaders[key];
      updateRequest({ headers: newHeaders });
    },
    [request.headers, updateRequest]
  );

  const applyAuth = useCallback(() => {
    const authHeaders = ApiClient.getAuthHeaders(
      authType as any,
      authCredentials
    );
    updateRequest({
      headers: { ...request.headers, ...authHeaders },
    });
    setShowAuthConfig(false);

    toast({
      title: "Authentication applied",
      description: `${authType} authentication headers added`,
    });
  }, [authType, authCredentials, request.headers, updateRequest, toast]);

  const makeRequest = useCallback(async () => {
    if (!request.url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResponse(null);

    try {
      const requestWithBody = {
        ...request,
        body: getRequestBody(),
      };

      // Fix: Ensure requestWithBody.body is always a string or undefined (not FormData)
      const { body, ...rest } = requestWithBody;
      const safeBody = body instanceof FormData ? undefined : body;

      const result = await ApiClient.makeRequest({ ...rest, body: safeBody });
      setResponse(result);

      if (result.success && result.data) {
        const dataString =
          typeof result.data === "string"
            ? result.data
            : JSON.stringify(result.data, null, 2);
        onDataReceived(dataString);

        toast({
          title: "Request successful",
          description: `Received ${
            typeof result.data === "object" ? "JSON" : "text"
          } data (${result.responseTime}ms)`,
        });
      } else {
        toast({
          title: "Request failed",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Request error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [request, getRequestBody, onDataReceived, toast]);

  const saveEndpoint = useCallback(() => {
    if (!request.url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL to save",
        variant: "destructive",
      });
      return;
    }

    const name = prompt("Enter a name for this endpoint:");
    if (!name) return;

    try {
      const saved = EndpointStorage.saveEndpoint({
        name: name.trim(),
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      setSavedEndpoints(EndpointStorage.getEndpoints());

      toast({
        title: "Endpoint saved",
        description: `"${saved.name}" has been saved`,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save endpoint",
        variant: "destructive",
      });
    }
  }, [request, toast]);

  const loadEndpoint = useCallback(
    (endpoint: SavedEndpoint) => {
      setRequest({
        url: endpoint.url,
        method: endpoint.method,
        headers: endpoint.headers,
        body: endpoint.body || "",
        timeout: 30000,
      });

      toast({
        title: "Endpoint loaded",
        description: `Loaded "${endpoint.name}"`,
      });
    },
    [toast]
  );

  const deleteEndpoint = useCallback(
    (id: string, name: string) => {
      if (confirm(`Delete endpoint "${name}"?`)) {
        EndpointStorage.deleteEndpoint(id);
        setSavedEndpoints(EndpointStorage.getEndpoints());

        toast({
          title: "Endpoint deleted",
          description: `"${name}" has been deleted`,
        });
      }
    },
    [toast]
  );

  const copyResponse = useCallback(async () => {
    if (!response?.data) return;

    try {
      const text =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data, null, 2);
      await navigator.clipboard.writeText(text);

      toast({
        title: "Copied",
        description: "Response data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy response data",
        variant: "destructive",
      });
    }
  }, [response, toast]);

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">API Integration</span>
          </div>

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={saveEndpoint}
              disabled={!request.url.trim()}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Request Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select
                value={request.method}
                onValueChange={(value: any) => updateRequest({ method: value })}
              >
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

              <Button
                onClick={makeRequest}
                disabled={isLoading || !request.url.trim()}
              >
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
                        onChange={(e) =>
                          updateQueryParam(index, { enabled: e.target.checked })
                        }
                        className="w-3 h-3"
                      />
                      <Input
                        placeholder="Key"
                        value={param.key}
                        onChange={(e) =>
                          updateQueryParam(index, { key: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) =>
                          updateQueryParam(index, { value: e.target.value })
                        }
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
                      <Select
                        value={authType}
                        onValueChange={(value: any) => setAuthType(value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            No Authentication
                          </SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="apikey">API Key</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                        </SelectContent>
                      </Select>

                      {authType === "bearer" && (
                        <Input
                          placeholder="Token"
                          value={authCredentials.token}
                          onChange={(e) =>
                            setAuthCredentials((prev) => ({
                              ...prev,
                              token: e.target.value,
                            }))
                          }
                          className="h-8"
                        />
                      )}

                      {authType === "apikey" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Header name"
                            value={authCredentials.key}
                            onChange={(e) =>
                              setAuthCredentials((prev) => ({
                                ...prev,
                                key: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                          <Input
                            placeholder="API key"
                            value={authCredentials.value}
                            onChange={(e) =>
                              setAuthCredentials((prev) => ({
                                ...prev,
                                value: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>
                      )}

                      {authType === "basic" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Username"
                            value={authCredentials.username}
                            onChange={(e) =>
                              setAuthCredentials((prev) => ({
                                ...prev,
                                username: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                          <Input
                            placeholder="Password"
                            type="password"
                            value={authCredentials.password}
                            onChange={(e) =>
                              setAuthCredentials((prev) => ({
                                ...prev,
                                password: e.target.value,
                              }))
                            }
                            className="h-8"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={applyAuth}
                          disabled={authType === "none"}
                        >
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAuthConfig(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {Object.entries(request.headers).map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <Input
                          placeholder="Header name"
                          value={key}
                          onChange={(e) =>
                            updateHeader(key, e.target.value, value)
                          }
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Header value"
                          value={value}
                          onChange={(e) =>
                            updateHeader(key, key, e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeHeader(key)}
                          className="h-7 px-2"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Request Body</Label>
                  <Select
                    value={bodyType}
                    onValueChange={(value: BodyType) => setBodyType(value)}

                  >
                    <SelectTrigger className="w-32 h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="form-data">Form Data</SelectItem>
                      <SelectItem value="x-www-form-urlencoded">
                        URL Encoded
                      </SelectItem>
                      <SelectItem value="raw">Raw</SelectItem>
                      <SelectItem value="binary">Binary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bodyType === "json" || bodyType === "raw" ? (
                  <Textarea
                    placeholder={
                      bodyType === "json"
                        ? '{\n  "key": "value"\n}'
                        : "Raw request body"
                    }
                    value={request.body}
                    onChange={(e) => updateRequest({ body: e.target.value })}
                    className="h-32 text-xs font-mono"
                  />
                ) : bodyType === "form-data" ||
                  bodyType === "x-www-form-urlencoded" ? (
                  <Card className="p-2 ">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        Form Fields
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addFormField}
                        className="h-6 px-2 text-xs bg-transparent"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {formData.map((field, index) => (
                        <div key={index} className="flex gap-1 items-center">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) =>
                              updateFormField(index, {
                                enabled: e.target.checked,
                              })
                            }
                            className="w-3 h-3"
                          />
                          <Input
                            placeholder="Key"
                            value={field.key}
                            onChange={(e) =>
                              updateFormField(index, { key: e.target.value })
                            }
                            className="h-9 text-xs"
                          />
                          <Input
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) =>
                              updateFormField(index, {
                                value: e.target.value,
                              })
                            }
                            className="h-9 text-xs"
                          />
                          {bodyType === "form-data" && (
                            <Select
                              value={field.type}
                              onValueChange={(value: "text" | "file") =>
                                updateFormField(index, { type: value })
                              }
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
                  onChange={(e) =>
                    updateRequest({
                      timeout: Number.parseInt(e.target.value) || 30000,
                    })
                  }
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
      </div>
    </div>
  );
}
