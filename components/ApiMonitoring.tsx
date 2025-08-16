"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { monitoringEngine, type MonitorConfig, type MonitorCheck, type MonitorStats } from "@/lib/monitorings"
import { Play, Plus, Trash2, AlertTriangle, CheckCircle, XCircle, Clock, Bell } from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts"

interface ApiMonitoringProps {
  className?: string
}

export function ApiMonitoring({ className }: ApiMonitoringProps) {
  const [monitors, setMonitors] = useState<MonitorConfig[]>([])
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null)
  const [monitorStats, setMonitorStats] = useState<Record<string, MonitorStats>>({})
  const [recentChecks, setRecentChecks] = useState<MonitorCheck[]>([])
  const [showAddMonitor, setShowAddMonitor] = useState(false)
  const [newMonitor, setNewMonitor] = useState<Partial<MonitorConfig>>({
    name: "",
    url: "",
    method: "GET",
    interval: 5,
    timeout: 30,
    alertThreshold: 3,
    enabled: true,
    tags: [],
  })
  const [activeTab, setActiveTab] = useState("dashboard")
  const { toast } = useToast()

  useEffect(() => {
    // Load initial data
    setMonitors(monitoringEngine.getAllMonitors())
    updateStats()

    // Set up event handlers
    monitoringEngine.setCheckHandler((check) => {
      setRecentChecks((prev) => [...prev.slice(-99), check])
      updateStats()
    })

    monitoringEngine.setIncidentHandlers(
      (incident) => {
        toast({
          title: "Incident Started",
          description: `${getMonitorName(incident.monitorId)} is experiencing issues`,
          variant: "destructive",
        })
      },
      (incident) => {
        const duration = incident.duration ? formatDuration(incident.duration) : "Unknown"
        toast({
          title: "Incident Resolved",
          description: `${getMonitorName(incident.monitorId)} is back online (${duration} downtime)`,
        })
      },
    )

    return () => {
      // Cleanup is handled by the monitoring engine
    }
  }, [])

  const updateStats = () => {
    const stats: Record<string, MonitorStats> = {}
    for (const monitor of monitoringEngine.getAllMonitors()) {
      stats[monitor.id] = monitoringEngine.getMonitorStats(monitor.id)
    }
    setMonitorStats(stats)
  }

  const getMonitorName = (id: string) => {
    return monitors.find((m) => m.id === id)?.name || "Unknown Monitor"
  }

  const handleAddMonitor = () => {
    if (!newMonitor.name || !newMonitor.url) {
      toast({
        title: "Invalid monitor",
        description: "Name and URL are required",
        variant: "destructive",
      })
      return
    }

    const monitor: MonitorConfig = {
      id: crypto.randomUUID(),
      name: newMonitor.name,
      url: newMonitor.url,
      method: newMonitor.method || "GET",
      headers: newMonitor.headers,
      body: newMonitor.body,
      interval: newMonitor.interval || 5,
      timeout: newMonitor.timeout || 30,
      expectedStatus: newMonitor.expectedStatus,
      expectedContent: newMonitor.expectedContent,
      alertThreshold: newMonitor.alertThreshold || 3,
      enabled: newMonitor.enabled ?? true,
      createdAt: new Date(),
      tags: newMonitor.tags || [],
    }

    monitoringEngine.addMonitor(monitor)
    setMonitors(monitoringEngine.getAllMonitors())
    setShowAddMonitor(false)
    setNewMonitor({
      name: "",
      url: "",
      method: "GET",
      interval: 5,
      timeout: 30,
      alertThreshold: 3,
      enabled: true,
      tags: [],
    })

    toast({
      title: "Monitor added",
      description: `${monitor.name} is now being monitored`,
    })
  }

  const handleDeleteMonitor = (id: string) => {
    const monitor = monitors.find((m) => m.id === id)
    if (!monitor) return

    monitoringEngine.removeMonitor(id)
    setMonitors(monitoringEngine.getAllMonitors())
    if (selectedMonitor === id) {
      setSelectedMonitor(null)
    }

    toast({
      title: "Monitor deleted",
      description: `${monitor.name} monitoring stopped`,
    })
  }

  const handleToggleMonitor = (id: string, enabled: boolean) => {
    const monitor = monitors.find((m) => m.id === id)
    if (!monitor) return

    const updated = { ...monitor, enabled }
    monitoringEngine.updateMonitor(updated)
    setMonitors(monitoringEngine.getAllMonitors())

    toast({
      title: enabled ? "Monitor enabled" : "Monitor disabled",
      description: `${monitor.name} monitoring ${enabled ? "started" : "stopped"}`,
    })
  }

  const handleRunCheck = async (id: string) => {
    try {
      await monitoringEngine.runCheck(id)
      toast({
        title: "Check completed",
        description: "Manual check executed successfully",
      })
    } catch (error) {
      toast({
        title: "Check failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "up":
        return "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300"
      case "down":
        return "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300"
      case "degraded":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300"
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "up":
        return <CheckCircle className="w-4 h-4" />
      case "down":
        return <XCircle className="w-4 h-4" />
      case "degraded":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatUptime = (uptime: number) => {
    return `${uptime.toFixed(2)}%`
  }

  const getUptimeChartData = (monitorId: string) => {
    const checks = monitoringEngine.getChecks(monitorId, 24 * 60 * 60 * 1000) // Last 24 hours
    const hourlyData: Record<string, { hour: string; uptime: number; responseTime: number; count: number }> = {}

    checks.forEach((check) => {
      const hour = new Date(check.timestamp).toISOString().slice(0, 13) + ":00"
      if (!hourlyData[hour]) {
        hourlyData[hour] = { hour, uptime: 0, responseTime: 0, count: 0 }
      }

      hourlyData[hour].count++
      if (check.success) {
        hourlyData[hour].uptime++
        hourlyData[hour].responseTime += check.responseTime
      }
    })

    return Object.values(hourlyData)
      .map((data) => ({
        hour: new Date(data.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        uptime: data.count > 0 ? (data.uptime / data.count) * 100 : 0,
        responseTime: data.uptime > 0 ? data.responseTime / data.uptime : 0,
      }))
      .slice(-24)
  }

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="monitors">Monitors</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Monitors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{monitors.length}</div>
                <p className="text-xs text-muted-foreground">{monitors.filter((m) => m.enabled).length} active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {monitors.length > 0
                    ? formatUptime(
                        Object.values(monitorStats).reduce((sum, stats) => sum + stats.uptime, 0) / monitors.length,
                      )
                    : "100%"}
                </div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.values(monitorStats).reduce(
                    (sum, stats) => sum + stats.incidents.filter((i) => i.status === "ongoing").length,
                    0,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Ongoing issues</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {monitors.length > 0
                    ? Math.round(
                        Object.values(monitorStats).reduce((sum, stats) => sum + stats.avgResponseTime, 0) /
                          monitors.length,
                      )
                    : 0}
                  ms
                </div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Monitor Status</CardTitle>
                <CardDescription>Current status of all monitors</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {monitors.map((monitor) => {
                      const stats = monitorStats[monitor.id]
                      return (
                        <div key={monitor.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(stats?.currentStatus || "unknown")}
                            <div>
                              <div className="font-medium">{monitor.name}</div>
                              <div className="text-sm text-muted-foreground">{monitor.url}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(stats?.currentStatus || "unknown")}>
                              {stats?.currentStatus || "unknown"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {stats ? formatUptime(stats.uptime) : "N/A"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest monitoring checks</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {recentChecks
                      .slice(-20)
                      .reverse()
                      .map((check) => (
                        <div key={check.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex items-center gap-2">
                            {check.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span>{getMonitorName(check.monitorId)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={check.success ? "default" : "destructive"}>{check.statusCode}</Badge>
                            <span>{check.responseTime}ms</span>
                            <span className="text-muted-foreground">{check.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {selectedMonitor && (
            <Card>
              <CardHeader>
                <CardTitle>Monitor Details</CardTitle>
                <CardDescription>{getMonitorName(selectedMonitor)} - 24 Hour Overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={getUptimeChartData(selectedMonitor)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="uptime" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monitors" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Monitors</h3>
            <Button onClick={() => setShowAddMonitor(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Monitor
            </Button>
          </div>

          {showAddMonitor && (
            <Card>
              <CardHeader>
                <CardTitle>Add New Monitor</CardTitle>
                <CardDescription>Configure a new endpoint to monitor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monitor-name">Monitor Name</Label>
                    <Input
                      id="monitor-name"
                      value={newMonitor.name || ""}
                      onChange={(e) => setNewMonitor((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="My API"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monitor-url">URL</Label>
                    <Input
                      id="monitor-url"
                      value={newMonitor.url || ""}
                      onChange={(e) => setNewMonitor((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://api.example.com/health"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monitor-method">HTTP Method</Label>
                    <Select
                      value={newMonitor.method || "GET"}
                      onValueChange={(value: any) => setNewMonitor((prev) => ({ ...prev, method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="HEAD">HEAD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monitor-interval">Check Interval (minutes)</Label>
                    <Input
                      id="monitor-interval"
                      type="number"
                      value={newMonitor.interval || 5}
                      onChange={(e) =>
                        setNewMonitor((prev) => ({ ...prev, interval: Number.parseInt(e.target.value) || 5 }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="monitor-timeout">Timeout (seconds)</Label>
                    <Input
                      id="monitor-timeout"
                      type="number"
                      value={newMonitor.timeout || 30}
                      onChange={(e) =>
                        setNewMonitor((prev) => ({ ...prev, timeout: Number.parseInt(e.target.value) || 30 }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Alert Threshold (failures)</Label>
                    <Input
                      id="alert-threshold"
                      type="number"
                      value={newMonitor.alertThreshold || 3}
                      onChange={(e) =>
                        setNewMonitor((prev) => ({ ...prev, alertThreshold: Number.parseInt(e.target.value) || 3 }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monitor-headers">Headers (JSON)</Label>
                  <Textarea
                    id="monitor-headers"
                    value={JSON.stringify(newMonitor.headers || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value || "{}")
                        setNewMonitor((prev) => ({ ...prev, headers }))
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    rows={3}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="monitor-enabled"
                    checked={newMonitor.enabled ?? true}
                    onCheckedChange={(enabled) => setNewMonitor((prev) => ({ ...prev, enabled }))}
                  />
                  <Label htmlFor="monitor-enabled">Enable monitoring</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddMonitor}>Add Monitor</Button>
                  <Button variant="outline" onClick={() => setShowAddMonitor(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitors.map((monitor) => {
              const stats = monitorStats[monitor.id]
              return (
                <Card key={monitor.id} className="cursor-pointer" onClick={() => setSelectedMonitor(monitor.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{monitor.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(stats?.currentStatus || "unknown")}>
                          {stats?.currentStatus || "unknown"}
                        </Badge>
                        <Switch
                          checked={monitor.enabled}
                          onCheckedChange={(enabled) => handleToggleMonitor(monitor.id, enabled)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <CardDescription className="truncate">{monitor.url}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Uptime</div>
                        <div className="font-medium">{stats ? formatUptime(stats.uptime) : "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Response</div>
                        <div className="font-medium">{stats ? `${Math.round(stats.avgResponseTime)}ms` : "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Interval</div>
                        <div className="font-medium">{monitor.interval}m</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last Check</div>
                        <div className="font-medium">
                          {monitor.lastChecked ? monitor.lastChecked.toLocaleTimeString() : "Never"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => handleRunCheck(monitor.id)}>
                        <Play className="w-3 h-3 mr-1" />
                        Test
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteMonitor(monitor.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
              <CardDescription>Monitor downtime and incident history</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {Object.entries(monitorStats)
                    .flatMap(([monitorId, stats]) => stats.incidents.map((incident) => ({ ...incident, monitorId })))
                    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
                    .map((incident) => (
                      <div key={incident.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {incident.status === "ongoing" ? (
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          <div>
                            <div className="font-medium">{getMonitorName(incident.monitorId)}</div>
                            <div className="text-sm text-muted-foreground">
                              Started {incident.startTime.toLocaleString()}
                              {incident.endTime && ` • Resolved ${incident.endTime.toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={incident.status === "ongoing" ? "destructive" : "default"}>
                            {incident.status}
                          </Badge>
                          <div className="text-sm text-muted-foreground mt-1">
                            {incident.duration ? formatDuration(incident.duration) : "Ongoing"}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>Set up notifications for monitor incidents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Alert configuration coming soon</p>
                <p className="text-sm">Webhook, email, and Slack integrations will be available in the next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
