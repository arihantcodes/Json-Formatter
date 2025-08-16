export interface ApiRequest {
  url: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers: Record<string, string>
  body?: string
  timeout?: number
}

export interface ApiResponse {
  success: boolean
  data?: any
  status?: number
  statusText?: string
  headers?: Record<string, string>
  error?: string
  responseTime?: number
}

export interface SavedEndpoint {
  id: string
  name: string
  url: string
  method: ApiRequest["method"]
  headers: Record<string, string>
  body?: string
  createdAt: number
}

export class ApiClient {
  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  private static readonly MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB

  static async makeRequest(request: ApiRequest): Promise<ApiResponse> {
    const startTime = Date.now()

    try {
      // Validate URL
      let url: URL
      try {
        url = new URL(request.url)
      } catch {
        return {
          success: false,
          error: "Invalid URL format",
        }
      }

      // Prepare headers
      const headers = new Headers()
      Object.entries(request.headers).forEach(([key, value]) => {
        if (key && value) {
          headers.set(key, value)
        }
      })

      // Set default headers if not provided
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", "JSON-Formatter/1.0")
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(request.timeout || this.DEFAULT_TIMEOUT),
        mode: "cors", // Added to handle CORS properly
      }

      // Add body for non-GET requests
      if (request.method !== "GET" && request.body) {
        requestOptions.body = request.body

        // Set content-type if not provided and body looks like JSON
        if (!headers.has("Content-Type")) {
          try {
            JSON.parse(request.body)
            headers.set("Content-Type", "application/json")
          } catch {
            // Not JSON, leave content-type unset
          }
        }
      }

      // Make the request
      const response = await fetch(request.url, requestOptions)
      const responseTime = Date.now() - startTime

      // Get response headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Check content length
      const contentLength = response.headers.get("content-length")
      if (contentLength && Number.parseInt(contentLength) > this.MAX_RESPONSE_SIZE) {
        return {
          success: false,
          error: `Response too large (${contentLength} bytes). Maximum allowed: ${this.MAX_RESPONSE_SIZE} bytes`,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          responseTime,
        }
      }

      // Get response text
      const responseText = await response.text()

      // Check if response is too large
      if (responseText.length > this.MAX_RESPONSE_SIZE) {
        return {
          success: false,
          error: `Response too large (${responseText.length} characters). Maximum allowed: ${this.MAX_RESPONSE_SIZE} characters`,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          responseTime,
        }
      }

      // Try to parse as JSON
      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        // If not JSON, return as text
        data = responseText
      }

      return {
        success: response.ok,
        data,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      if (error instanceof Error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          return {
            success: false,
            error: `Request timeout after ${request.timeout || this.DEFAULT_TIMEOUT}ms`,
            responseTime,
          }
        }

        // Added specific CORS error handling
        if (error.message.includes("CORS") || error.message.includes("fetch")) {
          return {
            success: false,
            error: `CORS Error: ${error.message}. The API server may not allow requests from this domain. Try using a CORS proxy or test with a tool like Postman.`,
            responseTime,
          }
        }

        return {
          success: false,
          error: error.message,
          responseTime,
        }
      }

      return {
        success: false,
        error: "Unknown error occurred",
        responseTime,
      }
    }
  }

  static getCommonHeaders(): Record<string, string> {
    return {
      Accept: "application/json, text/plain, */*",
      "Cache-Control": "no-cache",
    }
  }

  static getAuthHeaders(
    type: "bearer" | "apikey" | "basic",
    credentials: Record<string, string>,
  ): Record<string, string> {
    switch (type) {
      case "bearer":
        return credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {}

      case "apikey":
        if (credentials.key && credentials.value) {
          return { [credentials.key]: credentials.value }
        }
        return {}

      case "basic":
        if (credentials.username && credentials.password) {
          const encoded = btoa(`${credentials.username}:${credentials.password}`)
          return { Authorization: `Basic ${encoded}` }
        }
        return {}

      default:
        return {}
    }
  }
}

// Local storage utilities for saved endpoints
export class EndpointStorage {
  private static readonly STORAGE_KEY = "json-formatter-endpoints"

  static getEndpoints(): SavedEndpoint[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  static saveEndpoint(endpoint: Omit<SavedEndpoint, "id" | "createdAt">): SavedEndpoint {
    const endpoints = this.getEndpoints()
    const newEndpoint: SavedEndpoint = {
      ...endpoint,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }

    endpoints.push(newEndpoint)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(endpoints))
    return newEndpoint
  }

  static deleteEndpoint(id: string): void {
    const endpoints = this.getEndpoints().filter((ep) => ep.id !== id)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(endpoints))
  }

  static updateEndpoint(id: string, updates: Partial<SavedEndpoint>): void {
    const endpoints = this.getEndpoints()
    const index = endpoints.findIndex((ep) => ep.id === id)

    if (index !== -1) {
      endpoints[index] = { ...endpoints[index], ...updates }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(endpoints))
    }
  }
}
