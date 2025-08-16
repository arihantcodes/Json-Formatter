export function encodeState(input: string, formatOptions: any): string {
  const state = {
    input: input.slice(0, 10000), // Limit size for URL
    options: formatOptions,
    version: 1, // Added version for future compatibility
  }

  try {
    const jsonString = JSON.stringify(state)
    const compressed = btoa(jsonString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
    return compressed
  } catch {
    return ""
  }
}

export function decodeState(encoded: string): { input: string; options: any } | null {
  try {
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4)
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = atob(base64)
    const state = JSON.parse(decoded)

    if (state.version && state.version === 1) {
      return {
        input: state.input || "",
        options: state.options || {
          indent: 2,
          sortKeys: false,
          removeEmpty: false,
          minify: false,
        },
      }
    }

    // Fallback for legacy format
    return state
  } catch {
    return null
  }
}

export function getShareUrl(input: string, formatOptions: any): string {
  if (typeof window === "undefined") return ""

  const encoded = encodeState(input, formatOptions)
  if (!encoded) return window.location.origin

  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set("state", encoded)
  return url.toString()
}

export function loadStateFromUrl(): { input: string; options: any } | null {
  if (typeof window === "undefined") return null

  const params = new URLSearchParams(window.location.search)
  const state = params.get("state")

  if (!state) return null

  return decodeState(state)
}

export function isStateInUrl(input: string, formatOptions: any): boolean {
  if (typeof window === "undefined") return false

  const currentState = loadStateFromUrl()
  if (!currentState) return !input && Object.values(formatOptions).every((v) => v === false || v === 2)

  return currentState.input === input && JSON.stringify(currentState.options) === JSON.stringify(formatOptions)
}

export function generateShareText(input: string, parsedData: any): string {
  const lines = input.split("\n").length
  const size = new Blob([input]).size
  const format = parsedData ? "JSON" : "Raw"

  return `Check out this ${format} data (${lines} lines, ${(size / 1024).toFixed(1)}KB) formatted with JSON Formatter`
}
