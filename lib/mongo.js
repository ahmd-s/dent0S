import { MongoClient } from 'mongodb'

let client = null
let db = null
let isConnected = false
let listenersAttached = false
let _dbName = null

/**
 * Validates MONGO_URL and DB_NAME before the first MongoClient is created.
 * Called inside getDb() only when client is null (cold-start or post-failure).
 * Returns validated { mongoUrl, dbName } — process.env is not read after this.
 */
function validateMongoConfig() {
  const mongoUrl = process.env.MONGO_URL?.trim()
  if (!mongoUrl) {
    throw new Error(
      'MONGO_URL is missing. DentOS cannot start without a MongoDB connection.'
    )
  }

  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction && !process.env.DB_NAME?.trim()) {
    throw new Error('DB_NAME is missing in production.')
  }

  const dbName = process.env.DB_NAME?.trim() || 'dentos_db'
  return { mongoUrl, dbName }
}

function attachListeners(mongoClient) {
  if (listenersAttached) return
  listenersAttached = true

  mongoClient.on('error', (err) => {
    console.error('MongoDB client error:', err)
    isConnected = false
  })

  mongoClient.on('close', () => {
    console.warn('MongoDB connection closed unexpectedly')
    isConnected = false
    db = null
  })
}

function logConnectionFailure(dbName) {
  const env = process.env.NODE_ENV || 'development'
  console.error(`
========================================
MongoDB connection failed.

Environment:
  ${env}

Database:
  ${dbName}

Check:
  - MONGO_URL
  - Atlas credentials
  - Network access
  - Atlas cluster status
========================================`)
}

export async function getDb() {
  if (isConnected && db) return db

  if (!client) {
    const { mongoUrl, dbName } = validateMongoConfig()
    _dbName = dbName
    client = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    attachListeners(client)
  }

  try {
    await client.connect()
    isConnected = true
    db = client.db(_dbName)
  } catch (err) {
    logConnectionFailure(_dbName)
    client = null
    db = null
    isConnected = false
    listenersAttached = false
    _dbName = null
    throw err
  }

  return db
}

export async function closeDb() {
  const currentClient = client
  try {
    if (currentClient) {
      await currentClient.close()
    }
  } finally {
    client = null
    db = null
    isConnected = false
    listenersAttached = false
    _dbName = null
  }
}
