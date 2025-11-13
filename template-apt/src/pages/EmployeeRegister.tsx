import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../lib/email';

export default function EmployeeRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key: string, value: any) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  
  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    fecha_nacimiento: '',
    email: '',
    telefono1: '',
    telefono2: '',
    cargo_id: '',
    password: '',
    confirmPassword: '',
  });

  const [cargos, setCargos] = useState<any[]>([]);
  const [errors, setErrors] = useState<any>({});

  // Cargar cargos disponibles
  useEffect(() => {
    const loadCargos = async () => {
      try {
        const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
        console.log('🔍 Loading cargos - hasEnv:', hasEnv);
        
        // Cargos estándar
        const demoCargos = [
          { id_cargo: -1, nombre_cargo: 'Jefe de Taller', descripcion_cargo: 'Lidera diagnóstico, checklist, asigna mecánicos y valida cierre de OT', created_at: new Date().toISOString() },
          { id_cargo: -2, nombre_cargo: 'Coordinador', descripcion_cargo: 'Agenda trabajos, solicita ingresos y reporta estados', created_at: new Date().toISOString() },
          { id_cargo: -3, nombre_cargo: 'Supervisor', descripcion_cargo: 'Aprueba asignaciones, controla tiempos y calidad técnica', created_at: new Date().toISOString() },
          { id_cargo: -4, nombre_cargo: 'Mecánico', descripcion_cargo: 'Ejecuta mantenciones y registra avances', created_at: new Date().toISOString() },
          { id_cargo: -5, nombre_cargo: 'Guardia', descripcion_cargo: 'Registra ingresos y salidas de vehículos', created_at: new Date().toISOString() },
          { id_cargo: -6, nombre_cargo: 'Asistente de Repuestos', descripcion_cargo: 'Gestiona materiales y herramientas', created_at: new Date().toISOString() },
          { id_cargo: -7, nombre_cargo: 'Chofer', descripcion_cargo: 'Usuario informativo para trazabilidad del vehículo', created_at: new Date().toISOString() },
        ];

        if (hasEnv) {
          const { data } = await supabase.from('cargo').select('*');
          console.log('✅ Cargos from Supabase:', data);
          // Si Supabase tiene cargos, usarlos; si no, usar los demo
          if (data && data.length > 0) {
            setCargos(data);
          } else {
            console.log('⚠️ Supabase vacío, usando cargos demo');
            setCargos(demoCargos);
          }
        } else {
          // localStorage: siempre crear cargos estándar
          console.log('✅ Usando localStorage, creando cargos demo');
          writeLocal('apt_cargos', demoCargos);
          setCargos(demoCargos);
        }
      } catch (error) {
        console.error('Error cargando cargos:', error);
        // Si falla, usar cargos hardcodeados
        const demoCargos = [
          { id_cargo: -1, nombre_cargo: 'Jefe de Taller', descripcion_cargo: 'Lidera diagnóstico, checklist, asigna mecánicos y valida cierre de OT', created_at: new Date().toISOString() },
          { id_cargo: -2, nombre_cargo: 'Coordinador', descripcion_cargo: 'Agenda trabajos, solicita ingresos y reporta estados', created_at: new Date().toISOString() },
          { id_cargo: -3, nombre_cargo: 'Supervisor', descripcion_cargo: 'Aprueba asignaciones, controla tiempos y calidad técnica', created_at: new Date().toISOString() },
          { id_cargo: -4, nombre_cargo: 'Mecánico', descripcion_cargo: 'Ejecuta mantenciones y registra avances', created_at: new Date().toISOString() },
          { id_cargo: -5, nombre_cargo: 'Guardia', descripcion_cargo: 'Registra ingresos y salidas de vehículos', created_at: new Date().toISOString() },
          { id_cargo: -6, nombre_cargo: 'Asistente de Repuestos', descripcion_cargo: 'Gestiona materiales y herramientas', created_at: new Date().toISOString() },
          { id_cargo: -7, nombre_cargo: 'Chofer', descripcion_cargo: 'Usuario informativo para trazabilidad del vehículo', created_at: new Date().toISOString() },
        ];
        console.log('✅ Cargos fallback creados:', demoCargos);
        setCargos(demoCargos);
      }
    };
    loadCargos();
  }, []);

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.rut) newErrors.rut = 'El RUT es obligatorio';
    if (!formData.nombre) newErrors.nombre = 'El nombre es obligatorio';
    if (!formData.apellido_paterno) newErrors.apellido_paterno = 'El apellido paterno es obligatorio';
    if (!formData.fecha_nacimiento) newErrors.fecha_nacimiento = 'La fecha de nacimiento es obligatoria';
    if (!formData.email) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }
    if (!formData.telefono1) newErrors.telefono1 = 'El teléfono es obligatorio';
    if (!formData.cargo_id) newErrors.cargo_id = 'Debe seleccionar un cargo';
    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      let nuevoEmpleado: any = null;
      let empleadosLocales = readLocal('apt_empleados', []);

      // Verificar si el RUT ya existe (local o BD)
      const existingLocal = empleadosLocales.find((e: any) => e.rut === formData.rut);
      
      if (hasEnv) {
        const { data: existingBD } = await supabase
          .from('empleado')
          .select('*')
          .eq('rut', formData.rut)
          .maybeSingle();

        if (existingBD || existingLocal) {
          alert('Ya existe un empleado con este RUT');
          setLoading(false);
          return;
        }
      } else if (existingLocal) {
        alert('Ya existe un empleado con este RUT');
        setLoading(false);
        return;
      }

      // Crear el empleado (en BD o localStorage)
      const cargoSeleccionado = cargos.find(c => c.id_cargo === parseInt(formData.cargo_id));
      
      if (hasEnv) {
        const { data, error: empleadoError } = await supabase
          .from('empleado')
          .insert([{
            rut: formData.rut,
            nombre: formData.nombre,
            apellido_paterno: formData.apellido_paterno,
            apellido_materno: formData.apellido_materno || null,
            fecha_nacimiento: formData.fecha_nacimiento,
            email: formData.email,
            telefono1: formData.telefono1,
            telefono2: formData.telefono2 || null,
            cargo_id: parseInt(formData.cargo_id),
          }])
          .select()
          .single();

        if (empleadoError) {
          // Si falla por RLS u otro error, guardar localmente
          console.log('⚠️ Error en Supabase, usando localStorage:', empleadoError.message);
          // Continuar al bloque else para guardar localmente
        } else {
          nuevoEmpleado = data;
        }
      }
      
      // Si no se guardó en BD (falló o hasEnv es false)
      if (!nuevoEmpleado) {
        // Guardar localmente
        nuevoEmpleado = {
          id_empleado: Date.now(),
          rut: formData.rut,
          nombre: formData.nombre,
          apellido_paterno: formData.apellido_paterno,
          apellido_materno: formData.apellido_materno || null,
          fecha_nacimiento: formData.fecha_nacimiento,
          email: formData.email,
          telefono1: formData.telefono1,
          telefono2: formData.telefono2 || null,
          cargo_id: parseInt(formData.cargo_id),
          cargo: cargoSeleccionado,
          created_at: new Date().toISOString(),
        };
        
        empleadosLocales.push(nuevoEmpleado);
        writeLocal('apt_empleados', empleadosLocales);
      }

      // Guardar la contraseña temporalmente para aprobación
      const pendingUser = {
        empleado_id: nuevoEmpleado.id_empleado,
        password: formData.password,
        rut: formData.rut,
        email: formData.email,
        nombre_completo: `${formData.nombre} ${formData.apellido_paterno}`,
        cargo: cargoSeleccionado?.nombre_cargo || 'Sin cargo',
        aprobado: false,
        created_at: new Date().toISOString(),
      };
      
      const existingPending = readLocal('apt_pending_users', []);
      existingPending.push(pendingUser);
      writeLocal('apt_pending_users', existingPending);

      // Enviar correos
      await enviarCorreoRegistro(nuevoEmpleado, cargoSeleccionado?.nombre_cargo);
      await enviarCorreoAdministrador(nuevoEmpleado, cargoSeleccionado?.nombre_cargo);

      alert('¡Registro exitoso! Revisa tu correo electrónico.');
      navigate('/login');

    } catch (error: any) {
      console.error('Error en registro:', error);
      alert('Error al registrar: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const enviarCorreoRegistro = async (empleado: any, cargo: string = '') => {
    try {
      console.log('🔍 VITE_ENABLE_EMAIL value:', import.meta.env.VITE_ENABLE_EMAIL);
      console.log('🔍 Type:', typeof import.meta.env.VITE_ENABLE_EMAIL);
      const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true';
      console.log('🔍 emailEnabled result:', emailEnabled);
      if (!emailEnabled) {
        console.log('📧 Correos deshabilitados');
        return;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
              .info-box { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 ¡Bienvenido a APT Taller!</h1>
              </div>
              <div class="content">
                <p>Estimado/a <strong>${empleado.nombre} ${empleado.apellido_paterno}</strong>,</p>
                
                <p>Tu registro ha sido recibido exitosamente. Estamos revisando tu información y te notificaremos cuando tu cuenta sea aprobada.</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0;">📋 Información de tu Registro</h3>
                  <p><strong>RUT:</strong> ${empleado.rut}</p>
                  <p><strong>Email:</strong> ${empleado.email}</p>
                  ${cargo ? `<p><strong>Cargo:</strong> ${cargo}</p>` : ''}
                  <p><strong>Estado:</strong> Pendiente de Aprobación</p>
                </div>
                
                <p style="margin-top: 30px;">Recibirás un correo cuando un administrador apruebe tu solicitud. Una vez aprobado, podrás iniciar sesión con tus credenciales.</p>
                
                <p>Si tienes alguna pregunta, contáctanos.</p>
                
                <p>Saludos cordiales,<br><strong>Equipo APT Taller</strong></p>
              </div>
              <div class="footer">
                <p>Este es un correo automático. Por favor no respondas a este mensaje.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = await sendEmail({
        to: empleado.email,
        subject: '🎉 Bienvenido a APT Taller - Registro Recibido',
        html: emailHtml
      });

      if (result.ok) {
        console.log('✅ Correo de registro enviado a:', empleado.email);
      } else {
        console.error('❌ Error enviando correo de registro:', result.error);
      }
    } catch (error) {
      console.error('Error en enviarCorreoRegistro:', error);
    }
  };

  const enviarCorreoAdministrador = async (empleado: any, cargo: string = '') => {
    try {
      console.log('🔍 VITE_ENABLE_EMAIL value (admin):', import.meta.env.VITE_ENABLE_EMAIL);
      const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true';
      console.log('🔍 emailEnabled result (admin):', emailEnabled);
      if (!emailEnabled) {
        console.log('📧 Correos deshabilitados');
        return;
      }

      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'dwerdecker@gmail.com';

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
              .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .info-row:last-child { border-bottom: none; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🔔 Nueva Solicitud de Registro</h1>
              </div>
              <div class="content">
                <p>Estimado Administrador,</p>
                
                <p>Se ha recibido una nueva solicitud de registro en el sistema APT Taller:</p>
                
                <div class="alert-box">
                  <h3 style="margin-top: 0; color: #dc2626;">📋 Datos del Nuevo Empleado</h3>
                  <div class="info-row">
                    <span><strong>Nombre:</strong></span>
                    <span>${empleado.nombre} ${empleado.apellido_paterno} ${empleado.apellido_materno || ''}</span>
                  </div>
                  <div class="info-row">
                    <span><strong>RUT:</strong></span>
                    <span>${empleado.rut}</span>
                  </div>
                  <div class="info-row">
                    <span><strong>Email:</strong></span>
                    <span>${empleado.email}</span>
                  </div>
                  <div class="info-row">
                    <span><strong>Teléfono:</strong></span>
                    <span>${empleado.telefono1}</span>
                  </div>
                  ${cargo ? `
                  <div class="info-row">
                    <span><strong>Cargo:</strong></span>
                    <span>${cargo}</span>
                  </div>
                  ` : ''}
                  ${empleado.fecha_nacimiento ? `
                  <div class="info-row">
                    <span><strong>Fecha de Nacimiento:</strong></span>
                    <span>${new Date(empleado.fecha_nacimiento).toLocaleDateString('es-ES')}</span>
                  </div>
                  ` : ''}
                  <div class="info-row">
                    <span><strong>Fecha de Registro:</strong></span>
                    <span>${new Date().toLocaleString('es-ES')}</span>
                  </div>
                  <div class="info-row">
                    <span><strong>Estado:</strong></span>
                    <span style="color: #dc2626; font-weight: bold;">⏳ PENDIENTE DE APROBACIÓN</span>
                  </div>
                </div>
                
                <p style="background: #fffbeb; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                  <strong>⚠️ Acción Requerida:</strong><br>
                  Por favor, revisa la información del empleado y aprueba o rechaza la solicitud desde el panel de administración.
                </p>
                
                <p>Puedes gestionar las solicitudes pendientes en: <strong>Empleados → Solicitudes Pendientes</strong></p>
              </div>
              <div class="footer">
                <p>Sistema APT Taller - Notificación Automática</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = await sendEmail({
        to: adminEmail,
        subject: `🔔 Nueva Solicitud de Registro - ${empleado.nombre} ${empleado.apellido_paterno}`,
        html: emailHtml
      });

      if (result.ok) {
        console.log('✅ Notificación enviada al administrador');
      } else {
        console.error('❌ Error enviando notificación:', result.error);
      }
    } catch (error) {
      console.error('Error en enviarCorreoAdministrador:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h2 className="text-3xl font-bold text-white text-center">
            📝 Registro de Empleado
          </h2>
          <p className="text-blue-100 text-center mt-2">
            Completa el siguiente formulario para registrarte como empleado
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Primera fila: RUT, Cargo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RUT *
                </label>
                <input
                  type="text"
                  value={formData.rut}
                  onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.rut ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="12.345.678-9"
                />
                {errors.rut && <p className="text-red-500 text-sm mt-1">{errors.rut}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cargo *
                </label>
                <select
                  value={formData.cargo_id}
                  onChange={(e) => setFormData({ ...formData, cargo_id: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.cargo_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Seleccionar cargo</option>
                  {cargos.map((cargo) => (
                    <option key={cargo.id_cargo} value={cargo.id_cargo}>
                      {cargo.nombre_cargo}
                    </option>
                  ))}
                </select>
                {errors.cargo_id && <p className="text-red-500 text-sm mt-1">{errors.cargo_id}</p>}
              </div>
            </div>

            {/* Segunda fila: Nombre, Apellidos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.nombre ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Juan"
                />
                {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido Paterno *
                </label>
                <input
                  type="text"
                  value={formData.apellido_paterno}
                  onChange={(e) => setFormData({ ...formData, apellido_paterno: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.apellido_paterno ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Pérez"
                />
                {errors.apellido_paterno && <p className="text-red-500 text-sm mt-1">{errors.apellido_paterno}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido Materno *
                </label>
                <input
                  type="text"
                  value={formData.apellido_materno}
                  onChange={(e) => setFormData({ ...formData, apellido_materno: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="González"
                />
              </div>
            </div>

            {/* Tercera fila: Fecha Nacimiento, Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Nacimiento *
                </label>
                <input
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.fecha_nacimiento ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.fecha_nacimiento && <p className="text-red-500 text-sm mt-1">{errors.fecha_nacimiento}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="juan.perez@ejemplo.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* Cuarta fila: Teléfonos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono 1 *
                </label>
                <input
                  type="tel"
                  value={formData.telefono1}
                  onChange={(e) => setFormData({ ...formData, telefono1: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.telefono1 ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="+56912345678"
                />
                {errors.telefono1 && <p className="text-red-500 text-sm mt-1">{errors.telefono1}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono 2
                </label>
                <input
                  type="tel"
                  value={formData.telefono2}
                  onChange={(e) => setFormData({ ...formData, telefono2: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+56987654321"
                />
              </div>
            </div>

            {/* Quinta fila: Contraseñas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Repite tu contraseña"
                />
                {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Registrando...' : 'Registrarse'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

