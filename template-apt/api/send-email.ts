// api/send-email.ts

import MailerSend, { EmailParams, Recipient } from "mailersend";

export default async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response(JSON.stringify({ ok: false, error: "Only POST" }), { status: 405 });

  const body = await req.json();
  const { to, subject, html } = body;

  const apiKey = process.env.MAILERSEND_API_KEY;
  const fromEmail = process.env.MAILERSEND_FROM;

  if (!apiKey || !fromEmail) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "MAILERSEND_API_KEY o MAILERSEND_FROM no configurados",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const mailersend = new MailerSend({ apiKey });

  try {
    const emailParams = new EmailParams()
      .setFrom({ email: fromEmail })
      .setTo([new Recipient(to)])
      .setSubject(subject)
      .setHtml(html);

    const response = await mailersend.email.send(emailParams);

    return new Response(JSON.stringify({ ok: true, id: response.id }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message ?? 'Error enviando correo' }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

