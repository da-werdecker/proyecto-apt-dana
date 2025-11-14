import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  CalendarDays,
  Truck,
  User,
  AlertCircle,
  FileText,
  ClipboardList,
  Activity,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wrench,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SolicitudDiagnostico } from '../types/database';
import Modal from '../components/Modal';

const TIPOS_TRABAJO = [
  { value: 'mantencion', label: 'Mantención' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'emergencia', label: 'Emergencia' },
];

const BLOQUES_HORARIO_LV = [
  '07:30 - 09:30',
  '09:30 - 11:30',
  '13:15 - 15:15',
  '15:15 - 16:30',
];

const BLOQUES_HORARIO_SAB = BLOQUES_HORARIO_LV;

const ESTADOS_AGENDA_PERMITIDOS = [
  'pendiente_confirmacion',
  'pendiente',
  'confirmada',
  'confirmado',
  'aprobada',
  'aprobado',
];

interface CoordinatorDashboardProps {
  activeSection?: 'agenda' | 'solicitudes' | 'emergencias' | 'ordenes' | 'vehiculos' | 'reportes';
}

export default function CoordinatorDashboard({ activeSection = 'solicitudes' }: CoordinatorDashboardProps) {
  // Estados para Solicitudes
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudDiagnostico | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para Vehículos
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleStats, setVehicleStats] = useState({
    enRuta: 0,
    enTaller: 0,
    enEspera: 0,
    fueraServicio: 0
  });

  // Estados para Órdenes de Trabajo
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [orderStats, setOrderStats] = useState({
    programadas: 0,
    enDiagnostico: 0,
    enReparacion: 0,
    retrasadas: 0
  });
const [reportOrders, setReportOrders] = useState<any[]>([]);
const [reportOrderStats, setReportOrderStats] = useState({
  enCurso: 0,
  finalizadas: 0,
  pendientesCierre: 0,
  cerradas: 0,
  });

  // Estados para Agenda/Calendario
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [agendaItems, setAgendaItems] = useState<any[]>([]);
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<any[]>([]);
const [solicitudesHistoricas, setSolicitudesHistoricas] = useState<any[]>([]);
const [solicitudViewMode, setSolicitudViewMode] = useState<'pendientes' | 'historial'>('pendientes');

