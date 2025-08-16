import type { SupportedFormat } from "./detect"

export interface ConversionResult {
  success: boolean
  data?: any
  errors?: Array<{
    line: number
    column: number
    message: string
    snippet: string
  }>
}

export async function convertToJson(text: string, format: SupportedFormat): Promise<ConversionResult> {
  try {
    switch (format) {
      case "json":
        return convertJsonToJson(text)
      case "csv":
        return convertCsvToJson(text)
      case "xml":
        return convertXmlToJson(text)
      case "yaml":
        return convertYamlToJson(text)
      case "query":
        return convertQueryToJson(text)
      case "ndjson":
        return convertNdjsonToJson(text)
      default:
        return convertFallbackToJson(text)
    }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : "Conversion failed",
          snippet: text.slice(0, 100),
        },
      ],
    }
  }
}

function convertJsonToJson(text: string): ConversionResult {
  try {
    const data = JSON.parse(text)
    return { success: true, data }
  } catch (error) {
    const match = error instanceof Error ? error.message.match(/position (\d+)/) : null
    const position = match ? Number.parseInt(match[1]) : 0
    const lines = text.slice(0, position).split("\n")
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    return {
      success: false,
      errors: [
        {
          line,
          column,
          message: error instanceof Error ? error.message : "JSON parse error",
          snippet: getSnippet(text, position),
        },
      ],
    }
  }
}

function convertCsvToJson(text: string): ConversionResult {
  const lines = text.trim().split("\n")
  if (lines.length < 2) {
    return {
      success: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: "CSV must have at least a header and one data row",
          snippet: text.slice(0, 100),
        },
      ],
    }
  }

  const delimiter = detectCsvDelimiter(lines[0])
  const headers = parseCsvLine(lines[0], delimiter)
  const data = []

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCsvLine(lines[i], delimiter)
      const row: Record<string, string> = {}

      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })

      data.push(row)
    }
  }

  return { success: true, data }
}

function convertXmlToJson(text: string): ConversionResult {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, "text/xml")

    const parseError = doc.querySelector("parsererror")
    if (parseError) {
      return {
        success: false,
        errors: [
          {
            line: 1,
            column: 1,
            message: "XML parsing error: " + parseError.textContent,
            snippet: text.slice(0, 100),
          },
        ],
      }
    }

    const data = xmlNodeToJson(doc.documentElement)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : "XML conversion failed",
          snippet: text.slice(0, 100),
        },
      ],
    }
  }
}

function convertYamlToJson(text: string): ConversionResult {
  // Simple YAML parser for basic cases
  try {
    const lines = text.split("\n")
    const result: any = {}
    const currentObj = result
    const stack: any[] = [result]

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith("#")) continue

      const indent = line.length - line.trimStart().length
      const colonIndex = trimmed.indexOf(":")

      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim()
        const value = trimmed.slice(colonIndex + 1).trim()

        if (value) {
          currentObj[key] = parseYamlValue(value)
        } else {
          currentObj[key] = {}
          // Handle nested objects (simplified)
        }
      }
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: "YAML parsing not fully supported. Try a simpler format.",
          snippet: text.slice(0, 100),
        },
      ],
    }
  }
}

function convertQueryToJson(text: string): ConversionResult {
  try {
    const params = new URLSearchParams(text)
    const data: Record<string, string | string[]> = {}

    for (const [key, value] of params.entries()) {
      if (data[key]) {
        if (Array.isArray(data[key])) {
          ;(data[key] as string[]).push(value)
        } else {
          data[key] = [data[key] as string, value]
        }
      } else {
        data[key] = value
      }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : "Query string parse error",
          snippet: text.slice(0, 100),
        },
      ],
    }
  }
}

function convertNdjsonToJson(text: string): ConversionResult {
  try {
    const lines = text.trim().split("\n")
    const data = lines.map((line) => JSON.parse(line.trim()))
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : "NDJSON parse error",
          snippet: text.slice(0, 100),
        },
      ],
    }
  }
}

function convertFallbackToJson(text: string): ConversionResult {
  // Try to extract key-value pairs from logs or other text
  const lines = text.split("\n")
  const data: Record<string, any> = {}

  for (const line of lines) {
    const kvMatch = line.match(/(\w+)[:=]\s*(.+)/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      data[key] = parseYamlValue(value)
    }
  }

  if (Object.keys(data).length > 0) {
    return { success: true, data }
  }

  return {
    success: false,
    errors: [
      {
        line: 1,
        column: 1,
        message: "Unable to detect a supported format. Try JSON, CSV, XML, or YAML.",
        snippet: text.slice(0, 100),
      },
    ],
  }
}

// Helper functions
function detectCsvDelimiter(line: string): string {
  const delimiters = [",", ";", "\t"]
  let maxCount = 0
  let bestDelimiter = ","

  for (const delimiter of delimiters) {
    const count = line.split(delimiter).length - 1
    if (count > maxCount) {
      maxCount = count
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function xmlNodeToJson(node: Element): any {
  const result: any = {}

  // Handle attributes
  if (node.attributes.length > 0) {
    result["@attributes"] = {}
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i]
      result["@attributes"][attr.name] = attr.value
    }
  }

  // Handle child nodes
  const children = Array.from(node.childNodes)
  const textContent = node.textContent?.trim()

  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
    return textContent
  }

  const elementChildren = children.filter((child) => child.nodeType === Node.ELEMENT_NODE) as Element[]

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

function parseYamlValue(value: string): any {
  if (value === "true") return true
  if (value === "false") return false
  if (value === "null") return null
  if (/^\d+$/.test(value)) return Number.parseInt(value)
  if (/^\d+\.\d+$/.test(value)) return Number.parseFloat(value)
  return value
}

function getSnippet(text: string, position: number): string {
  const start = Math.max(0, position - 50)
  const end = Math.min(text.length, position + 50)
  return text.slice(start, end)
}
