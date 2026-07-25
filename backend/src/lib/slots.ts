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
  now?: Date // lets tests pass a fixed time instead of the real clock
}): Slot[] {
  const { startTime, endTime, breakStart, breakEnd, slotDurationMinutes, bookedTimes, date, now = new Date() } = params

  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)
  const breakStartMinutes = breakStart ? parseTimeToMinutes(breakStart) : null
  const breakEndMinutes = breakEnd ? parseTimeToMinutes(breakEnd) : null

  const slots: Slot[] = []

  // Stops once a full slot no longer fits before endTime, so no partial slot is offered.
  for (let slotStart = startMinutes; slotStart + slotDurationMinutes <= endMinutes; slotStart += slotDurationMinutes) {
    const slotEnd = slotStart + slotDurationMinutes

    // Excludes any slot that overlaps the break at all.
    if (breakStartMinutes !== null && breakEndMinutes !== null) {
      const overlapsBreak = slotStart < breakEndMinutes && slotEnd > breakStartMinutes
      if (overlapsBreak) continue
    }

    const time = minutesToTime(slotStart)
    let available = !bookedTimes.has(time)

    // Compares every slot's real datetime against now, with no separate check for today
    // versus a past date.
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
