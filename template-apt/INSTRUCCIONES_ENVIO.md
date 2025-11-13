# 📧 Instrucciones para Enviar Correos

## ✅ Correo de Prueba Directo (FUNCIONA)

Para enviar un correo de prueba sin usar la aplicación web:

```bash
npm run send:test
```

O con la API key explícita:
```bash
$env:RESEND_API_KEY='re_3MmW8vAL_3h76AMZsdmHAGY3jw37C7rDr'; npm run send:test
```

## 🖥️ Para que Funcione desde la Aplicación Web

### Opción 1: Ejecutar ambos servidores juntos

**En UNA terminal:**
```bash
npm run dev:both
```

Esto ejecuta:
- Servidor Express en puerto 3001 (maneja `/api/send-email`)
- Vite en puerto 5173 (tu aplicación React)

### Opción 2: Ejecutar en terminales separadas

**Terminal 1** (Servidor Express):
```bash
node server.js
```
Deberías ver: `🚀 Servidor de API corriendo en http://localhost:3001`

**Terminal 2** (Vite):
```bash
npm run dev
```
Deberías ver: `Local: http://localhost:5173`

### Verificar que funciona:

1. Asegúrate de que ambos servidores estén corriendo
2. Abre `http://localhost:5173` en tu navegador
3. Ve a la página de Gate (Control de Acceso)
4. Registra un ingreso de vehículo
5. Revisa la terminal del servidor Express - deberías ver logs de 📧

## 🔍 Solución de Problemas

### Error "Failed to fetch"
- El servidor Express no está corriendo
- Solución: Ejecuta `node server.js` en una terminal

### Error 500
- Revisa la terminal del servidor Express para ver el error exacto
- Verifica que `.env.local` tiene `RESEND_API_KEY=re_...`

### El correo no llega
- Revisa la carpeta de Spam en Gmail
- Verifica en [Resend Dashboard](https://resend.com/emails) → Logs
- El correo puede tardar unos segundos

## ✅ Verificación Rápida

Para verificar que todo está configurado:
```bash
# Verificar que la API key está en .env.local
Get-Content .env.local

# Enviar correo de prueba
npm run send:test
```

Si el correo de prueba funciona, la configuración está bien. Solo necesitas que el servidor Express esté corriendo para que funcione desde la web.










