import { useState, useEffect, ChangeEvent, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Calendar,
  Truck,
  User,
  AlertCircle,
  FileText,
  Camera,
  Play,
  Pause,
  ClipboardList,
  Gauge,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';

interface MechanicDashboardProps {
  activeSection?: 'overview' | 'assigned' | 'progress' | 'ot-progress';
  initialCombinedTab?: 'ordenes' | 'registro';
}
const hasEnv =
  Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function MechanicDashboard({
  activeSection = 'assigned',
  initialCombinedTab,
}: MechanicDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [selectedOT, setSelectedOT] = useState<any | null>(null);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [progressTab, setProgressTab] = useState<'pendientes' | 'finalizadas'>('pendientes');
  const [editDetailModal, setEditDetailModal] = useState(false);
  const [editDetailValue, setEditDetailValue] = useState('');
  const [empleadoInfo, setEmpleadoInfo] = useState<any | null>(null);
  const [overviewStats, setOverviewStats] = useState({
    total: 0,
    activas: 0,
    pendientes: 0,
    finalizadas: 0,
  });
  const [nextOrder, setNextOrder] = useState<any | null>(null);
  const [upcomingOrders, setUpcomingOrders] = useState<any[]>([]);
  const [recentProgressList, setRecentProgressList] = useState<any[]>([]);
  const [overviewFinalizedOrders, setOverviewFinalizedOrders] = useState<any[]>([]);
  const [completedAdvances, setCompletedAdvances] = useState<any[]>([]);
  const [otCombinedTab, setOtCombinedTab] = useState<'ordenes' | 'registro' | 'finalizadas'>(
    initialCombinedTab || (activeSection === 'progress' ? 'registro' : 'ordenes')
  );
  const combinedViewActive =
    activeSection === 'assigned' || activeSection === 'progress' || activeSection === 'ot-progress';

  const normalizeOrderState = (estado: string | null | undefined) =>
    (estado || '').toLowerCase().replace(/\s+/g, '_');

  const isFinalState = (estado: string | null | undefined) => {
    const normalized = normalizeOrderState(estado);
    return ['finalizada', 'finalizado', 'cerrada', 'cerrado'].includes(normalized);
  };

  const getOtEstadoClasses = (estado: string | null | undefined) => {
    const normalized = (estado || '').toLowerCase();
    if (normalized === 'finalizada') {
      return 'bg-rose-100 text-rose-700';
    }
    if (['en_proceso', 'en_progreso', 'en_reparacion', 'en_reparación', 'en_curso'].includes(normalized)) {
      return 'bg-emerald-100 text-emerald-700';
    }
    return 'bg-blue-50 text-blue-600';
  };

  const formatEstadoLabel = (estado: string | null | undefined) => {
    if (!estado) return 'Sin estado';
    const cleaned = estado.replace(/_/g, ' ').toLowerCase();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const renderOrdersGrid = (ordersList: any[], emptyMessage: string) => {
    if (!ordersList || ordersList.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
          <FileText className="mx-auto text-slate-300" size={48} />
          <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {ordersList.map((order) => {
          const reparacionEstado = (order.estado_reparacion || 'pendiente').toLowerCase();
          const reparacionProgramada = Boolean(order.fecha_programada_reparacion);
          const reparacionBadgeClasses =
            reparacionEstado === 'programada'
              ? 'bg-emerald-100 text-emerald-700'
              : reparacionEstado === 'en_reparacion'
              ? 'bg-blue-100 text-blue-700'
              : reparacionEstado === 'finalizada'
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-100 text-amber-700';
          const estadoOtClasses = getOtEstadoClasses(order.estado_ot);
          const estadoOtLabel = formatEstadoLabel(order.estado_ot);
          const showRegistrarAccion = !isFinalState(order.estado_ot);

          return (
            <div
              key={order.id_orden_trabajo}
              className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow">
                      <Truck size={16} />
                      {order.patente_vehiculo}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                        order.prioridad === 'critica'
                          ? 'bg-rose-100 text-rose-700'
                          : order.prioridad === 'alta'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {order.prioridad === 'critica'
                        ? 'Crítica'
                        : order.prioridad === 'alta'
                        ? 'Alta'
                        : 'Normal'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${estadoOtClasses}`}
                    >
                      {estadoOtLabel}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${reparacionBadgeClasses}`}
                    >
                      {`Reparación: ${reparacionEstado.replace(/_/g, ' ')}`}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                    <span className="inline-flex items-center gap-2">
                      <AlertCircle size={16} className="text-slate-400" />
                      <strong>Falla:</strong> {order.falla_reportada}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Truck size={16} className="text-slate-400" />
                      <strong>Marca / Modelo:</strong> {order.marca_vehiculo} {order.modelo_vehiculo}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <User size={16} className="text-slate-400" />
                      <strong>Tipo:</strong> {order.tipo_vehiculo}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      <strong>Fecha inicio:</strong> {formatDate(order.fecha_programada || order.fecha_inicio_ot)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock size={16} className="text-slate-400" />
                      <strong>Hora estimada:</strong> {order.hora_estimado || order.hora_confirmada || 'N/A'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList size={16} className="text-slate-400" />
                      <strong>Sucursal:</strong> {order.sucursal_nombre}
                    </span>
                    {order.kilometraje_registrado && (
                      <span className="inline-flex items-center gap-2">
                        <Gauge size={16} className="text-slate-400" />
                        <strong>Kilometraje:</strong> {order.kilometraje_registrado.toLocaleString('es-CL')} km
                      </span>
                    )}
                  </div>

                  {reparacionProgramada && (
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
                      <Calendar size={16} />
                      <span>
                        Reparación programada para {formatDate(order.fecha_programada_reparacion)}{' '}
                        {order.hora_programada_reparacion ? `· ${order.hora_programada_reparacion}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-stretch gap-2 md:items-end">
                  <button
                    onClick={() => handleGoToProgress(order)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
                  >
                    Ver detalle y registrar
                  </button>
                  {showRegistrarAccion && (
                    <button
                      onClick={() => handleGoToProgress(order)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-600"
                    >
                      Registrar avance
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const combinedTabTitle =
    otCombinedTab === 'ordenes'
      ? 'Paso 1 · Selecciona una OT'
      : otCombinedTab === 'registro'
      ? 'Paso 2 · Registra tu avance'
      : 'OT finalizadas';

  const combinedTabDescription =
    otCombinedTab === 'ordenes'
      ? 'Revisa detalles, prioridad y agenda antes de comenzar a trabajar.'
      : otCombinedTab === 'registro'
      ? selectedOT
        ? `Documenta el trabajo realizado en la OT ${selectedOT.patente_vehiculo || `#${selectedOT.id_orden_trabajo}`}.`
        : 'Selecciona una OT para habilitar el formulario de registro.'
      : 'Consulta rápidamente todas las OT que ya fueron cerradas o finalizadas.';

  const combinedSummary = useMemo(() => {
    if (!Array.isArray(myOrders) || myOrders.length === 0) {
      return { total: 0, activas: 0, pendientes: 0, finalizadas: 0 };
    }

    let activas = 0;
    let finalizadas = 0;
    let pendientes = 0;

    myOrders.forEach((orden: any) => {
      const estadoNorm = normalizeOrderState(orden.estado_ot);
      if (estadoNorm === 'finalizada') {
        finalizadas += 1;
        return;
      }
      if (
        ['en_curso', 'en_reparacion', 'en_pruebas', 'esperando_repuestos', 'en_diagnostico_programado'].includes(
          estadoNorm
        )
      ) {
        activas += 1;
        return;
      }
      pendientes += 1;
    });

    return {
      total: myOrders.length,
      activas,
      pendientes,
      finalizadas,
    };
  }, [myOrders]);

  const finalOrders = useMemo(() => {
    if (!Array.isArray(myOrders) || myOrders.length === 0) return [];
    return myOrders.filter(
      (orden: any) => isFinalState(orden.estado_ot) || isFinalState(orden.estado_reparacion)
    );
  }, [myOrders]);

  const activeOrders = useMemo(() => {
    if (!Array.isArray(myOrders) || myOrders.length === 0) return [];
    return myOrders.filter((orden: any) => !isFinalState(orden.estado_ot));
  }, [myOrders]);

  const [progressData, setProgressData] = useState({
    descripcion_trabajo: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: '',
    fotos: [] as string[],
  });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [orderUpdateData, setOrderUpdateData] = useState({
    estado_ot: 'en_reparacion',
    detalle_reparacion: '',
  });

  const historySummary = useMemo(() => {
    if (!Array.isArray(workHistory) || workHistory.length === 0) {
      return {
        total: 0,
        finalized: 0,
        active: 0,
        totalAdvances: 0,
        avgRepairHours: 0,
        uniqueVehicles: 0,
        avgAdvancesPerOrder: 0,
        topFallas: [] as { name: string; count: number }[],
      };
    }

    let finalized = 0;
    let active = 0;
    let totalAdvances = 0;
    let totalDurationHours = 0;
    let durationCount = 0;
    const fallaMap = new Map<string, number>();
    const vehicleSet = new Set<string>();

    workHistory.forEach((orden: any) => {
      const estadoNorm = normalizeOrderState(orden.estado_ot);
      if (estadoNorm === 'finalizada') {
        finalized += 1;
        const inicio = orden.fecha_inicio_ot ? new Date(orden.fecha_inicio_ot) : null;
        const cierre = orden.fecha_cierre_ot ? new Date(orden.fecha_cierre_ot) : null;
        if (inicio && cierre && !Number.isNaN(inicio.getTime()) && !Number.isNaN(cierre.getTime())) {
          const diffHours = (cierre.getTime() - inicio.getTime()) / (1000 * 60 * 60);
          if (diffHours > 0) {
            totalDurationHours += diffHours;
            durationCount += 1;
          }
        }
      } else {
        active += 1;
      }

      const avancesCount = Array.isArray(orden.avances) ? orden.avances.length : 0;
      totalAdvances += avancesCount;

      const falla = (orden.falla_reportada || orden.descripcion_ot || 'Sin especificar').toLowerCase();
      fallaMap.set(falla, (fallaMap.get(falla) || 0) + 1);

      if (orden.patente_vehiculo) {
        vehicleSet.add(String(orden.patente_vehiculo).toUpperCase());
      }
    });

    const topFallas = Array.from(fallaMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      total: workHistory.length,
      finalized,
      active,
      totalAdvances,
      avgRepairHours: durationCount > 0 ? totalDurationHours / durationCount : 0,
      uniqueVehicles: vehicleSet.size,
      avgAdvancesPerOrder: workHistory.length > 0 ? totalAdvances / workHistory.length : 0,
      topFallas,
    };
  }, [workHistory]);

  useEffect(() => {
    if (activeSection === 'progress') {
      setOtCombinedTab('registro');
    } else if (activeSection === 'assigned') {
      setOtCombinedTab('ordenes');
    }
  }, [activeSection]);

  useEffect(() => {
    const fetchData = async () => {
      if (activeSection === 'overview') {
        await loadMyOrders(true);
      } else if (combinedViewActive) {
        await loadMyOrders();
      }
    };

    fetchData();
  }, [activeSection, user, combinedViewActive]);

  const loadCompletedAdvances = async (empleadoId: number | null | undefined) => {
    if (!hasEnv || !empleadoId) {
      setCompletedAdvances([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('avance_ot')
        .select(
          `
          id_avance_ot,
          orden_trabajo_id,
          descripcion_trabajo,
          observaciones,
          hora_inicio,
          hora_fin,
          fotos,
          mecanico_id,
          created_at,
          orden:orden_trabajo_id (
            id_orden_trabajo,
            descripcion_ot,
            detalle_reparacion,
            prioridad_ot,
            solicitud:solicitud_diagnostico_id (tipo_problema),
            vehiculo:vehiculo_id (
              patente_vehiculo,
              modelo:modelo_vehiculo_id (
                nombre_modelo,
                marca:marca_vehiculo_id (nombre_marca)
              )
            )
          )
        `
        )
        .eq('mecanico_id', empleadoId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      const mapped = (data || []).map((avance: any) => {
        const orden = avance.orden || {};
        const vehiculo = orden.vehiculo || {};
        const modelo = vehiculo.modelo || {};
        const marca = modelo.marca || {};
        const solicitud = orden.solicitud || {};

        return {
          ...avance,
          patente_vehiculo: vehiculo.patente_vehiculo || 'N/A',
          marca_vehiculo: marca.nombre_marca || 'N/A',
          modelo_vehiculo: modelo.nombre_modelo || 'N/A',
          detalle_reparacion: orden.detalle_reparacion || '',
          prioridad_ot: orden.prioridad_ot || 'normal',
          descripcion_ot: orden.descripcion_ot || solicitud.tipo_problema || 'Sin detalle',
        };
      });

      setCompletedAdvances(mapped);
    } catch (error) {
      console.error('⚠️ Error cargando revisiones finalizadas:', error);
      setCompletedAdvances([]);
    }
  };

  const loadMyOrders = async (includeOverviewData = false) => {
    try {
      setLoading(true);

      if (!hasEnv || !user?.id_usuario) {
        setMyOrders([]);
        setSelectedOT(null);
        if (includeOverviewData) {
          setOverviewStats({ total: 0, activas: 0, pendientes: 0, finalizadas: 0 });
          setNextOrder(null);
          setUpcomingOrders([]);
          setRecentProgressList([]);
          setOverviewFinalizedOrders([]);
          setCompletedAdvances([]);
        }
        return;
      }

      const { data: empleadoDb, error: empleadoError } = await supabase
        .from('empleado')
        .select('id_empleado, usuario_id, nombre, apellido_paterno, apellido_materno, telefono1, email')
        .eq('usuario_id', user.id_usuario)
        .maybeSingle();

      if (empleadoError) {
        throw empleadoError;
      }

      if (!empleadoDb) {
        setMyOrders([]);
        setSelectedOT(null);
        return;
      }

      const empleadoId = Number(empleadoDb.id_empleado);
      setEmpleadoInfo(empleadoDb);

      const { data: ordenesDb, error: ordenesError } = await supabase
        .from('orden_trabajo')
        .select(
          `
          id_orden_trabajo,
          descripcion_ot,
          estado_ot,
          prioridad_ot,
          empleado_id,
          vehiculo_id,
          solicitud_diagnostico_id,
          mecanico_apoyo_ids,
          confirmado_ingreso,
          fecha_programada_reparacion,
          hora_programada_reparacion,
          estado_reparacion,
          hora_confirmada,
          fecha_inicio_ot,
          fecha_cierre_ot,
          fecha_cierre_tecnico,
          estado_cierre,
          detalle_reparacion,
          created_at,
          vehiculo:vehiculo_id (
            patente_vehiculo,
            kilometraje_vehiculo,
            modelo:modelo_vehiculo_id (
              nombre_modelo,
              marca:marca_vehiculo_id (nombre_marca)
            ),
            tipo:tipo_vehiculo_id (tipo_vehiculo),
            sucursal:sucursal_id (nombre_sucursal)
          ),
          solicitud:solicitud_diagnostico_id (
            patente_vehiculo,
            tipo_problema,
            fecha_confirmada,
            fecha_solicitada,
            bloque_horario_confirmado,
            bloque_horario,
            tipo_trabajo,
            prioridad,
            orden_trabajo_id,
            mecanico_id
          )
        `
        );

      if (ordenesError) {
        throw ordenesError;
      }

      const dataArray = Array.isArray(ordenesDb) ? ordenesDb : [];
      const asignadas = dataArray.filter((orden: any) => {
        if (orden.empleado_id === empleadoId) {
          return true;
        }
        const apoyos = Array.isArray(orden.mecanico_apoyo_ids)
          ? orden.mecanico_apoyo_ids.map((val: any) => Number(val))
          : [];
        return apoyos.includes(empleadoId);
      });

      const ordenesOrigen = asignadas.map((orden: any) => {
        const vehiculo = orden.vehiculo || {};
        const solicitud = orden.solicitud || {};
        const modelo = vehiculo.modelo || {};
        const marca = modelo.marca || {};
        const fechaProgramada =
          solicitud.fecha_confirmada ||
          solicitud.fecha_solicitada ||
          orden.fecha_inicio_ot ||
          null;

        let bloqueHorario =
          solicitud.bloque_horario_confirmado ||
          solicitud.bloque_horario ||
          '';
        if (!bloqueHorario && typeof orden.hora_confirmada === 'string') {
          const partesHora = orden.hora_confirmada.split(' ');
          if (partesHora.length > 1) {
            bloqueHorario = partesHora.slice(1).join(' ').trim();
          }
        }

        return {
          ...orden,
          patente_vehiculo:
            vehiculo.patente_vehiculo ||
            solicitud.patente_vehiculo ||
            orden.patente_vehiculo ||
            'N/A',
          fecha_programada: fechaProgramada,
          hora_estimado: bloqueHorario || 'N/A',
          fecha_programada_reparacion: orden.fecha_programada_reparacion || null,
          hora_programada_reparacion: orden.hora_programada_reparacion || '',
          estado_reparacion: orden.estado_reparacion || 'pendiente',
          tipo_vehiculo:
            vehiculo.tipo?.tipo_vehiculo ||
            solicitud.tipo_vehiculo ||
            orden.tipo_vehiculo ||
            'N/A',
          modelo_vehiculo: modelo.nombre_modelo || orden.modelo_vehiculo || 'N/A',
          marca_vehiculo: marca.nombre_marca || orden.marca_vehiculo || 'N/A',
          sucursal_nombre:
            vehiculo.sucursal?.nombre_sucursal ||
            orden.sucursal_nombre ||
            'Sin asignar',
          kilometraje_registrado:
            vehiculo.kilometraje_vehiculo || solicitud.kilometraje_reportado || null,
          falla_reportada: solicitud.tipo_problema || orden.descripcion_ot || 'Sin especificar',
          prioridad: orden.prioridad_ot || solicitud.prioridad || 'normal',
          tipo_trabajo: solicitud.tipo_trabajo || 'diagnostico',
          detalle_reparacion: orden.detalle_reparacion || '',
        };
      });

      let filteredOrders = ordenesOrigen;

      if (hasEnv) {
        try {
          const { data: aprobacionesDb, error: aprobacionesError } = await supabase
            .from('aprobacion_asignacion_ot')
            .select('orden_trabajo_id, estado')
            .eq('mecanico_id', empleadoId);

          if (aprobacionesError) {
            throw aprobacionesError;
          }

          const aprobadasSet = new Set(
            (aprobacionesDb || [])
              .filter((row: any) => row.estado === 'aprobada')
              .map((row: any) => row.orden_trabajo_id)
          );

          filteredOrders = ordenesOrigen.filter((orden: any) => aprobadasSet.has(orden.id_orden_trabajo));
        } catch (error) {
          console.error('⚠️ Error consultando aprobaciones de asignación:', error);
        }
      }

      setMyOrders(filteredOrders);
      if (filteredOrders.length === 0) {
        setSelectedOT(null);
      }

      if (includeOverviewData) {
        let finalizadas = 0;
        let activas = 0;
        let pendientes = 0;

        const upcomingList = filteredOrders
          .filter((orden: any) => {
            const estadoNorm = normalizeOrderState(orden.estado_ot);
            return estadoNorm !== 'finalizada' && estadoNorm !== 'cancelada';
          })
          .filter((orden: any) => orden.fecha_programada)
          .sort(
            (a: any, b: any) =>
              new Date(a.fecha_programada || a.fecha_inicio_ot || 0).getTime() -
              new Date(b.fecha_programada || b.fecha_inicio_ot || 0).getTime()
          );

        filteredOrders.forEach((orden: any) => {
          const estadoNorm = normalizeOrderState(orden.estado_ot);
          if (estadoNorm === 'finalizada') {
            finalizadas += 1;
            return;
          }
          if (
            ['en_curso', 'en_reparacion', 'en_pruebas', 'esperando_repuestos', 'en_diagnostico_programado'].includes(
              estadoNorm
            )
          ) {
            activas += 1;
            return;
          }
          pendientes += 1;
        });

        setOverviewStats({
          total: filteredOrders.length,
          activas,
          pendientes,
          finalizadas,
        });

        setNextOrder(upcomingList[0] || null);
        setUpcomingOrders(upcomingList.slice(0, 3));

        const ordenIds = filteredOrders.map((orden: any) => orden.id_orden_trabajo).filter(Boolean);

        if (ordenIds.length > 0) {
          try {
            const { data: avancesRecientes, error: avancesOverviewError } = await supabase
              .from('avance_ot')
              .select(
                `
                id_avance_ot,
                orden_trabajo_id,
                descripcion_trabajo,
                hora_inicio,
                hora_fin,
                observaciones,
                fotos,
                mecanico_id,
                created_at
              `
              )
              .in('orden_trabajo_id', ordenIds)
              .order('created_at', { ascending: false })
              .limit(6);

            if (avancesOverviewError) {
              throw avancesOverviewError;
            }

            const enriched = (avancesRecientes || []).map((avance: any) => {
              const relatedOrder = filteredOrders.find(
                (orden: any) => orden.id_orden_trabajo === avance.orden_trabajo_id
              );
              return {
                ...avance,
                order: relatedOrder || null,
              };
            });

            setRecentProgressList(enriched);
          } catch (error) {
            console.error('⚠️ Error cargando avances recientes:', error);
            setRecentProgressList([]);
          }
        } else {
          setRecentProgressList([]);
        }

        try {
          const { data: finalOrdersDb, error: finalOrdersError } = await supabase
            .from('orden_trabajo')
            .select(
              `
              id_orden_trabajo,
              descripcion_ot,
              estado_ot,
              prioridad_ot,
              fecha_inicio_ot,
              fecha_cierre_ot,
              detalle_reparacion,
              vehiculo:vehiculo_id (
                patente_vehiculo,
                modelo:modelo_vehiculo_id (
                  nombre_modelo,
                  marca:marca_vehiculo_id (nombre_marca)
                )
              ),
              solicitud:solicitud_diagnostico_id (
                tipo_problema
              )
            `
            )
            .or(`empleado_id.eq.${empleadoId},mecanico_apoyo_ids.cs.{${empleadoId}}`)
            .eq('estado_cierre', 'cerrada')
            .order('fecha_cierre_ot', { ascending: false, nullsLast: true })
            .limit(5);

          if (finalOrdersError) {
            throw finalOrdersError;
          }

          const finalOrdersMapped = (finalOrdersDb || []).map((orden: any) => {
            const vehiculo = orden.vehiculo || {};
            const modelo = vehiculo.modelo || {};
            const marca = modelo.marca || {};
            const solicitud = orden.solicitud || {};
        return {
          ...orden,
              patente_vehiculo: vehiculo.patente_vehiculo || 'N/A',
              marca_vehiculo: marca.nombre_marca || 'N/A',
              modelo_vehiculo: modelo.nombre_modelo || 'N/A',
              descripcion_ot: orden.descripcion_ot || solicitud.tipo_problema || 'Sin detalle',
        };
      });

          setOverviewFinalizedOrders(finalOrdersMapped);
        } catch (error) {
          console.error('⚠️ Error cargando OT cerradas para el tablero:', error);
          setOverviewFinalizedOrders([]);
        }
      }

      await loadCompletedAdvances(empleadoId);
    } catch (error) {
      console.error('Error loading my orders:', error);
      setMyOrders([]);
      setSelectedOT(null);
    } finally {
      setLoading(false);
    }
  };

  const ensureSelectedOrder = (orders: any[]) => {
    if (orders.length > 0) {
      const first = orders[0];
      setSelectedOT(first);
      return first;
    }
    setSelectedOT(null);
    return null;
  };

  const fetchProgressLogs = async (orderId: number | null) => {
    if (!orderId || !hasEnv) {
      setProgressLogs([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('avance_ot')
        .select('*')
        .eq('orden_trabajo_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setProgressLogs(
        (data || []).map((log: any) => ({
          ...log,
          fecha_registro: log.created_at || log.fecha_registro,
        }))
      );
    } catch (error) {
      console.error('⚠️ Error cargando avances desde Supabase:', error);
      setProgressLogs([]);
    }
  };

  useEffect(() => {
  if (!combinedViewActive) return;
  const state =
    (location.state as { orderId?: number; tab?: 'ordenes' | 'registro' } | null) || null;
  if (!state) return;

  if (state.orderId) {
    if (myOrders.length === 0) return;
    const target = myOrders.find((orden) => orden.id_orden_trabajo === state.orderId);
    if (!target) return;
    setSelectedOT(target);
    setOrderUpdateData({
      estado_ot: target.estado_ot || 'en_reparacion',
      detalle_reparacion: target.detalle_reparacion || '',
    });
    fetchProgressLogs(target.id_orden_trabajo);
    setOtCombinedTab('registro');
    navigate(location.pathname, { replace: true });
    return;
  }

  if (state.tab) {
    setOtCombinedTab(state.tab);
    navigate(location.pathname, { replace: true });
  }
}, [combinedViewActive, location, myOrders]);

useEffect(() => {
  if (combinedViewActive) {
      return;
    }

    const current = ensureSelectedOrder(myOrders);
    if (!current) {
      fetchProgressLogs(null);
    }
}, [myOrders, combinedViewActive]);

useEffect(() => {
  if (!combinedViewActive || !selectedOT) return;
  const updated = myOrders.find(
    (orden) => orden.id_orden_trabajo === selectedOT.id_orden_trabajo
  );
  if (updated) {
    if (updated !== selectedOT) {
      setSelectedOT(updated);
      setOrderUpdateData((prev) => ({
        ...prev,
        estado_ot: updated.estado_ot || prev.estado_ot,
        detalle_reparacion: updated.detalle_reparacion || prev.detalle_reparacion,
      }));
    }
  } else {
    setSelectedOT(null);
  }
}, [combinedViewActive, myOrders, selectedOT]);

  const loadWorkHistory = async () => {
    try {
      setLoading(true);

      if (!hasEnv || !user?.id_usuario) {
        setWorkHistory([]);
        return;
      }

      const { data: empleadoDb, error: empleadoError } = await supabase
        .from('empleado')
        .select('id_empleado')
        .eq('usuario_id', user.id_usuario)
        .maybeSingle();

      if (empleadoError) {
        throw empleadoError;
      }

      if (!empleadoDb) {
        setWorkHistory([]);
        return;
      }

      const filtroArray = `mecanico_apoyo_ids.cs.{${empleadoDb.id_empleado}}`;
      const { data: ordenesDb, error: ordenesError } = await supabase
        .from('orden_trabajo')
        .select(
          `
          id_orden_trabajo,
          descripcion_ot,
          estado_ot,
          prioridad_ot,
          fecha_inicio_ot,
          fecha_cierre_ot,
          fecha_cierre_tecnico,
          estado_cierre,
          hora_confirmada,
          detalle_reparacion,
          created_at,
          vehiculo:vehiculo_id (
            patente_vehiculo,
            kilometraje_vehiculo,
            modelo:modelo_vehiculo_id (
              nombre_modelo,
              marca:marca_vehiculo_id (nombre_marca)
            ),
            tipo:tipo_vehiculo_id (tipo_vehiculo)
          ),
          solicitud:solicitud_diagnostico_id (
            tipo_problema,
            fecha_confirmada,
            bloque_horario_confirmado
          )
        `
        )
        .or(`empleado_id.eq.${empleadoDb.id_empleado},${filtroArray}`)
        .eq('estado_cierre', 'cerrada')
        .order('fecha_inicio_ot', { ascending: false, nullsLast: true });

      if (ordenesError) {
        throw ordenesError;
      }

      const dataArray = Array.isArray(ordenesDb) ? ordenesDb : [];
      const ordenIds = dataArray.map((orden: any) => orden.id_orden_trabajo).filter(Boolean);

      const avancesPorOrden = new Map<number, any[]>();
      if (ordenIds.length > 0) {
        const { data: avancesDb, error: avancesError } = await supabase
          .from('avance_ot')
          .select(
            `
            id_avance_ot,
            orden_trabajo_id,
            descripcion_trabajo,
            hora_inicio,
            hora_fin,
            observaciones,
            fotos,
            mecanico_id,
            created_at
          `
          )
          .in('orden_trabajo_id', ordenIds);

        if (avancesError) {
          throw avancesError;
        }

        if (Array.isArray(avancesDb)) {
          avancesDb.forEach((avance: any) => {
            const otId = avance.orden_trabajo_id;
            if (!otId) return;
            if (!avancesPorOrden.has(otId)) {
              avancesPorOrden.set(otId, []);
            }
            avancesPorOrden.get(otId)!.push(avance);
          });
        }
      }

      const historialOrigen = dataArray
        .map((orden: any) => {
            const vehiculo = orden.vehiculo || {};
            const modelo = vehiculo.modelo || {};
            const marca = modelo.marca || {};
            const solicitud = orden.solicitud || {};
            const avancesCrudos = avancesPorOrden.get(orden.id_orden_trabajo) || [];
            const avancesFiltrados = avancesCrudos
              .filter((avance: any) => !avance.mecanico_id || avance.mecanico_id === empleadoDb.id_empleado)
              .sort(
                (a: any, b: any) =>
                  new Date(b.created_at || b.fecha_registro || 0).getTime() -
                  new Date(a.created_at || a.fecha_registro || 0).getTime()
              );

            let bloqueHorario = solicitud.bloque_horario_confirmado || solicitud.bloque_horario || '';
            if (!bloqueHorario && typeof orden.hora_confirmada === 'string') {
              const partesHora = orden.hora_confirmada.split(' ');
              if (partesHora.length > 1) {
                bloqueHorario = partesHora.slice(1).join(' ').trim();
              }
            }

          return {
            ...orden,
              patente_vehiculo: vehiculo.patente_vehiculo || solicitud.patente_vehiculo || 'N/A',
              marca_vehiculo: marca.nombre_marca || 'N/A',
              modelo_vehiculo: modelo.nombre_modelo || 'N/A',
              tipo_vehiculo: vehiculo.tipo?.tipo_vehiculo || 'N/A',
              falla_reportada: solicitud.tipo_problema || orden.descripcion_ot || 'Sin especificar',
              bloque_horario: bloqueHorario,
              hora_estimado: bloqueHorario || 'N/A',
              fecha_programada: solicitud.fecha_confirmada || orden.fecha_inicio_ot,
              avances: avancesFiltrados,
              ultimo_avance: avancesFiltrados[0] || null,
            };
          })
        ;

      const historialFiltrado = historialOrigen.filter((orden: any) => {
        const estadoCierre = (orden.estado_cierre || '').toLowerCase();
        if (estadoCierre === 'cerrada') return true;
        if (orden.fecha_cierre_tecnico) return true;
        return false;
      });

      setWorkHistory(historialFiltrado);
      await loadCompletedAdvances(Number(empleadoDb.id_empleado));
    } catch (error) {
      console.error('Error loading work history:', error);
      setWorkHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToProgress = (orden: any) => {
    const selectOrder = () => {
    setSelectedOT(orden);
    setOrderUpdateData({
      estado_ot: orden.estado_ot || 'en_reparacion',
      detalle_reparacion: orden.detalle_reparacion || '',
    });
    fetchProgressLogs(orden.id_orden_trabajo);
      setOtCombinedTab('registro');
    };

    if (combinedViewActive) {
      selectOrder();
      return;
    }

    navigate('/mechanic-ots', { state: { orderId: orden.id_orden_trabajo } });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        showToast({
          type: 'warning',
          message: `La imagen ${file.name} es muy grande. Máximo 5MB por imagen.`,
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImages((prev) => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSaveProgress = async () => {
    if (!selectedOT) {
      showToast({
        type: 'warning',
        message: 'Selecciona una OT antes de registrar avances.',
      });
      return;
    }
    if (!progressData.descripcion_trabajo.trim()) {
      showToast({
        type: 'warning',
        message: 'Describe el trabajo realizado antes de registrar el avance.',
      });
      return;
    }

    const basePayload = {
      orden_trabajo_id: selectedOT.id_orden_trabajo,
      descripcion_trabajo: progressData.descripcion_trabajo.trim(),
      hora_inicio: progressData.hora_inicio || null,
      hora_fin: progressData.hora_fin || null,
      observaciones: progressData.observaciones || null,
      fotos: selectedImages.length > 0 ? selectedImages : null,
      mecanico_id: empleadoInfo?.id_empleado || null,
    };

    if (!hasEnv) {
      showToast({
        type: 'error',
        message: 'No se pudo registrar el avance porque la conexión a la base de datos no está disponible.',
      });
      return;
    }

    try {
      const { error: avanceError } = await supabase.from('avance_ot').insert([basePayload]);
      if (avanceError) {
        throw avanceError;
      }

      const { error: updateError } = await supabase
        .from('orden_trabajo')
        .update({
          estado_ot: orderUpdateData.estado_ot,
          detalle_reparacion: orderUpdateData.detalle_reparacion || null,
        })
        .eq('id_orden_trabajo', selectedOT.id_orden_trabajo);

      if (updateError) {
        throw updateError;
      }

      if (orderUpdateData.estado_ot === 'finalizada') {
        await loadWorkHistory();
    }

    showToast({
      type: 'success',
      message: 'Progreso registrado exitosamente.',
    });

    setProgressData({
      descripcion_trabajo: '',
      hora_inicio: '',
      hora_fin: '',
      observaciones: '',
      fotos: [],
    });
    setSelectedImages([]);
      await fetchProgressLogs(selectedOT.id_orden_trabajo);
      await loadMyOrders();
      await loadCompletedAdvances(empleadoInfo?.id_empleado || null);
    } catch (error: any) {
      console.error('Error guardando avance:', error);
      showToast({
        type: 'error',
        message: 'No se pudo guardar el avance en la base de datos.',
      });
    }
  };

  const handleUpdateRepairDetail = async () => {
    if (!selectedOT) {
      showToast({
        type: 'warning',
        message: 'Selecciona una OT para editar su detalle.',
      });
      return;
    }

    const nuevoDetalle = editDetailValue.trim();

    if (!hasEnv) {
      showToast({
        type: 'error',
        message: 'No se pudo actualizar el detalle porque la base de datos no está disponible.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('orden_trabajo')
        .update({
          estado_ot: orderUpdateData.estado_ot,
          detalle_reparacion: nuevoDetalle || null,
        })
        .eq('id_orden_trabajo', selectedOT.id_orden_trabajo);

      if (error) {
        throw error;
      }

      setSelectedOT({
        ...selectedOT,
        detalle_reparacion: nuevoDetalle,
        estado_ot: orderUpdateData.estado_ot,
      });
      setOrderUpdateData((prev) => ({
        ...prev,
        detalle_reparacion: nuevoDetalle,
      }));
    setEditDetailModal(false);

      await loadMyOrders();
      await fetchProgressLogs(selectedOT.id_orden_trabajo);
      await loadWorkHistory();

      showToast({
        type: 'success',
        message: 'Detalle de la OT actualizado.',
      });
    } catch (error: any) {
      console.error('Error actualizando detalle:', error);
      showToast({
        type: 'error',
        message: 'No se pudo actualizar la OT en la base de datos.',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES');
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const fecha = new Date(dateStr);
      return `${fecha.toLocaleDateString('es-ES')} ${fecha.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return 'N/A';
    }
  };

  const formatHours = (hours: number) => {
    if (!hours || Number.isNaN(hours)) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours.toFixed(1)} h`;
  };

  const getStatusStyles = (estado?: string) => {
    switch ((estado || '').toLowerCase()) {
      case 'finalizada':
        return { label: 'Finalizada', classes: 'bg-green-100 text-green-700 border-green-200' };
      case 'en_reparacion':
        return { label: 'En reparación', classes: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'en curso':
        return { label: 'En curso', classes: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
      case 'esperando_repuestos':
        return { label: 'Esperando repuestos', classes: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'en_pruebas':
        return { label: 'En pruebas', classes: 'bg-purple-100 text-purple-700 border-purple-200' };
      default:
        return { label: estado || 'Pendiente', classes: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const renderPendingProgressSection = () => {
    const pendientes = myOrders.filter((order) => order.estado_ot !== 'finalizada');

    if (pendientes.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
          <FileText className="mx-auto text-slate-300" size={48} />
          <p className="mt-4 text-sm text-slate-500">No tienes órdenes pendientes para registrar avances.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendientes.map((order) => (
            <button
              key={order.id_orden_trabajo}
              onClick={() => {
                const isSelected = selectedOT?.id_orden_trabajo === order.id_orden_trabajo;
                if (isSelected) {
                  setSelectedOT(null);
                  setOrderUpdateData({ estado_ot: 'en_reparacion', detalle_reparacion: '' });
                  fetchProgressLogs(null);
                  return;
                }
                setSelectedOT(order);
                setOrderUpdateData({
                  estado_ot: order.estado_ot || 'en_reparacion',
                  detalle_reparacion: order.detalle_reparacion || '',
                });
                fetchProgressLogs(order.id_orden_trabajo);
              }}
              className={`text-left rounded-2xl border px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                selectedOT?.id_orden_trabajo === order.id_orden_trabajo
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                <span>{order.patente_vehiculo}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">OT #{order.id_orden_trabajo}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {order.marca_vehiculo} {order.modelo_vehiculo} · {order.falla_reportada}
              </p>
            </button>
          ))}
        </div>

        {selectedOT ? (
          <div className="space-y-6 rounded-3xl border border-blue-100 bg-blue-50/60 p-6 shadow-inner">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1 text-sm text-blue-800">
                <h3 className="text-lg font-semibold text-blue-900">OT seleccionada</h3>
                <p><strong>Patente:</strong> {selectedOT.patente_vehiculo}</p>
                <p><strong>Marca / Modelo:</strong> {selectedOT.marca_vehiculo} {selectedOT.modelo_vehiculo}</p>
                <p><strong>Falla:</strong> {selectedOT.falla_reportada}</p>
                <p><strong>Estado actual:</strong> {orderUpdateData.estado_ot}</p>
              </div>
              <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-600 shadow-sm">
                OT #{selectedOT.id_orden_trabajo}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción del Trabajo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={progressData.descripcion_trabajo}
                  onChange={(e) => setProgressData({ ...progressData, descripcion_trabajo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Describe lo que estás haciendo..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Play size={16} className="inline mr-1" /> Hora de Inicio
                  </label>
                  <input
                    type="time"
                    value={progressData.hora_inicio}
                    onChange={(e) => setProgressData({ ...progressData, hora_inicio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Pause size={16} className="inline mr-1" /> Hora de Fin
                  </label>
                  <input
                    type="time"
                    value={progressData.hora_fin}
                    onChange={(e) => setProgressData({ ...progressData, hora_fin: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones / Datos Importantes
                </label>
                <textarea
                  value={progressData.observaciones}
                  onChange={(e) => setProgressData({ ...progressData, observaciones: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Mediciones, códigos de falla, etc..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Camera size={16} className="inline mr-1" /> Fotografías (Antes / Durante / Después)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {selectedImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {selectedImages.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-20 object-cover rounded border border-gray-300"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de la OT
                  </label>
                  <select
                    value={orderUpdateData.estado_ot}
                    onChange={(e) => setOrderUpdateData({ ...orderUpdateData, estado_ot: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="en_reparacion">En reparación</option>
                    <option value="esperando_repuestos">Esperando repuestos</option>
                    <option value="en_pruebas">En pruebas</option>
                    <option value="finalizada">Finalizada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resumen técnico / pendientes
                  </label>
                  <textarea
                    value={orderUpdateData.detalle_reparacion}
                    onChange={(e) =>
                      setOrderUpdateData({
                        ...orderUpdateData,
                        detalle_reparacion: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Checklist, piezas reemplazadas, próximas acciones..."
                  />
                </div>
              </div>

              <button
                onClick={handleSaveProgress}
                disabled={!progressData.descripcion_trabajo}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
              >
                Guardar avance
              </button>
            </div>

            {progressLogs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Avances registrados</h3>
                <div className="space-y-3">
                  {progressLogs.map((log, index) => (
                    <div
                      key={`${log.fecha_registro}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>
                          {new Date(log.fecha_registro).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          {new Date(log.fecha_registro).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {(log.hora_inicio || log.hora_fin) && (
                          <span>
                            ⏱️ {log.hora_inicio || '--:--'} - {log.hora_fin || '--:--'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 mb-2">
                        <strong>Trabajo:</strong> {log.descripcion_trabajo}
                      </p>
                      {log.observaciones && (
                        <p className="text-xs text-gray-600">
                          <strong>Obs:</strong> {log.observaciones}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const renderFinalizedProgressSection = () => {
    if (completedAdvances.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
          <FileText className="mx-auto text-slate-300" size={48} />
          <p className="mt-4 text-sm text-slate-500">No hay revisiones finalizadas registradas todavía.</p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {completedAdvances.map((avance) => (
          <div key={avance.id_avance_ot} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {avance.order?.patente_vehiculo || `OT #${avance.orden_trabajo_id}`}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(avance.created_at)}</p>
                <p className="mt-1 text-sm text-slate-600">
                  <strong>Trabajo:</strong> {avance.descripcion_trabajo}
                </p>
                {avance.observaciones && (
                  <p className="text-xs text-slate-500">
                    <strong>Obs:</strong> {avance.observaciones}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const orderRef =
                    avance.order ||
                    myOrders.find((orden: any) => orden.id_orden_trabajo === avance.orden_trabajo_id);
                  if (orderRef) {
                    handleGoToProgress(orderRef);
                  } else {
                    showToast({
                      type: 'error',
                      message: 'No se encontró la OT asociada en tu lista.',
                    });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                Ver OT
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {activeSection === 'overview' && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  <Activity size={14} />
                  Resumen de tu jornada
                </span>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">
                    Hola,
                    {' '}
                    {empleadoInfo?.nombre
                      ? `${empleadoInfo.nombre} ${empleadoInfo.apellido_paterno || ''}`.trim()
                      : user?.usuario || 'Mecánico'}
                  </h1>
                  <p className="text-sm text-slate-500">
                    Tienes {overviewStats.activas + overviewStats.pendientes} OT activas o pendientes. Revisa tus próximas tareas.
                  </p>
                </div>
              </div>
              <div className="w-full max-w-xs">
                {nextOrder ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Próxima OT programada</p>
                    <p className="mt-2 text-lg font-semibold text-blue-900">{nextOrder.patente_vehiculo}</p>
                    <p className="text-xs text-blue-700">
                      {formatDate(nextOrder.fecha_programada)} · {nextOrder.hora_estimado || 'Horario por confirmar'}
                    </p>
                    <p className="mt-3 text-xs text-blue-600">{nextOrder.falla_reportada || 'Sin descripción'}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-xs text-slate-500">
                    No tienes OT programadas próximamente.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { key: 'total', label: 'OT Totales', value: overviewStats.total, icon: ClipboardList, color: 'text-slate-700', bg: 'bg-slate-100' },
              { key: 'activas', label: 'En ejecución', value: overviewStats.activas, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-100' },
              { key: 'pendientes', label: 'Pendientes', value: overviewStats.pendientes, icon: AlertCircle, color: 'text-amber-700', bg: 'bg-amber-100' },
              { key: 'finalizadas', label: 'Finalizadas', value: overviewStats.finalizadas, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-100' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bg} ${stat.color}`}>
                      <Icon size={22} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Próximas OT programadas</h2>
                  <p className="text-xs text-slate-500">Coordina tiempos y materiales antes de iniciar.</p>
                </div>
                <button
                  onClick={() => navigate('/mechanic-assigned')}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600"
                >
                  Ver todas
                  <ArrowRight size={14} />
                </button>
              </div>
              {upcomingOrders.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                  No tienes OT próximas con fecha asignada.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {upcomingOrders.map((orden) => (
                    <div key={orden.id_orden_trabajo} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1 text-sm text-slate-600">
                          <p className="text-base font-semibold text-slate-900">{orden.patente_vehiculo}</p>
                          <p className="text-xs text-slate-500">
                            {orden.marca_vehiculo} {orden.modelo_vehiculo}
                          </p>
                          <p>
                            <strong>Fecha:</strong> {formatDate(orden.fecha_programada)} · {orden.hora_estimado || 'Por definir'}
                          </p>
                          <p>
                            <strong>Falla:</strong> {orden.falla_reportada || orden.descripcion_ot || 'Sin detalle'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleGoToProgress(orden)}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
                        >
                          Abrir OT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Avances recientes</h2>
                  <p className="text-xs text-slate-500">Mantén tu historial al día registrando cada intervención.</p>
                </div>
                <button
                  onClick={() => navigate('/mechanic-ots', { state: { tab: 'registro' } })}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Registrar nuevo
                </button>
              </div>
              {recentProgressList.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                  Aún no registras avances en tus OT.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {recentProgressList.map((avance) => (
                    <div key={avance.id_avance_ot} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {avance.order?.patente_vehiculo || `OT #${avance.orden_trabajo_id}`}
                          </p>
                          <p className="text-xs text-slate-500">{formatDateTime(avance.created_at)}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            <strong>Trabajo:</strong> {avance.descripcion_trabajo}
                          </p>
                          {avance.observaciones && (
                            <p className="text-xs text-slate-500">
                              <strong>Obs:</strong> {avance.observaciones}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const orderRef =
                              avance.order ||
                              myOrders.find((orden: any) => orden.id_orden_trabajo === avance.orden_trabajo_id);
                            if (orderRef) {
                              handleGoToProgress(orderRef);
                            } else {
                              showToast({
                                type: 'error',
                                message: 'No se encontró la OT asociada en tu lista.',
                              });
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          Ver OT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Últimas OT con avance</h2>
                <p className="text-xs text-slate-500">Cada vez que registres trabajo, lo verás reflejado aquí.</p>
              </div>
            </div>
            {completedAdvances.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                Aún no registras avances recientemente.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {completedAdvances.slice(0, 4).map((avance) => (
                  <div key={avance.id_avance_ot} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{avance.patente_vehiculo}</p>
                        <p className="text-xs text-slate-500">
                          {avance.marca_vehiculo} {avance.modelo_vehiculo}
                        </p>
                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                          <p>
                            <strong>Trabajo:</strong> {avance.descripcion_trabajo}
                          </p>
                          {avance.observaciones && (
                            <p>
                              <strong>Obs:</strong> {avance.observaciones}
                            </p>
                          )}
                          <p>
                            <strong>Registrado:</strong> {formatDateTime(avance.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle size={14} />
                        Avance registrado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {combinedViewActive && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-transparent bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500 p-8 text-white shadow-xl shadow-blue-200/40">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  <ClipboardList size={14} />
                  Flujo operativo del día
                </span>
                <div>
                  <h1 className="text-3xl font-bold">OT´s y Registro de Avances</h1>
                  <p className="text-sm text-blue-100">
                    Revisa tus órdenes asignadas, conoce su prioridad y documenta el progreso sin cambiar de pantalla.
                  </p>
                </div>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto">
                {[
                  { label: 'OT asignadas', value: combinedSummary.total },
                  { label: 'Activas', value: combinedSummary.activas },
                  { label: 'Finalizadas', value: combinedSummary.finalizadas },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/30 bg-white/15 px-4 py-3 text-center backdrop-blur"
                  >
                    <p className="text-xs uppercase tracking-wide text-white/70">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{combinedTabTitle}</p>
                <p className="text-sm text-slate-600">{combinedTabDescription}</p>
              </div>
              <div className="inline-flex flex-nowrap items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold text-slate-500 shadow-inner">
                <button
                  onClick={() => setOtCombinedTab('ordenes')}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                    otCombinedTab === 'ordenes'
                      ? 'bg-white text-blue-600 shadow shadow-blue-100'
                      : 'hover:text-blue-600'
                  }`}
                >
                  <ClipboardList size={16} />
                  Órdenes asignadas
                </button>
                <button
                  onClick={() => setOtCombinedTab('registro')}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                    otCombinedTab === 'registro'
                      ? 'bg-white text-emerald-600 shadow shadow-emerald-100'
                      : 'hover:text-emerald-600'
                  }`}
                >
                  <Activity size={16} />
                  Registro de avances
                </button>
                <button
                  onClick={() => setOtCombinedTab('finalizadas')}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                    otCombinedTab === 'finalizadas'
                      ? 'bg-white text-rose-600 shadow shadow-rose-100'
                      : 'hover:text-rose-600'
                  }`}
                >
                  <CheckCircle size={16} />
                  OT finalizadas
                </button>
              </div>
            </div>
          </div>

          {otCombinedTab === 'ordenes' && renderOrdersGrid(activeOrders, 'No tienes órdenes de trabajo asignadas.')}
          {otCombinedTab === 'finalizadas' &&
            renderOrdersGrid(finalOrders, 'Aún no registras OT finalizadas en tu lista.')}
          {otCombinedTab === 'registro' && (
            <div className="space-y-6">
              {progressTab === 'pendientes'
                ? renderPendingProgressSection()
                : renderFinalizedProgressSection()}
            </div>
          )}
        </div>
      )}
      {activeSection === 'assigned' && !combinedViewActive && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Mis OT Asignadas</h1>
                <p className="text-sm text-slate-500">Revisa las órdenes que tienes a tu cargo y registra avances.</p>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                {activeOrders.length} OT asignada(s)
              </div>
            </div>
          </div>

          {activeOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
              <FileText className="mx-auto text-slate-300" size={48} />
              <p className="mt-4 text-sm text-slate-500">No tienes órdenes de trabajo asignadas.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {activeOrders.map((order) => {
                const reparacionEstado = (order.estado_reparacion || 'pendiente').toLowerCase();
                const reparacionProgramada = Boolean(order.fecha_programada_reparacion);
                const reparacionBadgeClasses =
                  reparacionEstado === 'programada'
                    ? 'bg-emerald-100 text-emerald-700'
                    : reparacionEstado === 'en_reparacion'
                    ? 'bg-blue-100 text-blue-700'
                    : reparacionEstado === 'finalizada'
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-amber-100 text-amber-700';
                const estadoOtClasses = getOtEstadoClasses(order.estado_ot);
                const estadoOtLabel = formatEstadoLabel(order.estado_ot);
                return (
                <div
                  key={order.id_orden_trabajo}
                  className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow">
                          <Truck size={16} />
                          {order.patente_vehiculo}
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            order.prioridad === 'critica'
                              ? 'bg-rose-100 text-rose-700'
                              : order.prioridad === 'alta'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {order.prioridad === 'critica'
                            ? 'Crítica'
                            : order.prioridad === 'alta'
                            ? 'Alta'
                            : 'Normal'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${estadoOtClasses}`}
                        >
                          {estadoOtLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${reparacionBadgeClasses}`}
                        >
                          {`Reparación: ${reparacionEstado.replace(/_/g, ' ')}`}
                        </span>
                      </div>

                      <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                        <span className="inline-flex items-center gap-2">
                          <AlertCircle size={16} className="text-slate-400" />
                            <strong>Falla:</strong> {order.falla_reportada}
                          </span>
                        <span className="inline-flex items-center gap-2">
                          <Truck size={16} className="text-slate-400" />
                            <strong>Marca / Modelo:</strong> {order.marca_vehiculo} {order.modelo_vehiculo}
                          </span>
                        <span className="inline-flex items-center gap-2">
                          <User size={16} className="text-slate-400" />
                            <strong>Tipo:</strong> {order.tipo_vehiculo}
                          </span>
                        <span className="inline-flex items-center gap-2">
                          <Calendar size={16} className="text-slate-400" />
                          <strong>Fecha inicio:</strong> {formatDate(order.fecha_programada || order.fecha_inicio_ot)}
                          </span>
                        <span className="inline-flex items-center gap-2">
                          <Clock size={16} className="text-slate-400" />
                          <strong>Hora estimada:</strong> {order.hora_estimado || order.hora_confirmada || 'N/A'}
                          </span>
                        <span className="inline-flex items-center gap-2">
                          <ClipboardList size={16} className="text-slate-400" />
                            <strong>Sucursal:</strong> {order.sucursal_nombre}
                          </span>
                        {order.kilometraje_registrado && (
                          <span className="inline-flex.items-center gap-2">
                            <Gauge size={16} className="text-slate-400" />
                              <strong>Kilometraje:</strong> {order.kilometraje_registrado.toLocaleString('es-CL')} km
                            </span>
                        )}
                      </div>

                      {reparacionProgramada && (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700 inline-flex items-center gap-2">
                          <Calendar size={16} />
                          <span>
                            Reparación programada para{' '}
                            {formatDate(order.fecha_programada_reparacion)}{' '}
                            {order.hora_programada_reparacion
                              ? `· ${order.hora_programada_reparacion}`
                              : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-stretch gap-2 md:items-end">
                      <button
                        onClick={() => handleGoToProgress(order)}
                        className="inline-flex items-center.justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
                      >
                        Ver detalle y registrar
                      </button>
                      {order.estado_ot !== 'finalizada' && (
                        <button
                          onClick={() => handleGoToProgress(order)}
                          className="inline-flex items-center.justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-600"
                        >
                          Registrar avance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}

      {activeSection === 'detail' && null}

      {activeSection === 'progress' && !combinedViewActive && (
        <div className="space-y-8">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  <Activity size={14} />
                  Registro técnico
                </span>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Registro de Avances / Trabajo Realizado</h1>
                  <p className="text-sm text-slate-500">
                    Selecciona una OT para documentar tu trabajo, adjuntar evidencias y mantener el historial actualizado.
                  </p>
            </div>
                </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                {progressTab === 'pendientes' ? 'OT pendientes de avance' : 'Revisiones finalizadas'}
              </div>
              </div>
              </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner shadow-white">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setProgressTab('pendientes')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  progressTab === 'pendientes'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-white text-slate-600 hover:text-blue-600'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setProgressTab('finalizadas')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  progressTab === 'finalizadas'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-white text-slate-600 hover:text-emerald-600'
                }`}
              >
                Revisiones finalizadas
              </button>
            </div>
          </div>

          {progressTab === 'pendientes'
            ? renderPendingProgressSection()
            : renderFinalizedProgressSection()}
        </div>
      )}

      <Modal
        isOpen={editDetailModal}
        onClose={() => {
          setEditDetailModal(false);
          setEditDetailValue(selectedOT?.detalle_reparacion || '');
        }}
        title="Actualizar detalle de reparación"
      >
        <div className="space-y-4">
          <textarea
            value={editDetailValue}
            onChange={(e) => setEditDetailValue(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={5}
            placeholder="Describe el trabajo final, piezas reemplazadas, pruebas realizadas..."
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setEditDetailModal(false);
                setEditDetailValue(selectedOT?.detalle_reparacion || '');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpdateRepairDetail}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


