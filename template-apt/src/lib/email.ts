// src/lib/email.ts

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Envía un correo electrónico usando el endpoint serverless
 * @param params - Parámetros del correo (to, subject, html)
 * @returns Respuesta del servidor
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
  try {
    console.log('📧 Enviando correo a:', params.to);
    console.log('📧 Asunto:', params.subject);
    
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    console.log('📧 Respuesta del servidor - Status:', response.status);
    console.log('📧 Respuesta del servidor - OK:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('📧 Error en respuesta:', errorText);
      return {
        ok: false,
        error: `Error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    console.log('📧 Datos recibidos:', data);
    return data;
  } catch (error: any) {
    console.error('📧 Error en fetch:', error);
    return {
      ok: false,
      error: error.message || "Error al enviar el correo - Verifica que el servidor esté corriendo con 'vercel dev'",
    };
  }
}

