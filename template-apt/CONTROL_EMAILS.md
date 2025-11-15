# 📧 Control de Envío de Correos

## Estado Actual: DESHABILITADO ⚠️

El envío de correos está **deshabilitado por defecto**. El código está completo y listo, pero no enviará correos hasta que lo habilites.

## ✅ Cómo Habilitar el Envío de Correos

### Paso 1: Editar `.env.local`

Abre el archivo `.env.local` en la raíz del proyecto y agrega esta línea:

```env
RESEND_API_KEY=re_3MmW8vAL_3h76AMZsdmHAGY3jw37C7rDr
VITE_ENABLE_EMAIL=true
VITE_ADMIN_EMAIL=dwerdecker@gmail.com
```

### Paso 2: Reiniciar los servidores

Después de agregar `VITE_ENABLE_EMAIL=true`, reinicia los servidores:

```powershell
# Detener servidores actuales (Ctrl+C)
# Luego ejecutar:
npm run dev:both
```

### Paso 3: Verificar

Cuando registres un ingreso de vehículo, deberías ver en la consola:
```
📧 Envío de correos habilitado
✅ Correo enviado exitosamente
```

## ❌ Cómo Deshabilitar el Envío de Correos

### Opción 1: Quitar la variable
En `.env.local`, elimina o comenta la línea:
```env
# VITE_ENABLE_EMAIL=true
```

### Opción 2: Cambiar a false
```env
VITE_ENABLE_EMAIL=false
```

Luego reinicia los servidores.

## 📋 Estado del Código

✅ **El código de envío de correos está completo y funcional**
- Template HTML con toda la información del vehículo
- Configuración de Resend lista
- Manejo de errores implementado

⚠️ **Solo está deshabilitado temporalmente** mediante la variable `VITE_ENABLE_EMAIL`

## 🔄 Para Volver a Usarlo

1. Agrega `VITE_ENABLE_EMAIL=true` a `.env.local`
2. Reinicia los servidores
3. ¡Listo! Los correos se enviarán automáticamente

---

**Nota**: Cuando habilites los correos, se enviarán automáticamente a `dwerdecker@gmail.com` cada vez que se registre un ingreso de vehículo autorizado.













