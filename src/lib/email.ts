import nodemailer from "nodemailer";

/**
 * Email delivery. If SMTP_URL is set (e.g. smtp://user:pass@smtp.example.com:587),
 * alerts are delivered by email. Otherwise messages are logged to the console so
 * development environments still show exactly what would have been sent.
 */

let transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ delivered: boolean }> {
  const t = getTransporter();
  const from = process.env.EMAIL_FROM ?? "DealScout <alerts@dealscout.local>";
  if (!t) {
    console.log(
      `[email:console-fallback] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n---`
    );
    return { delivered: false };
  }
  await t.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
  return { delivered: true };
}
