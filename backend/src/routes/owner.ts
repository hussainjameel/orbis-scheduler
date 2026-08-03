import { Router } from 'express'
import { Prisma } from '@prisma/client'
import type { FieldType, BookingStatus } from '@prisma/client'
import prisma from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireApprovedBusiness } from '../middleware/requireApprovedBusiness.js'
import { sendMail } from '../lib/mailer.js'

const router = Router()

const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/

// Minutes-since-midnight — lets start/end/break times compare as plain numbers instead of strings.
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

const VALID_FIELD_TYPES = ['text', 'textarea', 'dropdown', 'checkbox', 'radio']
const OPTIONS_REQUIRED_TYPES = ['dropdown', 'checkbox', 'radio']

// Returns the current business's profile.
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
        user: { select: { name: true, email: true } },
      },
    })

    if (!business) {
      return res.status(404).json({ error: 'Business not found.' })
    }

    const { user, ...rest } = business
    res.status(200).json({ business: { ...rest, owner: user } })
  } catch (err) {
    console.error('Failed to fetch business profile', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Updates editable profile fields. Name and slug are fixed after registration.
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

// Returns the business's weekly availability.
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

// Replaces the full week of availability in one call.
router.put('/availability', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const days = req.body

  // Must submit the whole week as one array of exactly 7 entries.
  if (!Array.isArray(days) || days.length !== 7) {
    return res.status(400).json({ error: 'Exactly 7 day entries are required' })
  }

  // First pass checks each day's shape and catches duplicates before any time validation.
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

  // Second pass validates hours, but only for days marked open.
  for (const day of days) {
    if (day.isAvailable !== true) continue

    const { dayOfWeek, startTime, endTime, breakStart, breakEnd, slotDurationMinutes } = day

    if (!startTime || !endTime) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: startTime and endTime are required when isAvailable is true` })
    }
    if (!TIME_FORMAT.test(startTime) || !TIME_FORMAT.test(endTime)) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: startTime and endTime must be in HH:MM format` })
    }

    const startMinutes = parseTimeToMinutes(startTime)
    const endMinutes = parseTimeToMinutes(endTime)

    if (endMinutes <= startMinutes) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: endTime must be after startTime` })
    }

    // A break is optional, but if one side is sent both must be, and both must fall inside the open window.
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

    // A day marked open must fit at least one real appointment.
    const availableMinutes = endMinutes - startMinutes - breakMinutes
    if (Math.floor(availableMinutes / slotDurationMinutes) < 1) {
      return res.status(400).json({ error: `Day ${dayOfWeek}: slotDurationMinutes does not fit any whole slot in the available time window` })
    }
  }

  try {
    // All 7 upserts run in one transaction, so a failure partway through can't leave the week half-updated.
    await prisma.$transaction(async (tx) => {
      for (const day of days) {
        // Closed days store null for every time field instead of placeholder values.
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

        // businessId_dayOfWeek is the compound unique key, so this updates the day's row if one exists, or creates it.
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

// Returns the booking form and its fields.
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

// Updates the form's title, description, and booking window.
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

// Adds a new field to the booking form.
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
        // fieldType was already checked against VALID_FIELD_TYPES above, so this cast is safe.
        fieldType: fieldType as FieldType,
        isRequired: isRequiredValue,
        // isProtected is never read from the request. Every new field starts unprotected.
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

// Updates a non-protected field's label, required flag, or options.
router.patch('/form/fields/:id', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const fieldId = Number(req.params.id as string)
  const { label, fieldType, isRequired, options } = req.body ?? {}

  if (!Number.isInteger(fieldId)) {
    return res.status(404).json({ error: 'Field not found.' })
  }

  try {
    // Joins through the form to confirm this field belongs to the caller's business.
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
      // Whether options are required is based on the field's existing type, since fieldType can't change.
      const needsOptions = OPTIONS_REQUIRED_TYPES.includes(field.fieldType)
      if (needsOptions) {
        if (!Array.isArray(options) || options.length === 0 || !options.every((o: unknown) => typeof o === 'string')) {
          return res.status(400).json({ error: 'options must be a non-empty array of strings for dropdown, checkbox, and radio fields' })
        }
        data.options = options
      } else if (options !== null) {
        return res.status(400).json({ error: 'options must be omitted or null for text and textarea fields' })
      } else {
        // Prisma needs its JsonNull sentinel here, not a plain null, or the column won't actually clear.
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

// Deletes a non-protected field and its past answers.
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

    // The database won't let a field be deleted while old answers still reference it, so those go first in the same transaction.
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

// Reorders all fields on the form in one call.
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

    // Unknown or other-business ids are checked before completeness, so an invalid id gets a specific error.
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

const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled']

// Lists this business's bookings, paginated and filterable.
router.get('/bookings', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const { status, search, page: pageParam } = req.query

  if (status !== undefined && (typeof status !== 'string' || !BOOKING_STATUSES.includes(status))) {
    return res.status(400).json({ error: 'status must be one of: pending, approved, rejected, cancelled' })
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

  // Shared with countsWhere below, so a search term narrows both the list and the pill counts identically.
  const searchFilter: Prisma.BookingWhereInput =
    typeof search === 'string' && search.trim().length > 0
      ? {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerEmail: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}

  const where: Prisma.BookingWhereInput = { businessId, ...searchFilter }
  if (typeof status === 'string') {
    where.status = status as BookingStatus
  }

  // Deliberately omits the status filter — the pills for inactive statuses need their real counts, not 0.
  const countsWhere: Prisma.BookingWhereInput = { businessId, ...searchFilter }

  try {
    const [bookings, total, statusGroups] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          bookingDate: true,
          bookingTime: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.booking.count({ where }),
      prisma.booking.groupBy({
        by: ['status'],
        where: countsWhere,
        _count: { status: true },
      }),
    ])

    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
    for (const group of statusGroups) {
      counts[group.status] = group._count.status
    }
    const all = counts.pending + counts.approved + counts.rejected + counts.cancelled

    res.status(200).json({
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      counts: { ...counts, all },
    })
  } catch (err) {
    console.error('Failed to fetch bookings', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Returns full detail for one booking.
router.get('/bookings/:id', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const bookingId = Number(req.params.id as string)

  if (!Number.isInteger(bookingId)) {
    return res.status(404).json({ error: 'Booking not found.' })
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        bookingDate: true,
        bookingTime: true,
        status: true,
        ownerNotes: true,
        createdAt: true,
        updatedAt: true,
        fieldValues: {
          orderBy: { formField: { displayOrder: 'asc' } },
          select: {
            value: true,
            formField: { select: { label: true, fieldType: true, options: true } },
          },
        },
      },
    })

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' })
    }

    const { fieldValues, ...rest } = booking
    res.status(200).json({
      ...rest,
      fieldValues: fieldValues.map((fv) => ({
        label: fv.formField.label,
        value: fv.value,
        fieldType: fv.formField.fieldType,
        options: fv.formField.options,
      })),
    })
  } catch (err) {
    console.error('Failed to fetch booking', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Approves a pending booking and notifies the customer.
router.patch('/bookings/:id/approve', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const bookingId = Number(req.params.id as string)
  const { ownerNotes } = req.body ?? {}

  if (!Number.isInteger(bookingId)) {
    return res.status(404).json({ error: 'Booking not found.' })
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: { business: { select: { name: true } } },
    })

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' })
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: `Only pending bookings can be approved (current status: ${booking.status})` })
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'approved', ...(ownerNotes !== undefined && { ownerNotes }) },
    })

    const bookingDateStr = booking.bookingDate.toISOString().slice(0, 10)
    await sendMail({
      to: booking.customerEmail,
      subject: `Your booking has been approved — ${booking.business.name}`,
      text: `Good news! Your booking with ${booking.business.name} on ${bookingDateStr} at ${booking.bookingTime} has been approved.`,
    }).catch((err) => console.error('Failed to send booking approval email', err))

    res.status(200).json({ message: 'Booking approved. Customer has been notified.' })
  } catch (err) {
    console.error('Failed to approve booking', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Rejects a pending booking and notifies the customer.
router.patch('/bookings/:id/reject', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const bookingId = Number(req.params.id as string)
  const { ownerNotes } = req.body ?? {}

  if (!Number.isInteger(bookingId)) {
    return res.status(404).json({ error: 'Booking not found.' })
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: { business: { select: { name: true } } },
    })

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' })
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: `Only pending bookings can be rejected (current status: ${booking.status})` })
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'rejected', ...(ownerNotes !== undefined && { ownerNotes }) },
    })

    const bookingDateStr = booking.bookingDate.toISOString().slice(0, 10)
    await sendMail({
      to: booking.customerEmail,
      subject: `Update on your booking — ${booking.business.name}`,
      text: `Unfortunately, your booking with ${booking.business.name} on ${bookingDateStr} at ${booking.bookingTime} was not approved.${ownerNotes ? ` Note from the business: ${ownerNotes}` : ''}`,
    }).catch((err) => console.error('Failed to send booking rejection email', err))

    res.status(200).json({ message: 'Booking rejected. Customer has been notified.' })
  } catch (err) {
    console.error('Failed to reject booking', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

// Cancels an approved booking and notifies the customer.
router.patch('/bookings/:id/cancel', authenticate, requireApprovedBusiness, async (req, res) => {
  const businessId = req.user?.businessId as string
  const bookingId = Number(req.params.id as string)
  const { ownerNotes } = req.body ?? {}

  if (!Number.isInteger(bookingId)) {
    return res.status(404).json({ error: 'Booking not found.' })
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      include: { business: { select: { name: true } } },
    })

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' })
    }
    if (booking.status !== 'approved') {
      return res.status(400).json({ error: `Only approved bookings can be cancelled (current status: ${booking.status})` })
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'cancelled', ...(ownerNotes !== undefined && { ownerNotes }) },
    })

    const bookingDateStr = booking.bookingDate.toISOString().slice(0, 10)
    await sendMail({
      to: booking.customerEmail,
      subject: `Your booking has been cancelled — ${booking.business.name}`,
      text: `Your booking with ${booking.business.name} on ${bookingDateStr} at ${booking.bookingTime} has been cancelled.${ownerNotes ? ` Note from the business: ${ownerNotes}` : ''}`,
    }).catch((err) => console.error('Failed to send booking cancellation email', err))

    res.status(200).json({ message: 'Booking cancelled. Customer has been notified.' })
  } catch (err) {
    console.error('Failed to cancel booking', err)
    res.status(500).json({ error: 'Something went wrong, please try again' })
  }
})

export default router
