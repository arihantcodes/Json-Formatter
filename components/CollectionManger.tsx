"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Folder,
  Plus,
  Search,
  Download,
  Upload,
  Clipboard,
  Trash2,
  Settings,
  Play,
  Globe,
  ChevronRight,
  ChevronDown,
  FileText,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  CollectionManager,
  type RequestCollection,
  type CollectionRequest,
  type Environment,
  type CollectionFolder,
} from "@/lib/collection"

interface CollectionManagerProps {
  onRequestSelected: (request: CollectionRequest) => void
  className?: string
}

export function CollectionManagerComponent({ onRequestSelected, className }: CollectionManagerProps) {
  const [collections, setCollections] = useState<RequestCollection[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newEnvironmentName, setNewEnvironmentName] = useState("")
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)

  const { toast } = useToast()

  useEffect(() => {
    setCollections(CollectionManager.getCollections())
    setEnvironments(CollectionManager.getEnvironments())
    setActiveEnvironment(CollectionManager.getActiveEnvironment())
  }, [])

  const createCollection = useCallback(() => {
    if (!newCollectionName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a collection name",
        variant: "destructive",
      })
      return
    }

    const collection = CollectionManager.saveCollection({
      name: newCollectionName.trim(),
      description: "",
      folders: [],
      requests: [],
      variables: [],
    })

    setCollections(CollectionManager.getCollections())
    setNewCollectionName("")

    toast({
      title: "Collection created",
      description: `"${collection.name}" has been created`,
    })
  }, [newCollectionName, toast])

  const deleteCollection = useCallback(
    (id: string, name: string) => {
      if (confirm(`Delete collection "${name}" and all its requests?`)) {
        CollectionManager.deleteCollection(id)
        setCollections(CollectionManager.getCollections())

        toast({
          title: "Collection deleted",
          description: `"${name}" has been deleted`,
        })
      }
    },
    [toast],
  )

  const duplicateCollection = useCallback(
    (id: string) => {
      const duplicate = CollectionManager.duplicateCollection(id)
      if (duplicate) {
        setCollections(CollectionManager.getCollections())

        toast({
          title: "Collection duplicated",
          description: `"${duplicate.name}" has been created`,
        })
      }
    },
    [toast],
  )

  const createEnvironment = useCallback(() => {
    if (!newEnvironmentName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter an environment name",
        variant: "destructive",
      })
      return
    }

    const environment = CollectionManager.saveEnvironment({
      name: newEnvironmentName.trim(),
      variables: [],
      isActive: false,
    })

    setEnvironments(CollectionManager.getEnvironments())
    setNewEnvironmentName("")

    toast({
      title: "Environment created",
      description: `"${environment.name}" has been created`,
    })
  }, [newEnvironmentName, toast])

  const setActiveEnv = useCallback(
    (id: string) => {
      CollectionManager.setActiveEnvironment(id)
      setEnvironments(CollectionManager.getEnvironments())
      setActiveEnvironment(CollectionManager.getActiveEnvironment())

      const env = environments.find((e) => e.id === id)
      toast({
        title: "Environment activated",
        description: `"${env?.name}" is now active`,
      })
    },
    [environments, toast],
  )

  const exportCollection = useCallback(
    (id: string, name: string) => {
      const jsonData = CollectionManager.exportCollection(id)
      if (jsonData) {
        const blob = new Blob([jsonData], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`
        a.click()
        URL.revokeObjectURL(url)

        toast({
          title: "Collection exported",
          description: `"${name}" has been exported`,
        })
      }
    },
    [toast],
  )

  const importCollection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const collection = CollectionManager.importCollection(content)

        if (collection) {
          setCollections(CollectionManager.getCollections())
          toast({
            title: "Collection imported",
            description: `"${collection.name}" has been imported`,
          })
        } else {
          toast({
            title: "Import failed",
            description: "Invalid collection file format",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
      event.target.value = ""
    },
    [toast],
  )

  const toggleCollection = useCallback((id: string) => {
    setExpandedCollections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const filteredCollections = collections.filter(
    (collection) =>
      collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.requests.some(
        (req) =>
          req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          req.url.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  )

  const renderRequest = (request: CollectionRequest, collectionId: string) => (
    <motion.div
      key={request.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer group"
      onClick={() => onRequestSelected(request)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge variant="outline" className="text-xs">
          {request.method}
        </Badge>
        <span className="text-sm truncate">{request.name}</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
          <Play className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation()
            CollectionManager.deleteRequest(collectionId, request.id)
            setCollections(CollectionManager.getCollections())
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  )

  const renderFolder = (folder: CollectionFolder, collection: RequestCollection) => {
    const isExpanded = expandedFolders.has(folder.id)
    const folderRequests = collection.requests.filter((req) => req.folderId === folder.id)

    return (
      <div key={folder.id} className="ml-4">
        <div
          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
          onClick={() => toggleFolder(folder.id)}
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{folder.name}</span>
          <Badge variant="secondary" className="text-xs">
            {folderRequests.length}
          </Badge>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="ml-4"
            >
              {folderRequests.map((request) => renderRequest(request, collection.id))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const renderCollection = (collection: RequestCollection) => {
    const isExpanded = expandedCollections.has(collection.id)
    const rootRequests = collection.requests.filter((req) => !req.folderId)

    return (
      <Card key={collection.id} className="mb-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 cursor-pointer flex-1"
              onClick={() => toggleCollection(collection.id)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{collection.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {collection.requests.length} requests • {collection.folders.length} folders
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => exportCollection(collection.id, collection.name)}
                className="h-6 w-6 p-0"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => duplicateCollection(collection.id)}
                className="h-6 w-6 p-0"
              >
                <Clipboard className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteCollection(collection.id, collection.name)}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {collection.folders.map((folder) => renderFolder(folder, collection))}
                  {rootRequests.map((request) => renderRequest(request, collection.id))}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    )
  }

  return (
    <div className={className}>
      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Request Collections</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
                    <Upload className="h-3 w-3 mr-1" />
                    Import
                  </Button>
                  <input id="import-file" type="file" accept=".json" onChange={importCollection} className="hidden" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search collections and requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-8"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="New collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="h-8"
                  onKeyDown={(e) => e.key === "Enter" && createCollection()}
                />
                <Button size="sm" onClick={createCollection} disabled={!newCollectionName.trim()}>
                  <Plus className="h-3 w-3 mr-1" />
                  Create
                </Button>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {filteredCollections.length > 0 ? (
                    filteredCollections.map(renderCollection)
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No collections found</p>
                      <p className="text-xs">Create a collection to organize your API requests</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environments" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Environment Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeEnvironment && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                    <span className="font-medium text-sm">{activeEnvironment.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeEnvironment.variables.filter((v) => v.enabled).length} variables enabled
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="New environment name"
                  value={newEnvironmentName}
                  onChange={(e) => setNewEnvironmentName(e.target.value)}
                  className="h-8"
                  onKeyDown={(e) => e.key === "Enter" && createEnvironment()}
                />
                <Button size="sm" onClick={createEnvironment} disabled={!newEnvironmentName.trim()}>
                  <Plus className="h-3 w-3 mr-1" />
                  Create
                </Button>
              </div>

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {environments.map((environment) => (
                    <motion.div
                      key={environment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{environment.name}</span>
                          {environment.isActive && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{environment.variables.length} variables</p>
                      </div>
                      <div className="flex gap-1">
                        {!environment.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveEnv(environment.id)}
                            className="h-7 px-2"
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Delete environment "${environment.name}"?`)) {
                              CollectionManager.deleteEnvironment(environment.id)
                              setEnvironments(CollectionManager.getEnvironments())
                            }
                          }}
                          className="h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
