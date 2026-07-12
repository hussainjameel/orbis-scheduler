import type { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma.js'

export async function requireApprovedBusiness(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.businessId) {
    return res.status(403).json({ error: 'Owner access required.' })
  }

  try {
    const business = await prisma.business.findUnique({ where: { id: req.user.businessId } })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    if (business.approvalStatus === 'pending') {
      return res.status(403).json({
        error: 'Your registration is still under review. We will email you once your account is approved.',
      })
    }
    if (business.approvalStatus === 'rejected') {
      return res.status(403).json({
        error: 'Your registration was not approved',
        reason: business.rejectionReason,
      })
    }
    if (!business.isActive) {
      return res.status(403).json({ error: 'Account suspended' })
    }

    next()
  } catch (err) {
    console.error('Failed to verify business approval status', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
}
