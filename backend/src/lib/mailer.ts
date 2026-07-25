import nodemailer from 'nodemailer'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

// No SMTP_HOST means mail isn't configured, so fall back to null and let sendMail no-op.
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

// Every call site wraps this in its own catch, so a failed send can never block or fail
// the request that triggered it.
export async function sendMail(options: MailOptions) {
  if (!transporter) {
    console.log(`[mailer] SMTP not configured — skipping email to ${options.to}: ${options.subject}`)
    return
  }
  await transporter.sendMail({ from: SMTP_USER, ...options }) 
}
