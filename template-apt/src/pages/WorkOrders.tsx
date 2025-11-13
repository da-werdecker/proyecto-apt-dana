import { useEffect, useState } from 'react';
import { Plus, Edit, CheckCircle, Clock, Calendar, Truck, User, AlertCircle, FileText } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OrdenTrabajo } from '../types/database';

const TIPOS_TRABAJO = [
  { value: 'mantencion', label: 'Mantención' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'emergencia', label: 'Emergencia' },
];

export default function WorkOrders() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<any[]>([]);
  const [driverHistory, setDriverHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'todas' | 'diagnostico'>('todas');
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenTrabajo | null>(null);
  const [formData, setFormData] = useState({
    descripcion_ot: '',
    estado_ot: 'pendiente',
    empleado_id: '',
    vehiculo_id: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    // Filtrar órdenes según la pestaña activa
    if (activeTab === 'diagnostico') {
      const ordenesDiagnostico = allWorkOrders.filter((order: any) => 
        order.estado_ot === 'en_diagnostico_programado'
      );
      setWorkOrders(ordenesDiagnostico);
    } else {
      setWorkOrders(allWorkOrders);
    }
  }, [activeTab, allWorkOrders]);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const loadData = async () => {
    try {
      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

      let ordersQuery = supabase
        .from('orden_trabajo')
        .select(`
          *,
          empleado:empleado_id(nombre, apellido_paterno, apellido_materno),
          vehiculo:vehiculo_id(patente_vehiculo, modelo:modelo_vehiculo_id(nombre_modelo))
        `)
        .order('fecha_inicio_ot', { ascending: false });

      let empleadoId: number | null = null;
      let driverRequests: any[] = [];
      let localOrdersFallback: any[] = [];

      if (user?.rol === 'driver') {
        if (hasEnv) {
          const { data: empleado } = await supabase
            .from('empleado')
            .select('id_empleado')
            .eq('usuario_id', user.id_usuario)
            .maybeSingle();

          if (empleado) {
            empleadoId = empleado.id_empleado;
            ordersQuery = ordersQuery.eq('empleado_id', empleado.id_empleado);

            const { data: solicitudesData } = await supabase
              .from('solicitud_diagnostico')
              .select(`
                *,
                empleado:empleado_id(usuario_id, nombre, apellido_paterno, apellido_materno),
                vehiculo:vehiculo_id(
                  patente_vehiculo,
                  modelo:modelo_vehiculo_id(nombre_modelo)
                )
              `)
              .eq('empleado_id', empleado.id_empleado)
              .in('estado_solicitud', ['pendiente_confirmacion', 'confirmada'])
              .order('created_at', { ascending: false });

            driverRequests = solicitudesData || [];
          }
        } else {
          const empleados = readLocal('apt_empleados', []);
          const empleado = empleados.find((e: any) => e.usuario_id === user.id_usuario);
          if (empleado) {
            empleadoId = empleado.id_empleado;
          }

          driverRequests = readLocal('apt_solicitudes_diagnostico', []).filter(
            (s: any) =>
              s.empleado_id === empleadoId ||
              empleados.some((e: any) => e.id_empleado === s.empleado_id && e.usuario_id === user.id_usuario)
          );
        }
      }

      const [ordersRes, employeesRes, vehiclesRes] = await Promise.all([
        ordersQuery,
        supabase.from('empleado').select('*').order('nombre', { ascending: true }),
        supabase.from('vehiculo').select(`
          *,
          modelo:modelo_vehiculo_id(nombre_modelo)
        `).order('patente_vehiculo', { ascending: true }),
      ]);

      let allOrders = ordersRes.data || [];

      // Si es chofer, agregar solicitudes pendientes como "órdenes" virtuales
      if (user?.rol === 'driver') {
        const solicitudesFuente = driverRequests.length > 0 ? driverRequests : [];
        const solicitudesDelChofer = solicitudesFuente.filter(
          (s: any) =>
            (empleadoId && s.empleado_id === empleadoId) ||
            s.empleado?.usuario_id === user?.id_usuario
        );

        // Convertir solicitudes a formato de orden virtual
        const ordenesVirtuales = solicitudesDelChofer.map((solicitud: any) => {
          // Si la solicitud tiene una OT asociada, usar el ID de la OT real
          const ordenId = solicitud.orden_trabajo_id 
            ? solicitud.orden_trabajo_id 
            : `solicitud-${solicitud.id_solicitud_diagnostico}`;
          
          return {
            id_orden_trabajo: ordenId,
            fecha_inicio_ot: solicitud.fecha_confirmada || solicitud.fecha_solicitada,
            fecha_cierre_ot: null,
            descripcion_ot: `Diagnóstico - ${solicitud.tipo_problema || solicitud.descripcion_problema || 'Sin detalle'}`,
            estado_ot: solicitud.estado_solicitud === 'pendiente_confirmacion' 
              ? 'pendiente_confirmacion' 
              : 'en_diagnostico_programado',
            empleado_id: solicitud.empleado_id,
            vehiculo_id: solicitud.vehiculo_id || null,
            created_at: solicitud.created_at,
            solicitud_diagnostico_id: solicitud.id_solicitud_diagnostico,
            hora_confirmada: solicitud.fecha_confirmada && solicitud.bloque_horario_confirmado
              ? `${solicitud.fecha_confirmada} ${solicitud.bloque_horario_confirmado}`
              : `${solicitud.fecha_solicitada} ${solicitud.bloque_horario}`,
            patente_vehiculo: solicitud.patente_vehiculo || solicitud.vehiculo?.patente_vehiculo,
            tipo_problema: solicitud.tipo_problema || solicitud.motivo_consulta,
            bloque_horario: solicitud.bloque_horario_confirmado || solicitud.bloque_horario,
            estado_solicitud: solicitud.estado_solicitud,
            vehiculo: solicitud.vehiculo || null,
          };
        });

        allOrders = [...ordenesVirtuales, ...allOrders];
      }

      // Cargar también desde localStorage (siempre para coordinadores, o si no hay BD)
      if (!hasEnv || user?.rol === 'planner') {
        const localOrders = readLocal('apt_ordenes_trabajo', []);
        localOrdersFallback = localOrders;
        console.log('📦 Órdenes en localStorage:', localOrders.length);
        
        const localFiltered = localOrders.filter((order: any) => {
          if (user?.rol === 'driver' && empleadoId) {
            return order.empleado_id === empleadoId;
          }
          return true; // Para coordinadores y otros roles, mostrar todas
        });
        
        console.log('📦 Órdenes filtradas desde localStorage:', localFiltered.length);
        console.log('📦 Órdenes con estado en_diagnostico_programado:', localFiltered.filter((o: any) => o.estado_ot === 'en_diagnostico_programado').length);
        
        // Enriquecer órdenes con información de solicitudes
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const empleados = readLocal('apt_empleados', []);
        
        const ordenesEnriquecidas = localFiltered.map((orden: any) => {
          // Buscar solicitud asociada
          const solicitud = solicitudes.find((s: any) => 
            s.orden_trabajo_id === orden.id_orden_trabajo ||
            orden.solicitud_diagnostico_id === s.id_solicitud_diagnostico
          );

          // Buscar empleado
          const empleado = empleados.find((e: any) => e.id_empleado === orden.empleado_id);

          return {
            ...orden,
            patente_vehiculo:
              preferValues(
                orden.patente_vehiculo,
                solicitud?.patente_vehiculo
              ) || 'Sin patente',
            bloque_horario:
              preferValues(
                orden.hora_confirmada,
                solicitud?.bloque_horario_confirmado,
                solicitud?.bloque_horario
              ) || 'Sin horario',
            tipo_problema:
              preferValues(
                solicitud?.tipo_problema,
                orden.tipo_problema
              ) || 'Diagnóstico',
            tipo_trabajo:
              preferValues(
                solicitud?.tipo_trabajo,
                orden.tipo_trabajo
              ) || 'No definido',
            empleado: orden.empleado || (empleado ? {
              nombre: empleado.nombre,
              apellido_paterno: empleado.apellido_paterno,
              apellido_materno: empleado.apellido_materno,
            } : null),
            vehiculo: orden.vehiculo || (solicitud?.patente_vehiculo ? {
              patente_vehiculo: solicitud.patente_vehiculo
            } : null),
          };
        });

        // Combinar evitando duplicados
        const existingIds = new Set(allOrders.map((o: any) => o.id_orden_trabajo));
        const nuevasOrdenes = ordenesEnriquecidas.filter((o: any) => !existingIds.has(o.id_orden_trabajo));
        allOrders = [...allOrders, ...nuevasOrdenes];
        
        console.log('📊 Total de órdenes después de combinar:', allOrders.length);
        console.log('📊 Órdenes en diagnóstico programado:', allOrders.filter((o: any) => o.estado_ot === 'en_diagnostico_programado').length);
      }

      // Eliminar duplicados (si hay una OT real y una virtual con el mismo ID)
      const uniqueOrders = allOrders.filter((order, index, self) => 
        index === self.findIndex((o) => {
          // Si ambos tienen el mismo ID numérico
          if (typeof order.id_orden_trabajo === 'number' && typeof o.id_orden_trabajo === 'number') {
            return o.id_orden_trabajo === order.id_orden_trabajo;
          }
          // Si ambos tienen el mismo ID string
          if (typeof order.id_orden_trabajo === 'string' && typeof o.id_orden_trabajo === 'string') {
            return o.id_orden_trabajo === order.id_orden_trabajo;
          }
          // Si uno es numérico y otro es string con solicitud
          if (typeof order.id_orden_trabajo === 'number' && typeof o.id_orden_trabajo === 'string') {
            const solicitudId = o.id_orden_trabajo.replace('solicitud-', '');
            const ordenConSolicitud = order.solicitud_diagnostico_id?.toString();
            return ordenConSolicitud === solicitudId;
          }
          if (typeof o.id_orden_trabajo === 'number' && typeof order.id_orden_trabajo === 'string') {
            const solicitudId = order.id_orden_trabajo.replace('solicitud-', '');
            const ordenConSolicitud = o.solicitud_diagnostico_id?.toString();
            return ordenConSolicitud === solicitudId;
          }
          return false;
        })
      );

      setAllWorkOrders(uniqueOrders);
      if (user?.rol === 'driver') {
        setDriverHistory(buildDriverHistory(uniqueOrders, driverRequests, localOrdersFallback));
      } else {
        setDriverHistory([]);
      }
      
      // Cargar empleados y vehículos
      if (!hasEnv) {
        const empleadosLocal = readLocal('apt_empleados', []);
        const vehiculosLocal = readLocal('apt_vehiculos', []);
        setEmployees(empleadosLocal);
        setVehicles(vehiculosLocal);
      } else {
        setEmployees(employeesRes.data || []);
        setVehicles(vehiclesRes.data || []);
      }
    } catch (error) {
      console.error('Error loading work orders:', error);
      // Fallback a localStorage
      const localOrders = readLocal('apt_ordenes_trabajo', []);
      setAllWorkOrders(localOrders);
      if (user?.rol === 'driver') {
        setDriverHistory(buildDriverHistory(localOrders));
      } else {
        setDriverHistory([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      descripcion_ot: formData.descripcion_ot,
      estado_ot: formData.estado_ot,
      empleado_id: parseInt(formData.empleado_id),
      vehiculo_id: parseInt(formData.vehiculo_id),
    };

    try {
      if (editingOrder) {
        await supabase
          .from('orden_trabajo')
          .update(submitData)
          .eq('id_orden_trabajo', editingOrder.id_orden_trabajo);
      } else {
        await supabase.from('orden_trabajo').insert([submitData]);

        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'en ruta' })
          .eq('id_vehiculo', parseInt(formData.vehiculo_id));
      }

      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving work order:', error);
      alert('Error al guardar la orden de trabajo');
    }
  };

  const handleUpdateStatus = async (order: OrdenTrabajo, newStatus: string) => {
    try {
      await supabase
        .from('orden_trabajo')
        .update({
          estado_ot: newStatus,
          fecha_cierre_ot: newStatus === 'finalizada' ? new Date().toISOString() : null,
        })
        .eq('id_orden_trabajo', order.id_orden_trabajo);

      if (newStatus === 'finalizada') {
        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'disponible' })
          .eq('id_vehiculo', order.vehiculo_id);
      } else if (newStatus === 'en curso') {
        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'en ruta' })
          .eq('id_vehiculo', order.vehiculo_id);
      }

      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleEdit = (order: OrdenTrabajo) => {
    setEditingOrder(order);
    setFormData({
      descripcion_ot: order.descripcion_ot || '',
      estado_ot: order.estado_ot,
      empleado_id: order.empleado_id.toString(),
      vehiculo_id: order.vehiculo_id.toString(),
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setFormData({
      descripcion_ot: '',
      estado_ot: 'pendiente',
      empleado_id: '',
      vehiculo_id: '',
    });
  };

  const columns = [
    { header: 'ID', accessor: 'id_orden_trabajo' },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any, row: any) => {
        // Para solicitudes virtuales, mostrar el nombre del chofer si está disponible
        if (typeof row.id_orden_trabajo === 'string' && row.id_orden_trabajo.startsWith('solicitud-')) {
          const empleados = readLocal('apt_empleados', []);
          const empleado = empleados.find((e: any) => e.id_empleado === row.empleado_id);
          return empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : 'Chofer';
        }
        return value ? `${value.nombre} ${value.apellido_paterno}` : '-';
      },
    },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any, row: any) => {
        if (row.patente_vehiculo) {
          return row.patente_vehiculo;
        }
        return value ? `${value.patente_vehiculo} (${value.modelo?.nombre_modelo})` : '-';
      },
    },
    {
      header: 'Descripción',
      accessor: 'descripcion_ot',
      render: (value: string) => value || '-',
    },
    {
      header: 'Estado',
      accessor: 'estado_ot',
      render: (value: string) => {
        const estadoLabels: Record<string, string> = {
          'pendiente': 'Pendiente',
          'en curso': 'En Curso',
          'finalizada': 'Finalizada',
          'pendiente_confirmacion': 'Pendiente de Confirmación',
          'en_diagnostico_programado': 'En Diagnóstico Programado',
        };
        
        const estadoColors: Record<string, string> = {
          'pendiente': 'bg-yellow-100 text-yellow-800',
          'en curso': 'bg-blue-100 text-blue-800',
          'finalizada': 'bg-green-100 text-green-800',
          'pendiente_confirmacion': 'bg-orange-100 text-orange-800',
          'en_diagnostico_programado': 'bg-purple-100 text-purple-800',
        };
        
        return (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              estadoColors[value] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {estadoLabels[value] || value}
          </span>
        );
      },
    },
    {
      header: 'Hora de Diagnóstico',
      accessor: 'hora_confirmada',
      render: (value: string, row: any) => {
        if (row.estado_ot === 'pendiente_confirmacion' || row.estado_ot === 'en_diagnostico_programado') {
          return (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="text-gray-400" size={16} />
              <span>{row.bloque_horario || value || '-'}</span>
            </div>
          );
        }
        return '-';
      },
    },
    {
      header: 'Fecha Inicio',
      accessor: 'fecha_inicio_ot',
      render: (value: string) => new Date(value).toLocaleString('es-CL'),
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_trabajo',
      render: (_: any, row: any) => {
        // No mostrar acciones para solicitudes virtuales (órdenes creadas desde solicitudes de diagnóstico)
        if (typeof row.id_orden_trabajo === 'string' && row.id_orden_trabajo.startsWith('solicitud-')) {
          return (
            <span className="text-sm text-gray-500 italic">
              {row.estado_ot === 'pendiente_confirmacion' 
                ? 'Esperando confirmación del coordinador' 
                : 'Programado'}
            </span>
          );
        }
        
        return (
          <div className="flex gap-2">
            {user?.rol !== 'driver' && (
              <button
                onClick={() => handleEdit(row)}
                className="text-blue-600 hover:text-blue-800"
                title="Editar"
              >
                <Edit size={18} />
              </button>
            )}
            {row.estado_ot === 'pendiente' && (
              <button
                onClick={() => handleUpdateStatus(row, 'en curso')}
                className="text-orange-600 hover:text-orange-800"
                title="Iniciar"
              >
                <CheckCircle size={18} />
              </button>
            )}
            {row.estado_ot === 'en curso' && (
              <button
                onClick={() => handleUpdateStatus(row, 'finalizada')}
                className="text-green-600 hover:text-green-800"
                title="Finalizar"
              >
                <CheckCircle size={18} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  function formatDate(dateStr: string) {
    if (!dateStr) return 'N/A';
    try {
      let date: Date;
      if (dateStr.includes('T')) {
        date = new Date(dateStr);
      } else if (dateStr.includes('-')) {
        date = new Date(`${dateStr}T00:00:00`);
      } else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) {
        return 'N/A';
      }

      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    } catch (error) {
      console.error('Error formateando fecha:', dateStr, error);
      return 'N/A';
    }
  }

  function normalizeDate(value: any): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function formatDateTime(value?: any): string | null {
    if (!value) return null;
    const normalized = normalizeDate(value);
    if (!normalized) return null;
    const date = new Date(normalized);
    return (
      date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    );
  }

  function formatHour(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('T')) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (trimmed.includes(' ')) {
      const parts = trimmed.split(' ');
      return parts[parts.length - 1];
    }
    return trimmed;
  }

  function buildDriverTimeline(solicitud: any, ordenData: any, ordenLocal: any) {
    const estadoSolicitud = (solicitud?.estado_solicitud || '').toLowerCase();
    const estadoOrden = (ordenLocal?.estado_ot || ordenData?.estado_ot || '').toLowerCase();
    const fechaInicio = normalizeDate(ordenLocal?.fecha_inicio_ot || ordenData?.fecha_inicio_ot || solicitud?.fecha_confirmada);
    const fechaCierre = normalizeDate(ordenLocal?.fecha_cierre_ot || ordenData?.fecha_cierre_ot);

    const steps = [
      {
        key: 'solicitud',
        label: 'Solicitud enviada',
        date: normalizeDate(solicitud?.created_at || ordenData?.created_at || ordenData?.fecha_inicio_ot),
        reached: Boolean(solicitud || ordenData),
      },
      {
        key: 'pendiente',
        label: 'Pendiente de confirmación',
        date: normalizeDate(solicitud?.created_at || ordenData?.created_at),
        reached: Boolean(solicitud),
      },
      {
        key: 'confirmada',
        label: 'Hora confirmada',
        date: normalizeDate(solicitud?.fecha_confirmada),
        reached:
          estadoSolicitud === 'confirmada' ||
          ['en_diagnostico_programado', 'en curso', 'en_reparacion', 'finalizada'].includes(estadoOrden),
      },
      {
        key: 'diagnostico',
        label: 'Diagnóstico programado',
        date: fechaInicio,
        reached: ['en_diagnostico_programado', 'en curso', 'en_reparacion', 'finalizada'].includes(estadoOrden),
      },
      {
        key: 'reparacion',
        label: 'En reparación',
        date: fechaInicio,
        reached: ['en_reparacion', 'en curso', 'finalizada'].includes(estadoOrden),
      },
      {
        key: 'finalizada',
        label: 'Trabajo finalizado',
        date: fechaCierre,
        reached: estadoOrden === 'finalizada',
      },
      {
        key: 'cierre',
        label: 'Cierre técnico',
        date: normalizeDate(ordenLocal?.fecha_cierre_tecnico),
        reached: ordenLocal?.estado_cierre === 'cerrada',
      },
    ];

    let lastReachedIndex = -1;
    steps.forEach((step, idx) => {
      if (step.reached) {
        lastReachedIndex = idx;
      }
    });

    return steps.map((step, idx) => {
      const status: 'pending' | 'current' | 'complete' = !step.reached
        ? 'pending'
        : idx === lastReachedIndex
        ? 'current'
        : 'complete';
      return {
        ...step,
        status,
        formattedDate: formatDateTime(step.date),
      };
    });
  }

  const sanitizeValue = (value?: string | null) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower === 'n/a' || lower === 'na' || lower === 'sin dato' || lower === 'null') {
      return null;
    }
    return text;
  };

  const preferValues = (...values: (string | null | undefined)[]) => {
    for (const value of values) {
      const sanitized = sanitizeValue(value);
      if (sanitized) return sanitized;
    }
    return null;
  };

  function buildDriverHistory(orders: any[], solicitudesFuente: any[], ordenesFallback: any[]): any[] {
    const solicitudesLS = Array.isArray(solicitudesFuente) ? solicitudesFuente : [];
    const ordenesLS = Array.isArray(ordenesFallback) ? ordenesFallback : [];

    const history = orders.map((orden: any) => {
      const solicitud = Array.isArray(solicitudesLS)
        ? solicitudesLS.find((s: any) =>
            s.orden_trabajo_id === orden.id_orden_trabajo ||
            s.id_solicitud_diagnostico === orden.solicitud_diagnostico_id ||
            (typeof orden.id_orden_trabajo === 'string' &&
              orden.id_orden_trabajo.startsWith('solicitud-') &&
              `solicitud-${s.id_solicitud_diagnostico}` === orden.id_orden_trabajo)
          )
        : null;

      const ordenLocal = Array.isArray(ordenesLS)
        ? ordenesLS.find((o: any) =>
            o.id_orden_trabajo === orden.id_orden_trabajo ||
            (orden.solicitud_diagnostico_id && o.solicitud_diagnostico_id === orden.solicitud_diagnostico_id) ||
            (typeof orden.id_orden_trabajo === 'string' &&
              orden.id_orden_trabajo.startsWith('solicitud-') &&
              o.solicitud_diagnostico_id?.toString() === orden.id_orden_trabajo.replace('solicitud-', ''))
          )
        : null;

      const timeline = buildDriverTimeline(solicitud, orden, ordenLocal);
      const lastStep = [...timeline].reverse().find((step) => step.status !== 'pending');

      const estadoActual = lastStep?.label || 'Solicitud registrada';
      const estadoBadgeClass =
        lastStep?.status === 'complete'
          ? 'bg-green-100 text-green-700 border border-green-200'
          : lastStep?.status === 'current'
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'bg-gray-100 text-gray-500 border border-gray-200';

      const fechaReferencia =
        normalizeDate(
          solicitud?.fecha_confirmada ||
            solicitud?.fecha_solicitada ||
            ordenLocal?.fecha_inicio_ot ||
            orden.fecha_inicio_ot ||
            orden.created_at
        );

      const rawHora =
        solicitud?.bloque_horario_confirmado ||
        solicitud?.bloque_horario ||
        ordenLocal?.hora_confirmada ||
        orden.hora_confirmada ||
        orden.bloque_horario ||
        null;

      const patente =
        preferValues(
          orden.patente_vehiculo,
          solicitud?.patente_vehiculo,
          solicitud?.vehiculo?.patente_vehiculo,
          ordenLocal?.patente_vehiculo
        ) || 'Sin patente';

      const problema =
        preferValues(
          orden.tipo_problema,
          solicitud?.tipo_problema,
          solicitud?.descripcion_problema,
          solicitud?.motivo_consulta,
          ordenLocal?.tipo_problema,
          orden.descripcion_ot
        ) || 'Diagnóstico solicitado';

      return {
        id: orden.id_orden_trabajo,
        patente,
        problema,
        fecha: fechaReferencia,
        fechaFormateada: fechaReferencia ? formatDate(fechaReferencia) : 'N/A',
        hora: formatHour(typeof rawHora === 'string' ? rawHora : null),
        timeline,
        estadoActual,
        estadoBadgeClass,
      };
    });

    return history.sort((a, b) => {
      const aDate = a.fecha ? new Date(a.fecha).getTime() : 0;
      const bDate = b.fecha ? new Date(b.fecha).getTime() : 0;
      return bDate - aDate;
    });
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const ordenesDiagnostico = allWorkOrders.filter((order: any) => 
    order.estado_ot === 'en_diagnostico_programado'
  );

  // Debug logs
  console.log('🔍 WorkOrders Render:', {
    userRol: user?.rol,
    activeTab,
    ordenesDiagnosticoCount: ordenesDiagnostico.length,
    shouldShowCards: user?.rol === 'planner' && activeTab === 'diagnostico',
    allWorkOrdersCount: allWorkOrders.length,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1>
        {user?.rol !== 'driver' && (
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Orden de Trabajo
          </button>
        )}
      </div>

      {/* Pestañas - Solo para coordinadores */}
      {user?.rol === 'planner' && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('todas')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'todas'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Todas las Órdenes
                {allWorkOrders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
                    {allWorkOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('diagnostico')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'diagnostico'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                En Diagnóstico Programado
                {ordenesDiagnostico.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs">
                    {ordenesDiagnostico.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Mostrar todas las órdenes como tarjetas */}
      <div>
        {workOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay órdenes de trabajo</h3>
            <p className="text-gray-600">Las órdenes de trabajo aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workOrders.map((orden: any) => {
              // Determinar el color del borde y el badge según el estado
              const getBorderColor = () => {
                switch (orden.estado_ot) {
                  case 'en_diagnostico_programado':
                    return 'border-green-500';
                  case 'pendiente_confirmacion':
                    return 'border-orange-500';
                  case 'pendiente':
                    return 'border-yellow-500';
                  case 'en curso':
                    return 'border-blue-500';
                  case 'finalizada':
                    return 'border-gray-500';
                  default:
                    return 'border-gray-300';
                }
              };

              const getStatusBadge = () => {
                const estadoLabels: Record<string, { label: string; color: string }> = {
                  'pendiente': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
                  'en curso': { label: 'En Curso', color: 'bg-blue-100 text-blue-800' },
                  'finalizada': { label: 'Finalizada', color: 'bg-green-100 text-green-800' },
                  'pendiente_confirmacion': { label: 'Pendiente de Confirmación', color: 'bg-orange-100 text-orange-800' },
                  'en_diagnostico_programado': { label: 'En Diagnóstico Programado', color: 'bg-purple-100 text-purple-800' },
                };
                const estado = estadoLabels[orden.estado_ot] || { label: orden.estado_ot, color: 'bg-gray-100 text-gray-800' };
                return estado;
              };

              const statusBadge = getStatusBadge();
              const patenteDisplay =
                preferValues(
                  orden.patente_vehiculo,
                  orden.vehiculo?.patente_vehiculo,
                  orden.patente
                ) || 'Sin patente';
              const problemaDisplay =
                preferValues(
                  orden.tipo_problema,
                  orden.problema
                ) || 'Diagnóstico solicitado';
              const borderColor = getBorderColor();

              return (
                <div
                  key={orden.id_orden_trabajo}
                  className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${borderColor}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Truck className={orden.estado_ot === 'en_diagnostico_programado' ? 'text-green-600' : 'text-gray-600'} size={20} />
                          <span className="font-semibold text-gray-900">{patenteDisplay}</span>
                        </div>
                        <span className={`px-3 py-1 ${statusBadge.color} rounded-full text-xs font-semibold`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Chofer:</strong> {orden.empleado?.nombre && orden.empleado?.apellido_paterno 
                              ? `${orden.empleado.nombre} ${orden.empleado.apellido_paterno}` 
                              : orden.empleado_nombre || 'N/A'}
                          </span>
                        </div>
                        {orden.tipo_problema && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Problema:</strong> {problemaDisplay}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>{orden.fecha_confirmada ? 'Fecha confirmada:' : 'Fecha inicio:'}</strong> {orden.fecha_confirmada 
                              ? formatDate(orden.fecha_confirmada) 
                              : orden.fecha_inicio_ot 
                                ? formatDate(orden.fecha_inicio_ot) 
                                : 'N/A'}
                          </span>
                        </div>
                        {(orden.bloque_horario || orden.hora_confirmada || orden.estado_ot === 'en_diagnostico_programado' || orden.estado_ot === 'pendiente_confirmacion') && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Horario:</strong> {orden.bloque_horario 
                                ? orden.bloque_horario 
                                : orden.hora_confirmada 
                                  ? (typeof orden.hora_confirmada === 'string' && orden.hora_confirmada.includes(' ') 
                                      ? orden.hora_confirmada.split(' ')[1] || orden.hora_confirmada
                                      : orden.hora_confirmada)
                                  : 'N/A'}
                            </span>
                          </div>
                        )}
                        {orden.tipo_trabajo && (
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Tipo de trabajo:</strong> {TIPOS_TRABAJO.find(t => t.value === orden.tipo_trabajo)?.label || orden.tipo_trabajo}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700">
                            <strong>ID OT:</strong> {orden.id_orden_trabajo}
                          </span>
                        </div>
                      </div>

                      {orden.descripcion_ot && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Descripción:</strong> {orden.descripcion_ot}
                          </p>
                        </div>
                      )}

                      {/* Acciones para coordinadores */}
                      {user?.rol !== 'driver' && typeof orden.id_orden_trabajo !== 'string' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleEdit(orden)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Edit size={16} />
                            Editar
                          </button>
                          {orden.estado_ot === 'pendiente' && (
                            <button
                              onClick={() => handleUpdateStatus(orden, 'en curso')}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                            >
                              <CheckCircle size={16} />
                              Iniciar
                            </button>
                          )}
                          {orden.estado_ot === 'en curso' && (
                            <button
                              onClick={() => handleUpdateStatus(orden, 'finalizada')}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle size={16} />
                              Finalizar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {user?.rol === 'driver' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Historial de mis horas tomadas</h2>
              <p className="text-gray-600 text-sm">
                Revisa cada cita solicitada y el estado en que se encuentra dentro del proceso de diagnóstico y reparación.
              </p>
            </div>
          </div>

          {driverHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <FileText className="mx-auto text-gray-300 mb-4" size={48} />
              <p>No tienes horas agendadas todavía.</p>
              <p className="text-sm">Cuando solicites una revisión aparecerá aquí su progreso.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {driverHistory.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <Truck className="text-blue-600" size={20} />
                        <span className="font-semibold text-gray-900 text-lg">{item.patente}</span>
                        <span className={`px-3 py-1 text-xs font-semibold rounded ${item.estadoBadgeClass}`}>
                          {item.estadoActual}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        <div>
                          <strong>Problema:</strong> {item.problema}
                        </div>
                        {item.fechaFormateada !== 'N/A' && (
                          <div>
                            <strong>Programado:</strong> {item.fechaFormateada}
                            {item.hora && ` · ${item.hora}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap gap-3">
                      {item.timeline.map((step: any) => {
                        const statusClasses =
                          step.status === 'complete'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : step.status === 'current'
                            ? 'bg-blue-50 border border-blue-200 text-blue-700'
                            : 'bg-gray-50 border border-gray-200 text-gray-500';
                        return (
                          <div key={step.key} className={`min-w-[160px] px-3 py-2 rounded-lg ${statusClasses}`}>
                            <div className="text-xs font-semibold uppercase tracking-wide">{step.label}</div>
                            <div className="text-xs mt-1">
                              {step.formattedDate || 'En proceso'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {user?.rol !== 'driver' && (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            resetForm();
          }}
          title={editingOrder ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empleado
              </label>
              <select
                value={formData.empleado_id}
                onChange={(e) => setFormData({ ...formData, empleado_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar empleado</option>
                {employees.map((employee) => (
                  <option key={employee.id_empleado} value={employee.id_empleado}>
                    {employee.nombre} {employee.apellido_paterno}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehículo
              </label>
              <select
                value={formData.vehiculo_id}
                onChange={(e) => setFormData({ ...formData, vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!editingOrder}
              >
                <option value="">Seleccionar vehículo</option>
                {vehicles
                  .filter((v) => editingOrder || v.estado_vehiculo === 'disponible')
                  .map((vehicle) => (
                    <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                      {vehicle.patente_vehiculo} - {vehicle.modelo?.nombre_modelo}
                      {vehicle.estado_vehiculo !== 'disponible' && ` (${vehicle.estado_vehiculo})`}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.descripcion_ot}
                onChange={(e) => setFormData({ ...formData, descripcion_ot: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Descripción de la ruta o trabajo a realizar"
              />
            </div>

            {editingOrder && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.estado_ot}
                  onChange={(e) => setFormData({ ...formData, estado_ot: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en curso">En Curso</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingOrder ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
