-- Prevents two concurrent requests from both succeeding for the same
-- business+date+time while a prior booking there is still pending/approved.
-- Not expressible in schema.prisma (@@unique/@@index have no WHERE clause) —
-- exists only here, hand-authored, applied via `prisma migrate deploy`.
CREATE UNIQUE INDEX "bookings_active_slot_key"
ON "bookings" ("businessId", "bookingDate", "bookingTime")
WHERE "status" IN ('pending', 'approved');
