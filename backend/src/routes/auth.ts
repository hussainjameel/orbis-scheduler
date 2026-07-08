import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { sendMail } from '../lib/mailer.js'

const router = Router()

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
// Shared constant so both "wrong password" and "no such user" return the exact same response.
const INVALID_CREDENTIALS = { error: 'Invalid credentials' }

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Appends -2, -3, etc. until a free slug is found. Businesses.slug is unique and used in public booking URLs.
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

// UC4 — Owner registers a new business.
// Creates User + Business + a default BookingForm in one transaction, so a
// registered business is immediately bookable (customers can submit against
// the default Name/Email/Phone form even before the owner customises it).
// No JWT is issued here — the owner can't log in until an admin approves
// the business (see /login's pending/rejected/suspended checks below).
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

  // Pre-check for a fast, clean 409. The transaction's catch block below handles the rare race where two identical emails register at almost the same instant and both pass this check.
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const slug = await generateUniqueSlug(businessName)

  let business
  try {
    // All four processes succeed together as a transaction or none do, prevents a half-created state (e.g. a User with no matching Business) if something fails partway through.
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
    // Catches the race the pre-check above can miss: two near-simultaneous registrations with the same email. 
    // err.meta.modelName (not .target) is how @prisma/adapter-neon reports which table's unique constraint fired.
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

  // Best-effort notifications — per UC4, email failures must never block the registration response. 
  // Each sendMail has its own .catch so one failed email can't fail the others or the request itself.
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

// UC4/UC15 — Login. Blocks pending/rejected/suspended businesses and
// deactivated users, then issues a JWT scoped to the user's role.
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

    // No user and wrong password return the identical response
    if (!user) {
      return res.status(401).json(INVALID_CREDENTIALS)
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return res.status(401).json(INVALID_CREDENTIALS)
    }

    // Checked before the role branch below since it applies to both
    // admins and owners — admin can deactivate any single login without
    // touching a whole business's status.
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated.' })
    }

    let business
    if (user.role === 'owner') {
      // Registration always creates exactly one business per owner. If this is ever missing, the registration invariant broke — treat as a server error, not a normal user-facing case.
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

    // Owner tokens carry businessId so tenant-isolation checks (see
    // owner.ts) can trust it without a DB lookup; admin tokens don't need one.
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

// Sends a reset link if the email exists. Always returns the same response
// either way, and never awaits the email send — both are deliberate so
// neither the response content nor its timing reveals whether an account
// exists (account enumeration prevention).
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body ?? {}

  if (!email) {
    return res.status(400).json({ error: 'email is required' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiresAt },
      })

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      // Not awaited — see comment above the route.
      sendMail({
        to: user.email,
        subject: 'Reset your Orbis Scheduler password',
        text: `We received a request to reset your password. This link expires in 1 hour:\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
      }).catch((err) => console.error('Failed to send password reset email', err))
    }

    res.status(200).json({ message: "If that email exists, we've sent a reset link." })
  } catch (err) {
    console.error('Failed to process forgot-password request', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Consumes a reset token: validates it, updates the password, and clears
// the token fields in one call so the same link can never be used twice.
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body ?? {}

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' })
  }

  if (!PASSWORD_RULE.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' })
  }

  try {
    const user = await prisma.user.findFirst({ where: { resetToken: token } })

    // No match, missing expiry, or expired — all collapse to the same
    // generic message so a bad guess can't reveal which case it was.
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Single update: changing the password and invalidating the token happen atomically,
    // so there's no window where the old token still works after a successful reset.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    })

    res.status(200).json({ message: 'Password updated successfully. You can now log in.' })
  } catch (err) {
    console.error('Failed to process reset-password request', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router