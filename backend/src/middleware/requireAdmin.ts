import type { Request, Response, NextFunction } from 'express'

// Only checks role. Verifying the token itself is authenticate's job.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
