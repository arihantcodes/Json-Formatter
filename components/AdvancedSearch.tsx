"use client"

import { useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Copy, History, Trash2, BookOpen, Target, Filter, Key, Hash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { JsonSearcher, SearchHistory, type SearchResult, type SearchOptions } from "@/lib/search"

interface AdvancedSearchProps {
  data: any
  onResultSelect?: (result: SearchResult) => void
  className?: string
}

export function AdvancedSearch({ data, onResultSelect, className }: AdvancedSearchProps) {
  const [query, setQuery] = useState("")
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    searchKeys: true,
    searchValues: true,
    maxResults: 100,
  })
  const [isSearching, setIsSearching] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(SearchHistory.getHistory())

  const { toast } = useToast()

  const searchResults = useMemo(() => {
    if (!query.trim() || !data) return []

    try {
      setIsSearching(true)
      const results = JsonSearcher.search(data, query, searchOptions)
      return results
    } catch (error) {
      console.error("Search error:", error)
      return []
    } finally {
      setIsSearching(false)
    }
  }, [data, query, searchOptions])

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery.trim()) {
      SearchHistory.addToHistory(searchQuery)
      setSearchHistory(SearchHistory.getHistory())
    }
  }, [])

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onResultSelect?.(result)

      toast({
        title: "Result selected",
        description: `Navigated to ${JsonSearcher.formatPath(result.path)}`,
      })
    },
    [onResultSelect, toast],
  )

  const copyPath = useCallback(
    async (path: string[]) => {
      try {
        const pathString = JsonSearcher.formatPath(path)
        await navigator.clipboard.writeText(pathString)

        toast({
          title: "Path copied",
          description: "JSONPath copied to clipboard",
        })
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Unable to copy path",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const clearHistory = useCallback(() => {
    SearchHistory.clearHistory()
    setSearchHistory([])

    toast({
      title: "History cleared",
      description: "Search history has been cleared",
    })
  }, [toast])

  const updateSearchOptions = useCallback((updates: Partial<SearchOptions>) => {
    setSearchOptions((prev) => ({ ...prev, ...updates }))
  }, [])

  const getResultIcon = (result: SearchResult) => {
    switch (result.matchType) {
      case "key":
        return <Key className="h-3 w-3 text-blue-600" />
      case "value":
        return <Hash className="h-3 w-3 text-green-600" />
      case "path":
        return <Target className="h-3 w-3 text-purple-600" />
      default:
        return <Search className="h-3 w-3" />
    }
  }

  const getResultTypeColor = (type: string) => {
    switch (type) {
      case "key":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
      case "value":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
      case "path":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
      default:
        return "bg-muted"
    }
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Advanced Search</span>
            {searchResults.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {searchResults.length} results
              </Badge>
            )}
          </div>

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="h-8 px-2 bg-transparent"
            >
              <History className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowOptions(!showOptions)}
              className="h-8 px-2 bg-transparent"
            >
              <Filter className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search JSON data or use JSONPath (e.g., $.users[*].name)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch(query)
                }
              }}
              className="flex-1"
            />
            <Button onClick={() => handleSearch(query)} disabled={!query.trim() || isSearching}>
              <Search className="h-3 w-3 mr-1" />
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Search History
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearHistory}
                        className="h-6 px-2 text-xs bg-transparent"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {searchHistory.length > 0 ? (
                      <div className="space-y-1">
                        {searchHistory.slice(0, 10).map((historyQuery, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSearch(historyQuery)}
                            className="w-full justify-start h-7 px-2 text-xs font-mono"
                          >
                            {historyQuery}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No search history yet</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Search Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="case-sensitive"
                            checked={searchOptions.caseSensitive}
                            onCheckedChange={(checked) => updateSearchOptions({ caseSensitive: checked })}
                          />
                          <Label htmlFor="case-sensitive" className="text-xs">
                            Case sensitive
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="whole-word"
                            checked={searchOptions.wholeWord}
                            onCheckedChange={(checked) => updateSearchOptions({ wholeWord: checked })}
                          />
                          <Label htmlFor="whole-word" className="text-xs">
                            Whole word
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="regex"
                            checked={searchOptions.regex}
                            onCheckedChange={(checked) => updateSearchOptions({ regex: checked })}
                          />
                          <Label htmlFor="regex" className="text-xs">
                            Regular expression
                          </Label>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="search-keys"
                            checked={searchOptions.searchKeys}
                            onCheckedChange={(checked) => updateSearchOptions({ searchKeys: checked })}
                          />
                          <Label htmlFor="search-keys" className="text-xs">
                            Search in keys
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="search-values"
                            checked={searchOptions.searchValues}
                            onCheckedChange={(checked) => updateSearchOptions({ searchValues: checked })}
                          />
                          <Label htmlFor="search-values" className="text-xs">
                            Search in values
                          </Label>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="max-results" className="text-xs">
                            Max results: {searchOptions.maxResults}
                          </Label>
                          <input
                            id="max-results"
                            type="range"
                            min="10"
                            max="500"
                            step="10"
                            value={searchOptions.maxResults}
                            onChange={(e) => updateSearchOptions({ maxResults: Number.parseInt(e.target.value) })}
                            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {query && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Search Results
                {searchResults.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {searchResults.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchResults.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {searchResults.map((result, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getResultIcon(result)}
                              <code className="text-xs font-mono bg-background px-1 py-0.5 rounded truncate">
                                {JsonSearcher.formatPath(result.path)}
                              </code>
                              <Badge variant="outline" className={`text-xs ${getResultTypeColor(result.matchType)}`}>
                                {result.matchType}
                              </Badge>
                            </div>

                            <div className="text-sm">
                              <span className="text-muted-foreground">Match: </span>
                              <code className="bg-background px-1 py-0.5 rounded text-xs">
                                {result.matchText.length > 50
                                  ? `${result.matchText.substring(0, 50)}...`
                                  : result.matchText}
                              </code>
                            </div>

                            {result.context && (
                              <div className="text-xs text-muted-foreground mt-1">
                                <span>Context: </span>
                                <span className="font-mono">{result.context}</span>
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyPath(result.path)
                            }}
                            className="h-7 px-2"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{query.trim() ? "No results found" : "Enter a search query to find data"}</p>
                  <p className="text-xs mt-1">
                    Try JSONPath queries like <code className="bg-muted px-1 rounded">$.users[*].name</code> or simple
                    text search
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
