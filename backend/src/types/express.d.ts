// Shape of the type attached to req.user after authenticate.ts runs. businessId is optional — only owner tokens carry it, admin tokens don't.
export interface AuthenticatedUser {
  userId: number
  role: string
  businessId?: string
}

// Express's own Request type has no "user" field by default. This patches
// (augments) that type globally so req.user type-checks everywhere in the
// project, without modifying Express's own source files.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}