export interface SearchResult {
  path: string[]
  value: any
  key?: string
  parent?: any
  matchType: "key" | "value" | "path"
  matchText: string
  context?: string
}

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  searchKeys: boolean
  searchValues: boolean
  maxResults: number
}

export class JsonSearcher {
  private static readonly DEFAULT_MAX_RESULTS = 100

  static search(data: any, query: string, options: SearchOptions): SearchResult[] {
    if (!query.trim() || !data) return []

    const results: SearchResult[] = []
    const maxResults = options.maxResults || this.DEFAULT_MAX_RESULTS

    try {
      if (query.startsWith("$")) {
        // JSONPath query
        return this.searchJsonPath(data, query, maxResults)
      } else {
        // Text/regex search
        return this.searchText(data, query, options, [], results, maxResults)
      }
    } catch (error) {
      console.error("Search error:", error)
      return []
    }
  }

  private static searchJsonPath(data: any, jsonPath: string, maxResults: number): SearchResult[] {
    try {
      // Simple JSONPath implementation
      const results: SearchResult[] = []
      const paths = this.evaluateJsonPath(data, jsonPath)

      for (const pathResult of paths.slice(0, maxResults)) {
        results.push({
          path: pathResult.path,
          value: pathResult.value,
          matchType: "path",
          matchText: jsonPath,
          context: this.getContext(pathResult.value),
        })
      }

      return results
    } catch (error) {
      return []
    }
  }

  private static evaluateJsonPath(data: any, path: string): Array<{ path: string[]; value: any }> {
    const results: Array<{ path: string[]; value: any }> = []

    // Remove leading $ and split by dots, handling array notation
    const segments = path
      .replace(/^\$\.?/, "")
      .split(/\.|\[/)
      .map((s) => s.replace(/\]$/, ""))
      .filter((s) => s !== "")

    if (segments.length === 0) {
      return [{ path: [], value: data }]
    }

    this.traverseJsonPath(data, segments, [], results)
    return results
  }

  private static traverseJsonPath(
    current: any,
    segments: string[],
    currentPath: string[],
    results: Array<{ path: string[]; value: any }>,
  ): void {
    if (segments.length === 0) {
      results.push({ path: currentPath, value: current })
      return
    }

    const [segment, ...remaining] = segments

    if (segment === "*") {
      // Wildcard - match all properties/indices
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          this.traverseJsonPath(item, remaining, [...currentPath, index.toString()], results)
        })
      } else if (current && typeof current === "object") {
        Object.keys(current).forEach((key) => {
          this.traverseJsonPath(current[key], remaining, [...currentPath, key], results)
        })
      }
    } else if (segment === "**") {
      // Recursive descent
      this.recursiveSearch(current, remaining, currentPath, results)
    } else if (/^\d+$/.test(segment)) {
      // Array index
      const index = Number.parseInt(segment)
      if (Array.isArray(current) && index < current.length) {
        this.traverseJsonPath(current[index], remaining, [...currentPath, segment], results)
      }
    } else {
      // Object property
      if (current && typeof current === "object" && segment in current) {
        this.traverseJsonPath(current[segment], remaining, [...currentPath, segment], results)
      }
    }
  }

  private static recursiveSearch(
    current: any,
    segments: string[],
    currentPath: string[],
    results: Array<{ path: string[]; value: any }>,
  ): void {
    // Try to match at current level
    this.traverseJsonPath(current, segments, currentPath, results)

    // Recurse into children
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        this.recursiveSearch(item, segments, [...currentPath, index.toString()], results)
      })
    } else if (current && typeof current === "object") {
      Object.keys(current).forEach((key) => {
        this.recursiveSearch(current[key], segments, [...currentPath, key], results)
      })
    }
  }

  private static searchText(
    data: any,
    query: string,
    options: SearchOptions,
    currentPath: string[],
    results: SearchResult[],
    maxResults: number,
  ): SearchResult[] {
    if (results.length >= maxResults) return results

    const searchPattern = this.createSearchPattern(query, options)

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (results.length >= maxResults) return
        this.searchText(item, query, options, [...currentPath, index.toString()], results, maxResults)
      })
    } else if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        if (results.length >= maxResults) return

        // Search in keys
        if (options.searchKeys && this.matchesPattern(key, searchPattern)) {
          results.push({
            path: [...currentPath, key],
            value,
            key,
            parent: data,
            matchType: "key",
            matchText: key,
            context: this.getContext(value),
          })
        }

        // Search in values
        if (options.searchValues && this.matchesPattern(String(value), searchPattern)) {
          results.push({
            path: [...currentPath, key],
            value,
            key,
            parent: data,
            matchType: "value",
            matchText: String(value),
            context: this.getContext(value),
          })
        }

        // Recurse into nested objects
        if (typeof value === "object" && value !== null) {
          this.searchText(value, query, options, [...currentPath, key], results, maxResults)
        }
      })
    } else {
      // Primitive value
      if (options.searchValues && this.matchesPattern(String(data), searchPattern)) {
        results.push({
          path: currentPath,
          value: data,
          matchType: "value",
          matchText: String(data),
          context: this.getContext(data),
        })
      }
    }

    return results
  }

  private static createSearchPattern(query: string, options: SearchOptions): RegExp {
    let pattern = query

    if (!options.regex) {
      // Escape regex special characters
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }

    if (options.wholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    const flags = options.caseSensitive ? "g" : "gi"
    return new RegExp(pattern, flags)
  }

  private static matchesPattern(text: string, pattern: RegExp): boolean {
    return pattern.test(text)
  }

  private static getContext(value: any): string {
    if (typeof value === "string") {
      return value.length > 100 ? `${value.substring(0, 100)}...` : value
    }
    if (typeof value === "object") {
      return Array.isArray(value) ? `Array(${value.length})` : "Object"
    }
    return String(value)
  }

  static formatPath(path: string[]): string {
    if (path.length === 0) return "$"

    return path.reduce((acc, segment, index) => {
      if (index === 0) return `$.${segment}`

      // Check if segment is a number (array index)
      if (/^\d+$/.test(segment)) {
        return `${acc}[${segment}]`
      }

      // Check if segment needs quotes (contains special characters)
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(segment)) {
        return `${acc}.${segment}`
      }

      return `${acc}["${segment}"]`
    })
  }
}

export class SearchHistory {
  private static readonly STORAGE_KEY = "json-formatter-search-history"
  private static readonly MAX_HISTORY = 20

  static getHistory(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  static addToHistory(query: string): void {
    if (!query.trim()) return

    try {
      const history = this.getHistory()
      const filtered = history.filter((item) => item !== query)
      const newHistory = [query, ...filtered].slice(0, this.MAX_HISTORY)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newHistory))
    } catch {
      // Ignore storage errors
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }
}
