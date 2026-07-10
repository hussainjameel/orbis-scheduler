import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { sendMail } from '../lib/mailer.js'

const router = Router()

// UC11 — Admin approves a pending business registration.
router.patch('/businesses/:id/approve', authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id as string

  try {
    // Business ans user are related. Includes the related User with business Id so the owner's email is available for the notification below without a second query.
    const business = await prisma.business.findUnique({ where: { id }, include: { user: true } })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }
    // Idempotency guard below prevents double-approval and prevents this route from silently reverting a rejected business back to approved.
    if (business.approvalStatus === 'approved') {
      return res.status(400).json({ error: 'Business is already approved' })
    }

    await prisma.business.update({
      where: { id },
      data: { approvalStatus: 'approved' },
    })

    await sendMail({
      to: business.user.email,
      subject: 'Your business has been approved — Orbis Scheduler',
      text: `Good news! ${business.name} has been approved. You can now log in: ${process.env.FRONTEND_URL}/login`,
    }).catch((err) => console.error('Failed to send business approval email', err))

    res.status(200).json({ message: 'Business approved. Owner has been notified.' })
  } catch (err) {
    console.error('Failed to approve business', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// UC11 — Admin rejects a pending business registration with a reason.
router.patch('/businesses/:id/reject', authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id as string
  const { rejectionReason } = req.body ?? {}

  if (!rejectionReason) {
    return res.status(400).json({ error: 'rejectionReason is required' })
  }

  try {
    const business = await prisma.business.findUnique({ where: { id }, include: { user: true } })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    if (business.approvalStatus === 'rejected') {
      return res.status(400).json({ error: 'Business is already rejected' })
    }

    await prisma.business.update({
      where: { id },
      data: { approvalStatus: 'rejected', rejectionReason },
    })

    await sendMail({
      to: business.user.email,
      subject: 'Update on your Orbis Scheduler registration',
      text: `Unfortunately, ${business.name}'s registration was not approved. Reason: ${rejectionReason}`,
    }).catch((err) => console.error('Failed to send business rejection email', err))

    res.status(200).json({ message: 'Business rejected. Owner has been notified.' })
  } catch (err) {
    console.error('Failed to reject business', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router