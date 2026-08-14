/**
 * In-process performance counters for API calls, DB queries, page loads and
 * component renders.
 *
 * Every sample used to be appended to a module-scope array that was never
 * trimmed, so a warm server accumulated one object per request forever. Samples
 * now go into fixed-size ring buffers, which keeps memory flat while preserving
 * the recent window that the analysis helpers report on.
 */

const MAX_SAMPLES = 500

/** Fixed-capacity buffer that overwrites its oldest entry once full. */
function createRingBuffer(capacity = MAX_SAMPLES) {
  return { items: [], next: 0, capacity }
}

function push(buffer, item) {
  if (buffer.items.length < buffer.capacity) {
    buffer.items.push(item)
  } else {
    buffer.items[buffer.next] = item
    buffer.next = (buffer.next + 1) % buffer.capacity
  }
  return item
}

const buffers = {
  apiCalls: createRingBuffer(),
  dbQueries: createRingBuffer(),
  pageLoads: createRingBuffer(),
  componentRenders: createRingBuffer(),
}

const isDev = process.env.NODE_ENV === 'development'
const SLOW_DB_MS = 100
const SLOW_API_MS = 500
const SLOW_RENDER_MS = 16

export function resetMetrics() {
  for (const key of Object.keys(buffers)) buffers[key] = createRingBuffer()
}

export function getMetrics() {
  return {
    apiCalls: [...buffers.apiCalls.items],
    dbQueries: [...buffers.dbQueries.items],
    pageLoads: [...buffers.pageLoads.items],
    componentRenders: [...buffers.componentRenders.items],
  }
}

export function trackApiCall(route, method, duration, statusCode, payloadSize = 0) {
  const metric = { timestamp: Date.now(), route, method, duration, statusCode, payloadSize }
  push(buffers.apiCalls, metric)

  // Only slow calls are logged; every-request logging drowned real signal.
  if (isDev && duration > SLOW_API_MS) {
    console.warn(`[PERF] slow API ${method} ${route} — ${duration.toFixed(0)}ms (${statusCode})`)
  }
  return metric
}

export function trackDbQuery(collection, operation, duration, documentCount = 0) {
  const metric = { timestamp: Date.now(), collection, operation, duration, documentCount }
  push(buffers.dbQueries, metric)

  if (isDev && duration > SLOW_DB_MS) {
    console.warn(`[PERF] slow query ${collection}.${operation} — ${duration.toFixed(0)}ms, ${documentCount} docs`)
  }
  return metric
}

export function trackPageLoad(page, loadTime, renderTime, apiCallCount = 0) {
  return push(buffers.pageLoads, { timestamp: Date.now(), page, loadTime, renderTime, apiCallCount })
}

export function trackComponentRender(componentName, renderTime) {
  const metric = push(buffers.componentRenders, { timestamp: Date.now(), componentName, renderTime })
  if (isDev && renderTime > SLOW_RENDER_MS) {
    console.warn(`[PERF] slow render ${componentName} — ${renderTime.toFixed(0)}ms`)
  }
  return metric
}

function summarize(samples, valueOf) {
  if (samples.length === 0) return { count: 0, avg: 0 }
  const total = samples.reduce((sum, s) => sum + valueOf(s), 0)
  return { count: samples.length, avg: total / samples.length }
}

function groupBy(samples, keyOf) {
  const out = {}
  for (const sample of samples) {
    const key = keyOf(sample)
    const bucket = out[key] || (out[key] = { count: 0, totalTime: 0, avgTime: 0 })
    bucket.count++
    bucket.totalTime += sample.duration
  }
  for (const bucket of Object.values(out)) bucket.avgTime = bucket.totalTime / bucket.count
  return out
}

/** Aggregates the retained sample window. */
export function analyzePerformance() {
  const { apiCalls, dbQueries, pageLoads } = getMetrics()
  const api = summarize(apiCalls, m => m.duration)
  const dbq = summarize(dbQueries, m => m.duration)

  return {
    apiCalls: {
      total: api.count,
      averageTime: api.avg,
      slowCalls: apiCalls.filter(m => m.duration > SLOW_API_MS),
      byRoute: groupBy(apiCalls, m => m.route),
    },
    dbQueries: {
      total: dbq.count,
      averageTime: dbq.avg,
      slowQueries: dbQueries.filter(m => m.duration > SLOW_DB_MS),
      byCollection: groupBy(dbQueries, m => m.collection),
    },
    pageLoads: {
      total: pageLoads.length,
      averageLoadTime: summarize(pageLoads, m => m.loadTime).avg,
      averageRenderTime: summarize(pageLoads, m => m.renderTime).avg,
    },
  }
}

export function measureAsync(name, fn) {
  const start = performance.now()
  return fn().then(result => {
    const duration = performance.now() - start
    if (isDev && duration > SLOW_API_MS) console.warn(`[PERF] ${name} took ${duration.toFixed(0)}ms`)
    return result
  })
}

export function measureSync(name, fn) {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  if (isDev && duration > SLOW_RENDER_MS) console.warn(`[PERF] ${name} took ${duration.toFixed(0)}ms`)
  return result
}
