import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Neon serves Postgres over HTTP, not a normal TCP connection, so this adapter is required.
// Import this shared instance instead of creating a new PrismaClient elsewhere.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

export default prisma