/**
 * CLI wrapper for seed script.
 * Usage: cd app && npx tsx scripts/seed.ts
 */
import 'dotenv/config'
import { seedDatabase } from '../src/lib/seed'

seedDatabase()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
