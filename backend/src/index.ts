import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import ownerRoutes from './routes/owner.js'
import adminRoutes from './routes/admin.js'
import publicRoutes from './routes/public.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json())

// Kept minimal and unauthenticated on purpose, just to confirm the API is up.
app.get('/', (req, res) => {
  res.json({ message: 'Orbis Scheduler API is running' })
})

// Split by audience. /public has no auth; /owner and /admin each apply their own auth
// middleware per route.
app.use('/auth', authRoutes)
app.use('/public', publicRoutes)
app.use('/owner', ownerRoutes)
app.use('/admin', adminRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})