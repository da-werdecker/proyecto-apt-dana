// api/send-email.ts

import { Resend } from "resend";

export default async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response(JSON.stringify({ ok: false, error: "Only POST" }), { status: 405 });

  const body = await req.json();
  const { to, subject, html } = body;

  const resend = new Resend(process.env.RESEND_API_KEY as string);

  try {
    const { data, error } = await resend.emails.send({
      from: "APT Taller <onboarding@resend.dev>", // Usar dominio de prueba. Cambia a tu dominio verificado en producción
      to,
      subject,
      html
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, id: data?.id }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

