export interface TestResult {
    id: string
    name: string
    passed: boolean
    message: string
    duration: number
    timestamp: number
  }
  
  export interface TestSuite {
    id: string
    name: string
    tests: TestScript[]
    results: TestResult[]
    totalTests: number
    passedTests: number
    failedTests: number
    duration: number
    timestamp: number
  }
  
  export interface TestScript {
    id: string
    name: string
    script: string
    enabled: boolean
  }
  
  export interface ResponseAnalysis {
    size: {
      total: number
      headers: number
      body: number
    }
    performance: {
      responseTime: number
      rating: "excellent" | "good" | "fair" | "poor"
      suggestions: string[]
    }
    format: {
      type: "json" | "xml" | "html" | "text" | "binary"
      isValid: boolean
      errors: string[]
    }
    security: {
      headers: SecurityHeader[]
      issues: string[]
      score: number
    }
  }
  
  export interface SecurityHeader {
    name: string
    value?: string
    present: boolean
    recommended: boolean
    description: string
  }
  
  export class ResponseTester {
    private response: any
    private headers: Record<string, string>
    private status: number
    private responseTime: number
  
    constructor(response: any, headers: Record<string, string>, status: number, responseTime: number) {
      this.response = response
      this.headers = headers
      this.status = status
      this.responseTime = responseTime
    }
  
    // Test execution environment
    static createTestEnvironment(response: any, headers: Record<string, string>, status: number, responseTime: number) {
      const tester = new ResponseTester(response, headers, status, responseTime)
  
      return {
        // Response data
        response: response,
        responseHeaders: headers,
        responseTime: responseTime,
        status: status,
  
        // Test utilities
        expect: (actual: any) => ({
          toBe: (expected: any) => actual === expected,
          toEqual: (expected: any) => JSON.stringify(actual) === JSON.stringify(expected),
          toContain: (expected: any) => {
            if (typeof actual === "string") return actual.includes(expected)
            if (Array.isArray(actual)) return actual.includes(expected)
            return false
          },
          toBeGreaterThan: (expected: number) => actual > expected,
          toBeLessThan: (expected: number) => actual < expected,
          toBeNull: () => actual === null,
          toBeUndefined: () => actual === undefined,
          toBeTruthy: () => !!actual,
          toBeFalsy: () => !actual,
          toMatch: (pattern: RegExp) => pattern.test(actual),
          toHaveProperty: (property: string) => actual && actual.hasOwnProperty(property),
        }),
  
        // JSON path utilities
        jsonPath: (path: string) => tester.getJsonPath(path),
  
        // Header utilities
        hasHeader: (name: string) => headers.hasOwnProperty(name.toLowerCase()),
        getHeader: (name: string) => headers[name.toLowerCase()],
  
        // Status utilities
        isSuccess: () => status >= 200 && status < 300,
        isRedirect: () => status >= 300 && status < 400,
        isClientError: () => status >= 400 && status < 500,
        isServerError: () => status >= 500,
  
        // Performance utilities
        isFast: () => responseTime < 200,
        isAcceptable: () => responseTime < 1000,
        isSlow: () => responseTime > 2000,
  
        // Validation utilities
        isValidJson: () => {
          try {
            JSON.parse(typeof response === "string" ? response : JSON.stringify(response))
            return true
          } catch {
            return false
          }
        },
  
        // Custom assertions
        assert: (condition: boolean, message: string) => {
          if (!condition) throw new Error(message)
        },
      }
    }
  
    private getJsonPath(path: string): any {
      try {
        const parts = path.split(".")
        let current = this.response
  
        for (const part of parts) {
          if (part.includes("[") && part.includes("]")) {
            const [key, indexStr] = part.split("[")
            const index = Number.parseInt(indexStr.replace("]", ""))
            current = current[key][index]
          } else {
            current = current[part]
          }
        }
  
        return current
      } catch {
        return undefined
      }
    }
  
    static async runTests(
      tests: TestScript[],
      response: any,
      headers: Record<string, string>,
      status: number,
      responseTime: number,
    ): Promise<TestResult[]> {
      const results: TestResult[] = []
      const testEnv = this.createTestEnvironment(response, headers, status, responseTime)
  
      for (const test of tests.filter((t) => t.enabled)) {
        const startTime = Date.now()
  
        try {
          // Create a safe execution environment
          const testFunction = new Function(
            "response",
            "responseHeaders",
            "status",
            "responseTime",
            "expect",
            "jsonPath",
            "hasHeader",
            "getHeader",
            "isSuccess",
            "isRedirect",
            "isClientError",
            "isServerError",
            "isFast",
            "isAcceptable",
            "isSlow",
            "isValidJson",
            "assert",
            test.script,
          )
  
          testFunction(
            testEnv.response,
            testEnv.responseHeaders,
            testEnv.status,
            testEnv.responseTime,
            testEnv.expect,
            testEnv.jsonPath,
            testEnv.hasHeader,
            testEnv.getHeader,
            testEnv.isSuccess,
            testEnv.isRedirect,
            testEnv.isClientError,
            testEnv.isServerError,
            testEnv.isFast,
            testEnv.isAcceptable,
            testEnv.isSlow,
            testEnv.isValidJson,
            testEnv.assert,
          )
  
          results.push({
            id: test.id,
            name: test.name,
            passed: true,
            message: "Test passed",
            duration: Date.now() - startTime,
            timestamp: Date.now(),
          })
        } catch (error) {
          results.push({
            id: test.id,
            name: test.name,
            passed: false,
            message: error instanceof Error ? error.message : "Test failed",
            duration: Date.now() - startTime,
            timestamp: Date.now(),
          })
        }
      }
  
      return results
    }
  
    static analyzeResponse(
      response: any,
      headers: Record<string, string>,
      status: number,
      responseTime: number,
      responseText: string,
    ): ResponseAnalysis {
      const headerSize = Object.entries(headers).reduce((size, [key, value]) => size + key.length + value.length + 4, 0)
      const bodySize = new Blob([responseText]).size
      const totalSize = headerSize + bodySize
  
      // Performance analysis
      let performanceRating: "excellent" | "good" | "fair" | "poor"
      const suggestions: string[] = []
  
      if (responseTime < 100) {
        performanceRating = "excellent"
      } else if (responseTime < 300) {
        performanceRating = "good"
      } else if (responseTime < 1000) {
        performanceRating = "fair"
        suggestions.push("Consider optimizing server response time")
      } else {
        performanceRating = "poor"
        suggestions.push("Response time is too slow, investigate server performance")
      }
  
      if (totalSize > 1024 * 1024) {
        suggestions.push("Response size is large, consider pagination or compression")
      }
  
      // Format analysis
      let format: ResponseAnalysis["format"]
      try {
        JSON.parse(responseText)
        format = { type: "json", isValid: true, errors: [] }
      } catch (jsonError) {
        if (responseText.trim().startsWith("<")) {
          format = { type: "xml", isValid: true, errors: [] }
        } else if (responseText.includes("<!DOCTYPE html>") || responseText.includes("<html")) {
          format = { type: "html", isValid: true, errors: [] }
        } else {
          format = { type: "text", isValid: true, errors: [] }
        }
      }
  
      // Security analysis
      const securityHeaders: SecurityHeader[] = [
        {
          name: "Content-Security-Policy",
          value: headers["content-security-policy"],
          present: !!headers["content-security-policy"],
          recommended: true,
          description: "Helps prevent XSS attacks",
        },
        {
          name: "X-Frame-Options",
          value: headers["x-frame-options"],
          present: !!headers["x-frame-options"],
          recommended: true,
          description: "Prevents clickjacking attacks",
        },
        {
          name: "X-Content-Type-Options",
          value: headers["x-content-type-options"],
          present: !!headers["x-content-type-options"],
          recommended: true,
          description: "Prevents MIME type sniffing",
        },
        {
          name: "Strict-Transport-Security",
          value: headers["strict-transport-security"],
          present: !!headers["strict-transport-security"],
          recommended: true,
          description: "Enforces HTTPS connections",
        },
      ]
  
      const securityIssues: string[] = []
      let securityScore = 100
  
      securityHeaders.forEach((header) => {
        if (header.recommended && !header.present) {
          securityIssues.push(`Missing ${header.name} header`)
          securityScore -= 20
        }
      })
  
      return {
        size: {
          total: totalSize,
          headers: headerSize,
          body: bodySize,
        },
        performance: {
          responseTime,
          rating: performanceRating,
          suggestions,
        },
        format,
        security: {
          headers: securityHeaders,
          issues: securityIssues,
          score: Math.max(0, securityScore),
        },
      }
    }
  
    static getDefaultTests(): TestScript[] {
      return [
        {
          id: "status-success",
          name: "Status is successful",
          script: `assert(isSuccess(), "Expected successful status code, got " + status)`,
          enabled: true,
        },
        {
          id: "response-time",
          name: "Response time is acceptable",
          script: `assert(isAcceptable(), "Response time too slow: " + responseTime + "ms")`,
          enabled: true,
        },
        {
          id: "valid-json",
          name: "Response is valid JSON",
          script: `assert(isValidJson(), "Response is not valid JSON")`,
          enabled: false,
        },
        {
          id: "has-content-type",
          name: "Has Content-Type header",
          script: `assert(hasHeader("content-type"), "Missing Content-Type header")`,
          enabled: true,
        },
      ]
    }
  }
  
