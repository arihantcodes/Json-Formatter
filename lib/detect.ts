export type SupportedFormat = "json" | "csv" | "xml" | "yaml" | "query" | "ndjson" | "unknown"

export function detectFormat(text: string): SupportedFormat {
  const trimmed = text.trim()

  if (!trimmed) return "unknown"

  // JSON detection
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed)
      return "json"
    } catch {
      // Continue to other formats
    }
  }

  // NDJSON detection (multiple JSON objects separated by newlines)
  const lines = trimmed.split("\n").filter((line) => line.trim())
  if (
    lines.length > 1 &&
    lines.every((line) => {
      try {
        JSON.parse(line.trim())
        return true
      } catch {
        return false
      }
    })
  ) {
    return "ndjson"
  }

  // XML detection
  if (trimmed.startsWith("<") && trimmed.includes(">")) {
    return "xml"
  }

  // YAML detection
  if (trimmed.includes(":") && (trimmed.includes("\n") || /^[a-zA-Z_][a-zA-Z0-9_]*:\s*.+/.test(trimmed))) {
    // Check for YAML-specific patterns
    if (trimmed.includes("---") || /^[a-zA-Z_][a-zA-Z0-9_]*:\s*[|>]/.test(trimmed) || /^\s*-\s+/.test(trimmed)) {
      return "yaml"
    }
  }

  // Query string detection
  if (trimmed.includes("=") && trimmed.includes("&")) {
    return "query"
  }

  // CSV detection
  const csvLines = trimmed.split("\n")
  if (csvLines.length > 1) {
    const firstLine = csvLines[0]
    const delimiter = firstLine.includes(",")
      ? ","
      : firstLine.includes(";")
        ? ";"
        : firstLine.includes("\t")
          ? "\t"
          : null

    if (delimiter) {
      const firstRowCols = firstLine.split(delimiter).length
      const hasConsistentColumns = csvLines.slice(1, 5).every((line) => line.split(delimiter).length === firstRowCols)

      if (hasConsistentColumns && firstRowCols > 1) {
        return "csv"
      }
    }
  }

  return "unknown"
}

export function getFormatDescription(format: SupportedFormat): string {
  switch (format) {
    case "json":
      return "JSON (JavaScript Object Notation)"
    case "csv":
      return "CSV (Comma Separated Values)"
    case "xml":
      return "XML (eXtensible Markup Language)"
    case "yaml":
      return "YAML (YAML Ain't Markup Language)"
    case "query":
      return "Query String Parameters"
    case "ndjson":
      return "NDJSON (Newline Delimited JSON)"
    default:
      return "Unknown Format"
  }
}
