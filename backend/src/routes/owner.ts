import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()

router.get('/business/:businessId', authenticate, async (req, res) => {
  const businessId = req.params.businessId as string

  // Only owners can use this route — admin tokens have no businessId at all.
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required.' })
  }

  // Tenant isolation check: the URL's businessId (untrusted, client-supplied)
  // must match the token's businessId (trusted, set by authenticate.ts from
  // the verified JWT). If they don't match, this owner is trying to access
  // a business that isn't theirs — reject regardless of how valid their
  // own login is.
  if (businessId !== req.user.businessId) {
    return res.status(403).json({ error: 'You do not have access to this business.' })
  }

  try {
    const business = await prisma.business.findUnique({ where: { id: businessId } })

    // Token was valid and matched, but the business itself no longer exists
    // (e.g. deleted after the token was issued).
    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    res.status(200).json({ business })
  } catch (err) {
    console.error('Failed to fetch business', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router