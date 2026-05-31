import { MongoClient } from 'mongodb'

let client
let db
let isConnected = false

export async function getDb() {
  if (isConnected && db) {
    return db
  }

  if (!client) {
    client = new MongoClient(process.env.MONGO_URL, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
  }

  if (!isConnected) {
    await client.connect()
    isConnected = true
    db = client.db(process.env.DB_NAME || 'dentos_db')
    
    // Handle connection errors
    client.on('error', (err) => {
      console.error('MongoDB client error:', err)
      isConnected = false
    })
    
    client.on('close', () => {
      console.log('MongoDB connection closed')
      isConnected = false
    })
  }

  return db
}

export async function closeDb() {
  if (client && isConnected) {
    await client.close()
    isConnected = false
    db = null
  }
}
