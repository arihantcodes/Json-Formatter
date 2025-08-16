"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  PerformanceTestRunner,
  type PerformanceTestConfig,
  type PerformanceTestResult,
  PerformanceTestStorage,
  type PerformanceMetrics,
  type RequestResult,
} from "@/lib/perfomance";
import {
  Play,
  Square,
  Save,
  Trash2,
  Download,
  TrendingUp,
  Activity,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PerformanceTestingProps {
  className?: string;
}

export function PerformanceTesting({ className }: PerformanceTestingProps) {
  const [runner] = useState(() => new PerformanceTestRunner());
  const [testConfig, setTestConfig] = useState<PerformanceTestConfig>({
    id: crypto.randomUUID(),
    name: "Load Test",
    endpoint: "https://httpbin.org/delay/1",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    testType: "load",
    duration: 60,
    concurrency: 10,
    rampUpTime: 10,
    thresholds: {
      avgResponseTime: 2000,
      p95ResponseTime: 5000,
      errorRate: 5,
      minThroughput: 5,
    },
  });
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentMetrics, setCurrentMetrics] = useState<
    Partial<PerformanceMetrics>
  >({});
  const [testResult, setTestResult] = useState<PerformanceTestResult | null>(
    null
  );
  const [recentResults, setRecentResults] = useState<RequestResult[]>([]);
  const [savedTests, setSavedTests] = useState<PerformanceTestConfig[]>([]);
  const [testHistory, setTestHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("config");
  const { toast } = useToast();

  useEffect(() => {
    setSavedTests(PerformanceTestStorage.getTests());
    setTestHistory(PerformanceTestStorage.getResults());
  }, []);

  useEffect(() => {
    runner.setProgressHandler((progress, metrics) => {
      setProgress(progress);
      setCurrentMetrics(metrics);
    });

    runner.setResultHandler((result) => {
      setRecentResults((prev) => [...prev.slice(-99), result]); // Keep last 100 results
    });
  }, [runner]);

  const handleStartTest = async () => {
    if (isRunning) {
      runner.stop();
      setIsRunning(false);
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setCurrentMetrics({});
    setRecentResults([]);
    setTestResult(null);
    setActiveTab("monitor");

    try {
      const result = await runner.runTest(testConfig);
      setTestResult(result);
      PerformanceTestStorage.saveResult(result);
      setTestHistory(PerformanceTestStorage.getResults());

      toast({
        title: result.passed ? "Test passed" : "Test failed",
        description: result.passed
          ? "All performance thresholds met"
          : `${result.failedThresholds.length} threshold(s) failed`,
        variant: result.passed ? "default" : "destructive",
      });

      setActiveTab("results");
    } catch (error) {
      toast({
        title: "Test failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const handleSaveTest = () => {
    PerformanceTestStorage.saveTest(testConfig);
    setSavedTests(PerformanceTestStorage.getTests());
    toast({
      title: "Test saved",
      description: `Saved "${testConfig.name}"`,
    });
  };

  const handleLoadTest = (config: PerformanceTestConfig) => {
    setTestConfig(config);
    toast({
      title: "Test loaded",
      description: `Loaded "${config.name}"`,
    });
  };

  const handleDeleteTest = (id: string) => {
    PerformanceTestStorage.deleteTest(id);
    setSavedTests(PerformanceTestStorage.getTests());
    toast({
      title: "Test deleted",
      description: "Test configuration removed",
    });
  };

  const exportResults = () => {
    if (!testResult) return;

    const data = JSON.stringify(testResult, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-test-${testResult.config.name}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getTestTypeIcon = (type: string) => {
    switch (type) {
      case "load":
        return <Activity className="w-4 h-4" />;
      case "stress":
        return <TrendingUp className="w-4 h-4" />;
      case "spike":
        return <Zap className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getTestTypeColor = (type: string) => {
    switch (type) {
      case "load":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "stress":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "spike":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      case "volume":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "endurance":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex justify-evenly w-full overflow-x-auto mb-6 space-x-2 sm:grid sm:grid-cols-4 sm:space-x-0">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Configuration</CardTitle>
                <CardDescription>
                  Configure your performance test parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-name">Test Name</Label>
                  <Input
                    id="test-name"
                    value={testConfig.name}
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    value={testConfig.endpoint}
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        endpoint: e.target.value,
                      }))
                    }
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="method">HTTP Method</Label>
                    <Select
                      value={testConfig.method}
                      onValueChange={(value) =>
                        setTestConfig((prev) => ({ ...prev, method: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="test-type">Test Type</Label>
                    <Select
                      value={testConfig.testType}
                      onValueChange={(value: any) =>
                        setTestConfig((prev) => ({ ...prev, testType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="load">Load Test</SelectItem>
                        <SelectItem value="stress">Stress Test</SelectItem>
                        <SelectItem value="spike">Spike Test</SelectItem>
                        <SelectItem value="volume">Volume Test</SelectItem>
                        <SelectItem value="endurance">
                          Endurance Test
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-body">Request Body (JSON)</Label>
                  <Textarea
                    id="request-body"
                    value={testConfig.body || ""}
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        body: e.target.value,
                      }))
                    }
                    placeholder='{"key": "value"}'
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headers">Headers (JSON)</Label>
                  <Textarea
                    id="headers"
                    value={JSON.stringify(testConfig.headers, null, 2)}
                    onChange={(e) => {
                      try {
                        const headers = JSON.parse(e.target.value);
                        setTestConfig((prev) => ({ ...prev, headers }));
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Load Parameters</CardTitle>
                <CardDescription>
                  Configure load testing parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (seconds)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={testConfig.duration}
                      onChange={(e) =>
                        setTestConfig((prev) => ({
                          ...prev,
                          duration: Number.parseInt(e.target.value) || 60,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="concurrency">Concurrent Users</Label>
                    <Input
                      id="concurrency"
                      type="number"
                      value={testConfig.concurrency}
                      onChange={(e) =>
                        setTestConfig((prev) => ({
                          ...prev,
                          concurrency: Number.parseInt(e.target.value) || 10,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ramp-up">Ramp-up Time (seconds)</Label>
                    <Input
                      id="ramp-up"
                      type="number"
                      value={testConfig.rampUpTime || 0}
                      onChange={(e) =>
                        setTestConfig((prev) => ({
                          ...prev,
                          rampUpTime: Number.parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target-rps">Target RPS (optional)</Label>
                    <Input
                      id="target-rps"
                      type="number"
                      value={testConfig.targetRPS || ""}
                      onChange={(e) =>
                        setTestConfig((prev) => ({
                          ...prev,
                          targetRPS:
                            Number.parseInt(e.target.value) || undefined,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-requests">Max Requests (optional)</Label>
                  <Input
                    id="max-requests"
                    type="number"
                    value={testConfig.maxRequests || ""}
                    onChange={(e) =>
                      setTestConfig((prev) => ({
                        ...prev,
                        maxRequests:
                          Number.parseInt(e.target.value) || undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-3">
                  <Label>Performance Thresholds</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="avg-response">
                        Avg Response Time (ms)
                      </Label>
                      <Input
                        id="avg-response"
                        type="number"
                        value={testConfig.thresholds.avgResponseTime}
                        onChange={(e) =>
                          setTestConfig((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              avgResponseTime:
                                Number.parseInt(e.target.value) || 2000,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="p95-response">
                        P95 Response Time (ms)
                      </Label>
                      <Input
                        id="p95-response"
                        type="number"
                        value={testConfig.thresholds.p95ResponseTime}
                        onChange={(e) =>
                          setTestConfig((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              p95ResponseTime:
                                Number.parseInt(e.target.value) || 5000,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="error-rate">Max Error Rate (%)</Label>
                      <Input
                        id="error-rate"
                        type="number"
                        value={testConfig.thresholds.errorRate}
                        onChange={(e) =>
                          setTestConfig((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              errorRate: Number.parseInt(e.target.value) || 5,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="min-throughput">
                        Min Throughput (RPS)
                      </Label>
                      <Input
                        id="min-throughput"
                        type="number"
                        value={testConfig.thresholds.minThroughput}
                        onChange={(e) =>
                          setTestConfig((prev) => ({
                            ...prev,
                            thresholds: {
                              ...prev.thresholds,
                              minThroughput:
                                Number.parseInt(e.target.value) || 5,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleStartTest}
                    disabled={isRunning}
                    className="flex-1"
                  >
                    {isRunning ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop Test
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Test
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleSaveTest}>
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {savedTests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Tests</CardTitle>
                <CardDescription>
                  Load previously saved test configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedTests.map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        {getTestTypeIcon(test.testType)}
                        <div>
                          <div className="font-medium">{test.name}</div>
                          <div className="text-sm text-muted-foreground">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getTestTypeColor(
                                test.testType
                              )}`}
                            >
                              {test.testType}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLoadTest(test)}
                        >
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTest(test.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          {!isRunning && !testResult && (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  No test is currently running. Start a performance test to see real-time monitoring.
                </div>
              </CardContent>
            </Card>
          )}
          {isRunning && (
            <Card>
              <CardHeader>
                <CardTitle>Test Progress</CardTitle>
                <CardDescription>
                  Real-time performance monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {currentMetrics.totalRequests || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Requests
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(currentMetrics.throughput || 0).toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">RPS</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(currentMetrics.avgResponseTime || 0).toFixed(0)}ms
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg Response
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(currentMetrics.errorRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Error Rate
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {recentResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Requests</CardTitle>
                <CardDescription>Latest request results</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {recentResults
                      .slice(-20)
                      .reverse()
                      .map((result) => (
                        <div
                          key={result.id}
                          className="flex items-center justify-between p-2 border rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                result.success ? "default" : "destructive"
                              }
                            >
                              {result.statusCode}
                            </Badge>
                            <span>{result.timestamp.toLocaleTimeString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{result.responseTime}ms</span>
                            <span className="text-muted-foreground">
                              {result.size}B
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {testResult ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Test Results
                        <Badge
                          variant={
                            testResult.passed ? "default" : "destructive"
                          }
                        >
                          {testResult.passed ? "PASSED" : "FAILED"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {testResult.config.name}
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={exportResults}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {testResult.metrics.totalRequests}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Requests
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {testResult.metrics.throughput.toFixed(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">RPS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {testResult.metrics.avgResponseTime.toFixed(0)}ms
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg Response
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {testResult.metrics.errorRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Error Rate
                      </div>
                    </div>
                  </div>

                  {testResult.failedThresholds.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium mb-2 text-destructive">
                        Failed Thresholds
                      </h4>
                      <div className="space-y-1">
                        {testResult.failedThresholds.map((threshold, index) => (
                          <div
                            key={index}
                            className="text-sm text-destructive bg-destructive/10 p-2 rounded"
                          >
                            {threshold}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">
                        Response Time Distribution
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Min:</span>
                          <span>
                            {testResult.metrics.minResponseTime.toFixed(0)}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>50th percentile:</span>
                          <span>
                            {testResult.metrics.p50ResponseTime.toFixed(0)}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>95th percentile:</span>
                          <span>
                            {testResult.metrics.p95ResponseTime.toFixed(0)}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>99th percentile:</span>
                          <span>
                            {testResult.metrics.p99ResponseTime.toFixed(0)}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max:</span>
                          <span>
                            {testResult.metrics.maxResponseTime.toFixed(0)}ms
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Test Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Duration:</span>
                          <span>
                            {formatDuration(testResult.metrics.duration)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Successful:</span>
                          <span className="text-green-600">
                            {testResult.metrics.successfulRequests}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failed:</span>
                          <span className="text-red-600">
                            {testResult.metrics.failedRequests}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Data Transferred:</span>
                          <span>
                            {(
                              testResult.metrics.bytesTransferred / 1024
                            ).toFixed(1)}
                            KB
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {testResult.timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Timeline</CardTitle>
                    <CardDescription>
                      Response time and throughput over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={testResult.timeline}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={(value) =>
                              new Date(value).toLocaleTimeString()
                            }
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) =>
                              new Date(value).toLocaleTimeString()
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="avgResponseTime"
                            stroke="#8884d8"
                            name="Avg Response Time (ms)"
                          />
                          <Line
                            type="monotone"
                            dataKey="rps"
                            stroke="#82ca9d"
                            name="RPS"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  Run a performance test to see results
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Test History</CardTitle>
                  <CardDescription>
                    Previous performance test results
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setTestHistory(PerformanceTestStorage.getResults())
                  }
                >
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {testHistory.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {testHistory.reverse().map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {result.config.name}
                            </span>
                            <Badge
                              variant={
                                result.passed ? "default" : "destructive"
                              }
                            >
                              {result.passed ? "PASSED" : "FAILED"}
                            </Badge>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getTestTypeColor(
                                result.config.testType
                              )}`}
                            >
                              {result.config.testType}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(
                              result.metrics.startTime
                            ).toLocaleString()}{" "}
                            •{result.metrics.totalRequests} requests •
                            {result.metrics.avgResponseTime.toFixed(0)}ms avg •
                            {result.metrics.errorRate.toFixed(1)}% errors
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No test history available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
