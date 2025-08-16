// Web Worker bridge for parsing large files without blocking the main thread
export interface WorkerMessage {
  id: string
  type: "parse" | "cancel"
  data?: {
    text: string
    format: string
    options: any
  }
}

export interface WorkerResponse {
  id: string
  type: "success" | "error" | "progress"
  data?: any
  error?: string
  progress?: number
}

class ParseWorkerBridge {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>()
  private requestId = 0

  private initWorker() {
    if (this.worker) return

    // Create worker from inline script to avoid external file dependency
    const workerScript = `
      // Import conversion functions (simplified inline versions)
      function detectFormat(text) {
        const trimmed = text.trim()
        if (!trimmed) return "unknown"
        
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
            (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
          try {
            JSON.parse(trimmed)
            return "json"
          } catch {
            // Continue
          }
        }
        
        if (trimmed.startsWith("<") && trimmed.includes(">")) return "xml"
        if (trimmed.includes(":") && trimmed.includes("\\n")) return "yaml"
        if (trimmed.includes("=") && trimmed.includes("&")) return "query"
        
        const lines = trimmed.split("\\n")
        if (lines.length > 1) {
          const firstLine = lines[0]
          const delimiter = firstLine.includes(",") ? "," : 
                           firstLine.includes(";") ? ";" : 
                           firstLine.includes("\\t") ? "\\t" : null
          if (delimiter) return "csv"
        }
        
        return "unknown"
      }
      
      function convertToJson(text, format) {
        try {
          switch (format) {
            case "json":
              return { success: true, data: JSON.parse(text) }
            case "csv":
              return convertCsvToJson(text)
            case "xml":
              return convertXmlToJson(text)
            case "yaml":
              return convertYamlToJson(text)
            case "query":
              return convertQueryToJson(text)
            default:
              return { success: false, errors: [{ line: 1, column: 1, message: "Unsupported format", snippet: text.slice(0, 100) }] }
          }
        } catch (error) {
          return {
            success: false,
            errors: [{ line: 1, column: 1, message: error.message, snippet: text.slice(0, 100) }]
          }
        }
      }
      
      function convertCsvToJson(text) {
        const lines = text.trim().split("\\n")
        if (lines.length < 2) {
          return { success: false, errors: [{ line: 1, column: 1, message: "CSV must have header and data", snippet: text.slice(0, 100) }] }
        }
        
        const delimiter = lines[0].includes(",") ? "," : ";"
        const headers = lines[0].split(delimiter).map(h => h.trim())
        const data = []
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(delimiter).map(v => v.trim())
            const row = {}
            headers.forEach((header, index) => {
              row[header] = values[index] || ""
            })
            data.push(row)
          }
        }
        
        return { success: true, data }
      }
      
      function convertXmlToJson(text) {
        try {
          const parser = new DOMParser()
          const doc = parser.parseFromString(text, "text/xml")
          const parseError = doc.querySelector("parsererror")
          
          if (parseError) {
            return { success: false, errors: [{ line: 1, column: 1, message: "XML parse error", snippet: text.slice(0, 100) }] }
          }
          
          const data = xmlNodeToJson(doc.documentElement)
          return { success: true, data }
        } catch (error) {
          return { success: false, errors: [{ line: 1, column: 1, message: error.message, snippet: text.slice(0, 100) }] }
        }
      }
      
      function xmlNodeToJson(node) {
        const result = {}
        
        if (node.attributes.length > 0) {
          result["@attributes"] = {}
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i]
            result["@attributes"][attr.name] = attr.value
          }
        }
        
        const children = Array.from(node.childNodes)
        const textContent = node.textContent?.trim()
        
        if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
          return textContent
        }
        
        const elementChildren = children.filter(child => child.nodeType === Node.ELEMENT_NODE)
        
        for (const child of elementChildren) {
          const childData = xmlNodeToJson(child)
          if (result[child.tagName]) {
            if (!Array.isArray(result[child.tagName])) {
              result[child.tagName] = [result[child.tagName]]
            }
            result[child.tagName].push(childData)
          } else {
            result[child.tagName] = childData
          }
        }
        
        return result
      }
      
      function convertYamlToJson(text) {
        // Simplified YAML parser
        const lines = text.split("\\n")
        const result = {}
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith("#")) continue
          
          const colonIndex = trimmed.indexOf(":")
          if (colonIndex > 0) {
            const key = trimmed.slice(0, colonIndex).trim()
            const value = trimmed.slice(colonIndex + 1).trim()
            result[key] = parseYamlValue(value)
          }
        }
        
        return { success: true, data: result }
      }
      
      function parseYamlValue(value) {
        if (value === "true") return true
        if (value === "false") return false
        if (value === "null") return null
        if (/^\\d+$/.test(value)) return parseInt(value)
        if (/^\\d+\\.\\d+$/.test(value)) return parseFloat(value)
        return value
      }
      
      function convertQueryToJson(text) {
        try {
          const params = new URLSearchParams(text)
          const data = {}
          
          for (const [key, value] of params.entries()) {
            if (data[key]) {
              if (Array.isArray(data[key])) {
                data[key].push(value)
              } else {
                data[key] = [data[key], value]
              }
            } else {
              data[key] = value
            }
          }
          
          return { success: true, data }
        } catch (error) {
          return { success: false, errors: [{ line: 1, column: 1, message: error.message, snippet: text.slice(0, 100) }] }
        }
      }
      
      self.onmessage = function(e) {
        const { id, type, data } = e.data
        
        if (type === "parse") {
          try {
            // Send progress updates for large files
            const textSize = data.text.length
            if (textSize > 100000) {
              self.postMessage({ id, type: "progress", progress: 25 })
            }
            
            const format = detectFormat(data.text)
            
            if (textSize > 100000) {
              self.postMessage({ id, type: "progress", progress: 50 })
            }
            
            const result = convertToJson(data.text, format)
            
            if (textSize > 100000) {
              self.postMessage({ id, type: "progress", progress: 75 })
            }
            
            self.postMessage({ 
              id, 
              type: "success", 
              data: { 
                ...result, 
                format,
                originalSize: textSize 
              } 
            })
          } catch (error) {
            self.postMessage({ 
              id, 
              type: "error", 
              error: error.message 
            })
          }
        }
      }
    `

    const blob = new Blob([workerScript], { type: "application/javascript" })
    this.worker = new Worker(URL.createObjectURL(blob))

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, type, data, error, progress } = e.data
      const request = this.pendingRequests.get(id)

