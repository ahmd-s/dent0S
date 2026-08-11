// Performance monitoring utility for DentOS
// This file tracks API response times, database query times, and page load metrics

const performanceMetrics = {
  apiCalls: [],
  dbQueries: [],
  pageLoads: [],
  componentRenders: [],
}

// Reset metrics (call between tests)
export function resetMetrics() {
  performanceMetrics.apiCalls = []
  performanceMetrics.dbQueries = []
  performanceMetrics.pageLoads = []
  performanceMetrics.componentRenders = []
}

// Get all metrics
export function getMetrics() {
  return {
    apiCalls: performanceMetrics.apiCalls,
    dbQueries: performanceMetrics.dbQueries,
    pageLoads: performanceMetrics.pageLoads,
    componentRenders: performanceMetrics.componentRenders,
  }
}

const isDev = process.env.NODE_ENV === 'development'

// Track API call
export function trackApiCall(route, method, duration, statusCode, payloadSize = 0) {
  const metric = {
    timestamp: Date.now(),
    route,
    method,
    duration,
    statusCode,
    payloadSize,
  }
  performanceMetrics.apiCalls.push(metric)
  
  if (isDev) {
    console.log(`[PERF] API ${method} ${route} - ${duration.toFixed(2)}ms - Status: ${statusCode} - Payload: ${(payloadSize / 1024).toFixed(2)}KB`)
  }
  
  return metric
}

// Track database query
export function trackDbQuery(collection, operation, duration, documentCount = 0) {
  const metric = {
    timestamp: Date.now(),
    collection,
    operation,
    duration,
    documentCount,
  }
  performanceMetrics.dbQueries.push(metric)
  
  if (isDev) {
    if (duration > 100) {
      console.warn(`[PERF] SLOW DB QUERY: ${collection}.${operation} - ${duration.toFixed(2)}ms - Documents: ${documentCount}`)
    } else {
      console.log(`[PERF] DB ${collection}.${operation} - ${duration.toFixed(2)}ms - Documents: ${documentCount}`)
    }
  }
  
  return metric
}

// Track page load
export function trackPageLoad(page, loadTime, renderTime, apiCallCount = 0) {
  const metric = {
    timestamp: Date.now(),
    page,
    loadTime,
    renderTime,
    apiCallCount,
  }
  performanceMetrics.pageLoads.push(metric)
  
  if (isDev) {
    console.log(`[PERF] PAGE LOAD: ${page} - Total: ${loadTime.toFixed(2)}ms - Render: ${renderTime.toFixed(2)}ms - API Calls: ${apiCallCount}`)
  }
  
  return metric
}

// Track component render
export function trackComponentRender(componentName, renderTime) {
  const metric = {
    timestamp: Date.now(),
    componentName,
    renderTime,
  }
  performanceMetrics.componentRenders.push(metric)
  
  if (isDev && renderTime > 16) {
    console.warn(`[PERF] SLOW RENDER: ${componentName} - ${renderTime.toFixed(2)}ms`)
  }
  
  return metric
}

// Performance analysis helpers
export function analyzePerformance() {
  const metrics = getMetrics()
  
  const analysis = {
    apiCalls: {
      total: metrics.apiCalls.length,
      averageTime: metrics.apiCalls.length > 0 ? metrics.apiCalls.reduce((sum, m) => sum + m.duration, 0) / metrics.apiCalls.length : 0,
      slowCalls: metrics.apiCalls.filter(m => m.duration > 500),
      byRoute: {},
    },
    dbQueries: {
      total: metrics.dbQueries.length,
      averageTime: metrics.dbQueries.length > 0 ? metrics.dbQueries.reduce((sum, m) => sum + m.duration, 0) / metrics.dbQueries.length : 0,
      slowQueries: metrics.dbQueries.filter(m => m.duration > 100),
      byCollection: {},
    },
    pageLoads: {
      total: metrics.pageLoads.length,
      averageLoadTime: metrics.pageLoads.length > 0 ? metrics.pageLoads.reduce((sum, m) => sum + m.loadTime, 0) / metrics.pageLoads.length : 0,
      averageRenderTime: metrics.pageLoads.length > 0 ? metrics.pageLoads.reduce((sum, m) => sum + m.renderTime, 0) / metrics.pageLoads.length : 0,
    },
  }
  
  // Group API calls by route
  metrics.apiCalls.forEach(m => {
    if (!analysis.apiCalls.byRoute[m.route]) {
      analysis.apiCalls.byRoute[m.route] = { count: 0, totalTime: 0, avgTime: 0 }
    }
    analysis.apiCalls.byRoute[m.route].count++
    analysis.apiCalls.byRoute[m.route].totalTime += m.duration
  })
  
  Object.keys(analysis.apiCalls.byRoute).forEach(route => {
    const data = analysis.apiCalls.byRoute[route]
    data.avgTime = data.totalTime / data.count
  })
  
  // Group DB queries by collection
  metrics.dbQueries.forEach(m => {
    if (!analysis.dbQueries.byCollection[m.collection]) {
      analysis.dbQueries.byCollection[m.collection] = { count: 0, totalTime: 0, avgTime: 0 }
    }
    analysis.dbQueries.byCollection[m.collection].count++
    analysis.dbQueries.byCollection[m.collection].totalTime += m.duration
  })
  
  Object.keys(analysis.dbQueries.byCollection).forEach(collection => {
    const data = analysis.dbQueries.byCollection[collection]
    data.avgTime = data.totalTime / data.count
  })
  
  return analysis
}

// Print performance report
export function printPerformanceReport() {
  const analysis = analyzePerformance()
  
  console.log('\n========== PERFORMANCE REPORT ==========')
  console.log('\n--- API CALLS ---')
  console.log(`Total: ${analysis.apiCalls.total}`)
  console.log(`Average: ${analysis.apiCalls.averageTime.toFixed(2)}ms`)
  console.log(`Slow calls (>500ms): ${analysis.apiCalls.slowCalls.length}`)
  console.log('\nBy route:')
  Object.entries(analysis.apiCalls.byRoute).forEach(([route, data]) => {
    console.log(`  ${route}: ${data.count} calls, avg ${data.avgTime.toFixed(2)}ms`)
  })
  
  console.log('\n--- DATABASE QUERIES ---')
  console.log(`Total: ${analysis.dbQueries.total}`)
  console.log(`Average: ${analysis.dbQueries.averageTime.toFixed(2)}ms`)
  console.log(`Slow queries (>100ms): ${analysis.dbQueries.slowQueries.length}`)
  console.log('\nBy collection:')
  Object.entries(analysis.dbQueries.byCollection).forEach(([collection, data]) => {
    console.log(`  ${collection}: ${data.count} queries, avg ${data.avgTime.toFixed(2)}ms`)
  })
  
  console.log('\n--- PAGE LOADS ---')
  console.log(`Total: ${analysis.pageLoads.total}`)
  console.log(`Average load time: ${analysis.pageLoads.averageLoadTime.toFixed(2)}ms`)
  console.log(`Average render time: ${analysis.pageLoads.averageRenderTime.toFixed(2)}ms`)
  
  console.log('\n========================================\n')
}

// Wrapper for measuring async function performance
export function measureAsync(name, fn) {
  const start = performance.now()
  return fn().then(result => {
    const duration = performance.now() - start
    if (isDev) console.log(`[PERF] ${name} took ${duration.toFixed(2)}ms`)
    return result
  })
}

// Wrapper for measuring sync function performance
export function measureSync(name, fn) {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  if (isDev) console.log(`[PERF] ${name} took ${duration.toFixed(2)}ms`)
  return result
}