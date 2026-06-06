// Login and measure performance script
const credentials = {
  email: 'doctordentos@gmail.com',
  password: 'DentOSDoctor123'
}

const BASE_URL = 'http://localhost:3003'

async function login() {
  console.log('Attempting login...')
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  })
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`)
  }
  
  const data = await response.json()
  console.log('Login successful!')
  return data.token || data
}

async function measureWithAuth() {
  let authToken = null
  
  try {
    // Try to login
    const loginResult = await login()
    
    // The response might contain the token directly or in a different format
    if (typeof loginResult === 'string') {
      authToken = loginResult
    } else if (loginResult.token) {
      authToken = loginResult.token
    } else if (loginResult.access_token) {
      authToken = loginResult.access_token
    }
    
    if (!authToken) {
      console.log('Could not extract token from login response:', loginResult)
      throw new Error('No token in login response')
    }
    
    console.log('Auth token obtained')
    
    // Now measure performance with auth
    await measureDashboardStats(authToken)
    await measurePatientsList(authToken)
    
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  }
}

async function measureDashboardStats(authToken) {
  console.log('\n--- Measuring Dashboard Stats API ---')
  
  const measurements = []
  const iterations = 3
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    
    try {
      const response = await fetch(`${BASE_URL}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const duration = Date.now() - start
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      measurements.push({
        iteration: i + 1,
        duration,
        success: true,
        data: {
          appointments: data.today_queue?.length || 0,
          followups: data.followups?.length || 0,
          labCases: data.active_lab_cases || 0
        }
      })
      
      console.log(`  Iteration ${i + 1}: ${duration}ms - ${data.today_queue?.length || 0} appointments`)
      
    } catch (error) {
      const duration = Date.now() - start
      measurements.push({
        iteration: i + 1,
        duration,
        success: false,
        error: error.message
      })
      console.log(`  Iteration ${i + 1}: ${duration}ms - ERROR: ${error.message}`)
    }
    
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // Calculate stats
  const successful = measurements.filter(m => m.success)
  if (successful.length > 0) {
    const avg = successful.reduce((sum, m) => sum + m.duration, 0) / successful.length
    const min = Math.min(...successful.map(m => m.duration))
    const max = Math.max(...successful.map(m => m.duration))
    
    console.log(`\nDashboard Stats Results:`)
    console.log(`  Average: ${avg.toFixed(2)}ms`)
    console.log(`  Min: ${min.toFixed(2)}ms`)
    console.log(`  Max: ${max.toFixed(2)}ms`)
    console.log(`  Success rate: ${successful.length}/${iterations}`)
  }
  
  return measurements
}

async function measurePatientsList(authToken) {
  console.log('\n--- Measuring Patients List API ---')
  
  const measurements = []
  const iterations = 3
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    
    try {
      const response = await fetch(`${BASE_URL}/api/patients`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const duration = Date.now() - start
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      measurements.push({
        iteration: i + 1,
        duration,
        success: true,
        data: {
          patientCount: data.patients?.length || 0
        }
      })
      
      console.log(`  Iteration ${i + 1}: ${duration}ms - ${data.patients?.length || 0} patients`)
      
    } catch (error) {
      const duration = Date.now() - start
      measurements.push({
        iteration: i + 1,
        duration,
        success: false,
        error: error.message
      })
      console.log(`  Iteration ${i + 1}: ${duration}ms - ERROR: ${error.message}`)
    }
    
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // Calculate stats
  const successful = measurements.filter(m => m.success)
  if (successful.length > 0) {
    const avg = successful.reduce((sum, m) => sum + m.duration, 0) / successful.length
    const min = Math.min(...successful.map(m => m.duration))
    const max = Math.max(...successful.map(m => m.duration))
    
    console.log(`\nPatients List Results:`)
    console.log(`  Average: ${avg.toFixed(2)}ms`)
    console.log(`  Min: ${min.toFixed(2)}ms`)
    console.log(`  Max: ${max.toFixed(2)}ms`)
    console.log(`  Success rate: ${successful.length}/${iterations}`)
  }
  
  return measurements
}

// Run the measurements
measureWithAuth()
  .then(() => console.log('\n✅ Measurements complete'))
  .catch(err => {
    console.error('❌ Measurements failed:', err.message)
    process.exit(1)
  })