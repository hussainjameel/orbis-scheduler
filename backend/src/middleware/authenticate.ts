import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthenticatedUser } from '../types/express.js'

// jwt.verify() only proves a token is genuine and unexpired — it says nothing about whether the decoded payload actually has the fields our app expects.
// This type guard checks the actual shape at runtime, and narrows `payload` to AuthenticatedUser for TypeScript wherever this function returns true.
function isAuthenticatedUserPayload(payload: unknown): payload is AuthenticatedUser {
  if (typeof payload !== 'object' || payload === null) return false
  const candidate = payload as Record<string, unknown>
  return (
    typeof candidate.userId === 'number' &&
    typeof candidate.role === 'string' &&
    // businessId is optional — admin tokens never carry one, owner tokens always do.
    (candidate.businessId === undefined || typeof candidate.businessId === 'string')
  )
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Strip the "Bearer " prefix to get just the token string.
  const token = authHeader.slice('Bearer '.length).trim()

  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured')
    return res.status(500).json({ error: 'Something went wrong, please try again' })
  }

  try {
  // Verifies token by splitting it into header/payload/signature and comparing against a signature recomputed using JWT_SECRET. Throws if invalid/expired.
  // Returns the decoded payload: { userId, role, businessId?, iat, exp }
    const decoded = jwt.verify(token, jwtSecret)

    // Signature can be valid while the payload shape is still wrong/unexpected
    // (e.g. an old token format). Treat that the same as an invalid token.
    if (!isAuthenticatedUserPayload(decoded)) {
      console.error('JWT verified but payload has an unexpected shape')
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Rebuild a clean object rather than assigning `decoded` directly, so
    // req.user only ever contains exactly these known fields.
    const user: AuthenticatedUser = { userId: decoded.userId, role: decoded.role }
    if (decoded.businessId !== undefined) {
      user.businessId = decoded.businessId
    }

    // Attach the verified identity to the request 
    req.user = user

    next() // hand off to the actual route handler
  } catch (err) {
    console.error(err)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}