// Performance test script for DentOS
// This script makes API calls and measures their performance

const BASE_URL = 'http://localhost:3001'

const performanceResults = {
  apiCalls: [],
  pageLoads: [],
}

function measureApiCall(name, fn) {
  return async () => {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      performanceResults.apiCalls.push({
        name,
        duration,
        success: true,
        timestamp: Date.now(),
      })
      console.log(`✓ ${name}: ${duration.toFixed(2)}ms`)
      return result
    } catch (error) {
      const duration = performance.now() - start
      performanceResults.apiCalls.push({
        name,
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      })
      console.log(`✗ ${name}: ${duration.toFixed(2)}ms - ERROR: ${error.message}`)
      throw error
    }
  }
}

async function testApiPerformance() {
  console.log('Starting DentOS Performance Test...')
  console.log('Make sure the dev server is running on http://localhost:3000')
  console.log('')

  // Test patients API
  const testPatientsList = measureApiCall('GET /api/patients (list)', async () => {
    const response = await fetch(`${BASE_URL}/api/patients`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`  - Returned ${data.patients?.length || 0} patients`)
    return data
  })

  // Test patients API with search
  const testPatientsSearch = measureApiCall('GET /api/patients?q=test', async () => {
    const response = await fetch(`${BASE_URL}/api/patients?q=test`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`  - Returned ${data.patients?.length || 0} patients`)
    return data
  })

  // Test appointments API
  const testAppointments = measureApiCall('GET /api/appointments?date=today', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const response = await fetch(`${BASE_URL}/api/appointments?date=${today}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`  - Returned ${data.appointments?.length || 0} appointments`)
    return data
  })

  // Test dashboard stats API
  const testDashboardStats = measureApiCall('GET /api/dashboard/stats', async () => {
    const response = await fetch(`${BASE_URL}/api/dashboard/stats`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`  - Returned stats for ${data.today_queue?.length || 0} appointments`)
    return data
  })

  // Test lab cases API
  const testLabCases = measureApiCall('GET /api/lab-cases', async () => {
    const response = await fetch(`${BASE_URL}/api/lab-cases`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`  - Returned ${data.lab_cases?.length || 0} lab cases`)
    return data
  })

  // Test vendors API
  const testVendors = measureApiCall('GET /api/vendors', async () => {
    const response = await fetch(`${BASE_URL}/api/vendors`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    console.log(`  - Returned ${data.vendors?.length || 0} vendors`)
    return data
  })

  try {
    await testPatientsList()
    await testPatientsSearch()
    await testAppointments()
    await testDashboardStats()
    await testLabCases()
    await testVendors()
  } catch (error) {
    console.error('Test failed:', error)
  }

  printPerformanceReport()
}

function printPerformanceReport() {
  console.log('\n========== PERFORMANCE REPORT ==========')
  
  console.log('\n--- API CALLS ---')
  console.log(`Total: ${performanceResults.apiCalls.length}`)
  
  const successful = performanceResults.apiCalls.filter(r => r.success)
  const failed = performanceResults.apiCalls.filter(r => !r.success)
  
  console.log(`Successful: ${successful.length}`)
  console.log(`Failed: ${failed.length}`)
  
  if (successful.length > 0) {
    const totalTime = successful.reduce((sum, r) => sum + r.duration, 0)
    const avgTime = totalTime / successful.length
    const maxTime = Math.max(...successful.map(r => r.duration))
    const minTime = Math.min(...successful.map(r => r.duration))
    
    console.log(`Average: ${avgTime.toFixed(2)}ms`)
    console.log(`Min: ${minTime.toFixed(2)}ms`)
    console.log(`Max: ${maxTime.toFixed(2)}ms`)
    
    console.log('\nDetailed results:')
    successful.forEach(r => {
      const status = r.duration > 500 ? '⚠️ SLOW' : r.duration > 200 ? '⚡' : '✓'
      console.log(`  ${status} ${r.name}: ${r.duration.toFixed(2)}ms`)
    })
  }
  
  if (failed.length > 0) {
    console.log('\nFailed calls:')
    failed.forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.error}`)
    })
  }
  
  // Identify bottlenecks
  console.log('\n--- BOTTLENECK ANALYSIS ---')
  const slowCalls = successful.filter(r => r.duration > 500)
  if (slowCalls.length > 0) {
    console.log('Critical bottlenecks (>500ms):')
    slowCalls.forEach(r => {
      console.log(`  🚨 ${r.name}: ${r.duration.toFixed(2)}ms`)
    })
  } else {
    console.log('No critical bottlenecks found (>500ms)')
  }
  
  const mediumCalls = successful.filter(r => r.duration > 200 && r.duration <= 500)
  if (mediumCalls.length > 0) {
    console.log('Medium bottlenecks (>200ms):')
    mediumCalls.forEach(r => {
      console.log(`  ⚠️ ${r.name}: ${r.duration.toFixed(2)}ms`)
    })
  } else {
    console.log('No medium bottlenecks found (>200ms)')
  }
  
  console.log('\n========================================\n')
}

// Run the tests
testApiPerformance().catch(console.error)