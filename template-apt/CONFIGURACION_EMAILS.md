# 📧 Configuración de Emails para Notificaciones

## ✅ Correo de Ingreso de Vehículos

El sistema ahora envía automáticamente un correo cuando se registra el ingreso de un vehículo al taller.

## 🔧 Configurar Email del Administrador

### Opción 1: Variable de Entorno (Recomendado)

Agrega a tu archivo `.env.local`:

```env
VITE_ADMIN_EMAIL=tu-email@ejemplo.com
```

Puedes agregar múltiples emails separados por comas:

```env
VITE_ADMIN_EMAIL=admin1@ejemplo.com,admin2@ejemplo.com
```

**Nota**: En Vercel, agrega esta variable en **Settings → Environment Variables**.

### Opción 2: Modificar el Código Directamente

Si prefieres, puedes cambiar directamente en `src/pages/Gate.tsx` (línea ~491):

```typescript
const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'tu-email-aqui@ejemplo.com';
```

## 📧 Contenido del Correo

El correo incluye:
- ✅ Patente del vehículo
- ✅ Modelo y marca
- ✅ Tipo de vehículo
- ✅ Estado del vehículo
- ✅ Sucursal (si aplica)
- ✅ Fecha y hora del ingreso
- ✅ Estado de acceso (AUTORIZADO)

## 🎨 Personalizar el Template del Correo

El template HTML está en `src/pages/Gate.tsx` (líneas ~409-487). Puedes personalizar:
- Colores y estilos
- Información adicional
- Logo o branding

## 🔔 Próximas Mejoras

Puedes agregar notificaciones por correo para:
- Registro de salida de vehículos
- Creación de órdenes de trabajo
- Reporte de incidencias críticas
- Alertas de mantenimiento

## ⚠️ Notas Importantes

1. **Dominio de prueba**: Por defecto se usa `onboarding@resend.dev`. Para producción, verifica tu dominio en Resend.

2. **Error silencioso**: Si el correo falla, no se bloquea el registro del ingreso. Los errores se registran en la consola.

3. **Múltiples destinatarios**: Resend permite enviar a múltiples emails separados por comas.










