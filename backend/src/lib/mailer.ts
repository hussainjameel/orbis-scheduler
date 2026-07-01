import nodemailer from 'nodemailer'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null

type MailOptions = {
  to: string
  subject: string
  text: string
}

// Best-effort — per UC4/UC12, email failures must never block registration or approval flows.
export async function sendMail(options: MailOptions) {
  if (!transporter) {
    console.log(`[mailer] SMTP not configured — skipping email to ${options.to}: ${options.subject}`)
    return
  }
  await transporter.sendMail({ from: SMTP_USER, ...options }) 
}
