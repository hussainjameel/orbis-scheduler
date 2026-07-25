import { Router } from 'express'
import { Prisma } from '@prisma/client'
import type { ApprovalStatus } from '@prisma/client'
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

// GET /stats — deliberately unscoped: admin has platform-wide visibility, not tenant-scoped.
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalBusinesses,
      pendingRegistrations,
      approvedBusinesses,
      rejectedBusinesses,
      suspendedBusinesses,
      totalBookingsLifetime,
      bookingsThisWeek,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { approvalStatus: 'pending' } }),
      prisma.business.count({ where: { approvalStatus: 'approved' } }),
      prisma.business.count({ where: { approvalStatus: 'rejected' } }),
      prisma.business.count({ where: { approvalStatus: 'approved', isActive: false } }),
      prisma.booking.count(),
      // Rolling 7 days, not the current calendar week — see DEVLOG for the reasoning.
      prisma.booking.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ])

    res.status(200).json({
      totalBusinesses,
      pendingRegistrations,
      approvedBusinesses,
      rejectedBusinesses,
      suspendedBusinesses,
      totalBookingsLifetime,
      bookingsThisWeek,
    })
  } catch (err) {
    console.error('Failed to fetch admin stats', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// GET /businesses — unscoped platform-wide list, paginated/filtered/searched.
router.get('/businesses', authenticate, requireAdmin, async (req, res) => {
  const { status, isActive, search, page: pageParam } = req.query

  if (status !== undefined && (typeof status !== 'string' || !['pending', 'approved', 'rejected'].includes(status))) {
    return res.status(400).json({ error: 'status must be one of: pending, approved, rejected' })
  }
  if (isActive !== undefined && isActive !== 'true' && isActive !== 'false') {
    return res.status(400).json({ error: 'isActive must be true or false' })
  }

  let page = 1
  if (pageParam !== undefined) {
    const parsed = Number(pageParam)
    if (!Number.isInteger(parsed) || parsed < 1) {
      return res.status(400).json({ error: 'page must be a positive integer' })
    }
    page = parsed
  }

  const PAGE_SIZE = 25
  const where: Prisma.BusinessWhereInput = {}
  if (typeof status === 'string') {
    where.approvalStatus = status as ApprovalStatus
  }
  if (isActive === 'true' || isActive === 'false') {
    where.isActive = isActive === 'true'
  }
  if (typeof search === 'string' && search.trim().length > 0) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.business.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          approvalStatus: true,
          isActive: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          _count: { select: { bookings: true } },
        },
      }),
      prisma.business.count({ where }),
    ])

    const businesses = rows.map((b) => ({
      id: b.id,
      name: b.name,
      ownerName: b.user.name,
      ownerEmail: b.user.email,
      approvalStatus: b.approvalStatus,
      isActive: b.isActive,
      totalBookings: b._count.bookings,
      createdAt: b.createdAt,
    }))

    res.status(200).json({ businesses, total, page, totalPages: Math.ceil(total / PAGE_SIZE) })
  } catch (err) {
    console.error('Failed to fetch businesses', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// GET /businesses/:id — unscoped: admin can view any business by id.
router.get('/businesses/:id', authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id as string

  try {
    const business = await prisma.business.findUnique({
      where: { id },
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
        user: { select: { name: true, email: true } },
        _count: { select: { bookings: true } },
      },
    })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    const { user, _count, ...rest } = business
    res.status(200).json({ ...rest, owner: { name: user.name, email: user.email }, totalBookings: _count.bookings })
  } catch (err) {
    console.error('Failed to fetch business', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PATCH /businesses/:id/suspend — suspend/activate only apply to approved businesses;
// pending/rejected are governed by the approve/reject endpoints above, not this one.
router.patch('/businesses/:id/suspend', authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id as string

  try {
    const business = await prisma.business.findUnique({ where: { id } })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }
    if (business.approvalStatus !== 'approved') {
      return res.status(400).json({ error: `Only approved businesses can be suspended (current status: ${business.approvalStatus})` })
    }
    if (!business.isActive) {
      return res.status(400).json({ error: 'Business is already suspended' })
    }

    await prisma.business.update({ where: { id }, data: { isActive: false } })

    // No email here, deliberately — logged MVP gap per the use case doc, not this session's job to fix.
    res.status(200).json({ message: 'Business suspended successfully.' })
  } catch (err) {
    console.error('Failed to suspend business', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PATCH /businesses/:id/activate — mirrors /suspend's precondition and no-email pattern.
router.patch('/businesses/:id/activate', authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id as string

  try {
    const business = await prisma.business.findUnique({ where: { id } })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }
    if (business.approvalStatus !== 'approved') {
      return res.status(400).json({ error: `Only approved businesses can be activated (current status: ${business.approvalStatus})` })
    }
    if (business.isActive) {
      return res.status(400).json({ error: 'Business is already active' })
    }

    await prisma.business.update({ where: { id }, data: { isActive: true } })

    res.status(200).json({ message: 'Business activated successfully.' })
  } catch (err) {
    console.error('Failed to activate business', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router