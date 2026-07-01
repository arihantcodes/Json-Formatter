import type {
  RequestCollection,
  CollectionFolder,
  CollectionRequest,
  Environment,
  EnvironmentVariable,
  AuthConfig,
} from "./collection"

// Minimal typings for the Postman Collection v2.1 format
export interface PostmanCollection {
  info: {
    _postman_id?: string
    name: string
    description?: string | { content?: string }
    schema?: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
  auth?: PostmanAuth
}

export interface PostmanItem {
  name: string
  description?: string | { content?: string }
  // Folders contain nested items; requests contain a `request`
  item?: PostmanItem[]
  request?: PostmanRequest
}

export interface PostmanRequest {
  method?: string
  header?: PostmanHeader[]
  url?: string | PostmanUrl
  body?: PostmanBody
  auth?: PostmanAuth
  description?: string | { content?: string }
}

export interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
}

export interface PostmanUrl {
  raw?: string
  protocol?: string
  host?: string | string[]
  path?: string | string[]
  query?: Array<{ key: string; value: string; disabled?: boolean }>
}

export interface PostmanBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql"
  raw?: string
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>
  formdata?: Array<{ key: string; value: string; disabled?: boolean }>
  graphql?: { query?: string; variables?: string }
}

export interface PostmanVariable {
  key: string
  value: string
  type?: string
  disabled?: boolean
  description?: string
}

export interface PostmanAuth {
  type: string
  [key: string]: unknown
}

export interface PostmanEnvironment {
  id?: string
  name: string
  values: Array<{
    key: string
    value: string
    enabled?: boolean
    type?: string
    description?: string
  }>
  _postman_variable_scope?: string
}

// --- Type guards -------------------------------------------------------------

export function isPostmanCollection(data: unknown): data is PostmanCollection {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  const info = d.info as Record<string, unknown> | undefined
  return (
    typeof info === "object" &&
    info !== null &&
    typeof info.name === "string" &&
    Array.isArray(d.item)
  )
}

export function isPostmanEnvironment(data: unknown): data is PostmanEnvironment {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return (
    typeof d.name === "string" &&
    Array.isArray(d.values) &&
    (d._postman_variable_scope === "environment" ||
      // Fall back to structural detection when the scope marker is missing
      d.values.every(
        (v) => v && typeof v === "object" && "key" in (v as object),
      ))
  )
}

// --- Helpers -----------------------------------------------------------------

function toText(value: string | { content?: string } | undefined): string | undefined {
  if (typeof value === "string") return value
  if (value && typeof value === "object") return value.content
  return undefined
}

function normalizeMethod(method?: string): CollectionRequest["method"] {
  const valid: CollectionRequest["method"][] = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "CONNECT",
    "TRACE",
  ]
  const upper = (method ?? "GET").toUpperCase() as CollectionRequest["method"]
  return valid.includes(upper) ? upper : "GET"
}

function extractUrl(url: string | PostmanUrl | undefined): string {
  if (!url) return ""
  if (typeof url === "string") return url
  if (url.raw) return url.raw

  const protocol = url.protocol ? `${url.protocol}://` : ""
  const host = Array.isArray(url.host) ? url.host.join(".") : url.host ?? ""
  const path = Array.isArray(url.path) ? url.path.join("/") : url.path ?? ""
  const joined = path ? `${host}/${path}` : host
  return `${protocol}${joined}`
}

function extractQueryParams(
  url: string | PostmanUrl | undefined,
): CollectionRequest["queryParams"] {
  if (!url || typeof url === "string" || !Array.isArray(url.query)) return []
  return url.query.map((q) => ({
    key: q.key ?? "",
    value: q.value ?? "",
    enabled: !q.disabled,
  }))
}

function extractHeaders(headers?: PostmanHeader[]): Record<string, string> {
  const result: Record<string, string> = {}
  headers?.forEach((h) => {
    if (h && h.key && !h.disabled) {
      result[h.key] = h.value ?? ""
    }
  })
  return result
}

