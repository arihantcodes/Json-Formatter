export interface RequestCollection {
    id: string
    name: string
    description?: string
    folders: CollectionFolder[]
    requests: CollectionRequest[]
    variables: EnvironmentVariable[]
    createdAt: number
    updatedAt: number
  }
  
  export interface CollectionFolder {
    id: string
    name: string
    description?: string
    parentId?: string
    requests: string[] // Request IDs
    subfolders: string[] // Folder IDs
  }
  
  export interface CollectionRequest {
    id: string
    name: string
    description?: string
    folderId?: string
    url: string
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE"
    headers: Record<string, string>
    body?: string
    queryParams: Array<{ key: string; value: string; enabled: boolean }>
    authConfig?: AuthConfig
    tests?: string[] // Test scripts
    preRequestScript?: string
    createdAt: number
    updatedAt: number
  }
  
  export interface Environment {
    id: string
    name: string
    variables: EnvironmentVariable[]
    isActive: boolean
    createdAt: number
  }
  
  export interface EnvironmentVariable {
    key: string
    value: string
    enabled: boolean
    description?: string
    type?: "default" | "secret"
  }
  
  export interface AuthConfig {
    type: "none" | "bearer" | "apikey" | "basic" | "oauth2" | "jwt" | "digest" | "aws" | "custom"
    credentials: Record<string, string>
    settings?: Record<string, any>
  }
  
  export class CollectionManager {
    private static readonly COLLECTIONS_KEY = "json-formatter-collections"
    private static readonly ENVIRONMENTS_KEY = "json-formatter-environments"
    private static readonly ACTIVE_ENV_KEY = "json-formatter-active-environment"
  
    // Collection Management
    static getCollections(): RequestCollection[] {
      try {
        const stored = localStorage.getItem(this.COLLECTIONS_KEY)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }
  
    static saveCollection(collection: Omit<RequestCollection, "id" | "createdAt" | "updatedAt">): RequestCollection {
      const collections = this.getCollections()
      const newCollection: RequestCollection = {
        ...collection,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
  
      collections.push(newCollection)
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
      return newCollection
    }
  
    static updateCollection(id: string, updates: Partial<RequestCollection>): void {
      const collections = this.getCollections()
      const index = collections.findIndex((c) => c.id === id)
  
      if (index !== -1) {
        collections[index] = {
          ...collections[index],
          ...updates,
          updatedAt: Date.now(),
        }
        localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
      }
    }
  
    static deleteCollection(id: string): void {
      const collections = this.getCollections().filter((c) => c.id !== id)
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
    }
  
    static duplicateCollection(id: string): RequestCollection | null {
      const collections = this.getCollections()
      const original = collections.find((c) => c.id === id)
  
      if (!original) return null
  
      const duplicate: RequestCollection = {
        ...original,
        id: crypto.randomUUID(),
        name: `${original.name} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        requests: original.requests.map((req) => ({
          ...req,
          id: crypto.randomUUID(),
        })),
        folders: original.folders.map((folder) => ({
          ...folder,
          id: crypto.randomUUID(),
        })),
      }
  
      collections.push(duplicate)
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
      return duplicate
    }
  
    // Request Management
    static addRequestToCollection(
      collectionId: string,
      request: Omit<CollectionRequest, "id" | "createdAt" | "updatedAt">,
    ): CollectionRequest | null {
      const collections = this.getCollections()
      const collection = collections.find((c) => c.id === collectionId)
  
      if (!collection) return null
  
      const newRequest: CollectionRequest = {
        ...request,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
  
      collection.requests.push(newRequest)
      collection.updatedAt = Date.now()
  
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
      return newRequest
    }
  
    static updateRequest(collectionId: string, requestId: string, updates: Partial<CollectionRequest>): void {
      const collections = this.getCollections()
      const collection = collections.find((c) => c.id === collectionId)
  
      if (!collection) return
  
      const requestIndex = collection.requests.findIndex((r) => r.id === requestId)
      if (requestIndex !== -1) {
        collection.requests[requestIndex] = {
          ...collection.requests[requestIndex],
          ...updates,
          updatedAt: Date.now(),
        }
        collection.updatedAt = Date.now()
        localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
      }
    }
  
    static deleteRequest(collectionId: string, requestId: string): void {
      const collections = this.getCollections()
      const collection = collections.find((c) => c.id === collectionId)
  
      if (!collection) return
  
      collection.requests = collection.requests.filter((r) => r.id !== requestId)
      collection.updatedAt = Date.now()
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
    }
  
    // Folder Management
    static addFolder(collectionId: string, folder: Omit<CollectionFolder, "id">): CollectionFolder | null {
      const collections = this.getCollections()
      const collection = collections.find((c) => c.id === collectionId)
  
      if (!collection) return null
  
      const newFolder: CollectionFolder = {
        ...folder,
        id: crypto.randomUUID(),
      }
  
      collection.folders.push(newFolder)
      collection.updatedAt = Date.now()
  
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
      return newFolder
    }
  
    static deleteFolder(collectionId: string, folderId: string): void {
      const collections = this.getCollections()
      const collection = collections.find((c) => c.id === collectionId)
  
      if (!collection) return
  
      // Remove folder and move requests to root
      collection.folders = collection.folders.filter((f) => f.id !== folderId)
      collection.requests.forEach((req) => {
        if (req.folderId === folderId) {
          req.folderId = undefined
        }
      })
  
      collection.updatedAt = Date.now()
      localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
    }
  
    // Environment Management
    static getEnvironments(): Environment[] {
      try {
        const stored = localStorage.getItem(this.ENVIRONMENTS_KEY)
        return stored ? JSON.parse(stored) : this.getDefaultEnvironments()
      } catch {
        return this.getDefaultEnvironments()
      }
    }
  
    static getDefaultEnvironments(): Environment[] {
      return [
        {
          id: "development",
          name: "Development",
          variables: [
            { key: "baseUrl", value: "http://localhost:3000", enabled: true, description: "Development API base URL" },
            { key: "apiKey", value: "dev-api-key", enabled: true, description: "Development API key", type: "secret" },
          ],
          isActive: true,
          createdAt: Date.now(),
        },
        {
          id: "staging",
          name: "Staging",
          variables: [
            {
              key: "baseUrl",
              value: "https://staging-api.example.com",
              enabled: true,
              description: "Staging API base URL",
            },
            { key: "apiKey", value: "staging-api-key", enabled: true, description: "Staging API key", type: "secret" },
          ],
          isActive: false,
          createdAt: Date.now(),
        },
        {
          id: "production",
          name: "Production",
          variables: [
            { key: "baseUrl", value: "https://api.example.com", enabled: true, description: "Production API base URL" },
            { key: "apiKey", value: "prod-api-key", enabled: true, description: "Production API key", type: "secret" },
          ],
          isActive: false,
          createdAt: Date.now(),
        },
      ]
    }
  
    static saveEnvironment(environment: Omit<Environment, "id" | "createdAt">): Environment {
      const environments = this.getEnvironments()
      const newEnvironment: Environment = {
        ...environment,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
  
      environments.push(newEnvironment)
      localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(environments))
      return newEnvironment
    }
  
    static updateEnvironment(id: string, updates: Partial<Environment>): void {
      const environments = this.getEnvironments()
      const index = environments.findIndex((e) => e.id === id)
  
      if (index !== -1) {
        environments[index] = { ...environments[index], ...updates }
        localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(environments))
      }
    }
  
    static deleteEnvironment(id: string): void {
      const environments = this.getEnvironments().filter((e) => e.id !== id)
      localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(environments))
    }
  
    static setActiveEnvironment(id: string): void {
      const environments = this.getEnvironments()
      environments.forEach((env) => {
        env.isActive = env.id === id
      })
      localStorage.setItem(this.ENVIRONMENTS_KEY, JSON.stringify(environments))
      localStorage.setItem(this.ACTIVE_ENV_KEY, id)
    }
  
    static getActiveEnvironment(): Environment | null {
      const environments = this.getEnvironments()
      return environments.find((env) => env.isActive) || null
    }
  
    // Import/Export
    static exportCollection(id: string): string | null {
      const collection = this.getCollections().find((c) => c.id === id)
      if (!collection) return null
  
      return JSON.stringify(
        {
          version: "1.0",
          collection,
          exportedAt: Date.now(),
        },
        null,
        2,
      )
    }
  
    static importCollection(jsonData: string): RequestCollection | null {
      try {
        const data = JSON.parse(jsonData)
  
        if (data.collection) {
          const collection = {
            ...data.collection,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
  
          const collections = this.getCollections()
          collections.push(collection)
          localStorage.setItem(this.COLLECTIONS_KEY, JSON.stringify(collections))
  
          return collection
        }
  
        return null
      } catch {
        return null
      }
    }
  
    // Variable Interpolation
    static interpolateVariables(text: string, environment?: Environment): string {
      if (!environment) {
        environment = this.getActiveEnvironment() ?? undefined
      }
  
      if (!environment) return text
  
      let result = text
      environment.variables
        .filter((v) => v.enabled)
        .forEach((variable) => {
          const regex = new RegExp(`{{${variable.key}}}`, "g")
          result = result.replace(regex, variable.value)
        })
  
      return result
    }
  
    // Search
    static searchRequests(query: string, collectionId?: string): CollectionRequest[] {
      const collections = collectionId
        ? this.getCollections().filter((c) => c.id === collectionId)
        : this.getCollections()
  
      const results: CollectionRequest[] = []
      const searchTerm = query.toLowerCase()
  
      collections.forEach((collection) => {
        collection.requests.forEach((request) => {
          if (
            request.name.toLowerCase().includes(searchTerm) ||
            request.url.toLowerCase().includes(searchTerm) ||
            request.method.toLowerCase().includes(searchTerm) ||
            request.description?.toLowerCase().includes(searchTerm)
          ) {
            results.push(request)
          }
        })
      })
  
      return results
    }
  }
  