      if (!request) return

      if (type === "success") {
        this.pendingRequests.delete(id)
        request.resolve(data)
      } else if (type === "error") {
        this.pendingRequests.delete(id)
        request.reject(new Error(error))
      } else if (type === "progress" && progress !== undefined) {
        // Progress updates don't resolve the promise
        if (request.onProgress) {
          request.onProgress(progress)
        }
      }
    }

    this.worker.onerror = (error) => {
      console.error("Worker error:", error)
      // Reject all pending requests
      for (const [id, request] of this.pendingRequests) {
        request.reject(new Error("Worker error"))
      }
      this.pendingRequests.clear()
    }
  }

  async parseInWorker(
    text: string,
    format: string,
    options: any,
    onProgress?: (progress: number) => void,
  ): Promise<any> {
    this.initWorker()

    const id = (++this.requestId).toString()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onProgress })

      this.worker!.postMessage({
        id,
        type: "parse",
        data: { text, format, options },
      } as WorkerMessage)

      // Timeout for very large files
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error("Parse timeout"))
        }
      }, 30000) // 30 second timeout
    })
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pendingRequests.clear()
  }
}

export const parseWorker = new ParseWorkerBridge()

// Utility to determine if we should use worker
export function shouldUseWorker(text: string): boolean {
  return text.length > 50000 // Use worker for files > 50KB
}
