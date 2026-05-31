import { setupIndexes } from '../lib/setup-indexes.js'

setupIndexes().then(() => {
  console.log('Index setup completed')
  process.exit(0)
}).catch((error) => {
  console.error('Index setup failed:', error)
  process.exit(1)
})