function extractBody(body?: PostmanBody): string | undefined {
  if (!body) return undefined
  switch (body.mode) {
    case "raw":
      return body.raw
    case "graphql":
      return body.graphql
        ? JSON.stringify(
            { query: body.graphql.query, variables: body.graphql.variables },
            null,
            2,
          )
        : undefined
    case "urlencoded":
    case "formdata": {
      const entries = body[body.mode] ?? []
      return JSON.stringify(
        entries
          .filter((e) => !e.disabled)
          .reduce<Record<string, string>>((acc, e) => {
            acc[e.key] = e.value
            return acc
          }, {}),
        null,
        2,
      )
    }
    default:
      return body.raw
  }
}

function extractAuth(auth?: PostmanAuth): AuthConfig | undefined {
  if (!auth || !auth.type) return undefined

  const readParams = (key: string): Record<string, string> => {
    const params = auth[key]
    if (!Array.isArray(params)) return {}
    return params.reduce<Record<string, string>>((acc, p) => {
      if (p && typeof p === "object" && "key" in p) {
        acc[(p as { key: string }).key] = String((p as { value?: unknown }).value ?? "")
      }
      return acc
    }, {})
  }

  switch (auth.type) {
    case "bearer":
      return { type: "bearer", credentials: readParams("bearer") }
    case "basic":
      return { type: "basic", credentials: readParams("basic") }
    case "apikey":
      return { type: "apikey", credentials: readParams("apikey") }
    case "oauth2":
      return { type: "oauth2", credentials: readParams("oauth2") }
    case "digest":
      return { type: "digest", credentials: readParams("digest") }
    case "awsv4":
      return { type: "aws", credentials: readParams("awsv4") }
    case "noauth":
      return { type: "none", credentials: {} }
    default:
      return { type: "custom", credentials: readParams(auth.type) }
  }
}

// --- Converters --------------------------------------------------------------

export function convertPostmanCollection(data: PostmanCollection): RequestCollection {
  const now = Date.now()
  const folders: CollectionFolder[] = []
  const requests: CollectionRequest[] = []

  const walk = (items: PostmanItem[], parentFolderId?: string): void => {
    items.forEach((item) => {
      const isFolder = Array.isArray(item.item)

      if (isFolder) {
        const folder: CollectionFolder = {
          id: crypto.randomUUID(),
          name: item.name || "Untitled Folder",
          description: toText(item.description),
          parentId: parentFolderId,
          requests: [],
          subfolders: [],
        }
        folders.push(folder)

        if (parentFolderId) {
          const parent = folders.find((f) => f.id === parentFolderId)
          parent?.subfolders.push(folder.id)
        }

        walk(item.item ?? [], folder.id)
      } else if (item.request) {
        const req = item.request
        const request: CollectionRequest = {
          id: crypto.randomUUID(),
          name: item.name || "Untitled Request",
          description: toText(item.description) ?? toText(req.description),
          folderId: parentFolderId,
          url: extractUrl(req.url),
          method: normalizeMethod(req.method),
          headers: extractHeaders(req.header),
          body: extractBody(req.body),
          queryParams: extractQueryParams(req.url),
          authConfig: extractAuth(req.auth),
          createdAt: now,
          updatedAt: now,
        }
        requests.push(request)

        if (parentFolderId) {
          const parent = folders.find((f) => f.id === parentFolderId)
          parent?.requests.push(request.id)
        }
      }
    })
  }

  walk(data.item ?? [])

  const variables: EnvironmentVariable[] = (data.variable ?? []).map((v) => ({
    key: v.key,
    value: v.value ?? "",
    enabled: !v.disabled,
    description: v.description,
    type: v.type === "secret" ? "secret" : "default",
  }))

  return {
    id: crypto.randomUUID(),
    name: data.info.name || "Imported Collection",
    description: toText(data.info.description),
    folders,
    requests,
    variables,
    createdAt: now,
    updatedAt: now,
  }
}

export function convertPostmanEnvironment(data: PostmanEnvironment): Environment {
  const variables: EnvironmentVariable[] = (data.values ?? []).map((v) => ({
    key: v.key,
    value: v.value ?? "",
    enabled: v.enabled !== false,
    description: v.description,
    type: v.type === "secret" ? "secret" : "default",
  }))

  return {
    id: crypto.randomUUID(),
    name: data.name || "Imported Environment",
    variables,
    isActive: false,
    createdAt: Date.now(),
  }
}
