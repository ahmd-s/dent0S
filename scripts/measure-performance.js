// Performance measurement script
// This measures actual API performance without modifying production code

const BASE_URL = 'http://localhost:3002'
const TEST_ITERATIONS = 3

const measurements = {
  dashboardStats: [],
  patientsList: [],
  patientsSearch: [],
  patientsPagination: [],
}

function measureApiCall(name, fn) {
  return async () => {
    const start = performance.now()
    const apiCallStart = Date.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - start
      const apiCallDuration = Date.now() - apiCallStart
      
      measurements[name].push({
        duration,
        apiCallDuration,
        success: true,
        timestamp: Date.now()
      })
      
      console.log(`✓ ${name}: ${duration.toFixed(2)}ms (API: ${apiCallDuration.toFixed(2)}ms)`)
      return result
    } catch (error) {
      const duration = performance.now() - start
      const apiCallDuration = Date.now() - apiCallStart
      
      measurements[name].push({
        duration,
        apiCallDuration,
        success: false,
        error: error.message,
        timestamp: Date.now()
      })
      
      console.log(`✗ ${name}: ${duration.toFixed(2)}ms - ERROR: ${error.message}`)
      throw error
    }
  }
}

async function measureDashboardStats() {
  console.log('\n--- Measuring Dashboard Stats API ---')
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    await measureApiCall('dashboardStats', async () => {
      const response = await fetch(`${BASE_URL}/api/dashboard/stats`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      console.log(`  - Records: ${data.today_queue?.length || 0} appointments, ${data.followups?.length || 0} followups`)
      return data
    })()
    
    // Wait between iterations
    if (i < TEST_ITERATIONS - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

async function measurePatientsList() {
  console.log('\n--- Measuring Patients List API ---')
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    await measureApiCall('patientsList', async () => {
      const response = await fetch(`${BASE_URL}/api/patients`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      console.log(`  - Records: ${data.patients?.length || 0} patients`)
      return data
    })()
    
    if (i < TEST_ITERATIONS - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

async function measurePatientsSearch() {
  console.log('\n--- Measuring Patients Search API ---')
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    await measureApiCall('patientsSearch', async () => {
      const response = await fetch(`${BASE_URL}/api/patients?q=test`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      console.log(`  - Records: ${data.patients?.length || 0} patients`)
      return data
    })()
    
    if (i < TEST_ITERATIONS - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

async function measurePatientsPagination() {
  console.log('\n--- Measuring Patients Pagination API ---')
  
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    await measureApiCall('patientsPagination', async () => {
      // Test with the new optimized API if available, otherwise old
      const url = `${BASE_URL}/api/patients?page=1&page_size=20`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const patientCount = data.patients?.length || 0
      const total = data.pagination?.total_count || data.patients?.length || 0
      console.log(`  - Page: ${patientCount} patients, Total: ${total}`)
      return data
    })()
    
    if (i < TEST_ITERATIONS - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

function calculateStats(measurementsArray) {
  if (measurementsArray.length === 0) return null
  
  const successful = measurementsArray.filter(m => m.success)
  if (successful.length === 0) return null
  
  const durations = successful.map(m => m.duration)
  const apiDurations = successful.map(m => m.apiCallDuration)
  
  return {
    count: successful.length,
    min: Math.min(...durations),
    max: Math.max(...durations),
    avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    median: durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)],
    apiAvg: apiDurations.reduce((a, b) => a + b, 0) / apiDurations.length,
    stdDev: Math.sqrt(durations.reduce((sq, n) => sq + Math.pow(n - (durations.reduce((a, b) => a + b, 0) / durations.length), 2), 0) / durations.length)
  }
}

function printReport() {
  console.log('\n========== PERFORMANCE MEASUREMENT RESULTS ==========')
  
  Object.keys(measurements).forEach(key => {
    const stats = calculateStats(measurements[key])
    if (stats) {
      console.log(`\n${key.toUpperCase()}:`)
      console.log(`  Iterations: ${stats.count}`)
      console.log(`  Min: ${stats.min.toFixed(2)}ms`)
      console.log(`  Max: ${stats.max.toFixed(2)}ms`)
      console.log(`  Avg: ${stats.avg.toFixed(2)}ms`)
      console.log(`  Median: ${stats.median.toFixed(2)}ms`)
      console.log(`  Std Dev: ${stats.stdDev.toFixed(2)}ms`)
      console.log(`  API Avg: ${stats.apiAvg.toFixed(2)}ms`)
    } else {
      console.log(`\n${key.toUpperCase()}: No successful measurements`)
    }
  })
  
  console.log('\n=======================================================\n')
}

async function runMeasurement() {
  console.log('Starting Performance Measurement...')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Iterations: ${TEST_ITERATIONS}`)
  console.log('Make sure the dev server is running!')
  
  try {
    await measureDashboardStats()
    await measurePatientsList()
    await measurePatientsSearch()
    await measurePatientsPagination()
    
    printReport()
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fs = require('fs')
    fs.writeFileSync(
      `performance-results-${timestamp}.json`,
      JSON.stringify(measurements, null, 2)
    )
    console.log(`Results saved to: performance-results-${timestamp}.json`)
    
  } catch (error) {
    console.error('Measurement failed:', error)
    process.exit(1)
  }
}

runMeasurement()