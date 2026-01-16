export interface MonitorConfig {
    id: string
    name: string
    url: string
    method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD"
    headers?: Record<string, string>
    body?: string
    interval: number // in minutes
    timeout: number // in seconds
    expectedStatus?: number[]
    expectedContent?: string
    alertThreshold: number // consecutive failures before alert
    enabled: boolean
    createdAt: Date
    lastChecked?: Date
    tags: string[]
  }
  
  export interface MonitorCheck {
    id: string
    monitorId: string
    timestamp: Date
    responseTime: number
    statusCode: number
    success: boolean
    error?: string
    size: number
    location?: string
  }
  
  export interface MonitorStats {
    uptime: number // percentage
    avgResponseTime: number
    totalChecks: number
    successfulChecks: number
    failedChecks: number
    lastFailure?: Date
    currentStatus: "up" | "down" | "degraded"
    incidents: MonitorIncident[]
  }
  
  export interface MonitorIncident {
    id: string
    monitorId: string
    startTime: Date
    endTime?: Date
    duration?: number
    status: "ongoing" | "resolved"
    failureCount: number
    checks: MonitorCheck[]
  }
  
  export interface MonitorAlert {
    id: string
    monitorId: string
    type: "email" | "webhook" | "slack"
    config: {
      email?: string
      webhookUrl?: string
      slackChannel?: string
    }
    enabled: boolean
  }
  
  export class MonitoringEngine {
    private monitors = new Map<string, MonitorConfig>()
    private checks = new Map<string, MonitorCheck[]>()
    private incidents = new Map<string, MonitorIncident[]>()
    private intervals = new Map<string, NodeJS.Timeout>()
    private alerts = new Map<string, MonitorAlert[]>()
    private onCheckComplete: (check: MonitorCheck) => void = () => {}
    private onIncidentStart: (incident: MonitorIncident) => void = () => {}
    private onIncidentEnd: (incident: MonitorIncident) => void = () => {}
  
    setCheckHandler(handler: (check: MonitorCheck) => void) {
      this.onCheckComplete = handler
    }
  
    setIncidentHandlers(onStart: (incident: MonitorIncident) => void, onEnd: (incident: MonitorIncident) => void) {
      this.onIncidentStart = onStart
      this.onIncidentEnd = onEnd
    }
  
    addMonitor(config: MonitorConfig): void {
      this.monitors.set(config.id, config)
      this.checks.set(config.id, [])
      this.incidents.set(config.id, [])
  
      if (config.enabled) {
        this.startMonitoring(config.id)
      }
  
      this.saveToStorage()
    }
  
    updateMonitor(config: MonitorConfig): void {
      const existing = this.monitors.get(config.id)
      if (!existing) return
  
      this.monitors.set(config.id, config)
  
      // Restart monitoring if interval changed or enabled/disabled
      if (existing.interval !== config.interval || existing.enabled !== config.enabled) {
        this.stopMonitoring(config.id)
        if (config.enabled) {
          this.startMonitoring(config.id)
        }
      }
  
      this.saveToStorage()
    }
  
    removeMonitor(id: string): void {
      this.stopMonitoring(id)
      this.monitors.delete(id)
      this.checks.delete(id)
      this.incidents.delete(id)
      this.alerts.delete(id)
      this.saveToStorage()
    }
  
    getMonitor(id: string): MonitorConfig | undefined {
      return this.monitors.get(id)
    }
  
    getAllMonitors(): MonitorConfig[] {
      return Array.from(this.monitors.values())
    }
  
    getMonitorStats(id: string, timeRange = 24 * 60 * 60 * 1000): MonitorStats {
      const checks = this.getChecks(id, timeRange)
      const incidents = this.incidents.get(id) || []
  
      const totalChecks = checks.length
      const successfulChecks = checks.filter((c) => c.success).length
      const failedChecks = totalChecks - successfulChecks
  
      const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100
      const avgResponseTime =
        successfulChecks > 0
          ? checks.filter((c) => c.success).reduce((sum, c) => sum + c.responseTime, 0) / successfulChecks
          : 0
  
      const lastFailure = checks
        .filter((c) => !c.success)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp
  
      const ongoingIncident = incidents.find((i) => i.status === "ongoing")
      const currentStatus = ongoingIncident ? "down" : uptime < 99 ? "degraded" : "up"
  
      return {
        uptime,
        avgResponseTime,
        totalChecks,
        successfulChecks,
        failedChecks,
        lastFailure,
        currentStatus,
        incidents: incidents.slice(-10), // Last 10 incidents
      }
    }
  
    getChecks(id: string, timeRange?: number): MonitorCheck[] {
      const allChecks = this.checks.get(id) || []
      if (!timeRange) return allChecks
  
      const cutoff = new Date(Date.now() - timeRange)
      return allChecks.filter((check) => check.timestamp >= cutoff)
    }
  
    async runCheck(id: string): Promise<MonitorCheck> {
      const monitor = this.monitors.get(id)
      if (!monitor) {
        throw new Error(`Monitor ${id} not found`)
      }
  
      const startTime = Date.now()
      const check: MonitorCheck = {
        id: crypto.randomUUID(),
        monitorId: id,
        timestamp: new Date(),
        responseTime: 0,
        statusCode: 0,
        success: false,
        size: 0,
      }
  
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), monitor.timeout * 1000)
  
        const response = await fetch(monitor.url, {
          method: monitor.method,
          headers: monitor.headers,
          body: monitor.body,
          signal: controller.signal,
        })
  
        clearTimeout(timeoutId)
  
        const endTime = Date.now()
        const responseText = await response.text()
  
        check.responseTime = endTime - startTime
        check.statusCode = response.status
        check.size = new Blob([responseText]).size
  
        // Check if response meets expectations
        const statusOk = monitor.expectedStatus ? monitor.expectedStatus.includes(response.status) : response.ok
  
        const contentOk = monitor.expectedContent ? responseText.includes(monitor.expectedContent) : true
  
        check.success = statusOk && contentOk
  
        if (!check.success) {
          check.error = `Status: ${response.status}${!statusOk ? " (unexpected)" : ""}${
            !contentOk ? ", Content mismatch" : ""
          }`
        }
      } catch (error) {
        check.responseTime = Date.now() - startTime
        check.error = error instanceof Error ? error.message : "Unknown error"
      }
  
      // Store check
      const checks = this.checks.get(id) || []
      checks.push(check)
  
      // Keep only last 1000 checks per monitor
      if (checks.length > 1000) {
        checks.splice(0, checks.length - 1000)
      }
  
      this.checks.set(id, checks)
  
      // Update monitor last checked time
      monitor.lastChecked = new Date()
      this.monitors.set(id, monitor)
  
      // Handle incidents
      this.handleIncident(id, check)
  
      // Trigger callbacks
      this.onCheckComplete(check)
  
      this.saveToStorage()
      return check
    }
  
    private startMonitoring(id: string): void {
      const monitor = this.monitors.get(id)
      if (!monitor || !monitor.enabled) return
  
      // Run initial check
      this.runCheck(id)
  
      // Schedule recurring checks
      const interval = setInterval(
        () => {
          this.runCheck(id)
        },
        monitor.interval * 60 * 1000,
      )
  
      this.intervals.set(id, interval)
    }
  
    private stopMonitoring(id: string): void {
      const interval = this.intervals.get(id)
      if (interval) {
        clearInterval(interval)
        this.intervals.delete(id)
      }
    }
  
    private handleIncident(id: string, check: MonitorCheck): void {
      const monitor = this.monitors.get(id)
      if (!monitor) return
  
      const incidents = this.incidents.get(id) || []
      const recentChecks = this.getChecks(id, 60 * 60 * 1000) // Last hour
      const recentFailures = recentChecks.filter((c) => !c.success).slice(-monitor.alertThreshold)
  
      const ongoingIncident = incidents.find((i) => i.status === "ongoing")
  
      if (!check.success) {
        if (!ongoingIncident && recentFailures.length >= monitor.alertThreshold) {
          // Start new incident
          const incident: MonitorIncident = {
            id: crypto.randomUUID(),
            monitorId: id,
            startTime: recentFailures[0].timestamp,
            status: "ongoing",
            failureCount: recentFailures.length,
            checks: recentFailures,
          }
  
          incidents.push(incident)
          this.incidents.set(id, incidents)
          this.onIncidentStart(incident)
          this.sendAlert(id, incident)
        } else if (ongoingIncident) {
          // Update ongoing incident
          ongoingIncident.failureCount++
          ongoingIncident.checks.push(check)
        }
      } else if (ongoingIncident) {
        // Resolve incident
        ongoingIncident.endTime = check.timestamp
        ongoingIncident.duration = ongoingIncident.endTime.getTime() - ongoingIncident.startTime.getTime()
        ongoingIncident.status = "resolved"
        this.onIncidentEnd(ongoingIncident)
        this.sendRecoveryAlert(id, ongoingIncident)
      }
    }
  
    private async sendAlert(id: string, incident: MonitorIncident): Promise<void> {
      const monitor = this.monitors.get(id)
      const alerts = this.alerts.get(id) || []
  
      if (!monitor) return
  
      for (const alert of alerts.filter((a) => a.enabled)) {
        try {
          switch (alert.type) {
            case "webhook":
              if (alert.config.webhookUrl) {
                await fetch(alert.config.webhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "incident_start",
                    monitor: monitor.name,
                    url: monitor.url,
                    incident,
                    timestamp: new Date().toISOString(),
                  }),
                })
              }
              break
            case "email":
              // Email integration would require backend service
              console.log(`Email alert for ${monitor.name}: Incident started`)
              break
            case "slack":
              // Slack integration would require webhook URL
              console.log(`Slack alert for ${monitor.name}: Incident started`)
              break
          }
        } catch (error) {
          console.error(`Failed to send ${alert.type} alert:`, error)
        }
      }
    }
  
    private async sendRecoveryAlert(id: string, incident: MonitorIncident): Promise<void> {
      const monitor = this.monitors.get(id)
      const alerts = this.alerts.get(id) || []
  
      if (!monitor) return
  
      for (const alert of alerts.filter((a) => a.enabled)) {
        try {
          switch (alert.type) {
            case "webhook":
              if (alert.config.webhookUrl) {
                await fetch(alert.config.webhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "incident_resolved",
                    monitor: monitor.name,
                    url: monitor.url,
                    incident,
                    timestamp: new Date().toISOString(),
                  }),
                })
              }
              break
          }
        } catch (error) {
          console.error(`Failed to send recovery ${alert.type} alert:`, error)
        }
      }
    }
  
    addAlert(monitorId: string, alert: MonitorAlert): void {
      const alerts = this.alerts.get(monitorId) || []
      alerts.push(alert)
      this.alerts.set(monitorId, alerts)
      this.saveToStorage()
    }
  
    removeAlert(monitorId: string, alertId: string): void {
      const alerts = this.alerts.get(monitorId) || []
      const filtered = alerts.filter((a) => a.id !== alertId)
      this.alerts.set(monitorId, filtered)
      this.saveToStorage()
    }
  
    getAlerts(monitorId: string): MonitorAlert[] {
      return this.alerts.get(monitorId) || []
    }
  
    private saveToStorage(): void {
      try {
        const data = {
          monitors: Array.from(this.monitors.entries()),
          checks: Array.from(this.checks.entries()),
          incidents: Array.from(this.incidents.entries()),
          alerts: Array.from(this.alerts.entries()),
        }
        localStorage.setItem("api_monitoring", JSON.stringify(data))
      } catch (error) {
        console.error("Failed to save monitoring data:", error)
      }
    }
  
    loadFromStorage(): void {
      try {
        const stored = localStorage.getItem("api_monitoring")
        if (!stored) return
  
        const data = JSON.parse(stored)
  
        // Restore monitors
        if (data.monitors) {
          this.monitors = new Map(
            data.monitors.map(([id, config]: [string, any]) => [
              id,
              {
                ...config,
                createdAt: new Date(config.createdAt),
                lastChecked: config.lastChecked ? new Date(config.lastChecked) : undefined,
              },
            ]),
          )
        }
  
        // Restore checks
        if (data.checks) {
          this.checks = new Map(
            data.checks.map(([id, checks]: [string, any[]]) => [
              id,
              checks.map((check) => ({
                ...check,
                timestamp: new Date(check.timestamp),
              })),
            ]),
          )
        }
  
        // Restore incidents
        if (data.incidents) {
          this.incidents = new Map(
            data.incidents.map(([id, incidents]: [string, any[]]) => [
              id,
              incidents.map((incident) => ({
                ...incident,
                startTime: new Date(incident.startTime),
                endTime: incident.endTime ? new Date(incident.endTime) : undefined,
                checks: incident.checks.map((check: any) => ({
                  ...check,
                  timestamp: new Date(check.timestamp),
                })),
              })),
            ]),
          )
        }
  
        // Restore alerts
        if (data.alerts) {
          this.alerts = new Map(data.alerts)
        }
  
        // Restart monitoring for enabled monitors
        for (const [id, monitor] of this.monitors) {
          if (monitor.enabled) {
            this.startMonitoring(id)
          }
        }
      } catch (error) {
        console.error("Failed to load monitoring data:", error)
      }
    }
  
    destroy(): void {
      // Stop all monitoring
      for (const id of this.monitors.keys()) {
        this.stopMonitoring(id)
      }
  
      // Clear all data
      this.monitors.clear()
      this.checks.clear()
      this.incidents.clear()
      this.intervals.clear()
      this.alerts.clear()
    }
  }
  
  // Singleton instance
  export const monitoringEngine = new MonitoringEngine()
  
  // Auto-load on initialization
  if (typeof window !== "undefined") {
    monitoringEngine.loadFromStorage()
  }
  
