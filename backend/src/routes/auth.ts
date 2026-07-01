import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { sendMail } from '../lib/mailer.js'

const router = Router()

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

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

  const business = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: ownerName,
        email,
        passwordHash,
        role: 'owner',
      },
    })

    const business = await tx.business.create({
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
        businessId: business.id,
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

    return business
  })

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

export default router
