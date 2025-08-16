import type { FormatOptions } from "@/app/page"

export function formatJson(data: any, options: FormatOptions): string {
  if (options.minify) {
    return JSON.stringify(processData(data, options), null, 0)
  }

  const indent = options.indent === "tab" ? "\t" : " ".repeat(options.indent)
  return JSON.stringify(processData(data, options), null, indent)
}

function processData(data: any, options: FormatOptions): any {
  if (data === null || data === undefined) {
    return options.removeEmpty ? undefined : data
  }

  if (Array.isArray(data)) {
    const processed = data
      .map((item) => processData(item, options))
      .filter((item) => !options.removeEmpty || (item !== undefined && item !== null && item !== ""))

    return processed.length === 0 && options.removeEmpty ? undefined : processed
  }

  if (typeof data === "object") {
    const processed: any = {}
    const keys = options.sortKeys ? Object.keys(data).sort() : Object.keys(data)

    for (const key of keys) {
      const value = processData(data[key], options)

      if (!options.removeEmpty || (value !== undefined && value !== null && value !== "")) {
        processed[key] = value
      }
    }

    return Object.keys(processed).length === 0 && options.removeEmpty ? undefined : processed
  }

  return data
}

export function calculateJsonStats(data: any): {
  keys: number
  arrays: number
  depth: number
} {
  let keys = 0
  let arrays = 0
  let maxDepth = 0

  function traverse(obj: any, depth = 0) {
    maxDepth = Math.max(maxDepth, depth)

    if (Array.isArray(obj)) {
      arrays++
      obj.forEach((item) => traverse(item, depth + 1))
    } else if (obj && typeof obj === "object") {
      const objKeys = Object.keys(obj)
      keys += objKeys.length
      objKeys.forEach((key) => traverse(obj[key], depth + 1))
    }
  }

  traverse(data)

  return { keys, arrays, depth: maxDepth }
}
