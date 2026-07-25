import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from '../src/lib/prisma.js'

const email = process.env.ADMIN_SEED_EMAIL
const password = process.env.ADMIN_SEED_PASSWORD

if (!email || !password) {
  console.error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env to run the seed script')
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 12)

const admin = await prisma.user.upsert({
  where: { email },
  update: {},
  create: {
    name: 'Admin',
    email,
    passwordHash,
    role: 'admin',
    isActive: true,
  },
})

console.log(`Admin user ready: ${admin.email} (id ${admin.id})`)

await prisma.$disconnect()
