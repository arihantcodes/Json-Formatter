"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  GraphQLClient,
  GraphQLQueryBuilder,
  type GraphQLSchema,
  type GraphQLQuery,
  type GraphQLResponse,
  GraphQLQueryStorage,
  type QuerySelection,
} from "@/lib/graphql"
import { Play, Save, Trash2, Book, Settings, Plus, Minus } from "lucide-react"

interface GraphQLPlaygroundProps {
  className?: string
}

export function GraphQLPlayground({ className }: GraphQLPlaygroundProps) {
  const [client, setClient] = useState<GraphQLClient | null>(null)
  const [queryBuilder] = useState(() => new GraphQLQueryBuilder())
  const [endpoint, setEndpoint] = useState("https://api.github.com/graphql")
  const [headers, setHeaders] = useState<Record<string, string>>({
    Authorization: "Bearer YOUR_TOKEN_HERE",
  })
  const [schema, setSchema] = useState<GraphQLSchema | null>(null)
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)
  const [currentQuery, setCurrentQuery] = useState<GraphQLQuery>({
    id: crypto.randomUUID(),
    name: "New Query",
    operation: "query",
    query: `query {
  viewer {
    login
    name
    email
  }
}`,
    variables: {},
    headers: {},
    endpoint: "",
    createdAt: new Date(),
  })
  const [queryResult, setQueryResult] = useState<GraphQLResponse | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [savedQueries, setSavedQueries] = useState<GraphQLQuery[]>([])
  const [selectedType, setSelectedType] = useState<string>("")
  const [querySelections, setQuerySelections] = useState<QuerySelection[]>([])
  const [showQueryBuilder, setShowQueryBuilder] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Array<{ message: string; line?: number; column?: number }>>(
    [],
  )
  const queryTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    setSavedQueries(GraphQLQueryStorage.getQueries())
  }, [])

  useEffect(() => {
    if (endpoint && headers) {
      setClient(new GraphQLClient(endpoint, headers))
    }
  }, [endpoint, headers])

  useEffect(() => {
    if (currentQuery.query) {
      const errors = queryBuilder.validateQuery(currentQuery.query)
      setValidationErrors(errors)
    }
  }, [currentQuery.query, queryBuilder])

  const handleLoadSchema = async () => {
    if (!client) {
      toast({
        title: "No client",
        description: "Please configure endpoint and headers first",
        variant: "destructive",
      })
      return
    }

    setIsLoadingSchema(true)
    try {
      const loadedSchema = await client.introspectSchema()
      setSchema(loadedSchema)
      queryBuilder.setSchema(loadedSchema)

      if (loadedSchema.queryType) {
        setSelectedType(loadedSchema.queryType.name)
      }

      toast({
        title: "Schema loaded",
        description: `Loaded ${loadedSchema.types.length} types`,
      })
    } catch (error) {
      toast({
        title: "Schema loading failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSchema(false)
    }
  }

  const handleExecuteQuery = async () => {
    if (!client) {
      toast({
        title: "No client",
        description: "Please configure endpoint and headers first",
        variant: "destructive",
      })
      return
    }

    if (validationErrors.length > 0) {
      toast({
        title: "Query validation failed",
        description: validationErrors[0].message,
        variant: "destructive",
      })
      return
    }

    setIsExecuting(true)
    try {
      const result = await client.executeQuery(currentQuery.query, currentQuery.variables)
      setQueryResult(result)

      if (result.errors) {
        toast({
          title: "Query executed with errors",
          description: `${result.errors.length} error(s) found`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Query executed successfully",
          description: "Results displayed below",
        })
      }

      // Update last used time
      const updatedQuery = { ...currentQuery, lastUsed: new Date() }
      setCurrentQuery(updatedQuery)
    } catch (error) {
      toast({
        title: "Query execution failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleSaveQuery = () => {
    const queryToSave = { ...currentQuery }
    GraphQLQueryStorage.saveQuery(queryToSave)
    setSavedQueries(GraphQLQueryStorage.getQueries())

    toast({
      title: "Query saved",
      description: `Saved "${queryToSave.name}"`,
    })
  }

  const handleLoadQuery = (query: GraphQLQuery) => {
    setCurrentQuery(query)
    setEndpoint(query.endpoint || endpoint)
    if (Object.keys(query.headers || {}).length > 0) {
      setHeaders({ ...headers, ...query.headers })
    }
  }

  const handleDeleteQuery = (id: string) => {
    GraphQLQueryStorage.deleteQuery(id)
    setSavedQueries(GraphQLQueryStorage.getQueries())
    toast({
      title: "Query deleted",
      description: "Query removed from saved queries",
    })
  }

  const handleAddHeader = () => {
    const key = prompt("Header name:")
    const value = prompt("Header value:")
    if (key && value) {
      setHeaders((prev) => ({ ...prev, [key]: value }))
    }
  }

  const handleRemoveHeader = (key: string) => {
    setHeaders((prev) => {
      const newHeaders = { ...prev }
      delete newHeaders[key]
      return newHeaders
    })
  }

  const buildQueryFromSelections = () => {
    if (!schema || querySelections.length === 0) return

    try {
      const builtQuery = queryBuilder.buildQuery(querySelections, currentQuery.operation)
      setCurrentQuery((prev) => ({ ...prev, query: builtQuery }))
      toast({
        title: "Query built",
        description: "Query generated from selections",
      })
    } catch (error) {
      toast({
        title: "Query building failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const addFieldSelection = (fieldName: string) => {
    setQuerySelections((prev) => [...prev, { name: fieldName, selections: [] }])
  }

  const removeFieldSelection = (index: number) => {
    setQuerySelections((prev) => prev.filter((_, i) => i !== index))
  }

  const formatResult = (result: any) => {
    try {
      return JSON.stringify(result, null, 2)
    } catch {
      return String(result)
    }
  }

  return (
    <div className={className}>
      <Tabs defaultValue="playground" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="playground">Playground</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="builder">Query Builder</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="playground" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Query Input */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        GraphQL Query
                        {validationErrors.length > 0 && (
                          <Badge variant="destructive">{validationErrors.length} errors</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Write and execute GraphQL queries</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSaveQuery}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button onClick={handleExecuteQuery} disabled={isExecuting || !client} size="sm">
                        <Play className="w-4 h-4 mr-2" />
                        {isExecuting ? "Executing..." : "Execute"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="query-name">Query Name</Label>
                    <Input
                      id="query-name"
                      value={currentQuery.name}
                      onChange={(e) => setCurrentQuery((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operation">Operation Type</Label>
                    <Select
                      value={currentQuery.operation}
                      onValueChange={(value: "query" | "mutation" | "subscription") =>
                        setCurrentQuery((prev) => ({ ...prev, operation: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="query">Query</SelectItem>
                        <SelectItem value="mutation">Mutation</SelectItem>
                        <SelectItem value="subscription">Subscription</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="query-text">Query</Label>
                    <Textarea
                      ref={queryTextareaRef}
                      id="query-text"
                      value={currentQuery.query}
                      onChange={(e) => setCurrentQuery((prev) => ({ ...prev, query: e.target.value }))}
                      className="font-mono text-sm min-h-[200px]"
                      placeholder="Enter your GraphQL query..."
                    />
                    {validationErrors.length > 0 && (
                      <div className="text-sm text-destructive">
                        {validationErrors.map((error, index) => (
                          <div key={index}>{error.message}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="variables">Variables (JSON)</Label>
                    <Textarea
                      id="variables"
                      value={JSON.stringify(currentQuery.variables, null, 2)}
                      onChange={(e) => {
                        try {
                          const variables = JSON.parse(e.target.value || "{}")
                          setCurrentQuery((prev) => ({ ...prev, variables }))
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      className="font-mono text-sm"
                      rows={4}
                      placeholder="{}"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="endpoint">GraphQL Endpoint</Label>
                    <Input
                      id="endpoint"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://api.example.com/graphql"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Headers</Label>
                      <Button variant="outline" size="sm" onClick={handleAddHeader}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(headers).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <Input value={key} disabled className="flex-1" />
                          <Input
                            value={value}
                            onChange={(e) => setHeaders((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="flex-1"
                            type={key.toLowerCase().includes("auth") ? "password" : "text"}
                          />
                          <Button variant="outline" size="sm" onClick={() => handleRemoveHeader(key)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleLoadSchema} disabled={isLoadingSchema || !endpoint} className="w-full">
                    <Book className="w-4 h-4 mr-2" />
                    {isLoadingSchema ? "Loading Schema..." : "Load Schema"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>Query execution results</CardDescription>
                </CardHeader>
                <CardContent>
                  {queryResult ? (
                    <ScrollArea className="h-96">
                      <Tabs defaultValue="data" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="data">Data</TabsTrigger>
                          <TabsTrigger value="errors">Errors</TabsTrigger>
                        </TabsList>
                        <TabsContent value="data">
                          <pre className="text-sm bg-muted p-4 rounded overflow-x-auto">
                            {formatResult(queryResult.data)}
                          </pre>
                        </TabsContent>
                        <TabsContent value="errors">
                          {queryResult.errors && queryResult.errors.length > 0 ? (
                            <div className="space-y-2">
                              {queryResult.errors.map((error, index) => (
                                <div key={index} className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                                  <div className="font-medium text-destructive">{error.message}</div>
                                  {error.locations && (
                                    <div className="text-sm text-muted-foreground">
                                      Line {error.locations[0].line}, Column {error.locations[0].column}
                                    </div>
                                  )}
                                  {error.path && (
                                    <div className="text-sm text-muted-foreground">Path: {error.path.join(" → ")}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground py-8">No errors</div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </ScrollArea>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">Execute a query to see results</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schema Explorer</CardTitle>
              <CardDescription>Browse the GraphQL schema types and fields</CardDescription>
            </CardHeader>
            <CardContent>
              {schema ? (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {schema.types
                      .filter((type) => !type.name.startsWith("__"))
                      .map((type) => (
                        <div key={type.name} className="border rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{type.kind}</Badge>
                            <span className="font-medium">{type.name}</span>
                          </div>
                          {type.description && <p className="text-sm text-muted-foreground mb-2">{type.description}</p>}
                          {type.fields && type.fields.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">Fields:</div>
                              {type.fields.slice(0, 5).map((field) => (
                                <div key={field.name} className="text-sm pl-4">
                                  <span className="font-mono">{field.name}</span>
                                  <span className="text-muted-foreground">: {field.type.name}</span>
                                </div>
                              ))}
                              {type.fields.length > 5 && (
                                <div className="text-sm text-muted-foreground pl-4">
                                  ... and {type.fields.length - 5} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center text-muted-foreground py-8">Load a schema to explore types and fields</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Visual Query Builder</CardTitle>
              <CardDescription>Build queries visually by selecting fields</CardDescription>
            </CardHeader>
            <CardContent>
              {schema ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={buildQueryFromSelections} disabled={querySelections.length === 0}>
                      Build Query
                    </Button>
                    <Button variant="outline" onClick={() => setQuerySelections([])}>
                      Clear Selections
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Available Fields</h4>
                      <ScrollArea className="h-64 border rounded p-2">
                        {selectedType &&
                          schema.types
                            .find((t) => t.name === selectedType)
                            ?.fields?.map((field) => (
                              <div
                                key={field.name}
                                className="flex items-center justify-between p-2 hover:bg-muted rounded"
                              >
                                <div>
                                  <span className="font-mono text-sm">{field.name}</span>
                                  <span className="text-muted-foreground text-sm">: {field.type.name}</span>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => addFieldSelection(field.name)}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                      </ScrollArea>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Selected Fields</h4>
                      <ScrollArea className="h-64 border rounded p-2">
                        {querySelections.map((selection, index) => (
                          <div key={index} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                            <span className="font-mono text-sm">{selection.name}</span>
                            <Button size="sm" variant="outline" onClick={() => removeFieldSelection(index)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Load a schema to use the visual query builder
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Saved Queries</CardTitle>
                  <CardDescription>Manage your saved GraphQL queries</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSavedQueries(GraphQLQueryStorage.getQueries())}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {savedQueries.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {savedQueries.map((query) => (
                      <div key={query.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{query.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {query.operation} • Created {query.createdAt.toLocaleDateString()}
                            {query.lastUsed && ` • Last used ${query.lastUsed.toLocaleDateString()}`}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleLoadQuery(query)}>
                            Load
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteQuery(query.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center text-muted-foreground py-8">No saved queries yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
