import { Router } from 'express'
import { Prisma } from '@prisma/client'
import type { FieldType } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireApprovedBusiness } from '../middleware/requireApprovedBusiness.js'

const router = Router()

const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/

//Converts "09:30" into a single number (570) minutes since midnight. Why bother? 
// Because comparing times as numbers is far simpler than comparing strings i.e "09:30" < "10:00"
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

const VALID_FIELD_TYPES = ['text', 'textarea', 'dropdown', 'checkbox', 'radio']
const OPTIONS_REQUIRED_TYPES = ['dropdown', 'checkbox', 'radio']

// GET /business
router.get('/business', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
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
      },
    })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    res.status(200).json({ business })
  } catch (err) {
    console.error('Failed to fetch business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PATCH /business
router.patch('/business', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const { name, slug, description, phone, contactEmail, websiteUrl } = req.body ?? {}

  if (name !== undefined || slug !== undefined) {
    return res.status(400).json({ error: 'name and slug cannot be changed after registration' })
  }

  const data = {
    ...(description !== undefined && { description }),
    ...(phone !== undefined && { phone }),
    ...(contactEmail !== undefined && { contactEmail }),
    ...(websiteUrl !== undefined && { websiteUrl }),
  }

  try {
    await prisma.business.update({ where: { id: businessId }, data })
    res.status(200).json({ message: 'Business profile updated successfully.' })
  } catch (err) {
    console.error('Failed to update business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// GET /availability
router.get('/availability', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string

  try {
    const availability = await prisma.availabilityRule.findMany({
      where: { businessId },
      orderBy: { dayOfWeek: 'asc' },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        breakStart: true,
        breakEnd: true,
        slotDurationMinutes: true,
        isAvailable: true,
      },
    })

    res.status(200).json({ availability })
  } catch (err) {
    console.error('Failed to fetch availability', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PUT /availability
router.put('/availability', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const days = req.body

  // The whole week must be submitted as one array of exactly 7 entries.
  if (!Array.isArray(days) || days.length !== 7) {
    return res.status(400).json({ error: 'Exactly 7 day entries are required' })
  }

  // First pass: check each day's basic shape and catch duplicate days,
  // before doing any time-based validation.
  const seenDays = new Set<number>()
  for (const day of days) {
    if (typeof day?.dayOfWeek !== 'number' || !Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      return res.status(400).json({ error: 'dayOfWeek must be an integer between 0 and 6' })
    }
    if (typeof day.isAvailable !== 'boolean') {
      return res.status(400).json({ error: `Day ${day.dayOfWeek}: isAvailable must be true or false` })
    }
    if (seenDays.has(day.dayOfWeek)) {
      return res.status(400).json({ error: `Duplicate dayOfWeek: ${day.dayOfWeek}` })
    }
    seenDays.add(day.dayOfWeek)
  }

  // A week with every day closed can never take a booking.
  if (!days.some((day) => day.isAvailable === true)) {
    return res.status(400).json({ error: 'At least one day must be available' })
  }

  // Second pass: only open days need real hours validated.
  for (const day of days) {
    if (day.isAvailable !== true) continue

    const { dayOfWeek, startTime, endTime, breakStart, breakEnd, slotDurationMinutes } = day

    if (!startTime || !endTime) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: startTime and endTime are required when isAvailable is true` })
    }
    if (!TIME_FORMAT.test(startTime) || !TIME_FORMAT.test(endTime)) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: startTime and endTime must be in HH:MM format` })
    }

    // Convert to minutes-since-midnight so times can be compared as plain numbers.
    const startMinutes = parseTimeToMinutes(startTime)
    const endMinutes = parseTimeToMinutes(endTime)

    if (endMinutes <= startMinutes) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: endTime must be after startTime` })
    }

    // Break is optional, but if either half is sent, both must be, and
    // must sit fully inside the open window.
    let breakMinutes = 0
    if (breakStart != null || breakEnd != null) {
      if (!breakStart || !breakEnd) {
        return res.status(400).json({ error: `Day ${dayOfWeek}: breakStart and breakEnd must both be provided together` })
      }
      if (!TIME_FORMAT.test(breakStart) || !TIME_FORMAT.test(breakEnd)) {
        return res.status(400).json({ error: `Day ${dayOfWeek}: breakStart and breakEnd must be in HH:MM format` })
      }

      const breakStartMinutes = parseTimeToMinutes(breakStart)
      const breakEndMinutes = parseTimeToMinutes(breakEnd)

      if (breakEndMinutes <= breakStartMinutes) {
        return res.status(400).json({ error: `Day ${dayOfWeek}: breakEnd must be after breakStart` })
      }
      if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
        return res.status(400).json({ error: `Day ${dayOfWeek}: break must fall within startTime and endTime` })
      }

      breakMinutes = breakEndMinutes - breakStartMinutes
    }

    if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: slotDurationMinutes is required and must be a positive integer` })
    }

    // A day marked open must actually fit at least one real appointment.
    const availableMinutes = endMinutes - startMinutes - breakMinutes
    if (Math.floor(availableMinutes / slotDurationMinutes) < 1) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: slotDurationMinutes does not fit any whole slot in the available time window` })
    }
  }

  try {
    // All 7 upserts run as one unit — a failure partway through rolls back
    // every day, so the week is never left half-updated.
    await prisma.$transaction(async (tx) => {
      for (const day of days) {
        // Closed days store null for all time fields — no fake placeholder
        // data for future slot-calculation code to trip over.
        const data = day.isAvailable
          ? {
              isAvailable: true,
              startTime: day.startTime,
              endTime: day.endTime,
              breakStart: day.breakStart ?? null,
              breakEnd: day.breakEnd ?? null,
              slotDurationMinutes: day.slotDurationMinutes,
            }
          : {
              isAvailable: false,
              startTime: null,
              endTime: null,
              breakStart: null,
              breakEnd: null,
              slotDurationMinutes: null,
            }

        // businessId_dayOfWeek is the compound key from the @@unique 
        // constraint — updates the existing row for this day if one 
        // exists, creates it otherwise.
        await tx.availabilityRule.upsert({
          where: { businessId_dayOfWeek: { businessId, dayOfWeek: day.dayOfWeek } },
          update: data,
          create: { businessId, dayOfWeek: day.dayOfWeek, ...data },
        })
      }
    })

    res.status(200).json({ message: 'Your availability has been updated' })
  } catch (err) {
    console.error('Failed to update availability', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// GET /form
router.get('/form', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string

  try {
    const form = await prisma.bookingForm.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        bookingWindowDays: true,
        isActive: true,
        formFields: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            label: true,
            fieldType: true,
            isRequired: true,
            isProtected: true,
            displayOrder: true,
            options: true,
          },
        },
      },
    })

    if (!form) {
      return res.status(404).json({ error: 'Booking form not found.' })
    }

    res.status(200).json({
      id: form.id,
      title: form.title,
      description: form.description,
      bookingWindowDays: form.bookingWindowDays,
      isActive: form.isActive,
      fields: form.formFields.map((field) => ({
        id: field.id,
        label: field.label,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        displayOrder: field.displayOrder,
        options: field.options,
        isProtected: field.isProtected,
      })),
    })
  } catch (err) {
    console.error('Failed to fetch booking form', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PUT /form
router.put('/form', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const { title, description, bookingWindowDays } = req.body ?? {}

  if (typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'title is required' })
  }
  if (bookingWindowDays !== undefined && (!Number.isInteger(bookingWindowDays) || bookingWindowDays <= 0)) {
    return res.status(400).json({ error: 'bookingWindowDays must be a positive integer' })
  }

  try {
    const form = await prisma.bookingForm.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } })

    if (!form) {
      return res.status(404).json({ error: 'Booking form not found.' })
    }

    const data = {
      title,
      ...(description !== undefined && { description }),
      ...(bookingWindowDays !== undefined && { bookingWindowDays }),
    }

    await prisma.bookingForm.update({ where: { id: form.id }, data })

    res.status(200).json({ message: 'Form updated successfully.' })
  } catch (err) {
    console.error('Failed to update booking form', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// POST /form/fields
router.post('/form/fields', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const { label, fieldType, isRequired, options } = req.body ?? {}

  if (typeof label !== 'string' || label.trim().length === 0) {
    return res.status(400).json({ error: 'label is required' })
  }
  if (typeof fieldType !== 'string' || !VALID_FIELD_TYPES.includes(fieldType)) {
    return res.status(400).json({ error: 'fieldType must be one of: text, textarea, dropdown, checkbox, radio' })
  }

  let isRequiredValue = false
  if (isRequired !== undefined) {
    if (typeof isRequired !== 'boolean') {
      return res.status(400).json({ error: 'isRequired must be true or false' })
    }
    isRequiredValue = isRequired
  }

  const needsOptions = OPTIONS_REQUIRED_TYPES.includes(fieldType)
  if (needsOptions) {
    if (!Array.isArray(options) || options.length === 0 || !options.every((o: unknown) => typeof o === 'string')) {
      return res.status(400).json({ error: 'options is required and must be a non-empty array of strings for dropdown, checkbox, and radio fields' })
    }
  } else if (options !== undefined && options !== null) {
    return res.status(400).json({ error: 'options must be omitted for text and textarea fields' })
  }

  try {
    const form = await prisma.bookingForm.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } })
    if (!form) {
      return res.status(404).json({ error: 'Booking form not found.' })
    }

    // New fields always append to the end of the form.
    const maxOrder = await prisma.formField.aggregate({
      where: { formId: form.id },
      _max: { displayOrder: true },
    })
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1

    const field = await prisma.formField.create({
      data: {
        formId: form.id,
        label,
        // Already validated against VALID_FIELD_TYPES above; cast narrows the plain
        // string from req.body to Prisma's generated FieldType literal union.
        fieldType: fieldType as FieldType,
        isRequired: isRequiredValue,
        // Never trust a client-supplied isProtected — every created field starts unprotected.
        isProtected: false,
        displayOrder,
        options: needsOptions ? options : null,
      },
      select: { id: true, label: true, fieldType: true, isRequired: true, displayOrder: true, options: true },
    })

    res.status(201).json(field)
  } catch (err) {
    console.error('Failed to create form field', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PATCH /form/fields/:id
router.patch('/form/fields/:id', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const fieldId = Number(req.params.id as string)
  const { label, fieldType, isRequired, options } = req.body ?? {}

  if (!Number.isInteger(fieldId)) {
    return res.status(404).json({ error: 'Field not found.' })
  }

  try {
    // Ownership is enforced via the relation join — a field id alone is never enough.
    const field = await prisma.formField.findFirst({ where: { id: fieldId, form: { businessId } } })

    if (!field) {
      return res.status(404).json({ error: 'Field not found.' })
    }
    if (field.isProtected) {
      return res.status(403).json({ error: 'This field is protected and cannot be edited.' })
    }
    if (fieldType !== undefined) {
      return res.status(400).json({ error: 'fieldType cannot be changed after creation' })
    }

    const data: Prisma.FormFieldUpdateInput = {}

    if (label !== undefined) {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ error: 'label must be a non-empty string' })
      }
      data.label = label
    }

    if (isRequired !== undefined) {
      if (typeof isRequired !== 'boolean') {
        return res.status(400).json({ error: 'isRequired must be true or false' })
      }
      data.isRequired = isRequired
    }

    if (options !== undefined) {
      // Required-ness is checked against the field's existing (immutable) type, not a submitted one.
      const needsOptions = OPTIONS_REQUIRED_TYPES.includes(field.fieldType)
      if (needsOptions) {
        if (!Array.isArray(options) || options.length === 0 || !options.every((o: unknown) => typeof o === 'string')) {
          return res.status(400).json({ error: 'options must be a non-empty array of strings for dropdown, checkbox, and radio fields' })
        }
        data.options = options
      } else if (options !== null) {
        return res.status(400).json({ error: 'options must be omitted or null for text and textarea fields' })
      } else {
        // Nullable Json columns need Prisma's JsonNull sentinel, not a plain `null`,
        // to actually clear the column on update.
        data.options = Prisma.JsonNull
      }
    }

    await prisma.formField.update({ where: { id: field.id }, data })

    res.status(200).json({ message: 'Field updated successfully.' })
  } catch (err) {
    console.error('Failed to update form field', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// DELETE /form/fields/:id
router.delete('/form/fields/:id', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const fieldId = Number(req.params.id as string)

  if (!Number.isInteger(fieldId)) {
    return res.status(404).json({ error: 'Field not found.' })
  }

  try {
    const field = await prisma.formField.findFirst({ where: { id: fieldId, form: { businessId } } })

    if (!field) {
      return res.status(404).json({ error: 'Field not found.' })
    }
    if (field.isProtected) {
      return res.status(403).json({ error: 'This field is protected and cannot be deleted.' })
    }

    // booking_field_values.formFieldId -> form_fields.id is ON DELETE RESTRICT,
    // so any historical answers for this field must go first, in the same transaction.
    await prisma.$transaction(async (tx) => {
      await tx.bookingFieldValue.deleteMany({ where: { formFieldId: field.id } })
      await tx.formField.delete({ where: { id: field.id } })
    })

    res.status(200).json({ message: 'Field deleted successfully.' })
  } catch (err) {
    console.error('Failed to delete form field', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// PUT /form/fields/reorder
router.put('/form/fields/reorder', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const updates = req.body

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'An array of { id, displayOrder } pairs is required' })
  }

  const seenIds = new Set<number>()
  for (const update of updates) {
    if (typeof update?.id !== 'number' || !Number.isInteger(update.id)) {
      return res.status(400).json({ error: 'Each entry must have an integer id' })
    }
    if (typeof update.displayOrder !== 'number' || !Number.isInteger(update.displayOrder)) {
      return res.status(400).json({ error: 'Each entry must have an integer displayOrder' })
    }
    if (seenIds.has(update.id)) {
      return res.status(400).json({ error: `Duplicate id: ${update.id}` })
    }
    seenIds.add(update.id)
  }

  try {
    const form = await prisma.bookingForm.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } })
    if (!form) {
      return res.status(404).json({ error: 'Booking form not found.' })
    }

    const existingFields = await prisma.formField.findMany({ where: { formId: form.id }, select: { id: true } })
    const existingIds = new Set(existingFields.map((f) => f.id))

    // Unrecognized/other-business ids are checked first (specific message), then completeness
    // (only reachable once every submitted id is already confirmed valid).
    for (const id of seenIds) {
      if (!existingIds.has(id)) {
        return res.status(400).json({ error: `Field ${id} does not belong to this form` })
      }
    }
    if (seenIds.size !== existingIds.size) {
      return res.status(400).json({ error: 'The reorder list must include every field on this form' })
    }

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.formField.update({ where: { id: update.id }, data: { displayOrder: update.displayOrder } })
      }
    })

    res.status(200).json({ message: 'Fields reordered successfully.' })
  } catch (err) {
    console.error('Failed to reorder fields', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router
