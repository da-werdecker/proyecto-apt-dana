import { useState, useEffect } from 'react';
import { Calendar, Clock, Upload, X, AlertCircle, CheckCircle, Truck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SolicitudDiagnostico } from '../types/database';
import Modal from '../components/Modal';

const TIPOS_PROBLEMA = [
  'Ruido',
  'Frenos',
  'Eléctrico',
  'Motor',
  'Transmisión',
  'Suspensión',
  'Neumáticos',
  'Climatización',
  'Luces',
  'Otro',
];

// Bloques horarios: Lunes a Viernes (07:30-16:30, excluyendo colación 12:30-13:15)
// Cada vehículo necesita 2 horas
const BLOQUES_HORARIO_LV = [
  '07:30 - 09:30',
  '09:30 - 11:30',
  '13:15 - 15:15',
  '15:15 - 16:30', // Solo 1.25 horas, pero permitido para casos especiales
];

// Bloques horarios: Sábado (09:00-14:00)
const BLOQUES_HORARIO_SAB = [
  '09:00 - 11:00',
  '11:00 - 13:00',
];

// Horas ocupadas por bloque (2 horas por vehículo)
const HORAS_POR_BLOQUE = 2;
const MAX_BLOQUES_LV = 3; // Máximo 3 bloques completos de 2 horas en lunes-viernes (sin contar el último parcial)
const MAX_BLOQUES_SAB = 2; // Máximo 2 bloques completos en sábado

export default function ScheduleDiagnostic() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [assignedVehicles, setAssignedVehicles] = useState<any[]>([]);
  const [assignedVehiclesLoading, setAssignedVehiclesLoading] = useState(false);

const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!hasEnv) {
  console.error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
}

  const loadAssignedVehicles = async () => {
    if (!user || !hasEnv) {
      setAssignedVehicles([]);
      return;
    }

    try {
      setAssignedVehiclesLoading(true);
      const { data: empleado, error: empleadoError } = await supabase
        .from('empleado')
        .select('id_empleado')
        .eq('usuario_id', user.id_usuario)
        .maybeSingle();

      if (empleadoError) throw empleadoError;
      if (!empleado) {
        setAssignedVehicles([]);
        return;
      }

      const { data: asignaciones, error: asignacionesError } = await supabase
        .from('asignacion_vehiculo')
        .select(
          `
            id_asignacion,
            estado_asignacion,
            fecha_asignacion,
            vehiculo:vehiculo_id (
              id_vehiculo,
              patente_vehiculo,
              estado_vehiculo,
              kilometraje_vehiculo,
              modelo:modelo_vehiculo_id (
                nombre_modelo,
                anio_modelo,
                marca:marca_vehiculo_id (nombre_marca)
              ),
              tipo:tipo_vehiculo_id (tipo_vehiculo)
            ),
            sucursal:sucursal_id (
              id_sucursal,
              nombre_sucursal,
              comuna_sucursal
            )
          `
        )
        .eq('empleado_id', empleado.id_empleado)
        .eq('estado_asignacion', 'activo');

      if (asignacionesError) throw asignacionesError;
      setAssignedVehicles(Array.isArray(asignaciones) ? asignaciones : []);
    } catch (err) {
      console.error('Error cargando vehículos asignados:', err);
      setAssignedVehicles([]);
    } finally {
      setAssignedVehiclesLoading(false);
    }
  };

