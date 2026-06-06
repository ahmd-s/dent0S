// Client-side performance monitoring for DentOS
// This hooks into React components to measure render times and API call times

'use client'

import { useEffect, useRef, useState } from 'react'

// Store performance metrics
const clientMetrics = {
  pageLoads: [],
  apiCalls: [],
  componentRenders: [],
}

// Reset metrics
export function resetClientMetrics() {
  clientMetrics.pageLoads = []
  clientMetrics.apiCalls = []
  clientMetrics.componentRenders = []
}

// Get metrics
export function getClientMetrics() {
  return { ...clientMetrics }
}

// Track page load
export function trackPageLoad(pageName, loadTime, renderTime) {
  const metric = {
    timestamp: Date.now(),
    page: pageName,
    loadTime,
    renderTime,
  }
  clientMetrics.pageLoads.push(metric)
  console.log(`[PERF CLIENT] Page load: ${pageName} - Load: ${loadTime.toFixed(2)}ms - Render: ${renderTime.toFixed(2)}ms`)
  return metric
}

// Track API call
export function trackApiCall(url, method, duration, status) {
  const metric = {
    timestamp: Date.now(),
    url,
    method,
    duration,
    status,
  }
  clientMetrics.apiCalls.push(metric)
  console.log(`[PERF CLIENT] API: ${method} ${url} - ${duration.toFixed(2)}ms - Status: ${status}`)
  return metric
}

// Track component render
export function trackComponentRender(componentName, renderTime) {
  const metric = {
    timestamp: Date.now(),
    componentName,
    renderTime,
  }
  clientMetrics.componentRenders.push(metric)
  if (renderTime > 16) {
    console.warn(`[PERF CLIENT] Slow render: ${componentName} - ${renderTime.toFixed(2)}ms`)
  }
  return metric
}

// Hook to measure page load performance
export function usePagePerformance(pageName) {
  const [loadComplete, setLoadComplete] = useState(false)
  const loadStartTime = useRef(null)
  const renderStartTime = useRef(null)

  useEffect(() => {
    loadStartTime.current = performance.now()
    renderStartTime.current = performance.now()

    return () => {
      const loadTime = performance.now() - loadStartTime.current
      const renderTime = performance.now() - renderStartTime.current
      trackPageLoad(pageName, loadTime, renderTime)
      setLoadComplete(true)
    }
  }, [pageName])

  return { loadComplete }
}

// Hook to measure component render performance
export function useRenderPerformance(componentName) {
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current++
    const renderStart = performance.now()

    return () => {
      const renderTime = performance.now() - renderStart
      if (renderCount.current > 1) { // Skip initial render
        trackComponentRender(componentName, renderTime)
      }
    }
  }, [componentName])

  return renderCount.current
}

// Wrapper for fetch with performance tracking
export async function trackedFetch(url, options = {}) {
  const startTime = performance.now()
  const method = options.method || 'GET'
  
  try {
    const response = await fetch(url, options)
    const duration = performance.now() - startTime
    trackApiCall(url, method, duration, response.status)
    return response
  } catch (error) {
    const duration = performance.now() - startTime
    trackApiCall(url, method, duration, 'ERROR')
    throw error
  }
}

// Performance report for client
export function printClientPerformanceReport() {
  console.log('\n========== CLIENT PERFORMANCE REPORT ==========')
  
  console.log('\n--- PAGE LOADS ---')
  console.log(`Total: ${clientMetrics.pageLoads.length}`)
  if (clientMetrics.pageLoads.length > 0) {
    const avgLoad = clientMetrics.pageLoads.reduce((sum, m) => sum + m.loadTime, 0) / clientMetrics.pageLoads.length
    const avgRender = clientMetrics.pageLoads.reduce((sum, m) => sum + m.renderTime, 0) / clientMetrics.pageLoads.length
    console.log(`Average load time: ${avgLoad.toFixed(2)}ms`)
    console.log(`Average render time: ${avgRender.toFixed(2)}ms`)
    
    clientMetrics.pageLoads.forEach(m => {
      console.log(`  ${m.page}: Load ${m.loadTime.toFixed(2)}ms, Render ${m.renderTime.toFixed(2)}ms`)
    })
  }
  
  console.log('\n--- API CALLS ---')
  console.log(`Total: ${clientMetrics.apiCalls.length}`)
  if (clientMetrics.apiCalls.length > 0) {
    const avgTime = clientMetrics.apiCalls.reduce((sum, m) => sum + m.duration, 0) / clientMetrics.apiCalls.length
    console.log(`Average time: ${avgTime.toFixed(2)}ms`)
    
    const byUrl = {}
    clientMetrics.apiCalls.forEach(m => {
      if (!byUrl[m.url]) byUrl[m.url] = { count: 0, totalTime: 0 }
      byUrl[m.url].count++
      byUrl[m.url].totalTime += m.duration
    })
    
    Object.entries(byUrl).forEach(([url, data]) => {
      console.log(`  ${url}: ${data.count} calls, avg ${(data.totalTime / data.count).toFixed(2)}ms`)
    })
  }
  
  console.log('\n--- COMPONENT RENDERS ---')
  console.log(`Total: ${clientMetrics.componentRenders.length}`)
  if (clientMetrics.componentRenders.length > 0) {
    const avgRender = clientMetrics.componentRenders.reduce((sum, m) => sum + m.renderTime, 0) / clientMetrics.componentRenders.length
    console.log(`Average render time: ${avgRender.toFixed(2)}ms`)
    
    const slowRenders = clientMetrics.componentRenders.filter(m => m.renderTime > 16)
    console.log(`Slow renders (>16ms): ${slowRenders.length}`)
    slowRenders.forEach(m => {
      console.log(`  ${m.componentName}: ${m.renderTime.toFixed(2)}ms`)
    })
  }
  
  console.log('\n=============================================\n')
}