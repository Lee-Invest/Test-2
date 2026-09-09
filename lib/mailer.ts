/**
 * Dev-mode mailer stub. In production, wire this up to nodemailer (or a
 * transactional email API) using the EMAIL_* env vars from .env.example.
 * For this MVP, emails are simply logged to the console.
 */
export async function sendMail(to: string, subject: string, body: string) {
  console.log(`\n----- [DEV EMAIL] -----\nTo: ${to}\nSubject: ${subject}\n\n${body}\n------------------------\n`);
}
