import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { sendMail } from '../lib/mailer.js'
import { generateSlots } from '../lib/slots.js'
import type { Slot } from '../lib/slots.js'

const router = Router()

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/
// Mirrors auth.ts's EMAIL_RULE exactly — same shape check, same error copy, so the app
// has one consistent standard for "does this look like an email" rather than two.
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseCalendarDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!DATE_FORMAT.test(dateStr)) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  const asDate = new Date(Date.UTC(year!, month! - 1, day!))
  // JS silently rolls invalid dates forward (Feb 30 becomes Mar 2) instead of
  // rejecting them, so the parsed date is checked against what was requested.
  if (asDate.getUTCFullYear() !== year || asDate.getUTCMonth() !== month! - 1 || asDate.getUTCDate() !== day) {
    return null
  }
  return { year: year!, month: month!, day: day! }
}

// Returns public profile info for an approved, active business.
router.get('/businesses/:businessId', async (req, res) => {
  const businessId = req.params.businessId

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        approvalStatus: true,
        isActive: true,
        availabilityRules: { select: { dayOfWeek: true, isAvailable: true } },
        bookingForms: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            title: true,
            description: true,
            bookingWindowDays: true,
            formFields: {
              orderBy: { displayOrder: 'asc' },
              // isProtected is included so the client can reliably identify the
              // always-present, never-renameable Name/Email fields (registration seeds
              // exactly these two as protected) without guessing off their label alone.
              select: { id: true, label: true, fieldType: true, isRequired: true, displayOrder: true, options: true, isProtected: true },
            },
          },
        },
      },
    })

    // Not found, not approved, and suspended all return the same 404, so a customer can't tell them apart.
    if (!business || business.approvalStatus !== 'approved' || !business.isActive) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    const form = business.bookingForms[0]

    res.status(200).json({
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        phone: business.phone,
        // Weekly open/closed pattern only — day-of-week granularity is enough to dim
        // closed days on the calendar. Actual bookable times for a specific date still
        // come exclusively from GET /public/slots, never derived from this.
        availability: business.availabilityRules.map((rule) => ({
          dayOfWeek: rule.dayOfWeek,
          isAvailable: rule.isAvailable,
        })),
        form: form
          ? {
              id: form.id,
              title: form.title,
              description: form.description,
              bookingWindowDays: form.bookingWindowDays,
              fields: form.formFields,
            }
          : null,
      },
    })
  } catch (err) {
    console.error('Failed to fetch public business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Returns bookable time slots for a business on a given date.
router.get('/slots', async (req, res) => {
  const { businessId, date } = req.query

  if (typeof businessId !== 'string' || !businessId || typeof date !== 'string' || !date) {
    return res.status(400).json({ error: 'businessId and date are required' })
  }

  const parsedDate = parseCalendarDate(date)
  if (!parsedDate) {
    return res.status(400).json({ error: 'date must be a valid date in YYYY-MM-DD format' })
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, approvalStatus: true, isActive: true },
    })

    if (!business || business.approvalStatus !== 'approved' || !business.isActive) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    const jsDay = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay()
    const dayOfWeek = (jsDay + 6) % 7 // JS: 0=Sunday..6=Saturday -> project: 0=Monday..6=Sunday

    const rule = await prisma.availabilityRule.findUnique({
      where: { businessId_dayOfWeek: { businessId, dayOfWeek } },
    })

    // No rule, a closed day, or incomplete data all mean nothing is bookable, not a server error.
    if (!rule || !rule.isAvailable || !rule.startTime || !rule.endTime || !rule.slotDurationMinutes) {
      return res.status(200).json({ date, slotDurationMinutes: null, slots: [] })
    }

    const bookingDateForQuery = new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day))
    // Only pending and approved bookings hold a slot. Rejected and cancelled ones free it up.
    const existingBookings = await prisma.booking.findMany({
      where: { businessId, bookingDate: bookingDateForQuery, status: { in: ['pending', 'approved'] } },
      select: { bookingTime: true },
    })
    const bookedTimes = new Set(existingBookings.map((b) => b.bookingTime))

    const slots = generateSlots({
      startTime: rule.startTime,
      endTime: rule.endTime,
      breakStart: rule.breakStart,
      breakEnd: rule.breakEnd,
      slotDurationMinutes: rule.slotDurationMinutes,
      bookedTimes,
      date: parsedDate,
    })

    res.status(200).json({ date, slotDurationMinutes: rule.slotDurationMinutes, slots })
  } catch (err) {
    console.error('Failed to fetch slots', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Validates and creates a customer booking.
router.post('/bookings', async (req, res) => {
  const { businessId, formId, bookingDate, bookingTime, customerName, customerEmail, customerPhone, fieldValues } = req.body ?? {}

  if (
    !businessId || typeof businessId !== 'string' ||
    formId === undefined || formId === null || formId === '' ||
    !bookingDate || typeof bookingDate !== 'string' ||
    !bookingTime || typeof bookingTime !== 'string' ||
    !customerName || typeof customerName !== 'string' ||
    !customerEmail || typeof customerEmail !== 'string'
  ) {
    return res.status(400).json({ error: 'businessId, formId, bookingDate, bookingTime, customerName and customerEmail are required' })
  }

  if (!EMAIL_RULE.test(customerEmail)) {
    return res.status(400).json({ error: 'Invalid email format' })
  }

  const parsedDate = parseCalendarDate(bookingDate)
  if (!parsedDate) {
    return res.status(400).json({ error: 'bookingDate must be a valid date in YYYY-MM-DD format' })
  }

  const formIdNum = Number(formId)
  if (!Number.isInteger(formIdNum)) {
    return res.status(400).json({ error: 'formId must be an integer' })
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, approvalStatus: true, isActive: true, user: { select: { email: true } } },
    })

    if (!business || business.approvalStatus !== 'approved' || !business.isActive) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    const form = await prisma.bookingForm.findFirst({ where: { businessId, isActive: true } })

    if (!form || form.id !== formIdNum) {
      return res.status(404).json({ error: 'Booking form not found.' })
    }

    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const bookingDateUTC = Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)
    const daysDiff = Math.round((bookingDateUTC - todayUTC) / 86400000)

    // The window runs from today through bookingWindowDays ahead. A past date is rejected
    // here, not treated as the slot-taken case below.
    if (daysDiff < 0 || daysDiff > form.bookingWindowDays) {
      return res.status(400).json({ error: 'bookingDate is outside the allowed booking window' })
    }

    // Recomputes availability instead of trusting what the client last saw, since it may be
    // stale. Any unavailable result, for any reason, returns the same 409 below.
    const jsDay = new Date(bookingDateUTC).getUTCDay()
    const dayOfWeek = (jsDay + 6) % 7
    const rule = await prisma.availabilityRule.findUnique({ where: { businessId_dayOfWeek: { businessId, dayOfWeek } } })

    let slots: Slot[] = []
    if (rule && rule.isAvailable && rule.startTime && rule.endTime && rule.slotDurationMinutes) {
      const bookingDateForQuery = new Date(bookingDateUTC)
      const existingBookings = await prisma.booking.findMany({
        where: { businessId, bookingDate: bookingDateForQuery, status: { in: ['pending', 'approved'] } },
        select: { bookingTime: true },
      })
      const bookedTimes = new Set(existingBookings.map((b) => b.bookingTime))
      slots = generateSlots({
        startTime: rule.startTime,
        endTime: rule.endTime,
        breakStart: rule.breakStart,
        breakEnd: rule.breakEnd,
        slotDurationMinutes: rule.slotDurationMinutes,
        bookedTimes,
        date: parsedDate,
      })
    }

    const matchingSlot = slots.find((s) => s.time === bookingTime)
    if (!matchingSlot || !matchingSlot.available) {
      return res.status(409).json({ error: 'This slot was just taken. Please select another time.' })
    }

    // Three separate checks: required fields, valid options, then unknown field ids. The order
    // only decides which error wins when more than one fails.
    const fields = await prisma.formField.findMany({ where: { formId: form.id } })
    const submitted: Array<{ formFieldId: number; value: string }> = Array.isArray(fieldValues)
      ? fieldValues.filter(
          (fv: unknown): fv is { formFieldId: number; value: string } =>
            typeof (fv as { formFieldId?: unknown })?.formFieldId === 'number' &&
            typeof (fv as { value?: unknown })?.value === 'string'
        )
      : []
    const valueByFieldId = new Map(submitted.map((fv) => [fv.formFieldId, fv.value]))

    for (const field of fields) {
      if (field.isRequired) {
        const value = valueByFieldId.get(field.id)
        if (!value || value.trim().length === 0) {
          return res.status(400).json({ error: `${field.label} is required` })
        }
      }
    }

    const OPTIONS_REQUIRED_TYPES = ['dropdown', 'checkbox', 'radio']
    for (const field of fields) {
      if (!OPTIONS_REQUIRED_TYPES.includes(field.fieldType)) continue
      const value = valueByFieldId.get(field.id)
      if (!value || value.trim().length === 0) continue
      const options = Array.isArray(field.options) ? field.options : []
      if (!options.includes(value)) {
        return res.status(400).json({ error: `${field.label} must be one of the provided options` })
      }
    }

    const validFieldIds = new Set(fields.map((f) => f.id))
    for (const fv of submitted) {
      if (!validFieldIds.has(fv.formFieldId)) {
        return res.status(400).json({ error: `Field ${fv.formFieldId} does not belong to this form` })
      }
    }

    // The checks above are optimistic; two requests can both pass before either writes. A
    // unique index only allows one active booking per business, date, and time, so the
    // second insert fails and is caught below as the same 409.
    let booking
    try {
      booking = await prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: {
            businessId,
            formId: form.id,
            customerName,
            customerEmail,
            customerPhone: customerPhone || null,
            bookingDate: new Date(bookingDateUTC),
            bookingTime,
            status: 'pending',
          },
        })

        if (submitted.length > 0) {
          await tx.bookingFieldValue.createMany({
            data: submitted.map((fv) => ({ bookingId: created.id, formFieldId: fv.formFieldId, value: fv.value })),
          })
        }

        return created
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ error: 'This slot was just taken. Please select another time.' })
      }
      throw err
    }

    // Both emails are sent without blocking the response if one fails.
    await Promise.all([
      sendMail({
        to: customerEmail,
        subject: `Booking request received — ${business.name}`,
        text: `Thanks for your booking request with ${business.name} on ${bookingDate} at ${bookingTime}. You'll receive another email once it's reviewed.`,
      }).catch((err) => console.error('Failed to send booking confirmation email', err)),
      sendMail({
        to: business.user.email,
        subject: `New booking request — ${bookingDate} ${bookingTime}`,
        text: `${customerName} (${customerEmail}) requested a booking on ${bookingDate} at ${bookingTime}. Log in to review it.`,
      }).catch((err) => console.error('Failed to notify business owner of new booking', err)),
    ])

    res.status(201).json({
      id: booking.id,
      status: booking.status,
      bookingDate,
      bookingTime,
      message: "Booking request submitted. You'll receive a confirmation email once it's reviewed.",
    })
  } catch (err) {
    console.error('Failed to create booking', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router
