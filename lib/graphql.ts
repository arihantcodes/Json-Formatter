export interface GraphQLSchema {
    types: GraphQLType[]
    queryType?: GraphQLType
    mutationType?: GraphQLType
    subscriptionType?: GraphQLType
  }
  
  export interface GraphQLType {
    name: string
    kind: "OBJECT" | "SCALAR" | "ENUM" | "INPUT_OBJECT" | "LIST" | "NON_NULL" | "INTERFACE" | "UNION"
    description?: string
    fields?: GraphQLField[]
    enumValues?: GraphQLEnumValue[]
    inputFields?: GraphQLInputField[]
    possibleTypes?: GraphQLType[]
  }
  
  export interface GraphQLField {
    name: string
    description?: string
    type: GraphQLType
    args: GraphQLInputField[]
    isDeprecated: boolean
    deprecationReason?: string
  }
  
  export interface GraphQLInputField {
    name: string
    description?: string
    type: GraphQLType
    defaultValue?: any
  }
  
  export interface GraphQLEnumValue {
    name: string
    description?: string
    isDeprecated: boolean
    deprecationReason?: string
  }
  
  export interface GraphQLQuery {
    id: string
    name: string
    operation: "query" | "mutation" | "subscription"
    query: string
    variables?: Record<string, any>
    headers?: Record<string, string>
    endpoint: string
    createdAt: Date
    lastUsed?: Date
  }
  
  export interface GraphQLResponse {
    data?: any
    errors?: Array<{
      message: string
      locations?: Array<{ line: number; column: number }>
      path?: Array<string | number>
      extensions?: Record<string, any>
    }>
    extensions?: Record<string, any>
  }
  
  export class GraphQLClient {
    private endpoint: string
    private headers: Record<string, string>
  
    constructor(endpoint: string, headers: Record<string, string> = {}) {
      this.endpoint = endpoint
      this.headers = {
        "Content-Type": "application/json",
        ...headers,
      }
    }
  
    async introspectSchema(): Promise<GraphQLSchema> {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              ...FullType
            }
          }
        }
  
        fragment FullType on __Type {
          kind
          name
          description
          fields(includeDeprecated: true) {
            name
            description
            args {
              ...InputValue
            }
            type {
              ...TypeRef
            }
            isDeprecated
            deprecationReason
          }
          inputFields {
            ...InputValue
          }
          interfaces {
            ...TypeRef
          }
          enumValues(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
          }
          possibleTypes {
            ...TypeRef
          }
        }
  
        fragment InputValue on __InputValue {
          name
          description
          type { ...TypeRef }
          defaultValue
        }
  
        fragment TypeRef on __Type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
  
      const response = await this.executeQuery(introspectionQuery)
      if (response.errors) {
        throw new Error(`Schema introspection failed: ${response.errors[0].message}`)
      }
  
      return this.parseIntrospectionResult(response.data.__schema)
    }
  
    async executeQuery(query: string, variables?: Record<string, any>): Promise<GraphQLResponse> {
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            query,
            variables,
          }),
        })
  
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
  
        return await response.json()
      } catch (error) {
        throw new Error(`GraphQL request failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
  
    private parseIntrospectionResult(schema: any): GraphQLSchema {
      const typeMap = new Map<string, GraphQLType>()
  
      // First pass: create all types
      schema.types.forEach((type: any) => {
        typeMap.set(type.name, {
          name: type.name,
          kind: type.kind,
          description: type.description,
          fields: [],
          enumValues: [],
          inputFields: [],
          possibleTypes: [],
        })
      })
  
      // Second pass: populate fields and relationships
      schema.types.forEach((type: any) => {
        const graphqlType = typeMap.get(type.name)!
  
        if (type.fields) {
          graphqlType.fields = type.fields.map((field: any) => ({
            name: field.name,
            description: field.description,
            type: this.parseTypeRef(field.type, typeMap),
            args:
              field.args?.map((arg: any) => ({
                name: arg.name,
                description: arg.description,
                type: this.parseTypeRef(arg.type, typeMap),
                defaultValue: arg.defaultValue,
              })) || [],
            isDeprecated: field.isDeprecated,
            deprecationReason: field.deprecationReason,
          }))
        }
  
        if (type.enumValues) {
          graphqlType.enumValues = type.enumValues.map((value: any) => ({
            name: value.name,
            description: value.description,
            isDeprecated: value.isDeprecated,
            deprecationReason: value.deprecationReason,
          }))
        }
  
        if (type.inputFields) {
          graphqlType.inputFields = type.inputFields.map((field: any) => ({
            name: field.name,
            description: field.description,
            type: this.parseTypeRef(field.type, typeMap),
            defaultValue: field.defaultValue,
          }))
        }
  
        if (type.possibleTypes) {
          graphqlType.possibleTypes = type.possibleTypes.map((t: any) => typeMap.get(t.name)!)
        }
      })
  
      return {
        types: Array.from(typeMap.values()),
        queryType: schema.queryType ? typeMap.get(schema.queryType.name) : undefined,
        mutationType: schema.mutationType ? typeMap.get(schema.mutationType.name) : undefined,
        subscriptionType: schema.subscriptionType ? typeMap.get(schema.subscriptionType.name) : undefined,
      }
    }
  
    private parseTypeRef(typeRef: any, typeMap: Map<string, GraphQLType>): GraphQLType {
      if (typeRef.ofType) {
        return this.parseTypeRef(typeRef.ofType, typeMap)
      }
  
      return (
        typeMap.get(typeRef.name) || {
          name: typeRef.name,
          kind: typeRef.kind,
          fields: [],
          enumValues: [],
          inputFields: [],
          possibleTypes: [],
        }
      )
    }
  
    updateHeaders(headers: Record<string, string>) {
      this.headers = { ...this.headers, ...headers }
    }
  
    updateEndpoint(endpoint: string) {
      this.endpoint = endpoint
    }
  }
  
  export class GraphQLQueryBuilder {
    private schema: GraphQLSchema | null = null
  
    setSchema(schema: GraphQLSchema) {
      this.schema = schema
    }
  
    buildQuery(selections: QuerySelection[], operation: "query" | "mutation" | "subscription" = "query"): string {
      if (!this.schema) {
        throw new Error("Schema not loaded")
      }
  
      const rootType =
        operation === "query"
          ? this.schema.queryType
          : operation === "mutation"
            ? this.schema.mutationType
            : this.schema.subscriptionType
  
      if (!rootType) {
        throw new Error(`${operation} type not available in schema`)
      }
  
      const queryBody = this.buildSelectionSet(selections, rootType, 0)
      return `${operation} {\n${queryBody}\n}`
    }
  
    private buildSelectionSet(selections: QuerySelection[], type: GraphQLType, depth: number): string {
      const indent = "  ".repeat(depth + 1)
  
      return selections
        .map((selection) => {
          const field = type.fields?.find((f) => f.name === selection.name)
          if (!field) return ""
  
          let fieldStr = `${indent}${selection.name}`
  
          // Add arguments
          if (selection.args && Object.keys(selection.args).length > 0) {
            const args = Object.entries(selection.args)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(", ")
            fieldStr += `(${args})`
          }
  
          // Add sub-selections for object types
          if (selection.selections && selection.selections.length > 0) {
            const subSelections = this.buildSelectionSet(selection.selections, field.type, depth + 1)
            fieldStr += ` {\n${subSelections}\n${indent}}`
          }
  
          return fieldStr
        })
        .join("\n")
    }
  
    validateQuery(query: string): Array<{ message: string; line?: number; column?: number }> {
      const errors: Array<{ message: string; line?: number; column?: number }> = []
  
      // Basic syntax validation
      if (!query.trim()) {
        errors.push({ message: "Query cannot be empty" })
        return errors
      }
  
      // Check for balanced braces
      let braceCount = 0
      let parenCount = 0
  
      for (let i = 0; i < query.length; i++) {
        const char = query[i]
        if (char === "{") braceCount++
        else if (char === "}") braceCount--
        else if (char === "(") parenCount++
        else if (char === ")") parenCount--
      }
  
      if (braceCount !== 0) {
        errors.push({ message: "Unbalanced braces in query" })
      }
  
      if (parenCount !== 0) {
        errors.push({ message: "Unbalanced parentheses in query" })
      }
  
      return errors
    }
  
    getFieldSuggestions(typeName: string, prefix = ""): Array<{ name: string; description?: string; type: string }> {
      if (!this.schema) return []
  
      const type = this.schema.types.find((t) => t.name === typeName)
      if (!type || !type.fields) return []
  
      return type.fields
        .filter((field) => field.name.toLowerCase().includes(prefix.toLowerCase()))
        .map((field) => ({
          name: field.name,
          description: field.description,
          type: this.getTypeString(field.type),
        }))
    }
  
    private getTypeString(type: GraphQLType): string {
      return type.name
    }
  }
  
  export interface QuerySelection {
    name: string
    args?: Record<string, any>
    selections?: QuerySelection[]
  }
  
  // Query storage utilities
  export class GraphQLQueryStorage {
    private static STORAGE_KEY = "graphql_queries"
  
    static saveQuery(query: GraphQLQuery): void {
      const queries = this.getQueries()
      const existingIndex = queries.findIndex((q) => q.id === query.id)
  
      if (existingIndex >= 0) {
        queries[existingIndex] = query
      } else {
        queries.push(query)
      }
  
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queries))
    }
  
    static getQueries(): GraphQLQuery[] {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (!stored) return []
  
        return JSON.parse(stored).map((q: any) => ({
          ...q,
          createdAt: new Date(q.createdAt),
          lastUsed: q.lastUsed ? new Date(q.lastUsed) : undefined,
        }))
      } catch {
        return []
      }
    }
  
    static deleteQuery(id: string): void {
      const queries = this.getQueries().filter((q) => q.id !== id)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queries))
    }
  
    static clearQueries(): void {
      localStorage.removeItem(this.STORAGE_KEY)
    }
  }
  