const appendDriverHistory = async (entry: any) => {
  if (!entry.empleado_id) return;

  const { error } = await supabase.from('driver_history').insert({
    empleado_id: entry.empleado_id || null,
    solicitud_diagnostico_id: entry.solicitud_diagnostico_id || null,
    vehiculo_id: entry.vehiculo_id || null,
    descripcion: entry.estado_solicitud || 'pendiente_confirmacion',
    metadata: entry,
  });

  if (error) {
    throw error;
  }
};

  const [formData, setFormData] = useState({
    patente_vehiculo: '',
    tipo_problema: '',
    prioridad: 'normal' as 'normal' | 'urgente',
    fecha_solicitada: '',
    bloque_horario: '',
    comentarios: '',
  });

  useEffect(() => {
    loadSolicitudes();
    loadAssignedVehicles();
  }, []);

  useEffect(() => {
    if (solicitudes.length > 0) {
      calculateAvailableDates();
    } else {
      // Si no hay solicitudes, todas las fechas están disponibles
      calculateAllAvailableDates();
    }
  }, [solicitudes]);

  useEffect(() => {
    if (formData.fecha_solicitada) {
      calculateAvailableTimeSlots(formData.fecha_solicitada);
    } else {
      setAvailableTimeSlots([]);
    }
  }, [formData.fecha_solicitada, solicitudes]);

  useEffect(() => {
    if (assignedVehicles.length > 0) {
      const first = assignedVehicles[0]?.vehiculo?.patente_vehiculo || '';
      setFormData((prev) => ({
        ...prev,
        patente_vehiculo: first,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        patente_vehiculo: '',
      }));
    }
  }, [assignedVehicles]);

  const loadSolicitudes = async () => {
    try {
      setLoading(true);

      if (!hasEnv) {
        setSolicitudes([]);
        return;
      }

      const { data, error } = await supabase
        .from('solicitud_diagnostico')
        .select('*')
        .in('estado_solicitud', ['pendiente_confirmacion', 'confirmada'])
        .order('fecha_solicitada', { ascending: true });

      if (error) {
        throw error;
      }

      setSolicitudes(data ?? []);
    } catch (error) {
      console.error('Error loading solicitudes:', error);
      setSolicitudes([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllAvailableDates = () => {
    const dates: string[] = [];
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    let currentDate = new Date(today);
    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay();
      // Lunes a viernes (1-5) o sábado (6)
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        dates.push(currentDate.toISOString().split('T')[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setAvailableDates(dates);
  };

  const calculateAvailableDates = () => {
    const dates: string[] = [];
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    let currentDate = new Date(today);
    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Solo lunes a sábado
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        // Contar solicitudes confirmadas/pendientes para esta fecha
        const solicitudesDelDia = solicitudes.filter((s) => {
          const solicitudDate = new Date(s.fecha_solicitada + 'T00:00:00').toISOString().split('T')[0];
          return solicitudDate === dateStr;
        });

        // Determinar máximo de bloques según el día
        const maxBloques = dayOfWeek === 6 ? MAX_BLOQUES_SAB : MAX_BLOQUES_LV;

        // Si hay menos solicitudes que el máximo, la fecha está disponible
        if (solicitudesDelDia.length < maxBloques) {
          dates.push(dateStr);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setAvailableDates(dates);
  };

  const calculateAvailableTimeSlots = (fecha: string) => {
    const fechaObj = new Date(fecha + 'T00:00:00'); // Asegurar zona horaria correcta
    const dayOfWeek = fechaObj.getDay();
    
    // Obtener bloques según el día
    const bloquesDelDia = dayOfWeek === 6 ? BLOQUES_HORARIO_SAB : BLOQUES_HORARIO_LV;
    
    // Obtener solicitudes para esta fecha (comparar solo la fecha sin hora)
    const solicitudesDelDia = solicitudes.filter((s) => {
      const solicitudDate = new Date(s.fecha_solicitada + 'T00:00:00').toISOString().split('T')[0];
      return solicitudDate === fecha;
    });

    // Obtener bloques ocupados
    const bloquesOcupados = solicitudesDelDia.map((s) => s.bloque_horario).filter(Boolean);

    // Filtrar bloques disponibles
    const bloquesDisponibles = bloquesDelDia.filter((bloque) => !bloquesOcupados.includes(bloque));

    setAvailableTimeSlots(bloquesDisponibles);
  };

  const isDateAvailable = (dateStr: string): boolean => {
    return availableDates.includes(dateStr);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`La imagen ${file.name} es muy grande. Máximo 5MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImages((prev) => [...prev, base64String]);
        setImageFiles((prev) => [...prev, file]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getCurrentEmployeeId = async (): Promise<number | null> => {
    if (!user) return null;

    try {
      if (!hasEnv) {
        throw new Error('Supabase no está configurado. No se puede obtener el id del empleado.');
      }

      const { data, error } = await supabase
        .from('empleado')
        .select('id_empleado')
        .eq('usuario_id', user.id_usuario)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.id_empleado ?? null;
    } catch (error) {
      console.error('Error getting employee ID:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!hasEnv) {
        throw new Error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      }

      const empleadoId = await getCurrentEmployeeId();
      
      if (!empleadoId) {
        setError('No se pudo identificar tu información de empleado. Contacta al administrador.');
        setSaving(false);
        return;
      }

      if (!formData.patente_vehiculo || !formData.tipo_problema || !formData.fecha_solicitada || !formData.bloque_horario) {
        setError('Por favor completa todos los campos obligatorios.');
        setSaving(false);
        return;
      }

      // Verificar que el bloque horario esté disponible
      if (!availableTimeSlots.includes(formData.bloque_horario)) {
        setError('El bloque horario seleccionado ya no está disponible. Por favor selecciona otro horario.');
        setSaving(false);
        return;
      }

      if (assignedVehicles.length === 0) {
        setError('No tienes vehículos asignados. Contacta al coordinador.');
        setSaving(false);
        return;
      }

      const patenteNormalizada = formData.patente_vehiculo.toUpperCase().trim();
      
      const solicitud: Omit<SolicitudDiagnostico, 'id_solicitud_diagnostico' | 'created_at' | 'vehiculo_id'> & { patente_vehiculo: string } = {
        patente_vehiculo: patenteNormalizada,
        empleado_id: empleadoId,
        tipo_problema: formData.tipo_problema,
        prioridad: formData.prioridad,
        fecha_solicitada: formData.fecha_solicitada,
        bloque_horario: formData.bloque_horario,
        comentarios: formData.comentarios || null,
        fotos: selectedImages.length > 0 ? selectedImages : null,
        estado_solicitud: 'pendiente_confirmacion',
      };

      // Buscar vehículo por patente
      let vehiculoId: number | null = null;
      let storedSolicitud: any = null;
      
      const vehiculoAsignado = assignedVehicles.find(
        (asignacion) =>
          asignacion?.vehiculo?.patente_vehiculo?.toUpperCase?.() === patenteNormalizada
      );

      vehiculoId = vehiculoAsignado?.vehiculo?.id_vehiculo || null;

      if (!vehiculoId) {
        setError('Selecciona un vehículo válido de tu lista asignada.');
        setSaving(false);
        return;
      }
      
      const solicitudDB = {
        ...solicitud,
        vehiculo_id: vehiculoId,
        patente_vehiculo: patenteNormalizada,
      };
      const { data: insertedSolicitud, error: dbError } = await supabase
        .from('solicitud_diagnostico')
        .insert([solicitudDB])
        .select()
        .single();

      if (dbError) {
        throw dbError;
      } else if (insertedSolicitud) {
        storedSolicitud = {
          ...solicitud,
          ...insertedSolicitud,
          patente_vehiculo: patenteNormalizada,
          bloque_horario_confirmado: insertedSolicitud.bloque_horario_confirmado || solicitud.bloque_horario,
          fecha_confirmada: insertedSolicitud.fecha_confirmada || solicitud.fecha_solicitada,
          empleado_id: insertedSolicitud.empleado_id || empleadoId,
        };
      }

      if (!storedSolicitud) {
        throw new Error('No se pudo registrar la solicitud en la base de datos.');
      }

      try {
        await appendDriverHistory({
          id: storedSolicitud.id_solicitud_diagnostico || Date.now(),
          solicitud_diagnostico_id: storedSolicitud.id_solicitud_diagnostico || null,
          patente_vehiculo: storedSolicitud.patente_vehiculo || patenteNormalizada,
          tipo_problema: storedSolicitud.tipo_problema,
          fecha_programada: storedSolicitud.fecha_confirmada || storedSolicitud.fecha_solicitada || formData.fecha_solicitada,
          bloque_horario: storedSolicitud.bloque_horario_confirmado || storedSolicitud.bloque_horario || formData.bloque_horario,
          estado_solicitud: storedSolicitud.estado_solicitud || 'pendiente_confirmacion',
          empleado_id: storedSolicitud.empleado_id,
          vehiculo_id: storedSolicitud.vehiculo_id || vehiculoId,
          created_at: storedSolicitud.created_at || new Date().toISOString(),
        });
      } catch (historyError) {
        console.warn('No se pudo registrar en driver_history:', historyError);
        // No interrumpir el flujo principal: la solicitud ya se creó.
      }

      // Recargar solicitudes para actualizar disponibilidad
      await loadSolicitudes();
      if (hasEnv) {
        await loadAssignedVehicles();
      }

      setSuccess(true);
      
      // Reset form
      const patenteDefault = assignedVehicles[0]?.vehiculo?.patente_vehiculo || '';
      setFormData({
        patente_vehiculo: patenteDefault,
        tipo_problema: '',
        prioridad: 'normal',
        fecha_solicitada: '',
        bloque_horario: '',
        comentarios: '',
      });
      setSelectedImages([]);
      setImageFiles([]);

      // Ocultar mensaje de éxito después de 5 segundos
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (error: any) {
      console.error('Error submitting request:', error);
      setError(error.message || 'Error al enviar la solicitud. Por favor intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // Obtener fecha mínima (hoy)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Obtener fecha máxima (30 días desde hoy)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  // Función para formatear fecha en español
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
  };

  if (!hasEnv) {
    return (
      <div className="space-y-4 bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900">Agendar Diagnóstico</h1>
        <p className="text-gray-600">
          Para agendar horas debes configurar las variables de entorno <code>VITE_SUPABASE_URL</code> y{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> y luego reiniciar <code>npm run dev</code>. Actualmente la aplicación está en modo offline y no puede registrar solicitudes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Agendar Diagnóstico</h1>
        <p className="text-gray-600">
          Solicita una hora para el diagnóstico de tu vehículo. El coordinador revisará tu solicitud y la confirmará.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="text-green-600" size={24} />
          <div>
            <p className="text-green-800 font-semibold">¡Solicitud enviada exitosamente!</p>
            <p className="text-green-700 text-sm">
              Tu solicitud ha sido creada y está pendiente de confirmación. El coordinador revisará tu solicitud pronto.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <div>
            <p className="text-red-800 font-semibold">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Patente del Vehículo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patente del Vehículo <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Truck className="absolute left-3 top-3.5 text-gray-400" size={20} />
            {hasEnv ? (
              <select
                value={formData.patente_vehiculo}
                onChange={(e) =>
                  setFormData({ ...formData, patente_vehiculo: e.target.value.toUpperCase() })
                }
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                required
                disabled={assignedVehiclesLoading || assignedVehicles.length === 0}
              >
                {assignedVehicles.length === 0 && (
                  <option value="">Sin vehículos asignados</option>
                )}
                {assignedVehicles.map((asignacion) => {
                  const patente = asignacion?.vehiculo?.patente_vehiculo || '';
                  const modelo = asignacion?.vehiculo?.modelo?.nombre_modelo || '';
                  const marca = asignacion?.vehiculo?.modelo?.marca?.nombre_marca || '';
                  return (
                    <option key={asignacion.id_asignacion || patente} value={patente}>
                      {patente} {marca || modelo ? `· ${[marca, modelo].filter(Boolean).join(' ')}` : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                value={formData.patente_vehiculo}
                onChange={(e) => setFormData({ ...formData, patente_vehiculo: e.target.value.toUpperCase() })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                placeholder="Ej: ABC123"
                required
                maxLength={10}
              />
            )}
          </div>
          {hasEnv ? (
            <p className="text-xs text-gray-500 mt-1">
              Sólo puedes agendar diagnóstico para vehículos que tengas asignados.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Ingresa la patente del vehículo que necesita diagnóstico
            </p>
          )}
        </div>

        {/* Tipo de Problema */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Problema <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.tipo_problema}
            onChange={(e) => setFormData({ ...formData, tipo_problema: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecciona el tipo de problema</option>
            {TIPOS_PROBLEMA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        {/* Prioridad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prioridad <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="normal"
                checked={formData.prioridad === 'normal'}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as 'normal' | 'urgente' })}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Normal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="urgente"
                checked={formData.prioridad === 'urgente'}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as 'normal' | 'urgente' })}
                className="w-4 h-4 text-red-600 focus:ring-red-500"
              />
              <span className="text-gray-700 font-semibold text-red-600">Urgente</span>
            </label>
          </div>
        </div>

        {/* Fecha Solicitada */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha Deseada <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3.5 text-gray-400" size={20} />
            <input
              type="date"
              value={formData.fecha_solicitada}
              onChange={(e) => {
                setFormData({ ...formData, fecha_solicitada: e.target.value, bloque_horario: '' });
              }}
              min={getMinDate()}
              max={getMaxDate()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          {formData.fecha_solicitada && !isDateAvailable(formData.fecha_solicitada) && (
            <p className="text-xs text-red-600 mt-1">
              Esta fecha no tiene disponibilidad. Por favor selecciona otra fecha.
            </p>
          )}
          {formData.fecha_solicitada && isDateAvailable(formData.fecha_solicitada) && (
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(formData.fecha_solicitada)} - Disponible
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Horarios: Lunes-Viernes 07:30-16:30 (colación 12:30-13:15) | Sábado 09:00-14:00
          </p>
        </div>

        {/* Bloque Horario */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bloque Horario <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-3.5 text-gray-400" size={20} />
            <select
              value={formData.bloque_horario}
              onChange={(e) => setFormData({ ...formData, bloque_horario: e.target.value })}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={!formData.fecha_solicitada || !isDateAvailable(formData.fecha_solicitada)}
            >
              <option value="">
                {!formData.fecha_solicitada 
                  ? 'Primero selecciona una fecha' 
                  : !isDateAvailable(formData.fecha_solicitada)
                  ? 'Fecha sin disponibilidad'
                  : availableTimeSlots.length === 0
                  ? 'No hay horarios disponibles'
                  : 'Selecciona un horario'}
              </option>
              {availableTimeSlots.map((bloque) => (
                <option key={bloque} value={bloque}>
                  {bloque}
                </option>
              ))}
            </select>
          </div>
          {formData.fecha_solicitada && availableTimeSlots.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {availableTimeSlots.length} bloque(s) disponible(s) para esta fecha
            </p>
          )}
        </div>

        {/* Comentarios */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comentarios Adicionales
          </label>
          <textarea
            value={formData.comentarios}
            onChange={(e) => setFormData({ ...formData, comentarios: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="Describe el problema con más detalle, síntomas que has notado, etc."
          />
        </div>

        {/* Adjuntar Fotos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adjuntar Fotos (Opcional)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="text-gray-400" size={32} />
              <span className="text-sm text-gray-600">
                Haz clic para seleccionar imágenes o arrastra aquí
              </span>
              <span className="text-xs text-gray-500">Máximo 5MB por imagen</span>
            </label>
          </div>

          {/* Vista previa de imágenes */}
          {selectedImages.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botón de Envío */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving || !isDateAvailable(formData.fecha_solicitada)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Enviando...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Enviar Solicitud
              </>
            )}
          </button>
        </div>
      </form>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Información Importante</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Tu solicitud quedará en estado "Pendiente de confirmación" hasta que el coordinador la revise.</li>
          <li>Recibirás una notificación cuando tu solicitud sea confirmada o rechazada.</li>
          <li>Las fotos ayudan a los mecánicos a entender mejor el problema antes del diagnóstico.</li>
          <li>Si marcas tu solicitud como "Urgente", será priorizada por el coordinador.</li>
          <li>Cada diagnóstico requiere 2 horas de tiempo.</li>
          <li>Horario de colación: 12:30 - 13:15 hrs (no se pueden agendar citas en este horario).</li>
        </ul>
      </div>
    </div>
  );
}
