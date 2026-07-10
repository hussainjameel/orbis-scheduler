import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

async function main() {
  const owners = await prisma.user.findMany({
    where: { role: 'owner' },
    include: { businesses: true },
    orderBy: { id: 'asc' },
  })

  console.log('\nUserID | Owner Name       | Email                    | Business Name    | BusinessID')
  console.log('-------|------------------|--------------------------|------------------|------------------------------------')

  for (const owner of owners) {
    const business = owner.businesses[0]
    console.log(
      `${String(owner.id).padEnd(6)} | ${owner.name.padEnd(16)} | ${owner.email.padEnd(24)} | ${(business?.name ?? '—').padEnd(16)} | ${business?.id ?? '—'}`
    )
  }

  console.log(`\nTotal owner users: ${owners.length}\n`)
}

main().then(() => process.exit(0))