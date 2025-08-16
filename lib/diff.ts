export interface DiffResult {
  path: string[]
  type: "added" | "removed" | "modified" | "unchanged"
  oldValue?: any
  newValue?: any
  children?: DiffResult[]
}

export function deepDiff(obj1: any, obj2: any, path: string[] = []): DiffResult[] {
  const results: DiffResult[] = []

  // Handle null/undefined cases
  if (obj1 === null || obj1 === undefined) {
    if (obj2 === null || obj2 === undefined) {
      return [{ path, type: "unchanged", oldValue: obj1, newValue: obj2 }]
    }
    return [{ path, type: "added", newValue: obj2 }]
  }

  if (obj2 === null || obj2 === undefined) {
    return [{ path, type: "removed", oldValue: obj1 }]
  }

  // Handle primitive values
  if (typeof obj1 !== "object" || typeof obj2 !== "object") {
    if (obj1 === obj2) {
      return [{ path, type: "unchanged", oldValue: obj1, newValue: obj2 }]
    }
    return [{ path, type: "modified", oldValue: obj1, newValue: obj2 }]
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const maxLength = Math.max(obj1.length, obj2.length)

    for (let i = 0; i < maxLength; i++) {
      const newPath = [...path, i.toString()]

      if (i >= obj1.length) {
        results.push({ path: newPath, type: "added", newValue: obj2[i] })
      } else if (i >= obj2.length) {
        results.push({ path: newPath, type: "removed", oldValue: obj1[i] })
      } else {
        results.push(...deepDiff(obj1[i], obj2[i], newPath))
      }
    }

    return results
  }

  // Handle objects
  if (Array.isArray(obj1) || Array.isArray(obj2)) {
    return [{ path, type: "modified", oldValue: obj1, newValue: obj2 }]
  }

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

  for (const key of allKeys) {
    const newPath = [...path, key]

    if (!(key in obj1)) {
      results.push({ path: newPath, type: "added", newValue: obj2[key] })
    } else if (!(key in obj2)) {
      results.push({ path: newPath, type: "removed", oldValue: obj1[key] })
    } else {
      results.push(...deepDiff(obj1[key], obj2[key], newPath))
    }
  }

  return results
}

export function formatDiffPath(path: string[]): string {
  if (path.length === 0) return "root"

  return path.reduce((acc, segment, index) => {
    if (index === 0) return segment

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

export function getDiffStats(diffs: DiffResult[]) {
  const stats = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    total: 0,
  }

  function countDiffs(diffList: DiffResult[]) {
    for (const diff of diffList) {
      stats[diff.type]++
      stats.total++

      if (diff.children) {
        countDiffs(diff.children)
      }
    }
  }

  countDiffs(diffs)
  return stats
}