const totalEventosAgenda = agendaItems.length;
const eventosPorVenir = agendaItems.filter((item: any) => {
  if (!item.fecha) return false;
  const evento = new Date(item.fecha + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return evento >= hoy;
}).length;
const eventosUrgentes = agendaItems.filter((item: any) => (item.prioridad || '').toLowerCase() === 'urgente').length;
const citasSeleccionadas = selectedDayAppointments.length;
const selectedDateLabel = selectedDate
  ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  : '';
const formattedSelectedDateLabel = selectedDateLabel
  ? selectedDateLabel.charAt(0).toUpperCase() + selectedDateLabel.slice(1)
  : 'Selecciona un día';
const isEstadoAprobado = (estado?: string) => {
  const value = (estado || '').toLowerCase();
  return value === 'aprobada' || value === 'aprobado' || value === 'confirmada' || value === 'confirmado';
};
const isEstadoRechazado = (estado?: string) => {
  const value = (estado || '').toLowerCase();
  return value === 'rechazada' || value === 'rechazado';
};
const historialAprobadas = solicitudesHistoricas.filter((s: any) => isEstadoAprobado(s.estado_solicitud)).length;
const historialRechazadas = solicitudesHistoricas.filter((s: any) => isEstadoRechazado(s.estado_solicitud)).length;
const historialTotal = solicitudesHistoricas.length;
const formatEstadoSolicitud = (estado?: string) => {
  const value = (estado || '').toLowerCase();
  if (isEstadoAprobado(value)) return 'Aprobada';
  if (isEstadoRechazado(value)) return 'Rechazada';
  if (!value) return 'Sin estado';
  return value.charAt(0).toUpperCase() + value.slice(1);
};
const formatFechaCorta = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
const getEstadoOTInfo = (estado?: string) => {
  const estadoLower = (estado || '').toLowerCase();
  if (estadoLower === 'en_diagnostico_programado' || estadoLower === 'pendiente') {
    return { label: 'Programada', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
  }
  if (estadoLower === 'en curso') {
    return { label: 'En diagnóstico', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
  }
  if (estadoLower === 'en_reparacion' || estadoLower === 'en reparación') {
    return { label: 'En reparación', badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' };
  }
  if (estadoLower === 'finalizada' || estadoLower === 'cerrada') {
    return { label: 'Finalizada', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
  }
  return { label: estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : 'Sin estado', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
};
const resolveFechaOrden = (orden: any) =>
  orden?.fecha_inicio_ot || orden?.fecha_confirmada || orden?.created_at || orden?.fecha_solicitada || null;
const workOrdersSorted = [...workOrders].sort(
  (a, b) =>
    new Date(resolveFechaOrden(b) || 0).getTime() - new Date(resolveFechaOrden(a) || 0).getTime()
);
const workOrdersCounts = {
  programadas: workOrders.filter((o: any) => {
    const estado = (o.estado_ot || '').toLowerCase();
    return estado === 'en_diagnostico_programado' || estado === 'pendiente';
  }).length,
  diagnostico: workOrders.filter((o: any) => (o.estado_ot || '').toLowerCase() === 'en curso').length,
  reparacion: workOrders.filter((o: any) => {
    const estado = (o.estado_ot || '').toLowerCase();
    return estado === 'en_reparacion' || estado === 'en reparación';
  }).length,
  finalizadas: workOrders.filter((o: any) => (o.estado_ot || '').toLowerCase() === 'finalizada').length,
  retrasadas: orderStats.retrasadas,
  total: workOrders.length,
};

  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const loadSolicitudesHistoricas = async () => {
    if (!hasEnv) {
      setSolicitudesHistoricas([]);
      return;
    }

        try {
          const { data, error } = await supabase
            .from('solicitud_diagnostico')
            .select(`
              id_solicitud_diagnostico,
              fecha_solicitada,
              bloque_horario,
              bloque_horario_confirmado,
              tipo_problema,
              prioridad,
              estado_solicitud,
              comentarios,
              fecha_confirmada,
              created_at,
              empleado:empleado_id (nombre, apellido_paterno),
              vehiculo:vehiculo_id (patente_vehiculo)
            `)
            .order('fecha_confirmada', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      let historicas = (data ?? [])
              .filter((item: any) => {
                const estado = (item.estado_solicitud || '').toLowerCase();
                return ['aprobada', 'aprobado', 'confirmada', 'confirmado', 'rechazada', 'rechazado'].includes(estado);
              })
              .map((item: any) => ({
                id_solicitud_diagnostico: item.id_solicitud_diagnostico,
                fecha_solicitada: item.fecha_solicitada,
                bloque_horario: item.bloque_horario,
                bloque_horario_confirmado: item.bloque_horario_confirmado,
                tipo_problema: item.tipo_problema,
                prioridad: item.prioridad,
                estado_solicitud: (item.estado_solicitud || '').toLowerCase(),
                comentarios: item.comentarios,
                fecha_confirmada: item.fecha_confirmada,
                fecha_resuelta: item.fecha_confirmada,
                created_at: item.created_at,
          empleado_nombre: (() => {
            if (item.empleado) {
              const nombre = `${item.empleado.nombre || ''} ${item.empleado.apellido_paterno || ''}`.trim();
              return nombre || 'N/A';
            }
            return 'N/A';
          })(),
                patente_vehiculo: item.vehiculo?.patente_vehiculo || 'N/A',
              }));

      const idsSupabase = new Set(historicas.map((h) => h.id_solicitud_diagnostico));

      try {
        const { data: ordenesHistorial, error: ordenesError } = await supabase
          .from('orden_trabajo')
          .select(`
            id_orden_trabajo,
            fecha_inicio_ot,
            estado_ot,
            solicitud_diagnostico_id,
            solicitud:solicitud_diagnostico_id (
              id_solicitud_diagnostico,
              fecha_solicitada,
              bloque_horario,
              bloque_horario_confirmado,
              tipo_problema,
              prioridad,
              estado_solicitud,
              comentarios,
              fecha_confirmada,
              created_at,
              empleado_id,
              patente_vehiculo
            ),
            empleado:empleado_id (nombre, apellido_paterno),
            vehiculo:vehiculo_id (patente_vehiculo)
          `)
          .order('fecha_inicio_ot', { ascending: false })
          .limit(100);

        if (!ordenesError && Array.isArray(ordenesHistorial)) {
          ordenesHistorial.forEach((orden: any) => {
            const solicitud = orden.solicitud || null;
            const id = solicitud?.id_solicitud_diagnostico || orden.solicitud_diagnostico_id;
            if (!id || idsSupabase.has(id)) return;

            const empleadoNombre = (() => {
              if (orden.empleado) {
                const nombreEmpleado = `${orden.empleado.nombre || ''} ${
                  orden.empleado.apellido_paterno || ''
                }`.trim();
                if (nombreEmpleado) {
                  return nombreEmpleado;
                }
              }
              return 'N/A';
            })();

            historicas.push({
              id_solicitud_diagnostico: id,
              fecha_solicitada: solicitud?.fecha_solicitada || null,
              bloque_horario: solicitud?.bloque_horario || null,
              bloque_horario_confirmado:
                solicitud?.bloque_horario_confirmado || solicitud?.bloque_horario || null,
              tipo_problema: solicitud?.tipo_problema || 'Diagnóstico',
              prioridad: solicitud?.prioridad || 'normal',
              estado_solicitud: (solicitud?.estado_solicitud || orden.estado_ot || 'confirmada').toLowerCase(),
              comentarios: solicitud?.comentarios || '',
              fecha_confirmada: solicitud?.fecha_confirmada || orden.fecha_inicio_ot || null,
              fecha_resuelta: orden.fecha_inicio_ot || solicitud?.fecha_confirmada || null,
              created_at: solicitud?.created_at || orden.fecha_inicio_ot || null,
              empleado_nombre: empleadoNombre,
              patente_vehiculo:
                solicitud?.patente_vehiculo ||
                orden.vehiculo?.patente_vehiculo ||
                solicitud?.patente_vehiculo ||
                'N/A',
            });
            idsSupabase.add(id);
          });
        }
      } catch (ordenesCatch) {
        console.warn('⚠️ No se pudieron cargar órdenes para historial:', ordenesCatch);
      }

      historicas = historicas.sort(
          (a: any, b: any) =>
          new Date(b.fecha_confirmada || b.created_at || b.fecha_solicitada || 0).getTime() -
          new Date(a.fecha_confirmada || a.created_at || a.fecha_solicitada || 0).getTime()
      );

      setSolicitudesHistoricas(historicas);
    } catch (error) {
      console.error('Error cargando solicitudes históricas:', error);
      setSolicitudesHistoricas([]);
    }
  };

  const [formData, setFormData] = useState({
    tipo_trabajo: '',
    fecha_confirmada: '',
    bloque_horario_confirmado: '',
    box_id: '',
    mecanico_id: '',
  });

  useEffect(() => {
    if (activeSection === 'solicitudes') {
      loadSolicitudes();
    } else if (activeSection === 'vehiculos') {
      loadVehicles();
    } else if (activeSection === 'ordenes') {
      loadWorkOrders();
    } else if (activeSection === 'agenda') {
      loadAgenda();
    } else if (activeSection === 'reportes') {
      loadReportOrders();
    }
    if (activeSection === 'solicitudes') {
      loadSolicitudesHistoricas();
    }
  }, [activeSection]);


  const loadSolicitudes = async () => {
    try {
      setLoading(true);

      if (!hasEnv) {
        setSolicitudes([]);
        setLoading(false);
        return;
      }

          const { data, error } = await supabase
            .from('solicitud_diagnostico')
            .select(`
              *,
              empleado:empleado_id(nombre, apellido_paterno),
              vehiculo:vehiculo_id(patente_vehiculo)
            `)
            .eq('estado_solicitud', 'pendiente_confirmacion')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const solicitudesEnriquecidas = (data ?? []).map((solicitud) => {
        const empleadoSupabase = (solicitud as any)?.empleado;
        const empleadoNombre = empleadoSupabase
          ? `${empleadoSupabase.nombre || ''} ${empleadoSupabase.apellido_paterno || ''}`.trim()
          : 'Chofer';
        const patente = (solicitud as any)?.vehiculo?.patente_vehiculo || solicitud.patente_vehiculo || 'N/A';
        return {
          ...solicitud,
          empleado_nombre: empleadoNombre,
          patente_vehiculo: patente,
        };
      });

      const sortByRecent = (lista: any[]) =>
        [...lista].sort((a, b) => {
          const dateA =
            (a.created_at && new Date(a.created_at).getTime()) ||
            (a.fecha_confirmada && new Date(a.fecha_confirmada).getTime()) ||
            (a.fecha_solicitada && new Date(a.fecha_solicitada).getTime()) ||
            0;
          const dateB =
            (b.created_at && new Date(b.created_at).getTime()) ||
            (b.fecha_confirmada && new Date(b.fecha_confirmada).getTime()) ||
            (b.fecha_solicitada && new Date(b.fecha_solicitada).getTime()) ||
            0;
          return dateB - dateA;
        });

      setSolicitudes(sortByRecent(solicitudesEnriquecidas));
    } catch (error) {
      console.error('❌ Error loading solicitudes:', error);
      setSolicitudes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (solicitud: SolicitudDiagnostico) => {
    console.log('🔍 Abriendo modal para solicitud:', solicitud);
    setSelectedSolicitud(solicitud);
    setFormData({
      tipo_trabajo: solicitud.tipo_trabajo || '',
      fecha_confirmada: solicitud.fecha_solicitada,
      bloque_horario_confirmado: solicitud.bloque_horario,
      box_id: solicitud.box_id?.toString() || '',
      mecanico_id: solicitud.mecanico_id?.toString() || '',
    });
    setModalOpen(true);
    setError('');
    setSuccess('');
    console.log('✅ Modal abierto');
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('🔵 handleConfirm llamado');
    console.log('🔵 selectedSolicitud:', selectedSolicitud);
    console.log('🔵 formData:', formData);
    
    if (!selectedSolicitud) {
      console.error('❌ No hay solicitud seleccionada');
      setError('No hay solicitud seleccionada.');
      alert('Error: No hay solicitud seleccionada.');
      return;
    }

    console.log('🔍 Validando formulario:', formData);
    
    if (!formData.tipo_trabajo || !formData.fecha_confirmada || !formData.bloque_horario_confirmado) {
      console.error('❌ Campos faltantes:', {
        tipo_trabajo: formData.tipo_trabajo,
        fecha_confirmada: formData.fecha_confirmada,
        bloque_horario_confirmado: formData.bloque_horario_confirmado,
      });
      const errorMsg = 'Por favor completa todos los campos obligatorios.';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');
    console.log('✅ Iniciando confirmación de solicitud:', selectedSolicitud.id_solicitud_diagnostico);
    console.log('🔍 hasEnv:', hasEnv);
    console.log('🔍 Variables de entorno:', {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'definida' : 'no definida',
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'definida' : 'no definida'
    });

    try {
      let vehiculoIdOT = selectedSolicitud.vehiculo_id || null;

      if (!vehiculoIdOT && selectedSolicitud.patente_vehiculo && hasEnv) {
        try {
          const { data: vehiculoEncontrado, error: vehiculoError } = await supabase
            .from('vehiculo')
            .select('id_vehiculo')
            .eq('patente_vehiculo', selectedSolicitud.patente_vehiculo.toUpperCase())
            .maybeSingle();

          if (!vehiculoError && vehiculoEncontrado) {
            vehiculoIdOT = vehiculoEncontrado.id_vehiculo;
          }
        } catch (vehiculoLookupError) {
          console.warn('⚠️ No se pudo buscar el vehículo en Supabase:', vehiculoLookupError);
        }
      }

      if (!vehiculoIdOT) {
        setProcessing(false);
        const msg =
          'No se encontró un vehículo asociado a la solicitud. Verifica la patente o asigna un vehículo antes de confirmar.';
        setError(msg);
        alert(msg);
        return;
      }

      const solicitudActualizada = {
        ...selectedSolicitud,
        estado_solicitud: 'confirmada' as const,
        tipo_trabajo: formData.tipo_trabajo as 'mantencion' | 'correctivo' | 'emergencia',
        fecha_confirmada: formData.fecha_confirmada,
        bloque_horario_confirmado: formData.bloque_horario_confirmado,
        box_id: formData.box_id ? parseInt(formData.box_id) : null,
        mecanico_id: formData.mecanico_id ? parseInt(formData.mecanico_id) : null,
      };

      // Crear Orden de Trabajo
      const nuevaOT = {
        fecha_inicio_ot: new Date(formData.fecha_confirmada).toISOString(),
        descripcion_ot: `Diagnóstico - ${selectedSolicitud.tipo_problema} - ${
          TIPOS_TRABAJO.find((t) => t.value === formData.tipo_trabajo)?.label
        }`,
        estado_ot: 'en_diagnostico_programado' as const,
        empleado_id: selectedSolicitud.empleado_id,
        vehiculo_id: vehiculoIdOT,
        solicitud_diagnostico_id: selectedSolicitud.id_solicitud_diagnostico,
        hora_confirmada: `${formData.fecha_confirmada} ${formData.bloque_horario_confirmado}`,
      };

      if (!hasEnv) {
        throw new Error('Supabase no está configurado. No es posible confirmar la solicitud.');
      }

          console.log('🔍 Intentando usar Supabase...');

          const { error: updateError } = await supabase
            .from('solicitud_diagnostico')
            .update({
              estado_solicitud: 'confirmada',
              tipo_trabajo: formData.tipo_trabajo,
              fecha_confirmada: formData.fecha_confirmada,
              bloque_horario_confirmado: formData.bloque_horario_confirmado,
              box_id: formData.box_id ? parseInt(formData.box_id) : null,
              mecanico_id: formData.mecanico_id ? parseInt(formData.mecanico_id) : null,
            })
            .eq('id_solicitud_diagnostico', selectedSolicitud.id_solicitud_diagnostico);

          if (updateError) {
        throw updateError;
      }

            const { data: otData, error: otError } = await supabase
              .from('orden_trabajo')
              .insert([nuevaOT])
              .select()
              .single();

      if (otError || !otData) {
        throw otError || new Error('No se pudo crear la Orden de Trabajo en Supabase.');
      }

      const { error: linkError } = await supabase
                .from('solicitud_diagnostico')
                .update({ orden_trabajo_id: otData.id_orden_trabajo })
                .eq('id_solicitud_diagnostico', selectedSolicitud.id_solicitud_diagnostico);

      if (linkError) {
        throw linkError;
      }

      console.log('✅ Proceso de guardado completado exitosamente');
      
      setSuccess('Solicitud confirmada y Orden de Trabajo creada exitosamente.');
      setProcessing(false);
      
      // Cerrar modal inmediatamente
      setModalOpen(false);
      setSelectedSolicitud(null);
      setFormData({
        tipo_trabajo: '',
        fecha_confirmada: '',
        bloque_horario_confirmado: '',
        box_id: '',
        mecanico_id: '',
      });
      
      // Recargar datos inmediatamente
      await loadSolicitudes();
      await loadWorkOrders();
      await loadSolicitudesHistoricas();
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error: any) {
      console.error('❌ Error confirming solicitud:', error);
      const errorMsg = error.message || 'Error al confirmar la solicitud.';
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
      setProcessing(false);
    }
  };

  const handleReject = async (solicitud: SolicitudDiagnostico) => {
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;

    try {
      if (!hasEnv) {
        throw new Error('Supabase no está configurado. No es posible rechazar la solicitud.');
      }

        await supabase
          .from('solicitud_diagnostico')
          .update({ estado_solicitud: 'rechazada' })
          .eq('id_solicitud_diagnostico', solicitud.id_solicitud_diagnostico);

      await loadSolicitudes();
      await loadWorkOrders();
      await loadSolicitudesHistoricas();
      setSuccess('Solicitud rechazada.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error rejecting solicitud:', error);
      setError('Error al rechazar la solicitud.');
    }
  };

  const getBloquesHorario = (fecha: string) => {
    const fechaObj = new Date(fecha + 'T00:00:00');
    const dayOfWeek = fechaObj.getDay();
    return dayOfWeek === 6 ? BLOQUES_HORARIO_SAB : BLOQUES_HORARIO_LV;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
  };

  // Función para cargar agenda (solicitudes confirmadas y órdenes de trabajo)
  const loadAgenda = async () => {
    if (!hasEnv) {
      setAgendaItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const estadosFilter = ESTADOS_AGENDA_PERMITIDOS.map(
        (estado) => `estado_solicitud.eq.${estado}`
      ).join(',');

      const [
        { data: solicitudesDb, error: solicitudesError },
        { data: empleadosDb, error: empleadosError },
        { data: vehiculosDb, error: vehiculosError },
        { data: ordenesDb, error: ordenesError },
      ] = await Promise.all([
        supabase
          .from('solicitud_diagnostico')
          .select(
            'id_solicitud_diagnostico, fecha_confirmada, fecha_solicitada, bloque_horario_confirmado, bloque_horario, tipo_problema, prioridad, estado_solicitud, empleado_id, vehiculo_id, orden_trabajo_id'
          )
          .or(estadosFilter || 'estado_solicitud.eq.confirmada')
          .order('fecha_confirmada', { ascending: true }),
              supabase.from('empleado').select('id_empleado, nombre, apellido_paterno'),
              supabase.from('vehiculo').select('id_vehiculo, patente_vehiculo'),
        supabase.from('orden_trabajo').select('id_orden_trabajo, solicitud_diagnostico_id, mecanico_id, estado_ot'),
            ]);

      if (solicitudesError) throw solicitudesError;
      if (empleadosError) throw empleadosError;
      if (vehiculosError) throw vehiculosError;
      if (ordenesError) throw ordenesError;

            const empleadoMap = new Map<number, any>();
            (empleadosDb || []).forEach((empleado: any) => empleadoMap.set(empleado.id_empleado, empleado));

            const vehiculoMap = new Map<number, any>();
            (vehiculosDb || []).forEach((vehiculo: any) => vehiculoMap.set(vehiculo.id_vehiculo, vehiculo));

            const ordenMap = new Map<number, any>();
            (ordenesDb || []).forEach((orden: any) => {
              if (orden?.solicitud_diagnostico_id) {
                ordenMap.set(orden.solicitud_diagnostico_id, orden);
              }
            });

      const itemsEnriquecidos = (solicitudesDb || [])
        .map((solicitud: any) => {
              const empleado = empleadoMap.get(solicitud.empleado_id);
        const vehiculo = vehiculoMap.get(solicitud.vehiculo_id);
              const orden = ordenMap.get(solicitud.id_solicitud_diagnostico);

          return {
                id: solicitud.id_solicitud_diagnostico,
          fecha: solicitud.fecha_confirmada || solicitud.fecha_solicitada,
                bloque_horario: solicitud.bloque_horario_confirmado || solicitud.bloque_horario,
          patente: solicitud.patente_vehiculo || vehiculo?.patente_vehiculo || 'N/A',
                chofer: empleado ? `${empleado.nombre || ''} ${empleado.apellido_paterno || ''}`.trim() || 'N/A' : 'N/A',
                mecanico: orden?.mecanico_id ? `Mecánico #${orden.mecanico_id}` : 'Sin asignar',
                tipo_problema: solicitud.tipo_problema,
                prioridad: solicitud.prioridad,
                estado: orden?.estado_ot || solicitud.estado_solicitud,
                orden_id: orden?.id_orden_trabajo || solicitud.orden_trabajo_id || null,
          };
        })
        .sort((a, b) => {
        const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return dateA - dateB;
      });

      setAgendaItems(itemsEnriquecidos);
    } catch (error) {
      console.error('Error loading agenda:', error);
      setAgendaItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Funciones auxiliares para el calendario
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return agendaItems.filter((item: any) => item.fecha === dateStr);
  };

  const handleDateClick = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    
    const appointments = getAppointmentsForDate(clickedDate);
    setSelectedDayAppointments(appointments);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentMonth.getMonth() === today.getMonth() && 
           currentMonth.getFullYear() === today.getFullYear();
  };

  const hasAppointments = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return getAppointmentsForDate(date).length > 0;
  };

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDayAppointments([]);
      return;
    }
    setSelectedDayAppointments(getAppointmentsForDate(selectedDate));
  }, [agendaItems, selectedDate]);

  // Función para cargar vehículos
  const loadVehicles = async () => {
    if (!hasEnv) {
      setVehicles([]);
      setVehicleStats({ enRuta: 0, enTaller: 0, enEspera: 0, fueraServicio: 0 });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
          const { data, error } = await supabase
            .from('vehiculo')
            .select(`
              *,
              modelo:modelo_vehiculo_id(nombre_modelo, marca:marca_vehiculo_id(nombre_marca)),
              tipo:tipo_vehiculo_id(tipo_vehiculo),
              sucursal:sucursal_id(nombre_sucursal)
            `)
            .order('patente_vehiculo', { ascending: true });
          
      if (error) {
        throw error;
        }

      const vehiclesData = data ?? [];
      setVehicles(vehiclesData);

      const stats = {
        enRuta: vehiclesData.filter((v: any) => v.estado_vehiculo === 'en_ruta').length,
        enTaller: vehiclesData.filter((v: any) => v.estado_vehiculo === 'en_taller').length,
        enEspera: vehiclesData.filter((v: any) => v.estado_vehiculo === 'disponible').length,
        fueraServicio: vehiclesData.filter((v: any) => v.estado_vehiculo === 'fuera_de_servicio').length,
      };
      setVehicleStats(stats);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      setVehicles([]);
      setVehicleStats({ enRuta: 0, enTaller: 0, enEspera: 0, fueraServicio: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar órdenes de trabajo
  const loadWorkOrders = async () => {
    if (!hasEnv) {
      setWorkOrders([]);
      setOrderStats({ programadas: 0, enDiagnostico: 0, enReparacion: 0, retrasadas: 0 });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
          const { data, error } = await supabase
            .from('orden_trabajo')
            .select(`
              *,
              empleado:empleado_id(nombre, apellido_paterno),
              vehiculo:vehiculo_id(patente_vehiculo)
            `)
            .order('fecha_inicio_ot', { ascending: false });
          
      if (error) throw error;

      const ordersData = data ?? [];
      const ordenesOrdenadas = ordersData
        .slice()
        .sort((a, b) => {
        const fechaA = new Date(a.created_at || a.fecha_inicio_ot || 0).getTime();
        const fechaB = new Date(b.created_at || b.fecha_inicio_ot || 0).getTime();
          return fechaB - fechaA;
      });

      setWorkOrders(ordenesOrdenadas);

      const today = new Date();
      const stats = {
        programadas: ordersData.filter((o: any) => o.estado_ot === 'en_diagnostico_programado' || o.estado_ot === 'pendiente').length,
        enDiagnostico: ordersData.filter((o: any) => o.estado_ot === 'en curso').length,
        enReparacion: ordersData.filter((o: any) => o.estado_ot === 'en curso').length,
        retrasadas: ordersData.filter((o: any) => {
          if (!o.fecha_inicio_ot) return false;
          const fechaInicio = new Date(o.fecha_inicio_ot);
          const diffDays = (today.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24);
          return diffDays > 7 && o.estado_ot !== 'finalizada';
        }).length,
      };
      setOrderStats(stats);
    } catch (error) {
      console.error('Error loading work orders:', error);
      setWorkOrders([]);
      setOrderStats({ programadas: 0, enDiagnostico: 0, enReparacion: 0, retrasadas: 0 });
    } finally {
      setLoading(false);
    }
  };

  const loadReportOrders = async () => {
    if (!hasEnv) {
      setReportOrders([]);
      setReportOrderStats({ enCurso: 0, finalizadas: 0, pendientesCierre: 0, cerradas: 0 });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
          const { data, error } = await supabase
            .from('orden_trabajo')
            .select(
              `
              id_orden_trabajo,
              descripcion_ot,
              estado_ot,
              estado_cierre,
              prioridad_ot,
              fecha_inicio_ot,
              fecha_cierre_ot,
              fecha_cierre_tecnico,
              detalle_reparacion,
              vehiculo:vehiculo_id(patente_vehiculo),
              solicitud:solicitud_diagnostico_id(
                tipo_problema,
                prioridad,
                patente_vehiculo
              )
            `
            )
            .order('created_at', { ascending: false });

      if (error) throw error;

      const normalizadas = (data ?? []).map((orden: any) => {
        const estadoCierre = (orden.estado_cierre || 'pendiente').toLowerCase();
        const estadoOT = (orden.estado_ot || '').toLowerCase();
        return {
          id_orden_trabajo: orden.id_orden_trabajo,
          descripcion_ot: orden.descripcion_ot || orden.detalle_reparacion || 'Sin descripción',
          estado_ot: orden.estado_ot || 'desconocido',
          estado_cierre: orden.estado_cierre || 'pendiente',
          prioridad_ot: orden.prioridad_ot || 'normal',
          fecha_inicio_ot: orden.fecha_inicio_ot || null,
          fecha_cierre_ot: orden.fecha_cierre_ot || null,
          fecha_cierre_tecnico: orden.fecha_cierre_tecnico || null,
          detalle_reparacion: orden.detalle_reparacion || '',
          patente_vehiculo:
            orden.patente_vehiculo ||
            orden.vehiculo?.patente_vehiculo ||
            orden.solicitud?.patente_vehiculo ||
            'N/A',
          tipo_problema: orden.solicitud?.tipo_problema || orden.descripcion_ot || 'Diagnóstico',
          prioridad: orden.solicitud?.prioridad || orden.prioridad_ot || 'normal',
          _estadoCierreLower: estadoCierre,
          _estadoOTLower: estadoOT,
        };
      });

      const enCurso = normalizadas.filter(
        (o) => o._estadoOTLower !== 'finalizada' && o._estadoCierreLower !== 'cerrada'
      ).length;
      const finalizadas = normalizadas.filter((o) => o._estadoOTLower === 'finalizada').length;
      const cerradas = normalizadas.filter((o) => o._estadoCierreLower === 'cerrada').length;
      const pendientesCierre = normalizadas.filter(
        (o) => o._estadoOTLower === 'finalizada' && o._estadoCierreLower !== 'cerrada'
      ).length;

      setReportOrderStats({
        enCurso,
        finalizadas,
        pendientesCierre,
        cerradas,
      });

      const ordenadas = normalizadas.sort(
        (a, b) =>
          new Date(b.fecha_cierre_tecnico || b.fecha_cierre_ot || b.fecha_inicio_ot || 0).getTime() -
          new Date(a.fecha_cierre_tecnico || a.fecha_cierre_ot || a.fecha_inicio_ot || 0).getTime()
      );

      setReportOrders(ordenadas);
    } catch (error) {
      console.error('❌ Error cargando reportes de OT:', error);
      setReportOrders([]);
      setReportOrderStats({ enCurso: 0, finalizadas: 0, pendientesCierre: 0, cerradas: 0 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando solicitudes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="text-green-600" size={24} />
          <p className="text-green-800 font-semibold">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <p className="text-red-800 font-semibold">{error}</p>
        </div>
      )}

      {/* Contenido de Agenda del Taller */}
      {activeSection === 'agenda' && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10 space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700">
                  <CalendarDays size={14} />
                  Planificación coordinada
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Agenda del Taller</h1>
                <p className="max-w-2xl text-slate-600">
                  Visualiza los diagnósticos confirmados, identifica bloques disponibles y prioriza los casos urgentes
                  para mantener el flujo operativo del taller.
                </p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-white/90 px-5 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha seleccionada</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{formattedSelectedDateLabel}</p>
                {selectedDate && (
                  <p className="text-sm text-slate-500">Citas programadas: {citasSeleccionadas}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Citas agendadas</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">{totalEventosAgenda}</p>
                <p className="text-xs text-slate-500">Diagnósticos confirmados para este mes.</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Próximas 24h</p>
                <p className="mt-2 text-2xl font-bold text-emerald-600">{eventosPorVenir}</p>
                <p className="text-xs text-slate-500">Citas con fecha igual o posterior a hoy.</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Casos urgentes</p>
                <p className="mt-2 text-2xl font-bold text-rose-600">{eventosUrgentes}</p>
                <p className="text-xs text-slate-500">Solicitudes marcadas como prioridad urgente.</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Bloques del día</p>
                <p className="mt-2 text-2xl font-bold text-indigo-600">
                  {selectedDate ? citasSeleccionadas : '--'}
                </p>
                <p className="text-xs text-slate-500">
                  Selecciona un día en el calendario para revisar los bloques ocupados.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-600/10 to-indigo-500/10 px-5 py-4">
                  <button
                    onClick={previousMonth}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                      aria-label="Mes anterior"
                  >
                      <ChevronLeft size={16} />
                      Anterior
                  </button>
                    <h2 className="text-lg font-semibold capitalize text-slate-900">
                    {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </h2>
                  <button
                    onClick={nextMonth}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                      aria-label="Mes siguiente"
                  >
                      Siguiente
                      <ChevronRight size={16} />
                  </button>
                </div>

                  <div className="grid grid-cols-7 gap-2 px-5 pt-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                      <span key={day}>{day}</span>
                  ))}
                </div>

                  <div className="grid grid-cols-7 gap-2 px-5 pb-5">
                  {(() => {
                    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
                      const buttons = [];
                    
                    for (let i = 0; i < startingDayOfWeek; i++) {
                        buttons.push(<div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent" />);
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                      const hasAppts = hasAppointments(day);
                      const isTodayDay = isToday(day);
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                        const isSelected =
                          selectedDate &&
                        date.getDate() === selectedDate.getDate() &&
                        date.getMonth() === selectedDate.getMonth() &&
                        date.getFullYear() === selectedDate.getFullYear();
                      
                        buttons.push(
                        <button
                          key={day}
                          onClick={() => handleDateClick(day)}
                            className={`relative flex aspect-square items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : isTodayDay
                                ? 'border border-blue-300 bg-blue-50 text-blue-700'
                                : hasAppts
                                ? 'border border-emerald-200 bg-emerald-50 text-slate-800 hover:border-emerald-300'
                                : 'border border-transparent text-slate-600 hover:border-slate-200'
                            }`}
                          >
                            {day}
                          {hasAppts && !isSelected && (
                              <span className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      );
                    }
                    
                      return buttons;
                  })()}
                </div>

                  <div className="flex flex-wrap gap-4 border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-blue-500" />
                      Seleccionado
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-blue-200" />
                      Hoy
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-300" />
                      Con citas
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedDate ? formattedSelectedDateLabel : 'Selecciona un día'}
                </h3>
                    <p className="text-sm text-slate-500">
                      {selectedDate
                        ? 'Revisa los diagnósticos y reparaciones confirmadas para esta fecha.'
                        : 'Haz clic en un día del calendario para ver sus detalles.'}
                    </p>
                    <div className="mt-4">
                {selectedDate ? (
                        citasSeleccionadas > 0 ? (
                          <div className="space-y-4">
                      {selectedDayAppointments.map((appt) => (
                              <div
                                key={appt.id}
                                className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Clock size={16} className="text-blue-500" />
                                    {appt.bloque_horario}
                                  </div>
                            {appt.prioridad === 'urgente' && (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                      Urgente
                              </span>
                            )}
                          </div>
                                <div className="mt-3 space-y-2 text-xs text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <Truck size={14} className="text-slate-400" />
                                    <span>
                              <strong>Patente:</strong> {appt.patente}
                                    </span>
                            </div>
                                  <div className="flex items-center gap-2">
                                    <User size={14} className="text-slate-400" />
                                    <span>
                              <strong>Chofer:</strong> {appt.chofer}
                                    </span>
                            </div>
                                  <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-slate-400" />
                                    <span>
                              <strong>Mecánico:</strong> {appt.mecanico}
                                    </span>
                            </div>
                                  <div className="flex items-center gap-2">
                                    <ClipboardList size={14} className="text-slate-400" />
                                    <span>
                                      <strong>Diagnóstico:</strong> {appt.tipo_problema}
                                </span>
                              </div>
                                </div>
                                <div className="mt-3 border-t border-slate-100 pt-2">
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      appt.estado === 'en_diagnostico_programado'
                                        ? 'bg-blue-100 text-blue-700'
                                        : appt.estado === 'en curso'
                                        ? 'bg-amber-100 text-amber-700'
                                        : appt.estado === 'finalizada'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {appt.orden_id ? `OT #${appt.orden_id}` : 'Sin OT'}
                                    <span className="uppercase">{appt.estado || 'pendiente'}</span>
                                  </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 p-8 text-center">
                            <Calendar size={36} className="text-slate-300" />
                            <p className="mt-3 text-sm text-slate-500">
                              No hay citas programadas para este día.
                            </p>
                    </div>
                  )
                ) : (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 p-8 text-center">
                          <Calendar size={36} className="text-slate-300" />
                          <p className="mt-3 text-sm text-slate-500">
                            Selecciona una fecha para ver los detalles de la agenda.
                          </p>
                  </div>
                )}
              </div>
            </div>
          </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Solicitudes de Diagnóstico */}
      {activeSection === 'solicitudes' && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700">
                  <ClipboardList size={14} />
                  Gestión de solicitudes
            </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Solicitudes de Diagnóstico / Reparación</h1>
                <p className="max-w-2xl text-slate-600">
                  Aprueba, reprograma o revisa el historial de solicitudes ingresadas por los choferes. Mantén todo el
                  flujo documentado en un solo lugar.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-blue-100 bg-white/90 p-3 text-center shadow-sm">
                  <p className="text-2xl font-bold text-blue-600">{solicitudes.length}</p>
                  <p className="text-xs text-slate-500">Pendientes</p>
            </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-center shadow-sm">
                  <p className="text-2xl font-bold text-emerald-600">{historialAprobadas}</p>
                  <p className="text-xs text-slate-500">Aprobadas</p>
              </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-center shadow-sm">
                  <p className="text-2xl font-bold text-rose-600">{historialRechazadas}</p>
                  <p className="text-xs text-slate-500">Rechazadas</p>
            </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-center shadow-sm">
                  <p className="text-2xl font-bold text-indigo-600">{historialTotal}</p>
                  <p className="text-xs text-slate-500">Historial total</p>
          </div>
        </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <FileText size={16} className="text-blue-500" />
                <span>Solicitudes pendientes</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSolicitudViewMode('pendientes')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    solicitudViewMode === 'pendientes'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setSolicitudViewMode('historial')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    solicitudViewMode === 'historial'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Historial
                </button>
              </div>
            </div>

            {solicitudViewMode === 'pendientes' ? (
              solicitudes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 py-10 text-center shadow-sm">
                  <FileText size={48} className="text-slate-300" />
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">No hay solicitudes nuevas</h3>
                  <p className="text-sm text-slate-500">Todas las solicitudes han sido procesadas.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {solicitudes.map((solicitud) => (
            <div
              key={solicitud.id_solicitud_diagnostico}
                      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
                      <div className="p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                <Truck size={18} className="text-blue-500" />
                        {solicitud.patente_vehiculo || 'Patente no disponible'}
                    </div>
                    {solicitud.prioridad === 'urgente' && (
                                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
                                  Urgente
                      </span>
                    )}
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                                #{solicitud.id_solicitud_diagnostico}
                              </span>
                  </div>

                            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                              <div className="flex items-center gap-2">
                                <User size={16} className="text-slate-400" />
                                <span>
                        <strong>Chofer:</strong> {solicitud.empleado_nombre || 'No disponible'}
                      </span>
                    </div>
                              <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-slate-400" />
                                <span>
                        <strong>Problema:</strong> {solicitud.tipo_problema}
                      </span>
                    </div>
                              <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-slate-400" />
                                <span>
                        <strong>Fecha solicitada:</strong> {formatDate(solicitud.fecha_solicitada)}
                      </span>
                    </div>
                              <div className="flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" />
                                <span>
                        <strong>Horario:</strong> {solicitud.bloque_horario}
                      </span>
                    </div>
                  </div>

                  {solicitud.comentarios && (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        <strong>Comentarios:</strong> {solicitud.comentarios}
                    </div>
                  )}

                  {solicitud.fotos && solicitud.fotos.length > 0 && (
                              <div className="mt-4">
                                <p className="text-sm font-semibold text-slate-700">Fotos adjuntas</p>
                                <div className="mt-2 grid grid-cols-4 gap-2">
                        {solicitud.fotos.slice(0, 4).map((foto: string, index: number) => (
                          <img
                            key={index}
                            src={foto}
                            alt={`Foto ${index + 1}`}
                                      className="h-20 w-full rounded-lg border border-slate-200 object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                          <div className="flex items-center gap-2 self-start">
                  <button
                    onClick={() => handleOpenModal(solicitud)}
                              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  >
                    <CheckCircle size={18} />
                    Revisar y Confirmar
                  </button>
                  <button
                    onClick={() => handleReject(solicitud)}
                              className="inline-flex items-center gap-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-600 shadow hover:bg-rose-200"
                  >
                    <XCircle size={18} />
                    Rechazar
                  </button>
                          </div>
                </div>
              </div>
            </div>
          ))}
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Historial de solicitudes</h2>
                    <p className="text-sm text-slate-500">
                      Revisa las solicitudes aprobadas o rechazadas anteriormente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-700">
                      <CheckCircle size={14} />
                      Aprobadas
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-2.5 py-0.5 font-semibold text-rose-700">
                      <XCircle size={14} />
                      Rechazadas
                    </span>
                  </div>
                </div>

                {historialTotal === 0 ? (
                  <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 py-10 text-center">
                    <ClipboardList size={36} className="text-slate-300" />
                    <p className="mt-3 text-sm text-slate-500">Todavía no hay solicitudes finalizadas.</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {solicitudesHistoricas.map((solicitud) => {
                      const estadoLower = (solicitud.estado_solicitud || '').toLowerCase();
                      const estadoAprobado = isEstadoAprobado(estadoLower);
                      const estadoRechazado = isEstadoRechazado(estadoLower);
                      const estadoLabel = formatEstadoSolicitud(estadoLower);
                      const fechaResolucion =
                        solicitud.fecha_confirmada || solicitud.created_at || solicitud.fecha_solicitada || null;
                      return (
                        <div
                          key={`hist-${solicitud.id_solicitud_diagnostico}`}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  estadoAprobado
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : estadoRechazado
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {estadoAprobado ? 'A' : estadoRechazado ? 'R' : 'C'}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {solicitud.patente_vehiculo || 'Patente no disponible'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Resolución:{' '}
                                  {fechaResolucion ? new Date(fechaResolucion).toLocaleDateString('es-ES') : 'Sin fecha'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                estadoAprobado
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : estadoRechazado
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {estadoLabel}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                            <span>
                              <strong>Chofer:</strong> {solicitud.empleado_nombre || 'N/A'}
                            </span>
                            <span>
                              <strong>Problema:</strong> {solicitud.tipo_problema}
                            </span>
                            <span>
                              <strong>Fecha solicitada:</strong>{' '}
                              {solicitud.fecha_solicitada ? formatDate(solicitud.fecha_solicitada) : 'N/A'}
                            </span>
                          </div>

                          {solicitud.comentarios && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                              <strong>Comentarios del chofer:</strong> {solicitud.comentarios}
        </div>
      )}
                          {solicitud.comentarios_respuesta && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                              <strong>Notas del coordinador:</strong> {solicitud.comentarios_respuesta}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido de Emergencias en Ruta */}
      {activeSection === 'emergencias' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergencias en Ruta</h1>
          <p className="text-gray-600 mb-6">Casos críticos con estado: en revisión, en atención, resueltos.</p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay emergencias activas</h3>
            <p className="text-gray-600">
              Aquí aparecerán las emergencias reportadas en ruta que requieran atención inmediata.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Órdenes de Trabajo en Curso */}
      {activeSection === 'ordenes' && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-slate-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10 space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Activity size={14} />
                  Flujo operativo
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Órdenes de Trabajo en Curso</h1>
                <p className="max-w-2xl text-slate-600">
                  Visualiza el estado de cada orden, desde la programación del diagnóstico hasta el cierre técnico.
                  Prioriza las tareas con retrasos y haz seguimiento a las OT finalizadas recientemente.
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white/90 px-5 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total de OT activas</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{workOrdersCounts.total}</p>
                <p className="text-sm text-slate-500">Incluye programadas, en ejecución y finalizadas.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-blue-100 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-500">
                  <ClipboardList size={14} /> Programadas
            </div>
                <p className="mt-2 text-2xl font-bold text-blue-600">{workOrdersCounts.programadas}</p>
            </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  <Clock size={14} /> En diagnóstico
            </div>
                <p className="mt-2 text-2xl font-bold text-amber-600">{workOrdersCounts.diagnostico}</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  <Wrench size={14} /> En reparación
                </div>
                <p className="mt-2 text-2xl font-bold text-indigo-600">{workOrdersCounts.reparacion}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  <CheckCircle size={14} /> Finalizadas
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-600">{workOrdersCounts.finalizadas}</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-600">
                  <AlertCircle size={14} /> Retrasadas
                </div>
                <p className="mt-2 text-2xl font-bold text-rose-600">{workOrdersCounts.retrasadas}</p>
            </div>
          </div>
              
            {workOrdersCounts.total === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 py-10 text-center shadow-sm">
                <Settings size={48} className="text-slate-300" />
                <h3 className="mt-3 text-lg font-semibold text-slate-900">No hay órdenes de trabajo registradas</h3>
                <p className="text-sm text-slate-500">
                  Cuando se creen órdenes de trabajo desde el taller, podrás seguirlas paso a paso en este panel.
              </p>
            </div>
          ) : (
              <div className="grid gap-6 lg:grid-cols-7">
                <div className="space-y-6 lg:col-span-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Línea de tiempo de órdenes
                  </h2>
                  <div className="relative border-l border-slate-200 pl-4">
                    <div className="absolute -left-[6px] top-0 bottom-0 border-l-2 border-dashed border-slate-200" />
                    <div className="space-y-6">
                      {workOrdersSorted.map((order) => {
                        const estadoInfo = getEstadoOTInfo(order.estado_ot);
                        const fechaInicio = formatFechaCorta(order.fecha_inicio_ot);
                        const fechaCierre = formatFechaCorta(order.fecha_cierre_ot);
                        const empleadoNombre =
                          order.empleado?.nombre
                            ? `${order.empleado.nombre} ${order.empleado.apellido_paterno || ''}`.trim()
                            : order.empleado_nombre || 'Sin asignar';
                        return (
                          <div key={order.id_orden_trabajo} className="relative pl-6">
                            <span
                              className={`absolute left-0 top-4 h-3 w-3 rounded-full border-2 border-white shadow ${estadoInfo.dot}`}
                            />
                            <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-[2px] hover:shadow-md">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-semibold text-slate-400">OT #{order.id_orden_trabajo}</span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estadoInfo.badge}`}>
                                  {estadoInfo.label}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  Prioridad: {(order.prioridad_ot || order.prioridad || 'normal').toUpperCase()}
                        </span>
                      </div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                                <span>
                                  <strong>Vehículo:</strong>{' '}
                                  {order.patente_vehiculo || order.vehiculo?.patente_vehiculo || 'N/A'}
                                </span>
                                <span>
                                  <strong>Responsable:</strong> {empleadoNombre || 'Sin asignar'}
                                </span>
                                <span>
                                  <strong>Inicio:</strong> {fechaInicio}
                                </span>
                                <span>
                                  <strong>Cierre:</strong> {order.fecha_cierre_ot ? fechaCierre : 'Pendiente'}
                                </span>
                      </div>
                      {order.descripcion_ot && (
                                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                                  {order.descripcion_ot}
                                </p>
                      )}
                    </div>
                  </div>
                        );
                      })}
                </div>
                  </div>
                </div>

                <div className="space-y-4 lg:col-span-3">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Últimas finalizadas
                    </h3>
                    {workOrdersCounts.finalizadas === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">Todavía no hay OT marcadas como finalizadas.</p>
                    ) : (
                      <ul className="mt-3 space-y-3 text-xs text-slate-600">
                        {workOrdersSorted
                          .filter((ot) => (ot.estado_ot || '').toLowerCase() === 'finalizada')
                          .slice(0, 4)
                          .map((ot) => (
                            <li key={`finalizada-${ot.id_orden_trabajo}`} className="flex items-start gap-2">
                              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                              <div>
                                <p className="font-semibold text-slate-900">OT #{ot.id_orden_trabajo}</p>
                                <p>{formatFechaCorta(ot.fecha_cierre_ot)}</p>
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-600">
                      Seguimiento de retrasos
                    </h3>
                    <p className="mt-2 text-xs text-rose-700">
                      {workOrdersCounts.retrasadas > 0
                        ? 'Revisa los tiempos de inicio y confirma si requieren replanificación.'
                        : 'No hay OT retrasadas en este momento.'}
                    </p>
                  </div>
                </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Contenido de Estado de Vehículos */}
      {activeSection === 'vehiculos' && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10 space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Truck size={14} />
                  Estado de la flota
            </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Estado de Vehículos</h1>
                <p className="max-w-2xl text-slate-600">
                  Monitorea disponibilidad, kilometraje y sucursal de cada vehículo. Identifica rápidamente unidades en
                  mantenimiento o fuera de servicio para replanificar rutas.
                </p>
            </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-100 bg-white/90 p-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Activos</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">
                    {vehicleStats.enRuta + vehicleStats.enEspera}
                  </p>
            </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Disponibles</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">{vehicleStats.enEspera}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">En Taller</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">{vehicleStats.enTaller}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Fuera de servicio</p>
                  <p className="mt-1 text-2xl font-bold text-rose-600">{vehicleStats.fueraServicio}</p>
                </div>
            </div>
          </div>
              
          {vehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 py-10 text-center shadow-sm">
                <Truck size={48} className="text-slate-300" />
                <h3 className="mt-3 text-lg font-semibold text-slate-900">No hay vehículos registrados</h3>
                <p className="text-sm text-slate-500">
                  Cuando se agreguen vehículos a la flota, se mostrarán aquí con su estado de disponibilidad.
              </p>
            </div>
          ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Resumen por estado
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      {
                        label: 'En ruta',
                        value: vehicleStats.enRuta,
                        classes: 'bg-emerald-100 text-emerald-700',
                        icon: '🚚',
                        description: 'Vehículos actualmente asignados a rutas o diagnósticos.',
                      },
                      {
                        label: 'En taller',
                        value: vehicleStats.enTaller,
                        classes: 'bg-amber-100 text-amber-700',
                        icon: '🛠️',
                        description: 'Vehículos siendo intervenidos en mantenimiento.',
                      },
                      {
                        label: 'Disponibles',
                        value: vehicleStats.enEspera,
                        classes: 'bg-blue-100 text-blue-700',
                        icon: '✅',
                        description: 'Listos para asignación inmediata.',
                      },
                      {
                        label: 'Fuera de servicio',
                        value: vehicleStats.fueraServicio,
                        classes: 'bg-rose-100 text-rose-700',
                        icon: '⛔',
                        description: 'No disponibles por fallas críticas o retiro.',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-[2px] hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{item.icon}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.classes}`}
                          >
                            {item.label}
                        </span>
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900">{item.value}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <p className="text-sm font-semibold text-slate-700">Detalle por vehículo</p>
                    <p className="text-xs text-slate-500">{vehicles.length} unidades</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {vehicles.map((vehicle) => {
                      const estado = (vehicle.estado_vehiculo || '').toLowerCase();
                      const estadoConfig =
                        estado === 'disponible'
                          ? { label: 'Disponible', badge: 'bg-emerald-100 text-emerald-700' }
                          : estado === 'en_ruta'
                          ? { label: 'En Ruta', badge: 'bg-blue-100 text-blue-700' }
                          : estado === 'en_taller'
                          ? { label: 'En Taller', badge: 'bg-amber-100 text-amber-700' }
                          : estado === 'fuera_de_servicio'
                          ? { label: 'Fuera de Servicio', badge: 'bg-rose-100 text-rose-700' }
                          : { label: estado || 'Sin estado', badge: 'bg-slate-100 text-slate-600' };
                      return (
                        <div
                          key={vehicle.id_vehiculo}
                          className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-slate-900">
                                {vehicle.patente_vehiculo}
                              </span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoConfig.badge}`}>
                                {estadoConfig.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {vehicle.modelo?.marca?.nombre_marca || 'N/A'} ·{' '}
                              {vehicle.modelo?.nombre_modelo || 'Modelo indefinido'}
                            </p>
                            <p className="text-xs text-slate-400">
                              Tipo: {vehicle.tipo?.tipo_vehiculo || 'N/A'} · Sucursal:{' '}
                              {vehicle.sucursal?.nombre_sucursal || 'Sin asignar'}
                            </p>
                          </div>
                          <div className="text-xs text-slate-500 md:text-right">
                            <p>
                              <strong>Kilometraje:</strong>{' '}
                              {vehicle.kilometraje_vehiculo
                                ? `${vehicle.kilometraje_vehiculo.toLocaleString()} km`
                                : 'N/A'}
                            </p>
                            <p>
                              <strong>Última actualización:</strong>{' '}
                              {vehicle.updated_at
                                ? new Date(vehicle.updated_at).toLocaleDateString('es-ES')
                                : 'Sin dato'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Contenido de Reportes Operativos */}
      {activeSection === 'reportes' && (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-slate-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10 space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-600/10 px-3 py-1 text-xs font-semibold text-sky-700">
                  <BarChart3 size={14} />
                  Reportes operativos
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">Reportes Operativos</h1>
                <p className="max-w-2xl text-slate-600">
                  Indicadores clave del desempeño del taller: tiempos de atención, asistencias en ruta y la situación de
                  la flota. Usa esta vista como tablero ejecutivo.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última actualización</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-500">Datos sincronizados desde Supabase.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-sky-100 bg-white/95 p-4 shadow-sm">
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-sky-500">
                  <Clock size={16} />
                  Tiempo promedio de respuesta
                  </div>
                <p className="mt-3 text-2xl font-bold text-sky-600">-- horas</p>
                <p className="text-xs text-slate-500">
                  Calculado desde la confirmación del diagnóstico hasta el cierre técnico.
                </p>
                </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  <Activity size={16} />
                  Asistencias en ruta (mes)
                  </div>
                <p className="mt-3 text-2xl font-bold text-emerald-600">0</p>
                <p className="text-xs text-slate-500">Total de solicitudes de emergencia atendidas en el mes.</p>
                </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-rose-600">
                  <Truck size={16} />
                  Vehículos inactivos
                  </div>
                <p className="mt-3 text-2xl font-bold text-rose-600">{vehicleStats.fueraServicio}</p>
                <p className="text-xs text-slate-500">
                  Unidades marcadas fuera de servicio por fallas críticas o mantención extendida.
                </p>
                </div>
              </div>
              
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-4">
                Órdenes de Trabajo
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
                {[ 
                  {
                    label: 'En curso',
                    value: reportOrderStats.enCurso,
                    classes: 'bg-sky-100 text-sky-700',
                    description: 'Diagnósticos y reparaciones activas.',
                  },
                  {
                    label: 'Finalizadas',
                    value: reportOrderStats.finalizadas,
                    classes: 'bg-emerald-100 text-emerald-700',
                    description: 'OT completadas por el equipo técnico.',
                  },
                  {
                    label: 'Pendientes de cierre',
                    value: reportOrderStats.pendientesCierre,
                    classes: 'bg-amber-100 text-amber-700',
                    description: 'Finalizadas pero sin cierre técnico.',
                  },
                  {
                    label: 'Cierre técnico completado',
                    value: reportOrderStats.cerradas,
                    classes: 'bg-indigo-100 text-indigo-700',
                    description: 'OT cerradas con validación técnica.',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-[2px] hover:shadow-md"
                  >
                    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.classes}`}>
                      {item.label}
                    </span>
                    <p className="mt-3 text-2xl font-bold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {reportOrders.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <Settings className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay información de OT registrada</h3>
                <p className="text-gray-600">
                  Una vez que existan órdenes creadas y cerradas por el taller, podrás ver su estado aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reportOrders.slice(0, 6).map((orden) => {
                  const estadoCierre = (orden.estado_cierre || 'pendiente').toLowerCase();
                  const estadoOT = (orden.estado_ot || '').toLowerCase();
                  const etiquetaEstado =
                    estadoCierre === 'cerrada'
                      ? { label: 'Cierre técnico completado', classes: 'bg-emerald-100 text-emerald-700' }
                      : estadoOT === 'finalizada'
                      ? { label: 'Finalizada', classes: 'bg-green-100 text-green-700' }
                      : { label: 'En curso', classes: 'bg-blue-100 text-blue-700' };
                  return (
                    <div
                      key={orden.id_orden_trabajo}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-lg text-gray-900">
                              OT #{orden.id_orden_trabajo}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full font-semibold ${etiquetaEstado.classes}`}>
                              {etiquetaEstado.label}
                            </span>
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                              Prioridad: {orden.prioridad || orden.prioridad_ot}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div><strong>Patente:</strong> {orden.patente_vehiculo}</div>
                            <div><strong>Problema:</strong> {orden.tipo_problema}</div>
                            <div>
                              <strong>Inicio:</strong>{' '}
                              {orden.fecha_inicio_ot
                                ? new Date(orden.fecha_inicio_ot).toLocaleString('es-CL')
                                : 'N/A'}
                            </div>
                            <div>
                              <strong>Finalizada:</strong>{' '}
                              {orden.fecha_cierre_ot
                                ? new Date(orden.fecha_cierre_ot).toLocaleString('es-CL')
                                : 'Pendiente'}
                            </div>
                            <div className="md:col-span-2">
                              <strong>Detalle reparación:</strong>{' '}
                              {orden.detalle_reparacion || 'Sin registrar'}
                            </div>
                            {orden.fecha_cierre_tecnico && (
                              <div className="md:col-span-2 text-sm text-emerald-700">
                                <strong>Cierre técnico:</strong>{' '}
                                {new Date(orden.fecha_cierre_tecnico).toLocaleString('es-CL')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {reportOrders.length > 6 && (
                  <p className="text-xs text-gray-500">
                    {reportOrders.length - 6} OT adicionales. Utiliza el panel del taller para más detalle.
                  </p>
                )}
              </div>
            )}
              </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSolicitud(null);
          setError('');
          setSuccess('');
        }}
        title="Revisar y Confirmar Solicitud"
      >
        {selectedSolicitud && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Información de la Solicitud</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Vehículo:</strong> {selectedSolicitud.patente_vehiculo || 'No disponible'}</p>
                <p><strong>Chofer:</strong> {selectedSolicitud.empleado_nombre || 'No disponible'}</p>
                <p><strong>Problema:</strong> {selectedSolicitud.tipo_problema}</p>
                <p><strong>Fecha solicitada:</strong> {formatDate(selectedSolicitud.fecha_solicitada)}</p>
                <p><strong>Horario solicitado:</strong> {selectedSolicitud.bloque_horario}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Trabajo <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tipo_trabajo}
                onChange={(e) => setFormData({ ...formData, tipo_trabajo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecciona el tipo de trabajo</option>
                {TIPOS_TRABAJO.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Confirmada <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.fecha_confirmada}
                onChange={(e) => {
                  setFormData({ ...formData, fecha_confirmada: e.target.value, bloque_horario_confirmado: '' });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bloque Horario Confirmado <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.bloque_horario_confirmado}
                onChange={(e) => setFormData({ ...formData, bloque_horario_confirmado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!formData.fecha_confirmada}
              >
                <option value="">Selecciona un horario</option>
                {formData.fecha_confirmada && getBloquesHorario(formData.fecha_confirmada).map((bloque) => (
                  <option key={bloque} value={bloque}>
                    {bloque}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Box (Opcional)
              </label>
              <input
                type="number"
                value={formData.box_id}
                onChange={(e) => setFormData({ ...formData, box_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Número de box"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mecánico Asignado (Opcional)
              </label>
              <input
                type="number"
                value={formData.mecanico_id}
                onChange={(e) => setFormData({ ...formData, mecanico_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ID del mecánico"
                min="1"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedSolicitud(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={processing}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  console.log('🔵 Botón clickeado');
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfirm(e);
                }}
                disabled={processing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Confirmar y Crear OT
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

