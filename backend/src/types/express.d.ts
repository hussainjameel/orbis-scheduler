export interface AuthenticatedUser {
  userId: number
  role: string
  businessId?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}
