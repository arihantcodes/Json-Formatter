// Synchronous, localStorage-compatible façade backed by IndexedDB.
//
// Why this exists: the app was storing everything (collections, history,
// environments, monitoring, perf results...) in `localStorage`, which is
// synchronous, string-only, and capped at ~5-10MB per origin. That cap is the
// ceiling on a local-first API platform. IndexedDB has no such practical cap
// but is async, which would force every call site to become async.
//
// This module keeps the existing SYNCHRONOUS API (getItem/setItem/removeItem)
// so no component or lib method has to change its signature, while moving the
// durable source of truth to IndexedDB:
//
//   • reads  -> in-memory cache (seeded synchronously from localStorage so
//               existing users see their data on the very first paint)
//   • writes -> in-memory cache + IndexedDB (durable, large) + a best-effort
//               localStorage mirror (fast next-boot; quota errors are ignored)
//   • boot   -> hydrateStore() loads IndexedDB (authoritative) into the cache
//               and migrates any pre-existing localStorage data on first run.

import { idbSet, idbDelete, idbEntries } from "./idb"

// App-owned keys — used to scope the one-time localStorage -> IndexedDB
// migration so we don't slurp unrelated keys (e.g. the theme preference).
const MANAGED_KEYS = [
  "json-formatter-collections",
  "json-formatter-environments",
  "json-formatter-active-environment",
  "json-formatter-endpoints",
  "json-formatter-header-presets",
  "json-formatter-env-vars",
  "json-formatter-search-history",
  "graphql_queries",
  "performance_tests",
  "performance_results",
  "api_monitoring",
]

const cache = new Map<string, string>()
const dirty = new Set<string>() // keys written since boot; hydration must not clobber them
const listeners = new Set<() => void>()
let hydrated = false
let hydrating: Promise<void> | null = null

function hasLS(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

function notify(): void {
  listeners.forEach((l) => {
    try {
      l()
    } catch {
      /* a listener throwing must not break persistence */
    }
  })
}

export const store = {
  getItem(key: string): string | null {
    if (cache.has(key)) return cache.get(key) ?? null
    // Cold cache before hydration: fall back to localStorage so existing data
    // is available synchronously on first render (no behavior change).
    if (hasLS()) {
      const v = window.localStorage.getItem(key)
      if (v !== null) {
        cache.set(key, v)
        return v
      }
    }
    return null
  },

  setItem(key: string, value: string): void {
    cache.set(key, value)
    dirty.add(key)
    void idbSet(key, value).catch(() => {
      /* durable write failed (private mode / disk) — cache + LS still hold it */
    })
    if (hasLS()) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* quota exceeded for large data — IndexedDB is the source of truth */
      }
    }
    notify()
  },

  removeItem(key: string): void {
    cache.delete(key)
    dirty.add(key)
    void idbDelete(key).catch(() => {})
    if (hasLS()) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
    notify()
  },

  // Subscribe to changes (writes + hydration completion). Returns an unsubscribe.
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  isHydrated(): boolean {
    return hydrated
  },
}

// Load IndexedDB (authoritative) into the in-memory cache and migrate any
// pre-existing localStorage data on first run. Safe to call multiple times;
// the work runs once. Notifies subscribers when done so views can re-read.
export function hydrateStore(): Promise<void> {
  if (hydrating) return hydrating

  hydrating = (async () => {
    try {
      const entries = await idbEntries()
      const idbKeys = new Set<string>()
      for (const [k, v] of entries) {
        idbKeys.add(k)
        if (!dirty.has(k)) cache.set(k, v) // don't clobber writes made since boot
      }

      // One-time migration: copy managed localStorage keys not yet in IndexedDB.
      if (hasLS()) {
        for (const k of MANAGED_KEYS) {
          if (idbKeys.has(k)) continue
          const v = window.localStorage.getItem(k)
          if (v == null) continue
          if (!dirty.has(k)) cache.set(k, v)
          void idbSet(k, v).catch(() => {})
        }
      }

      hydrated = true
      notify()
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — the localStorage
      // fallback in getItem keeps the app fully functional.
      hydrated = true
      notify()
    }
  })()

  return hydrating
}
