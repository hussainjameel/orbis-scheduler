export interface Slot {
  time: string
  available: boolean
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function generateSlots(params: {
  startTime: string
  endTime: string
  breakStart: string | null
  breakEnd: string | null
  slotDurationMinutes: number
  bookedTimes: Set<string>
  date: { year: number; month: number; day: number }
  now?: Date
}): Slot[] {
  const { startTime, endTime, breakStart, breakEnd, slotDurationMinutes, bookedTimes, date, now = new Date() } = params

  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  const breakStartMinutes = breakStart ? parseTimeToMinutes(breakStart) : null
  const breakEndMinutes = breakEnd ? parseTimeToMinutes(breakEnd) : null

  const slots: Slot[] = []

  for (let slotStart = startMinutes; slotStart + slotDurationMinutes <= endMinutes; slotStart += slotDurationMinutes) {
    const slotEnd = slotStart + slotDurationMinutes

    // Standard half-open-interval overlap test — excludes any slot touching the break at all.
    if (breakStartMinutes !== null && breakEndMinutes !== null) {
      const overlapsBreak = slotStart < breakEndMinutes && slotEnd > breakStartMinutes
      if (overlapsBreak) continue
    }

    const time = minutesToTime(slotStart)
    let available = !bookedTimes.has(time)

    // Applies to every date uniformly (today's already-passed times AND fully-past dates) —
    // a slot's real datetime is always compared against now, no "is this today" branch.
    if (available) {
      const slotDateTime = new Date(Date.UTC(date.year, date.month - 1, date.day, Math.floor(slotStart / 60), slotStart % 60))
      if (slotDateTime <= now) {
        available = false
      }
    }

    slots.push({ time, available })
  }

  return slots
}
