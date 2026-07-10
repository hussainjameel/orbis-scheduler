import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

// Edit this array with the exact user IDs you want to delete.
const userIdsToDelete = [1, 2, 3] // Replace with actual user IDs

async function main() {
  const businesses = await prisma.business.findMany({
    where: { userId: { in: userIdsToDelete } },
  })
  const businessIds = businesses.map((b) => b.id)

  const forms = await prisma.bookingForm.findMany({
    where: { businessId: { in: businessIds } },
  })
  const formIds = forms.map((f) => f.id)

  const deletedFields = await prisma.formField.deleteMany({ where: { formId: { in: formIds } } })
  const deletedForms = await prisma.bookingForm.deleteMany({ where: { id: { in: formIds } } })
  const deletedBusinesses = await prisma.business.deleteMany({ where: { id: { in: businessIds } } })
  const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: userIdsToDelete } } })

  console.log(`Deleted: ${deletedFields.count} form fields, ${deletedForms.count} booking forms, ${deletedBusinesses.count} businesses, ${deletedUsers.count} users`)
}

main().then(() => process.exit(0))