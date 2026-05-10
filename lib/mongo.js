import { MongoClient } from 'mongodb'

let client
let db

export async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'dentos_db')
  }
  return db
}
