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

export interface AuthConfig {
  type: "none" | "bearer" | "apikey" | "basic" | "oauth2" | "jwt" | "digest" | "aws" | "custom"
  credentials: Record<string, string>
  settings?: Record<string, any>
}

export interface HeaderPreset {
  id: string
  name: string
  headers: Record<string, string>
  description?: string
}

export interface EnvironmentVariable {
  key: string
  value: string
  enabled: boolean
  description?: string
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
    type: AuthConfig["type"],
    credentials: Record<string, string>,
    settings?: Record<string, any>,
  ): Record<string, string> {
    switch (type) {
      case "bearer":
        return credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {}

      case "apikey":
        if (credentials.key && credentials.value) {
          const location = settings?.location || "header"
          if (location === "header") {
            return { [credentials.key]: credentials.value }
          } else if (location === "query") {
            // Query params handled separately
            return {}
          }
        }
        return {}

      case "basic":
        if (credentials.username && credentials.password) {
          const encoded = btoa(`${credentials.username}:${credentials.password}`)
          return { Authorization: `Basic ${encoded}` }
        }
        return {}

      case "oauth2":
        if (credentials.accessToken) {
          return { Authorization: `Bearer ${credentials.accessToken}` }
        }
        return {}

      case "jwt":
        if (credentials.token) {
          const prefix = settings?.prefix || "Bearer"
          return { Authorization: `${prefix} ${credentials.token}` }
        }
        return {}

      case "digest":
        // Digest auth requires server challenge, simplified implementation
        if (credentials.username && credentials.password) {
          return {
            Authorization: `Digest username="${credentials.username}", realm="${settings?.realm || ""}", nonce="${settings?.nonce || ""}", uri="${settings?.uri || ""}", response="${settings?.response || ""}"`,
          }
        }
        return {}

      case "aws":
        if (credentials.accessKey && credentials.secretKey) {
          // AWS Signature V4 - simplified implementation
          const date = new Date().toISOString().split("T")[0].replace(/-/g, "")
          return {
            Authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/${date}/${settings?.region || "us-east-1"}/${settings?.service || "s3"}/aws4_request`,
            "X-Amz-Date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
          }
        }
        return {}

      case "custom":
        if (credentials.headerName && credentials.headerValue) {
          const prefix = credentials.prefix || ""
          return { [credentials.headerName]: `${prefix}${credentials.headerValue}` }
        }
        return {}

      default:
        return {}
    }
  }

  static getHeaderPresets(): HeaderPreset[] {
    try {
      const stored = localStorage.getItem("json-formatter-header-presets")
      return stored ? JSON.parse(stored) : this.getDefaultHeaderPresets()
    } catch {
      return this.getDefaultHeaderPresets()
    }
  }

  static getDefaultHeaderPresets(): HeaderPreset[] {
    return [
      {
        id: "json-api",
        name: "JSON API",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        description: "Standard JSON API headers",
      },
      {
        id: "form-data",
        name: "Form Data",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        description: "Form submission headers",
      },
      {
        id: "xml-api",
        name: "XML API",
        headers: {
          "Content-Type": "application/xml",
          Accept: "application/xml",
        },
        description: "XML API headers",
      },
      {
        id: "cors-headers",
        name: "CORS Headers",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        description: "Common CORS headers",
      },
    ]
  }

  static saveHeaderPreset(preset: Omit<HeaderPreset, "id">): HeaderPreset {
    const presets = this.getHeaderPresets()
    const newPreset: HeaderPreset = {
      ...preset,
      id: crypto.randomUUID(),
    }
    presets.push(newPreset)
    localStorage.setItem("json-formatter-header-presets", JSON.stringify(presets))
    return newPreset
  }

  static deleteHeaderPreset(id: string): void {
    const presets = this.getHeaderPresets().filter((p) => p.id !== id)
    localStorage.setItem("json-formatter-header-presets", JSON.stringify(presets))
  }

  static getEnvironmentVariables(): EnvironmentVariable[] {
    try {
      const stored = localStorage.getItem("json-formatter-env-vars")
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  static saveEnvironmentVariable(envVar: EnvironmentVariable): void {
    const envVars = this.getEnvironmentVariables()
    const existingIndex = envVars.findIndex((v) => v.key === envVar.key)

    if (existingIndex !== -1) {
      envVars[existingIndex] = envVar
    } else {
      envVars.push(envVar)
    }

    localStorage.setItem("json-formatter-env-vars", JSON.stringify(envVars))
  }

  static deleteEnvironmentVariable(key: string): void {
    const envVars = this.getEnvironmentVariables().filter((v) => v.key !== key)
    localStorage.setItem("json-formatter-env-vars", JSON.stringify(envVars))
  }

  static interpolateVariables(text: string, variables: EnvironmentVariable[]): string {
    let result = text
    variables
      .filter((v) => v.enabled)
      .forEach((variable) => {
        const regex = new RegExp(`{{${variable.key}}}`, "g")
        result = result.replace(regex, variable.value)
      })
    return result
  }

  static generateOAuth2AuthUrl(
    authUrl: string,
    clientId: string,
    redirectUri: string,
    scope?: string,
    state?: string,
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
    })

    if (scope) params.set("scope", scope)
    if (state) params.set("state", state)

    return `${authUrl}?${params.toString()}`
  }

  static async exchangeOAuth2Code(
    tokenUrl: string,
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{ access_token?: string; refresh_token?: string; error?: string }> {
    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      })

      const data = await response.json()
      return data
    } catch (error) {
      return { error: error instanceof Error ? error.message : "OAuth2 exchange failed" }
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
