// Performance logging for actual measurements
const performanceLog = {
  apiCalls: [],
  dbQueries: [],
  pageLoads: [],
}

export function resetPerformanceLog() {
  performanceLog.apiCalls = []
  performanceLog.dbQueries = []
  performanceLog.pageLoads = []
}

export function logApiCall(route, method, duration, statusCode) {
  performanceLog.apiCalls.push({
    timestamp: Date.now(),
    route,
    method,
    duration,
    statusCode
  })
}

export function logDbQuery(collection, operation, duration) {
  performanceLog.dbQueries.push({
    timestamp: Date.now(),
    collection,
    operation,
    duration
  })
}

export function logPageLoad(page, loadTime, apiCallCount) {
  performanceLog.pageLoads.push({
    timestamp: Date.now(),
    page,
    loadTime,
    apiCallCount
  })
}

export function getPerformanceReport() {
  return {
    apiCalls: {
      total: performanceLog.apiCalls.length,
      byRoute: {},
      averageTime: 0,
      slowCalls: []
    },
    dbQueries: {
      total: performanceLog.dbQueries.length,
      byCollection: {},
      averageTime: 0,
      slowQueries: []
    },
    pageLoads: {
      total: performanceLog.pageLoads.length,
      byPage: {},
      averageTime: 0
    }
  }
}

export function printPerformanceReport() {
  const report = getPerformanceReport()
  
  console.log('\n========== PERFORMANCE REPORT ==========')
  console.log(`Total API Calls: ${report.apiCalls.total}`)
  console.log(`Total DB Queries: ${report.dbQueries.total}`)
  console.log(`Total Page Loads: ${report.pageLoads.total}`)
  console.log('=========================================\n')
  
  return report
}