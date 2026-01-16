export interface PerformanceTestConfig {
    id: string
    name: string
    endpoint: string
    method: string
    headers: Record<string, string>
    body?: string
    testType: "load" | "stress" | "spike" | "volume" | "endurance"
    duration: number // in seconds
    concurrency: number
    rampUpTime?: number // in seconds
    targetRPS?: number // requests per second
    maxRequests?: number
    thresholds: {
      avgResponseTime: number // ms
      p95ResponseTime: number // ms
      errorRate: number // percentage
      minThroughput: number // requests per second
    }
  }
  
  export interface PerformanceMetrics {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    avgResponseTime: number
    minResponseTime: number
    maxResponseTime: number
    p50ResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    throughput: number // requests per second
    errorRate: number // percentage
    bytesTransferred: number
    startTime: Date
    endTime?: Date
    duration: number // actual duration in ms
  }
  
  export interface RequestResult {
    id: string
    timestamp: Date
    responseTime: number
    statusCode: number
    success: boolean
    error?: string
    size: number
  }
  
  export interface PerformanceTestResult {
    config: PerformanceTestConfig
    metrics: PerformanceMetrics
    requests: RequestResult[]
    timeline: Array<{
      timestamp: Date
      activeRequests: number
      rps: number
      avgResponseTime: number
      errorRate: number
    }>
    passed: boolean
    failedThresholds: string[]
  }
  
  export class PerformanceTestRunner {
    private isRunning = false
    private shouldStop = false
    private activeRequests = 0
    private results: RequestResult[] = []
    private timeline: PerformanceTestResult["timeline"] = []
    private onProgress: (progress: number, metrics: Partial<PerformanceMetrics>) => void = () => {}
    private onResult: (result: RequestResult) => void = () => {}
  
    setProgressHandler(handler: (progress: number, metrics: Partial<PerformanceMetrics>) => void) {
      this.onProgress = handler
    }
  
    setResultHandler(handler: (result: RequestResult) => void) {
      this.onResult = handler
    }
  
    async runTest(config: PerformanceTestConfig): Promise<PerformanceTestResult> {
      if (this.isRunning) {
        throw new Error("Test is already running")
      }
  
      this.isRunning = true
      this.shouldStop = false
      this.activeRequests = 0
      this.results = []
      this.timeline = []
  
      const startTime = new Date()
      const endTime = new Date(startTime.getTime() + config.duration * 1000)
  
      try {
        // Start timeline tracking
        const timelineInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(timelineInterval)
            return
          }
  
          const recentResults = this.results.filter(
            (r) => r.timestamp.getTime() > Date.now() - 5000, // Last 5 seconds
          )
  
          const rps = recentResults.length / 5
          const avgResponseTime =
            recentResults.length > 0
              ? recentResults.reduce((sum, r) => sum + r.responseTime, 0) / recentResults.length
              : 0
          const errorRate =
            recentResults.length > 0 ? (recentResults.filter((r) => !r.success).length / recentResults.length) * 100 : 0
  
          this.timeline.push({
            timestamp: new Date(),
            activeRequests: this.activeRequests,
            rps,
            avgResponseTime,
            errorRate,
          })
  
          // Report progress
          const progress = Math.min(100, ((Date.now() - startTime.getTime()) / (config.duration * 1000)) * 100)
          this.onProgress(progress, {
            totalRequests: this.results.length,
            successfulRequests: this.results.filter((r) => r.success).length,
            failedRequests: this.results.filter((r) => !r.success).length,
            avgResponseTime,
            throughput: rps,
            errorRate,
          })
        }, 1000)
  
        // Execute test based on type
        switch (config.testType) {
          case "load":
            await this.runLoadTest(config, startTime, endTime)
            break
          case "stress":
            await this.runStressTest(config, startTime, endTime)
            break
          case "spike":
            await this.runSpikeTest(config, startTime, endTime)
            break
          case "volume":
            await this.runVolumeTest(config, startTime, endTime)
            break
          case "endurance":
            await this.runEnduranceTest(config, startTime, endTime)
            break
        }
  
        // Wait for all active requests to complete
        while (this.activeRequests > 0 && !this.shouldStop) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
  
        clearInterval(timelineInterval)
      } finally {
        this.isRunning = false
      }
  
      const actualEndTime = new Date()
      const metrics = this.calculateMetrics(startTime, actualEndTime)
      const result: PerformanceTestResult = {
        config,
        metrics,
        requests: this.results,
        timeline: this.timeline,
        passed: this.evaluateThresholds(config.thresholds, metrics),
        failedThresholds: this.getFailedThresholds(config.thresholds, metrics),
      }
  
      return result
    }
  
    stop() {
      this.shouldStop = true
    }
  
    private async runLoadTest(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      const rampUpDuration = config.rampUpTime || 0
      const steadyStateDuration = config.duration - rampUpDuration
  
      // Ramp-up phase
      if (rampUpDuration > 0) {
        const rampUpEnd = new Date(startTime.getTime() + rampUpDuration * 1000)
        await this.rampUpRequests(config, startTime, rampUpEnd)
      }
  
      // Steady state phase
      const steadyStateStart = new Date(startTime.getTime() + rampUpDuration * 1000)
      const steadyStateEnd = new Date(steadyStateStart.getTime() + steadyStateDuration * 1000)
      await this.maintainConcurrency(config, steadyStateStart, steadyStateEnd)
    }
  
    private async runStressTest(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      // Gradually increase load beyond normal capacity
      const phases = 5
      const phaseDuration = config.duration / phases
  
      for (let phase = 1; phase <= phases && !this.shouldStop; phase++) {
        const phaseStart = new Date(startTime.getTime() + (phase - 1) * phaseDuration * 1000)
        const phaseEnd = new Date(phaseStart.getTime() + phaseDuration * 1000)
        const phaseConcurrency = Math.floor(config.concurrency * phase * 0.5)
  
        await this.maintainConcurrency({ ...config, concurrency: phaseConcurrency }, phaseStart, phaseEnd)
      }
    }
  
    private async runSpikeTest(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      const normalLoad = Math.floor(config.concurrency * 0.3)
      const spikeLoad = config.concurrency
      const spikeDuration = Math.min(30, config.duration * 0.2) // 20% of total time or 30s max
  
      // Normal load phase 1
      const phase1End = new Date(startTime.getTime() + (config.duration - spikeDuration) * 500)
      await this.maintainConcurrency({ ...config, concurrency: normalLoad }, startTime, phase1End)
  
      // Spike phase
      const spikeEnd = new Date(phase1End.getTime() + spikeDuration * 1000)
      await this.maintainConcurrency({ ...config, concurrency: spikeLoad }, phase1End, spikeEnd)
  
      // Normal load phase 2
      await this.maintainConcurrency({ ...config, concurrency: normalLoad }, spikeEnd, endTime)
    }
  
    private async runVolumeTest(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      // High volume of data with normal concurrency
      await this.maintainConcurrency(config, startTime, endTime)
    }
  
    private async runEnduranceTest(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      // Sustained load over extended period
      await this.maintainConcurrency(config, startTime, endTime)
    }
  
    private async rampUpRequests(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      const duration = endTime.getTime() - startTime.getTime()
      const interval = duration / config.concurrency
  
      for (let i = 0; i < config.concurrency && !this.shouldStop; i++) {
        setTimeout(() => {
          if (!this.shouldStop) {
            this.startRequestLoop(config, endTime)
          }
        }, i * interval)
      }
    }
  
    private async maintainConcurrency(config: PerformanceTestConfig, startTime: Date, endTime: Date) {
      const promises: Promise<void>[] = []
  
      for (let i = 0; i < config.concurrency; i++) {
        promises.push(this.startRequestLoop(config, endTime))
      }
  
      await Promise.all(promises)
    }
  
    private async startRequestLoop(config: PerformanceTestConfig, endTime: Date): Promise<void> {
      while (Date.now() < endTime.getTime() && !this.shouldStop) {
        if (config.maxRequests && this.results.length >= config.maxRequests) {
          break
        }
  
        await this.executeRequest(config)
  
        // Add delay if target RPS is specified
        if (config.targetRPS) {
          const delay = (1000 / config.targetRPS) * config.concurrency
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }
  
    private async executeRequest(config: PerformanceTestConfig): Promise<void> {
      const requestId = crypto.randomUUID()
      const startTime = Date.now()
  
      this.activeRequests++
  
      try {
        const response = await fetch(config.endpoint, {
          method: config.method,
          headers: config.headers,
          body: config.body,
        })
  
        const endTime = Date.now()
        const responseTime = endTime - startTime
        const responseText = await response.text()
        const size = new Blob([responseText]).size
  
        const result: RequestResult = {
          id: requestId,
          timestamp: new Date(startTime),
          responseTime,
          statusCode: response.status,
          success: response.ok,
          size,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        }
  
        this.results.push(result)
        this.onResult(result)
      } catch (error) {
        const endTime = Date.now()
        const responseTime = endTime - startTime
  
        const result: RequestResult = {
          id: requestId,
          timestamp: new Date(startTime),
          responseTime,
          statusCode: 0,
          success: false,
          size: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        }
  
        this.results.push(result)
        this.onResult(result)
      } finally {
        this.activeRequests--
      }
    }
  
    private calculateMetrics(startTime: Date, endTime: Date): PerformanceMetrics {
      const duration = endTime.getTime() - startTime.getTime()
      const successfulRequests = this.results.filter((r) => r.success)
      const failedRequests = this.results.filter((r) => !r.success)
  
      const responseTimes = this.results.map((r) => r.responseTime).sort((a, b) => a - b)
      const totalBytes = this.results.reduce((sum, r) => sum + r.size, 0)
  
      return {
        totalRequests: this.results.length,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        avgResponseTime:
          responseTimes.length > 0 ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length : 0,
        minResponseTime: responseTimes.length > 0 ? responseTimes[0] : 0,
        maxResponseTime: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
        p50ResponseTime: this.getPercentile(responseTimes, 50),
        p95ResponseTime: this.getPercentile(responseTimes, 95),
        p99ResponseTime: this.getPercentile(responseTimes, 99),
        throughput: this.results.length / (duration / 1000),
        errorRate: this.results.length > 0 ? (failedRequests.length / this.results.length) * 100 : 0,
        bytesTransferred: totalBytes,
        startTime,
        endTime,
        duration,
      }
    }
  
    private getPercentile(sortedArray: number[], percentile: number): number {
      if (sortedArray.length === 0) return 0
      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
      return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
    }
  
    private evaluateThresholds(thresholds: PerformanceTestConfig["thresholds"], metrics: PerformanceMetrics): boolean {
      return (
        metrics.avgResponseTime <= thresholds.avgResponseTime &&
        metrics.p95ResponseTime <= thresholds.p95ResponseTime &&
        metrics.errorRate <= thresholds.errorRate &&
        metrics.throughput >= thresholds.minThroughput
      )
    }
  
    private getFailedThresholds(thresholds: PerformanceTestConfig["thresholds"], metrics: PerformanceMetrics): string[] {
      const failed: string[] = []
  
      if (metrics.avgResponseTime > thresholds.avgResponseTime) {
        failed.push(`Average response time: ${metrics.avgResponseTime.toFixed(2)}ms > ${thresholds.avgResponseTime}ms`)
      }
  
      if (metrics.p95ResponseTime > thresholds.p95ResponseTime) {
        failed.push(
          `95th percentile response time: ${metrics.p95ResponseTime.toFixed(2)}ms > ${thresholds.p95ResponseTime}ms`,
        )
      }
  
      if (metrics.errorRate > thresholds.errorRate) {
        failed.push(`Error rate: ${metrics.errorRate.toFixed(2)}% > ${thresholds.errorRate}%`)
      }
  
      if (metrics.throughput < thresholds.minThroughput) {
        failed.push(`Throughput: ${metrics.throughput.toFixed(2)} RPS < ${thresholds.minThroughput} RPS`)
      }
  
      return failed
    }
  
    isTestRunning(): boolean {
      return this.isRunning
    }
  }
  
  // Performance test storage
  export class PerformanceTestStorage {
    private static STORAGE_KEY = "performance_tests"
    private static RESULTS_KEY = "performance_results"
  
    static saveTest(config: PerformanceTestConfig): void {
      const tests = this.getTests()
      const existingIndex = tests.findIndex((t) => t.id === config.id)
  
      if (existingIndex >= 0) {
        tests[existingIndex] = config
      } else {
        tests.push(config)
      }
  
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tests))
    }
  
    static getTests(): PerformanceTestConfig[] {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }
  
    static deleteTest(id: string): void {
      const tests = this.getTests().filter((t) => t.id !== id)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tests))
    }
  
    static saveResult(result: PerformanceTestResult): void {
      const results = this.getResults()
      results.push({
        ...result,
        metrics: {
          ...result.metrics,
          startTime: result.metrics.startTime.toISOString(),
          endTime: result.metrics.endTime?.toISOString(),
        },
      })
  
      // Keep only last 50 results
      if (results.length > 50) {
        results.splice(0, results.length - 50)
      }
  
      localStorage.setItem(this.RESULTS_KEY, JSON.stringify(results))
    }
  
    static getResults(): any[] {
      try {
        const stored = localStorage.getItem(this.RESULTS_KEY)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }
  
    static clearResults(): void {
      localStorage.removeItem(this.RESULTS_KEY)
    }
  }
  
