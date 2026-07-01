import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Orbis Scheduler API is running' })
})

// Routes — we'll wire these in as we build them
app.use('/auth', authRoutes)
// app.use('/public', publicRoutes)
// app.use('/owner', ownerRoutes)
// app.use('/admin', adminRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})