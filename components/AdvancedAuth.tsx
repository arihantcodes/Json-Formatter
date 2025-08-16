"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Key, Plus, Save, Trash2, Eye, EyeOff, Settings, Lock, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ApiClient, type AuthConfig, type HeaderPreset, type EnvironmentVariable } from "@/lib/api"

interface AdvancedAuthProps {
  onAuthApplied: (headers: Record<string, string>) => void
  className?: string
}

export function AdvancedAuth({ onAuthApplied, className }: AdvancedAuthProps) {
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    type: "none",
    credentials: {},
    settings: {},
  })

  const [headerPresets, setHeaderPresets] = useState<HeaderPreset[]>(ApiClient.getHeaderPresets())
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>(ApiClient.getEnvironmentVariables())
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [newPresetName, setNewPresetName] = useState("")
  const [newEnvVar, setNewEnvVar] = useState<EnvironmentVariable>({
    key: "",
    value: "",
    enabled: true,
    description: "",
  })

  const { toast } = useToast()

  const updateAuthConfig = useCallback((updates: Partial<AuthConfig>) => {
    setAuthConfig((prev) => ({ ...prev, ...updates }))
  }, [])

  const updateCredentials = useCallback((key: string, value: string) => {
    setAuthConfig((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }))
  }, [])

  const updateSettings = useCallback((key: string, value: any) => {
    setAuthConfig((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }))
  }, [])

  const applyAuth = useCallback(() => {
    const headers = ApiClient.getAuthHeaders(authConfig.type, authConfig.credentials, authConfig.settings)
    onAuthApplied(headers)

    toast({
      title: "Authentication applied",
      description: `${authConfig.type} authentication configured`,
    })
  }, [authConfig, onAuthApplied, toast])

  const applyHeaderPreset = useCallback(
    (preset: HeaderPreset) => {
      onAuthApplied(preset.headers)

      toast({
        title: "Headers applied",
        description: `Applied "${preset.name}" preset`,
      })
    },
    [onAuthApplied, toast],
  )

  const saveHeaderPreset = useCallback(() => {
    if (!newPresetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the preset",
        variant: "destructive",
      })
      return
    }

    const headers = ApiClient.getAuthHeaders(authConfig.type, authConfig.credentials, authConfig.settings)
    const preset = ApiClient.saveHeaderPreset({
      name: newPresetName.trim(),
      headers,
      description: `${authConfig.type} authentication preset`,
    })

    setHeaderPresets(ApiClient.getHeaderPresets())
    setNewPresetName("")

    toast({
      title: "Preset saved",
      description: `"${preset.name}" has been saved`,
    })
  }, [newPresetName, authConfig, toast])

  const deleteHeaderPreset = useCallback(
    (id: string, name: string) => {
      if (confirm(`Delete preset "${name}"?`)) {
        ApiClient.deleteHeaderPreset(id)
        setHeaderPresets(ApiClient.getHeaderPresets())

        toast({
          title: "Preset deleted",
          description: `"${name}" has been deleted`,
        })
      }
    },
    [toast],
  )

  const saveEnvVar = useCallback(() => {
    if (!newEnvVar.key.trim()) {
      toast({
        title: "Key required",
        description: "Please enter a variable key",
        variant: "destructive",
      })
      return
    }

    ApiClient.saveEnvironmentVariable(newEnvVar)
    setEnvVars(ApiClient.getEnvironmentVariables())
    setNewEnvVar({ key: "", value: "", enabled: true, description: "" })

    toast({
      title: "Variable saved",
      description: `"${newEnvVar.key}" has been saved`,
    })
  }, [newEnvVar, toast])

  const deleteEnvVar = useCallback(
    (key: string) => {
      if (confirm(`Delete variable "${key}"?`)) {
        ApiClient.deleteEnvironmentVariable(key)
        setEnvVars(ApiClient.getEnvironmentVariables())

        toast({
          title: "Variable deleted",
          description: `"${key}" has been deleted`,
        })
      }
    },
    [toast],
  )

  const toggleSecret = useCallback((key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const renderAuthForm = () => {
    switch (authConfig.type) {
      case "bearer":
        return (
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Bearer token"
                type={showSecrets.token ? "text" : "password"}
                value={authConfig.credentials.token || ""}
                onChange={(e) => updateCredentials("token", e.target.value)}
                className="pr-10"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleSecret("token")}
                className="absolute right-1 top-1 h-6 w-6 p-0"
              >
                {showSecrets.token ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )

      case "apikey":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Header/Param name"
                value={authConfig.credentials.key || ""}
                onChange={(e) => updateCredentials("key", e.target.value)}
              />
              <div className="relative">
                <Input
                  placeholder="API key"
                  type={showSecrets.apikey ? "text" : "password"}
                  value={authConfig.credentials.value || ""}
                  onChange={(e) => updateCredentials("value", e.target.value)}
                  className="pr-10"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleSecret("apikey")}
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                >
                  {showSecrets.apikey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            <Select
              value={authConfig.settings?.location || "header"}
              onValueChange={(value) => updateSettings("location", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query Parameter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )

      case "basic":
        return (
          <div className="space-y-3">
            <Input
              placeholder="Username"
              value={authConfig.credentials.username || ""}
              onChange={(e) => updateCredentials("username", e.target.value)}
            />
            <div className="relative">
              <Input
                placeholder="Password"
                type={showSecrets.password ? "text" : "password"}
                value={authConfig.credentials.password || ""}
                onChange={(e) => updateCredentials("password", e.target.value)}
                className="pr-10"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleSecret("password")}
                className="absolute right-1 top-1 h-6 w-6 p-0"
              >
                {showSecrets.password ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )

      case "oauth2":
        return (
          <div className="space-y-3">
            <Input
              placeholder="Access Token"
              type={showSecrets.oauth ? "text" : "password"}
              value={authConfig.credentials.accessToken || ""}
              onChange={(e) => updateCredentials("accessToken", e.target.value)}
            />
            <Input
              placeholder="Refresh Token (optional)"
              type={showSecrets.refresh ? "text" : "password"}
              value={authConfig.credentials.refreshToken || ""}
              onChange={(e) => updateCredentials("refreshToken", e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              <p>For OAuth 2.0 flow, you'll need to handle authorization separately.</p>
            </div>
          </div>
        )

      case "jwt":
        return (
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="JWT Token"
                type={showSecrets.jwt ? "text" : "password"}
                value={authConfig.credentials.token || ""}
                onChange={(e) => updateCredentials("token", e.target.value)}
                className="pr-10"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleSecret("jwt")}
                className="absolute right-1 top-1 h-6 w-6 p-0"
              >
                {showSecrets.jwt ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
            <Input
              placeholder="Prefix (default: Bearer)"
              value={authConfig.settings?.prefix || ""}
              onChange={(e) => updateSettings("prefix", e.target.value)}
            />
          </div>
        )

      case "custom":
        return (
          <div className="space-y-3">
            <Input
              placeholder="Header Name"
              value={authConfig.credentials.headerName || ""}
              onChange={(e) => updateCredentials("headerName", e.target.value)}
            />
            <Input
              placeholder="Prefix (optional)"
              value={authConfig.credentials.prefix || ""}
              onChange={(e) => updateCredentials("prefix", e.target.value)}
            />
            <div className="relative">
              <Input
                placeholder="Header Value"
                type={showSecrets.custom ? "text" : "password"}
                value={authConfig.credentials.headerValue || ""}
                onChange={(e) => updateCredentials("headerValue", e.target.value)}
                className="pr-10"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleSecret("custom")}
                className="absolute right-1 top-1 h-6 w-6 p-0"
              >
                {showSecrets.custom ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-4 text-muted-foreground">
            <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select an authentication method to configure</p>
          </div>
        )
    }
  }

  return (
    <div className={className}>
      <Tabs defaultValue="auth" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="presets">Header Presets</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Key className="h-4 w-4" />
                Authentication Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={authConfig.type}
                onValueChange={(value: AuthConfig["type"]) =>
                  updateAuthConfig({ type: value, credentials: {}, settings: {} })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Authentication</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="apikey">API Key</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                  <SelectItem value="jwt">JWT</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {renderAuthForm()}

              <div className="flex gap-2">
                <Button onClick={applyAuth} disabled={authConfig.type === "none"}>
                  Apply Authentication
                </Button>
                <Button
                  variant="outline"
                  onClick={saveHeaderPreset}
                  disabled={authConfig.type === "none" || !newPresetName.trim()}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save as Preset
                </Button>
              </div>

              {authConfig.type !== "none" && (
                <div className="space-y-2">
                  <Label className="text-xs">Save as Preset</Label>
                  <Input
                    placeholder="Preset name"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="h-8"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presets" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Header Presets ({headerPresets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {headerPresets.map((preset) => (
                    <motion.div
                      key={preset.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{preset.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {Object.keys(preset.headers).length} headers
                          </Badge>
                        </div>
                        {preset.description && <p className="text-xs text-muted-foreground">{preset.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyHeaderPreset(preset)}
                          className="h-7 px-2"
                        >
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteHeaderPreset(preset.id, preset.name)}
                          className="h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Environment Variables ({envVars.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card className="p-3">
                <div className="space-y-2">
                  <Label className="text-xs">Add New Variable</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Variable key"
                      value={newEnvVar.key}
                      onChange={(e) => setNewEnvVar((prev) => ({ ...prev, key: e.target.value }))}
                      className="h-8"
                    />
                    <Input
                      placeholder="Variable value"
                      value={newEnvVar.value}
                      onChange={(e) => setNewEnvVar((prev) => ({ ...prev, value: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <Input
                    placeholder="Description (optional)"
                    value={newEnvVar.description}
                    onChange={(e) => setNewEnvVar((prev) => ({ ...prev, description: e.target.value }))}
                    className="h-8"
                  />
                  <Button size="sm" onClick={saveEnvVar} disabled={!newEnvVar.key.trim()}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Variable
                  </Button>
                </div>
              </Card>

              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {envVars.map((envVar) => (
                    <motion.div
                      key={envVar.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs bg-muted px-1 rounded">{`{{${envVar.key}}}`}</code>
                          <Badge variant={envVar.enabled ? "default" : "secondary"} className="text-xs">
                            {envVar.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        {envVar.description && <p className="text-xs text-muted-foreground">{envVar.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteEnvVar(envVar.key)}
                          className="h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>

              {envVars.length > 0 && (
                <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                  <p>
                    <strong>Usage:</strong> Use variables in URLs, headers, or body with{" "}
                    <code>{`{{variableName}}`}</code> syntax.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
