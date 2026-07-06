import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()

router.get('/business/:businessId', authenticate, async (req, res) => {
  const businessId = req.params.businessId as string

  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required.' })
  }

  if (businessId !== req.user.businessId) {
    return res.status(403).json({ error: 'You do not have access to this business.' })
  }

  try {
    const business = await prisma.business.findUnique({ where: { id: businessId } })

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
