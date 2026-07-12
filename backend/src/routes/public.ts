import { Router } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

router.get('/businesses/:businessId', async (req, res) => {
  const businessId = req.params.businessId

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, description: true, phone: true, approvalStatus: true, isActive: true },
    })

    if (!business || business.approvalStatus !== 'approved' || !business.isActive) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    res.status(200).json({
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        phone: business.phone,
      },
    })
  } catch (err) {
    console.error('Failed to fetch public business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router
