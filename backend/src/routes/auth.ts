import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { sendMail } from '../lib/mailer.js'

const router = Router()

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const INVALID_CREDENTIALS = { error: 'Invalid credentials' }

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function generateUniqueSlug(businessName: string) {
  const base = slugify(businessName) || 'business'
  let slug = base
  let suffix = 1
  while (await prisma.business.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${base}-${suffix}`
  }
  return slug
}

router.post('/register', async (req, res) => {
  const { businessName, ownerName, email, password, phone, description, websiteUrl } = req.body ?? {}

  if (!businessName || !ownerName || !email || !password) {
    return res.status(400).json({ error: 'businessName, ownerName, email and password are required' })
  }
  if (!EMAIL_RULE.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' })
  }
  if (!PASSWORD_RULE.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' })
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const slug = await generateUniqueSlug(businessName)

  let business
  try {
    business = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: ownerName,
          email,
          passwordHash,
          role: 'owner',
        },
      })

      const newBusiness = await tx.business.create({
        data: {
          userId: user.id,
          name: businessName,
          slug,
          phone: phone || null,
          description: description || null,
          websiteUrl: websiteUrl || null,
        },
      })

      const form = await tx.bookingForm.create({
        data: {
          businessId: newBusiness.id,
          title: 'Booking Form',
        },
      })

      await tx.formField.createMany({
        data: [
          { formId: form.id, label: 'Name', fieldType: 'text', isRequired: true, displayOrder: 0 },
          { formId: form.id, label: 'Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { formId: form.id, label: 'Phone', fieldType: 'text', isRequired: true, displayOrder: 2 },
        ],
      })

      return newBusiness
    })
  } catch (err) {
    const isEmailConflict =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      err.meta?.modelName === 'User'

    if (isEmailConflict) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' })
    }

    console.error('Failed to create business registration', err)
    return res.status(500).json({ error: 'Something went wrong, please try again' })
  }

  // Best-effort notifications — per UC4, failures here must not block the registration response.
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { email: true } })
  await Promise.all([
    ...admins.map((admin) =>
      sendMail({
        to: admin.email,
        subject: 'New business registration awaiting review',
        text: `${businessName} (${email}) has registered and is awaiting approval.`,
      }).catch((err) => console.error('Failed to notify admin of new registration', err))
    ),
    sendMail({
      to: email,
      subject: 'Registration received — Orbis Scheduler',
      text: `Thanks for registering ${businessName}. An administrator will review your account shortly.`,
    }).catch((err) => console.error('Failed to send registration confirmation email', err)),
  ])

  res.status(201).json({
    message: 'Registration submitted. An administrator will review your account shortly.',
    business: { id: business.id, slug: business.slug, approvalStatus: business.approvalStatus },
  })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { businesses: true },
    })

    if (!user) {
      return res.status(401).json(INVALID_CREDENTIALS)
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return res.status(401).json(INVALID_CREDENTIALS)
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated.' })
    }

    let business
    if (user.role === 'owner') {
      business = user.businesses[0]
      if (!business) {
        console.error(`Owner user ${user.id} has no associated business`)
        return res.status(500).json({ error: 'Something went wrong, please try again' })
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
    }

    const payload =
      user.role === 'owner'
        ? { userId: user.id, role: user.role, businessId: business!.id }
        : { userId: user.id, role: user.role }

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '24h' })

    res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    console.error('Failed to process login', err)
    return res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router
