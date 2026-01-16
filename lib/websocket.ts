export interface WebSocketMessage {
    id: string
    type: "sent" | "received" | "system"
    content: string
    timestamp: Date
    size: number
  }
  
  export interface WebSocketConnection {
    url: string
    protocols?: string[]
    headers?: Record<string, string>
    auth?: {
      type: "bearer" | "basic" | "custom"
      token?: string
      username?: string
      password?: string
      customHeader?: string
      customValue?: string
    }
  }
  
  export interface WebSocketStats {
    connected: boolean
    connectionTime?: Date
    lastMessageTime?: Date
    messagesSent: number
    messagesReceived: number
    bytesTransferred: number
    latency?: number
  }
  
  export class WebSocketClient {
    private ws: WebSocket | null = null
    private connection: WebSocketConnection | null = null
    private stats: WebSocketStats = {
      connected: false,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
    }
    private pingInterval: NodeJS.Timeout | null = null
    private onMessage: (message: WebSocketMessage) => void = () => {}
    private onStatsUpdate: (stats: WebSocketStats) => void = () => {}
    private onConnectionChange: (connected: boolean) => void = () => {}
  
    setMessageHandler(handler: (message: WebSocketMessage) => void) {
      this.onMessage = handler
    }
  
    setStatsHandler(handler: (stats: WebSocketStats) => void) {
      this.onStatsUpdate = handler
    }
  
    setConnectionHandler(handler: (connected: boolean) => void) {
      this.onConnectionChange = handler
    }
  
    async connect(connection: WebSocketConnection): Promise<void> {
      if (this.ws) {
        this.disconnect()
      }
  
      this.connection = connection
  
      try {
        // Build WebSocket URL with auth if needed
        let wsUrl = connection.url
        if (connection.auth?.type === "basic" && connection.auth.username && connection.auth.password) {
          const credentials = btoa(`${connection.auth.username}:${connection.auth.password}`)
          wsUrl += (wsUrl.includes("?") ? "&" : "?") + `auth=${credentials}`
        }
  
        this.ws = new WebSocket(wsUrl, connection.protocols)
  
        // Add custom headers if supported (limited in browser WebSocket)
        if (connection.headers) {
          this.addSystemMessage("Note: Custom headers are limited in browser WebSocket connections")
        }
  
        this.ws.onopen = () => {
          this.stats.connected = true
          this.stats.connectionTime = new Date()
          this.addSystemMessage("Connected to WebSocket server")
          this.onConnectionChange(true)
          this.onStatsUpdate({ ...this.stats })
          this.startPing()
        }
  
        this.ws.onmessage = (event) => {
          const message: WebSocketMessage = {
            id: crypto.randomUUID(),
            type: "received",
            content: event.data,
            timestamp: new Date(),
            size: new Blob([event.data]).size,
          }
  
          this.stats.messagesReceived++
          this.stats.bytesTransferred += message.size
          this.stats.lastMessageTime = new Date()
  
          this.onMessage(message)
          this.onStatsUpdate({ ...this.stats })
        }
  
        this.ws.onclose = (event) => {
          this.stats.connected = false
          this.addSystemMessage(`Connection closed: ${event.code} ${event.reason || "Unknown reason"}`)
          this.onConnectionChange(false)
          this.onStatsUpdate({ ...this.stats })
          this.stopPing()
        }
  
        this.ws.onerror = () => {
          this.addSystemMessage("WebSocket connection error")
        }
      } catch (error) {
        this.addSystemMessage(`Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`)
        throw error
      }
    }
  
    disconnect() {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
      this.stopPing()
      this.stats.connected = false
      this.onConnectionChange(false)
      this.onStatsUpdate({ ...this.stats })
    }
  
    sendMessage(content: string): WebSocketMessage | null {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.addSystemMessage("Cannot send message: WebSocket not connected")
        return null
      }
  
      try {
        this.ws.send(content)
  
        const message: WebSocketMessage = {
          id: crypto.randomUUID(),
          type: "sent",
          content,
          timestamp: new Date(),
          size: new Blob([content]).size,
        }
  
        this.stats.messagesSent++
        this.stats.bytesTransferred += message.size
        this.stats.lastMessageTime = new Date()
  
        this.onMessage(message)
        this.onStatsUpdate({ ...this.stats })
  
        return message
      } catch (error) {
        this.addSystemMessage(`Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`)
        return null
      }
    }
  
    ping() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const startTime = Date.now()
        this.ws.send(JSON.stringify({ type: "ping", timestamp: startTime }))
  
        // Simple latency calculation (not accurate for all servers)
        setTimeout(() => {
          this.stats.latency = Date.now() - startTime
          this.onStatsUpdate({ ...this.stats })
        }, 100)
      }
    }
  
    private startPing() {
      this.pingInterval = setInterval(() => {
        this.ping()
      }, 30000) // Ping every 30 seconds
    }
  
    private stopPing() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }
    }
  
    private addSystemMessage(content: string) {
      const message: WebSocketMessage = {
        id: crypto.randomUUID(),
        type: "system",
        content,
        timestamp: new Date(),
        size: 0,
      }
      this.onMessage(message)
    }
  
    getStats(): WebSocketStats {
      return { ...this.stats }
    }
  
    isConnected(): boolean {
      return this.ws?.readyState === WebSocket.OPEN
    }
  }
  
