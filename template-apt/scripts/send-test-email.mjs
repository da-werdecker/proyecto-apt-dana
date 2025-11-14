// scripts/send-test-email.mjs
import MailerSend, { EmailParams, Recipient, Sender } from 'mailersend';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Cargar .env.local desde la raíz del proyecto
const projectRoot = path.resolve(process.cwd());
const envLocalPath = path.join(projectRoot, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

let apiKey = process.env.MAILERSEND_API_KEY;

// Fallback: parsear manualmente con limpieza de BOM
if (!apiKey && fs.existsSync(envLocalPath)) {
  let raw = fs.readFileSync(envLocalPath, 'utf8');
  // eliminar BOM si existe
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }
  for (let line of raw.split(/\r?\n/)) {
    if (line.charCodeAt(0) === 0xFEFF) line = line.slice(1);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (k === 'MAILERSEND_API_KEY' && v) {
        apiKey = v;
        break;
      }
    }
  }
}

if (!apiKey) {
  console.error('Falta MAILERSEND_API_KEY en .env.local');
  process.exit(1);
}

// Tomar destino por argumento o usar el dado en la solicitud del usuario
const toArg = process.argv[2];
const to = toArg || 'dwerdecker@gmail.com';

const mailersend = new MailerSend({ apiKey });
const fromEmail = process.env.MAILERSEND_FROM || 'no-reply@example.com';

const run = async () => {
  try {
    const emailParams = new EmailParams()
      .setFrom(new Sender(fromEmail, 'APT Taller'))
      .setTo([new Recipient(to)])
      .setSubject('Hola de prueba - APT Taller')
      .setHtml('<h1>Hola</h1><p>Este es un correo de prueba enviado desde APT Taller.</p>');

    const response = await mailersend.email.send(emailParams);

    console.log('Correo enviado. ID:', response?.id || 'N/A');
  } catch (e) {
    console.error('Fallo inesperado:', e);
    process.exit(1);
  }
};

run();
