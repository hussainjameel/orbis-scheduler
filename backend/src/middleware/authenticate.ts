import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthenticatedUser } from '../types/express.js'

// jwt.verify only proves the token is genuine and unexpired, not that the payload has the
// fields we expect. This checks that at runtime and narrows the type for TypeScript.
function isAuthenticatedUserPayload(payload: unknown): payload is AuthenticatedUser {
  if (typeof payload !== 'object' || payload === null) return false
  const candidate = payload as Record<string, unknown>
  return (
    typeof candidate.userId === 'number' &&
    typeof candidate.role === 'string' &&
    // businessId is optional. Admin tokens never carry one; owner tokens always do.
    (candidate.businessId === undefined || typeof candidate.businessId === 'string')
  )
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = authHeader.slice('Bearer '.length).trim()

  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured')
    return res.status(500).json({ error: 'Something went wrong, please try again' })
  }

  try {
    // jwt.verify throws if the signature is wrong or the token expired. Both land in the
    // catch below as the same generic 401.
    const decoded = jwt.verify(token, jwtSecret)

    // The signature can be valid even if the payload shape is wrong, like an old token
    // format. Treat that the same as invalid.
    if (!isAuthenticatedUserPayload(decoded)) {
      console.error('JWT verified but payload has an unexpected shape')
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Built fresh instead of assigning decoded directly, so req.user only ever has these
    // known fields.
    const user: AuthenticatedUser = { userId: decoded.userId, role: decoded.role }
    if (decoded.businessId !== undefined) {
      user.businessId = decoded.businessId
    }

    req.user = user

    next()
  } catch (err) {
    console.error(err)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}