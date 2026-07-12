import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireApprovedBusiness } from '../middleware/requireApprovedBusiness.js'

const router = Router()

// Original tenant-isolation test route — superseded by GET /owner/business below, kept for reference.
// router.get('/business/:businessId', authenticate, async (req, res) => {
//   const businessId = req.params.businessId as string
//
//   // Only owners can use this route — admin tokens have no businessId at all.
//   if (req.user?.role !== 'owner') {
//     return res.status(403).json({ error: 'Owner access required.' })
//   }
//
//   // Tenant isolation check: the URL's businessId (untrusted, client-supplied)
//   // must match the token's businessId (trusted, set by authenticate.ts from
//   // the verified JWT). If they don't match, this owner is trying to access
//   // a business that isn't theirs — reject regardless of how valid their
//   // own login is.
//   if (businessId !== req.user.businessId) {
//     return res.status(403).json({ error: 'You do not have access to this business.' })
//   }
//
//   try {
//     const business = await prisma.business.findUnique({ where: { id: businessId } })
//
//     // Token was valid and matched, but the business itself no longer exists
//     // (e.g. deleted after the token was issued).
//     if (!business) {
//       return res.status(404).json({ error: 'Business not found.' })
//     }
//
//     res.status(200).json({ business })
//   } catch (err) {
//     console.error('Failed to fetch business', err)
//     res.status(500).json({ error: 'Something went wrong, please try again' })
//   }
// })

router.get('/business', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        phone: true,
        contactEmail: true,
        websiteUrl: true,
        isActive: true,
        approvalStatus: true,
        rejectionReason: true,
        createdAt: true,
      },
    })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    res.status(200).json({ business })
  } catch (err) {
    console.error('Failed to fetch business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

router.patch('/business', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const { name, slug, description, phone, contactEmail, websiteUrl } = req.body ?? {}

  if (name !== undefined || slug !== undefined) {
    return res.status(400).json({ error: 'name and slug cannot be changed after registration' })
  }

  const data = {
    ...(description !== undefined && { description }),
    ...(phone !== undefined && { phone }),
    ...(contactEmail !== undefined && { contactEmail }),
    ...(websiteUrl !== undefined && { websiteUrl }),
  }

  try {
    await prisma.business.update({ where: { id: businessId }, data })
    res.status(200).json({ message: 'Business profile updated successfully.' })
  } catch (err) {
    console.error('Failed to update business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router
