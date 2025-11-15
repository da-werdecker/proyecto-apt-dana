// server.js - Servidor Express para desarrollo local
import express from 'express';
import cors from 'cors';
import MailerSend, { EmailParams, Recipient, Sender } from 'mailersend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env.local - Múltiples intentos
const envPath = path.join(__dirname, '.env.local');
console.log('📧 Buscando .env.local en:', envPath);
console.log('📧 ¿Existe el archivo?', fs.existsSync(envPath));

// Intentar cargar con dotenv primero
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
  
  // Si dotenv no funcionó, leer manualmente
  if (!process.env.MAILERSEND_API_KEY) {
    console.log('⚠️ dotenv no cargó la API key, leyendo manualmente...');
    try {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Remover BOM si existe
      if (envContent.charCodeAt(0) === 0xFEFF) {
        envContent = envContent.slice(1);
      }
      
      const lines = envContent.split(/\r?\n/);
      for (const line of lines) {
        let trimmed = line.trim();
        if (trimmed.charCodeAt(0) === 0xFEFF) {
          trimmed = trimmed.slice(1);
        }
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key.trim() === 'MAILERSEND_API_KEY') {
            const apiKeyValue = valueParts.join('=').trim();
            process.env.MAILERSEND_API_KEY = apiKeyValue;
            console.log('✅ API key cargada manualmente (longitud:', apiKeyValue.length, ')');
            break;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error leyendo .env.local:', error.message);
    }
  } else {
    console.log('✅ MAILERSEND_API_KEY cargada desde dotenv');
  }
  
  // Verificación final
  if (process.env.MAILERSEND_API_KEY) {
    console.log('✅ MAILERSEND_API_KEY configurada correctamente');
  } else {
    console.error('❌ MAILERSEND_API_KEY NO está configurada después de todos los intentos');
    // Fallback: usar API key directamente (SOLO PARA DESARROLLO)
    console.log('⚠️ Usando API key de fallback...');
    process.env.MAILERSEND_API_KEY = 'test-mailersend-api-key';
    console.log('✅ API key de fallback configurada');
  }
} else {
  console.error('❌ Archivo .env.local no encontrado en:', envPath);
  console.error('📧 Directorio actual:', __dirname);
}

const app = express();
const PORT = 3001; // Puerto diferente al de Vite (5173)

app.use(cors());
app.use(express.json());

// Endpoint para enviar correos
app.post('/api/send-email', async (req, res) => {
  try {
    console.log('📧 Recibida petición para enviar correo');
    console.log('📧 Body:', JSON.stringify(req.body, null, 2));
    
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      console.error('❌ Faltan parámetros');
      return res.status(400).json({ 
        ok: false, 
        error: 'Faltan parámetros: to, subject, html' 
      });
    }

    // Cargar API key de múltiples formas
    let apiKey = process.env.MAILERSEND_API_KEY;
    
    // Si no está en process.env, intentar leer del archivo directamente
    if (!apiKey) {
      console.log('📧 API key no encontrada en process.env, leyendo desde .env.local...');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('📧 Contenido del archivo (primeros 50 chars):', envContent.substring(0, 50));
        const lines = envContent.split(/\r?\n/); // Soporta Windows y Unix
        for (const line of lines) {
          let trimmed = line.trim();
          // Remover BOM si existe
          if (trimmed.charCodeAt(0) === 0xFEFF) {
            trimmed = trimmed.slice(1);
          }
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key.trim() === 'MAILERSEND_API_KEY') {
              apiKey = valueParts.join('=').trim();
              console.log('✅ API key encontrada en archivo (longitud):', apiKey ? apiKey.length : 0);
              break;
            }
          }
        }
      } else {
        console.error('❌ Archivo .env.local no existe');
      }
    } else {
      console.log('✅ API key encontrada en process.env');
    }
    
    console.log('📧 API Key encontrada:', apiKey ? 'Sí (oculta)' : 'No');
    
    if (!apiKey) {
    console.error('❌ MAILERSEND_API_KEY no configurada');
      return res.status(500).json({ 
        ok: false, 
      error: 'MAILERSEND_API_KEY no configurada. Verifica tu archivo .env.local' 
      });
    }

    const mailersend = new MailerSend({ apiKey });
    const fromEmail = process.env.MAILERSEND_FROM || 'no-reply@example.com';

    console.log('📧 Inicializando MailerSend...');
    console.log('📧 Enviando correo a:', to);
    console.log('📧 Asunto:', subject);
    
    const emailParams = new EmailParams()
      .setFrom(new Sender(fromEmail, 'APT Taller'))
      .setTo([new Recipient(to)])
      .setSubject(subject)
      .setHtml(html);

    const response = await mailersend.email.send(emailParams);

    console.log('✅ Correo enviado exitosamente. ID:', response?.id || 'N/A');
    res.json({ ok: true, id: response?.id });
  } catch (error) {
    console.error('❌ Error en /api/send-email:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Error interno del servidor',
      details: error.stack
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de API corriendo en http://localhost:${PORT}`);
  console.log(`📧 Endpoint disponible: http://localhost:${PORT}/api/send-email`);
});

