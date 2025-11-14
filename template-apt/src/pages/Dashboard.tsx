import { useEffect, useMemo, useRef, useState } from 'react';
import { Users, Truck, FileText, AlertCircle, Clock, User, MapPin } from 'lucide-react';
import Card from '../components/Card';
import Table from '../components/Table';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OrdenTrabajo, Empleado, Vehiculo } from '../types/database';

const dedupeById = <T extends Record<string, any>>(array: T[], idKey = 'id'): T[] => {
  const map = new Map<any, T>();
  for (const item of array) {
    if (!item || item[idKey] === undefined || item[idKey] === null) continue;
    map.set(item[idKey], item);
  }
  return Array.from(map.values());
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    availableVehicles: 0,
    activeOrders: 0,
    pendingIncidents: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [driverHistory, setDriverHistory] = useState<any[]>([]);
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const useLocalMocks = !hasEnv;
  const didFetchRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!useLocalMocks && didFetchRef.current) {
      return;
    }
    didFetchRef.current = true;
    loadDashboardData();
  }, [user, useLocalMocks]);

  useEffect(() => {
    if (user?.rol !== 'driver' || !useLocalMocks) {
      return;
    }

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ key?: string }>;
      const key = custom.detail?.key;
      if (!key || ['apt_driver_history', 'apt_ordenes_trabajo', 'apt_solicitudes_diagnostico'].includes(key)) {
        loadDashboardData();
      }
    };

    window.addEventListener('apt-local-update', handler as EventListener);
    return () => window.removeEventListener('apt-local-update', handler as EventListener);
  }, [user]);

  const readLocal = (key: string, fallback: any) => {
    if (!useLocalMocks) {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const normalizeDate = (value: any): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const formatDate = (value?: any) => {
    const iso = normalizeDate(value);
    if (!iso) return 'N/A';
    const date = new Date(iso);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (value?: any) => {
    const iso = normalizeDate(value);
    if (!iso) return null;
    const date = new Date(iso);
    return (
      date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const formatHour = (value?: string | null) => {
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
  };

  const buildDriverTimeline = (solicitud: any, ordenData: any, ordenLocal: any) => {
    const estadoSolicitud = (solicitud?.estado_solicitud || '').toLowerCase();
    const estadoOrden = (ordenLocal?.estado_ot || ordenData?.estado_ot || '').toLowerCase();
    const fechaInicio = normalizeDate(
      ordenLocal?.fecha_inicio_ot || ordenData?.fecha_inicio_ot || solicitud?.fecha_confirmada
    );
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
      if (step.reached) lastReachedIndex = idx;
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
        formattedDate: formatDateTime(step.date) || 'En proceso',
      };
    });
  };

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

  const sortedDriverHistory = useMemo(() => {
    return [...driverHistory].sort((a, b) => {
      const aDate = a?.fecha ? new Date(a.fecha).getTime() : 0;
      const bDate = b?.fecha ? new Date(b.fecha).getTime() : 0;
      return bDate - aDate;
    });
  }, [driverHistory]);

  const buildDriverHistory = (
    orders: any[],
    empleadoId?: number | null,
    solicitudesFuente?: any[],
    driverHistoryFuente?: any[]
  ): any[] => {
    const solicitudesLocales = useLocalMocks ? readLocal('apt_solicitudes_diagnostico', []) : [];
    const ordenesLS = useLocalMocks ? readLocal('apt_ordenes_trabajo', []) : [];
    const citasLocales = useLocalMocks ? readLocal('apt_driver_history', []) : [];

    const todasLasSolicitudes = [
      ...(Array.isArray(solicitudesFuente) ? solicitudesFuente : []),
      ...(Array.isArray(solicitudesLocales) ? solicitudesLocales : []),
    ];

    const solicitudesMap = new Map<string, any>();
    todasLasSolicitudes.forEach((solicitud: any) => {
      const key = String(solicitud.id_solicitud_diagnostico ?? solicitud.id ?? solicitud.uuid ?? '');
      if (!key) return;
      if (!solicitudesMap.has(key)) {
        solicitudesMap.set(key, solicitud);
      }
    });
    const solicitudesCombinadas = Array.from(solicitudesMap.values());

    const driverHistoryExtra = Array.isArray(driverHistoryFuente) ? driverHistoryFuente : [];
    const driverHistoryLocales = Array.isArray(citasLocales) ? citasLocales : [];
    const driverHistoryCombinado = [...driverHistoryExtra, ...driverHistoryLocales];

    const history = orders.map((orden: any) => {
      const solicitud = solicitudesCombinadas.find((s: any) => {
        const solicitudId = s.id_solicitud_diagnostico ?? s.id ?? null;
        if (!solicitudId) return false;
        return (
          s.orden_trabajo_id === orden.id_orden_trabajo ||
          solicitudId === orden.solicitud_diagnostico_id ||
          (typeof orden.id_orden_trabajo === 'string' &&
            orden.id_orden_trabajo.startsWith('solicitud-') &&
            `solicitud-${solicitudId}` === orden.id_orden_trabajo)
        );
      }) || null;

      const ordenLocal = Array.isArray(ordenesLS)
        ? ordenesLS.find((o: any) =>
            o.id_orden_trabajo === orden.id_orden_trabajo ||
            (orden.solicitud_diagnostico_id && o.solicitud_diagnostico_id === orden.solicitud_diagnostico_id) ||
            (typeof orden.id_orden_trabajo === 'string' &&
              orden.id_orden_trabajo.startsWith('solicitud-') &&
              o.solicitud_diagnostico_id?.toString() === orden.id_orden_trabajo.replace('solicitud-', ''))
          )
        : null;

      const citaGuardada = driverHistoryCombinado.find((c: any) =>
            c.id === orden.id_orden_trabajo ||
            c.solicitud_diagnostico_id === orden.solicitud_diagnostico_id
          ) || null;

      const perteneceAlChofer = !empleadoId
        || orden.empleado_id === empleadoId
        || solicitud?.empleado_id === empleadoId
        || ordenLocal?.empleado_id === empleadoId;

      if (!perteneceAlChofer) {
        return null;
      }

      const timeline = buildDriverTimeline(solicitud, orden, ordenLocal);
      const lastStep = [...timeline].reverse().find((step) => step.status !== 'pending');
      const estadoActual = lastStep?.label || 'Solicitud registrada';
      const estadoBadgeClass =
        lastStep?.status === 'complete'
          ? 'bg-green-100 text-green-700 border border-green-200'
          : lastStep?.status === 'current'
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'bg-gray-100 text-gray-500 border border-gray-200';

      const fechaReferencia = normalizeDate(
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
        citaGuardada?.bloque_horario ||
        null;

      const patente =
        preferValues(
          orden.patente_vehiculo,
          solicitud?.patente_vehiculo,
          solicitud?.vehiculo?.patente_vehiculo,
          ordenLocal?.patente_vehiculo,
          citaGuardada?.patente
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

      const solicitudId = solicitud?.id_solicitud_diagnostico ?? solicitud?.id ?? null;

      return {
        id: orden.id_orden_trabajo,
        solicitud_diagnostico_id: orden.solicitud_diagnostico_id ?? solicitudId ?? null,
        patente,
        problema,
        fecha: fechaReferencia,
        fechaFormateada: fechaReferencia ? formatDate(fechaReferencia) : 'N/A',
        hora: formatHour(typeof rawHora === 'string' ? rawHora : null),
        timeline,
        estadoActual,
        estadoBadgeClass,
      };
    }).filter(Boolean);

    const seenIds = new Set(history.map((h) => h.id));
    const extrasSolicitudes = solicitudesCombinadas
      .filter((solicitud: any) => {
        const solicitudId = solicitud.id_solicitud_diagnostico ?? solicitud.id ?? null;
        if (!solicitudId) return false;
        return (
          !history.some(
            (h) =>
              h.id === solicitudId ||
              h.solicitud_diagnostico_id === solicitudId ||
              h.patente === solicitud.patente_vehiculo
          ) &&
          (!empleadoId || solicitud.empleado_id === empleadoId)
        );
      })
      .map((solicitud: any) => {
        const timeline = buildDriverTimeline(solicitud, null, null);
        const lastStep = [...timeline].reverse().find((step) => step.status !== 'pending');
        const estadoActual = lastStep?.label || 'Solicitud registrada';
        const estadoBadgeClass =
          lastStep?.status === 'complete'
            ? 'bg-green-100 text-green-700 border border-green-200'
            : lastStep?.status === 'current'
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200';

        const patente =
          preferValues(
            solicitud.patente_vehiculo,
            solicitud.vehiculo?.patente_vehiculo
          ) || 'Sin patente';

        const problema =
          preferValues(
            solicitud.tipo_problema,
            solicitud.descripcion_problema,
            solicitud.motivo_consulta
          ) || 'Diagnóstico solicitado';

        return {
          id: solicitud.id_solicitud_diagnostico || solicitud.id,
          solicitud_diagnostico_id: solicitud.id_solicitud_diagnostico || null,
          patente,
          problema,
          fecha: normalizeDate(solicitud.fecha_confirmada || solicitud.fecha_solicitada || solicitud.created_at),
          fechaFormateada: formatDate(solicitud.fecha_confirmada || solicitud.fecha_solicitada || solicitud.created_at),
          hora: formatHour(solicitud.bloque_horario_confirmado || solicitud.bloque_horario),
          timeline,
          estadoActual,
          estadoBadgeClass,
        };
      });

    const extrasHistorial = driverHistoryCombinado
      .filter((c: any) =>
        !seenIds.has(c.id) &&
        !history.some(
          (h) =>
            h.id === c.id ||
            (h.solicitud_diagnostico_id && h.solicitud_diagnostico_id === c.solicitud_diagnostico_id)
        ) &&
        (!empleadoId || c.empleado_id === empleadoId)
      )
      .map((c: any) => {
        const solicitudSimulada = {
          fecha_confirmada: c.fecha_programada,
          fecha_solicitada: c.fecha_programada,
          bloque_horario_confirmado: c.bloque_horario,
          bloque_horario: c.bloque_horario,
          estado_solicitud: c.estado_solicitud || 'pendiente_confirmacion',
          created_at: c.created_at,
        };
        const timeline = buildDriverTimeline(solicitudSimulada, null, null);
        const lastStep = [...timeline].reverse().find((step) => step.status !== 'pending');
        const estadoActual = lastStep?.label || 'Solicitud registrada';
        const estadoBadgeClass =
          lastStep?.status === 'complete'
            ? 'bg-green-100 text-green-700 border border-green-200'
            : lastStep?.status === 'current'
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200';

        return {
          id: c.id,
          solicitud_diagnostico_id: c.solicitud_diagnostico_id || null,
          patente: c.patente_vehiculo || 'N/A',
          problema: c.tipo_problema || 'N/A',
          fecha: normalizeDate(c.fecha_programada) || normalizeDate(c.created_at),
          fechaFormateada: formatDate(c.fecha_programada || c.created_at),
          hora: formatHour(c.bloque_horario),
          timeline,
          estadoActual,
          estadoBadgeClass,
        };
      });

    const combined = [...history, ...extrasSolicitudes, ...extrasHistorial];

    return combined.sort((a, b) => {
      const aDate = a.fecha ? new Date(a.fecha).getTime() : 0;
      const bDate = b.fecha ? new Date(b.fecha).getTime() : 0;
      return bDate - aDate;
    });
  };

  const loadDashboardData = async () => {
    try {
      let empleadoIdLocal: number | null = null;
      const [employeesRes, vehiclesRes, ordersRes, incidentsRes] = await Promise.all([
        supabase.from('empleado').select('id_empleado', { count: 'exact', head: true }),
        supabase.from('vehiculo').select('id_vehiculo', { count: 'exact', head: true }).eq('estado_vehiculo', 'disponible'),
        supabase.from('orden_trabajo').select('id_orden_trabajo', { count: 'exact', head: true }).in('estado_ot', ['pendiente', 'en curso']),
        supabase.from('incidencia').select('id_incidencia', { count: 'exact', head: true }).eq('estado_incidencia', 'pendiente'),
      ]);

      setStats({
        totalEmployees: employeesRes.count || 0,
        availableVehicles: vehiclesRes.count || 0,
        activeOrders: ordersRes.count || 0,
        pendingIncidents: incidentsRes.count || 0,
      });

      if (user?.rol === 'driver') {
        setDriverProfile(null);
        const { data: empleado } = await supabase
          .from('empleado')
          .select(
            `
            id_empleado,
            nombre,
            apellido_paterno,
            apellido_materno,
            telefono1,
            telefono2,
            email,
            cargo:cargo_id(nombre_cargo)
          `
          )
          .eq('usuario_id', user.id_usuario)
          .maybeSingle();

        if (empleado) {
          empleadoIdLocal = empleado.id_empleado;
          const [
            { data: orders },
            { data: solicitudesDb },
            { data: driverHistoryDb },
            asignacionRes,
          ] = await Promise.all([
            supabase
              .from('orden_trabajo')
              .select(`
                *,
                empleado:empleado_id(nombre, apellido_paterno),
                vehiculo:vehiculo_id(patente_vehiculo)
              `)
              .eq('empleado_id', empleado.id_empleado)
              .order('fecha_inicio_ot', { ascending: false })
              .limit(30),
            supabase
              .from('solicitud_diagnostico')
              .select('*')
              .eq('empleado_id', empleado.id_empleado)
              .order('created_at', { ascending: false }),
            supabase
              .from('driver_history')
              .select('*')
              .eq('empleado_id', empleado.id_empleado)
              .order('created_at', { ascending: false }),
            supabase
              .from('asignacion_vehiculo')
              .select(
                `
                id_asignacion,
                estado_asignacion,
                fecha_asignacion,
                fecha_fin,
                vehiculo:vehiculo_id (
                  id_vehiculo,
                  patente_vehiculo,
                  estado_vehiculo,
                  kilometraje_vehiculo,
                  modelo:modelo_vehiculo_id (
                    nombre_modelo,
                    anio_modelo,
                    marca:marca_vehiculo_id(nombre_marca)
                  ),
                  tipo:tipo_vehiculo_id(tipo_vehiculo)
                ),
                sucursal:sucursal_id (
                  id_sucursal,
                  nombre_sucursal,
                  comuna_sucursal
                )
              `
              )
              .eq('empleado_id', empleado.id_empleado)
              .eq('estado_asignacion', 'activo')
              .maybeSingle(),
          ]);

          const asignacionActiva = asignacionRes?.data || null;
          setDriverProfile({
            empleado: {
              id_empleado: empleado.id_empleado,
              nombre: empleado.nombre,
              apellido_paterno: empleado.apellido_paterno,
              apellido_materno: empleado.apellido_materno,
              telefono: empleado.telefono1 || empleado.telefono2 || null,
              email: empleado.email || null,
              cargo: empleado.cargo?.nombre_cargo || null,
            },
            asignacion: asignacionActiva,
          });

          setRecentOrders(dedupeById(orders || [], 'id_orden_trabajo'));

          let combinedOrders = [...(orders || [])];

          if (useLocalMocks) {
            const localOrders = readLocal('apt_ordenes_trabajo', []);
            const localFiltered = Array.isArray(localOrders)
              ? localOrders.filter((o: any) => o.empleado_id === empleado.id_empleado)
              : [];

            const existingIds = new Set(combinedOrders.map((o: any) => o.id_orden_trabajo));
            localFiltered.forEach((o: any) => {
              if (!existingIds.has(o.id_orden_trabajo)) {
                combinedOrders.push(o);
              }
            });
          }

          setDriverHistory(
            dedupeById(
              buildDriverHistory(combinedOrders, empleadoIdLocal, solicitudesDb || [], driverHistoryDb || []),
              'id'
            )
          );
        } else {
          setDriverProfile(null);
          const empleadosLS = useLocalMocks ? readLocal('apt_empleados', []) : [];
          const empleadoLocal = Array.isArray(empleadosLS)
            ? empleadosLS.find((e: any) => e.usuario_id === user.id_usuario)
            : null;
          empleadoIdLocal = empleadoLocal?.id_empleado || null;
          const ordenesLS = useLocalMocks ? readLocal('apt_ordenes_trabajo', []) : [];
          const filtradas = Array.isArray(ordenesLS)
            ? ordenesLS.filter((o: any) => !empleadoIdLocal || o.empleado_id === empleadoIdLocal)
            : [];
          setRecentOrders(
            dedupeById(
              filtradas
                .sort(
                  (a: any, b: any) =>
                    new Date(b.fecha_inicio_ot || b.created_at || 0).getTime() -
                    new Date(a.fecha_inicio_ot || a.created_at || 0).getTime()
                )
                .slice(0, 5),
              'id_orden_trabajo'
            )
          );
          const solicitudesLocales = useLocalMocks ? readLocal('apt_solicitudes_diagnostico', []) : [];
          setDriverHistory(
            dedupeById(
              buildDriverHistory(
                filtradas,
                empleadoIdLocal,
                solicitudesLocales,
                useLocalMocks ? readLocal('apt_driver_history', []) : []
              ),
              'id'
            )
          );
        }
      } else {
        const { data: orders } = await supabase
          .from('orden_trabajo')
          .select(`
            *,
            empleado:empleado_id(nombre, apellido_paterno),
            vehiculo:vehiculo_id(patente_vehiculo)
          `)
          .order('fecha_inicio_ot', { ascending: false })
          .limit(5);

        setRecentOrders(dedupeById(orders || [], 'id_orden_trabajo'));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (user?.rol === 'driver' && useLocalMocks) {
        setDriverProfile(null);
        const empleadosLS = readLocal('apt_empleados', []);
        const empleadoActual = Array.isArray(empleadosLS)
          ? empleadosLS.find((e: any) => e.usuario_id === user.id_usuario)
          : null;
        const empleadoIdLocal = empleadoActual?.id_empleado || null;
        const ordenesLS = readLocal('apt_ordenes_trabajo', []);
        setDriverHistory(
          dedupeById(buildDriverHistory(Array.isArray(ordenesLS) ? ordenesLS : [], empleadoIdLocal), 'id')
        );
        if (Array.isArray(ordenesLS) && empleadoIdLocal) {
          const recientes = ordenesLS
            .filter((o: any) => o.empleado_id === empleadoIdLocal)
            .sort(
              (a: any, b: any) =>
                new Date(b.fecha_inicio_ot || b.created_at || 0).getTime() -
                new Date(a.fecha_inicio_ot || a.created_at || 0).getTime()
            )
            .slice(0, 5);
          setRecentOrders(dedupeById(recientes, 'id_orden_trabajo'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'ID',
      accessor: 'id_orden_trabajo',
    },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any) => value ? `${value.nombre} ${value.apellido_paterno}` : '-',
    },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any) => value?.patente_vehiculo || '-',
    },
    {
      header: 'Estado',
      accessor: 'estado_ot',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'pendiente'
              ? 'bg-yellow-100 text-yellow-800'
              : value === 'en curso'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fecha_inicio_ot',
      render: (value: string) => new Date(value).toLocaleDateString('es-CL'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (user?.rol === 'driver') {
    const empleadoInfo = driverProfile?.empleado || null;
    const asignacionActiva = driverProfile?.asignacion || null;
    const vehiculoAsignado = asignacionActiva?.vehiculo || null;
    const sucursalAsignada = asignacionActiva?.sucursal || null;
    const marcaVehiculo = vehiculoAsignado?.modelo?.marca?.nombre_marca || null;
    const modeloVehiculo = vehiculoAsignado?.modelo?.nombre_modelo || null;
    const anioModelo = vehiculoAsignado?.modelo?.anio_modelo || null;
    const tipoVehiculo = vehiculoAsignado?.tipo?.tipo_vehiculo || null;
    const kilometrajeVehiculo =
      vehiculoAsignado?.kilometraje_vehiculo !== undefined && vehiculoAsignado?.kilometraje_vehiculo !== null
        ? Number(vehiculoAsignado.kilometraje_vehiculo).toLocaleString('es-CL')
        : null;

    return (
      <div className="space-y-6">
        <div>
          <p className="text-gray-600">Bienvenido, {user?.usuario}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Historial de mis horas agendadas</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-blue-100 p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Mi Perfil de Conductor</h2>
              <p className="text-sm text-gray-500">Información sincronizada con Supabase</p>

              {empleadoInfo ? (
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <User className="text-blue-500" size={18} />
                    <span>
                      <strong>Nombre:</strong>{' '}
                      {`${empleadoInfo.nombre || ''} ${empleadoInfo.apellido_paterno || ''} ${empleadoInfo.apellido_materno || ''}`.trim() ||
                        'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="text-blue-500" size={18} />
                    <span>
                      <strong>ID Empleado:</strong> {empleadoInfo.id_empleado}
                    </span>
                  </div>
                  {empleadoInfo.cargo && (
                    <div>
                      <strong>Cargo:</strong> {empleadoInfo.cargo}
                    </div>
                  )}
                  {empleadoInfo.telefono && (
                    <div>
                      <strong>Contacto:</strong> {empleadoInfo.telefono}
                    </div>
                  )}
                  {empleadoInfo.email && (
                    <div>
                      <strong>Correo:</strong> {empleadoInfo.email}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">
                  No pudimos recuperar tu información de empleado. Contacta al administrador.
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
              <p className="font-semibold">¿Por qué veo esta información?</p>
              <p className="mt-2">
                Aquí puedes revisar el vehículo que tienes asignado y cuándo fue la última vinculación registrada.
                Todas las asignaciones están sincronizadas con la base de datos de Supabase.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-blue-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehículo asignado</h3>
            {asignacionActiva && vehiculoAsignado ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Patente</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">{vehiculoAsignado.patente_vehiculo}</div>
                  <div className="mt-2 text-xs text-gray-500">
                    Estado: <span className="font-semibold text-gray-700">{vehiculoAsignado.estado_vehiculo || 'N/A'}</span>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Modelo</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {[
                      marcaVehiculo,
                      modeloVehiculo,
                      anioModelo ? `(${anioModelo})` : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}{' '}
                    {!marcaVehiculo && !modeloVehiculo ? 'N/A' : ''}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Tipo:{' '}
                    <span className="font-semibold text-gray-700">
                      {tipoVehiculo || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Kilometraje</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {kilometrajeVehiculo ? `${kilometrajeVehiculo} km` : 'N/A'}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Asignado el{' '}
                    <span className="font-semibold text-gray-700">
                      {formatDate(asignacionActiva.fecha_asignacion)}
                    </span>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 md:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin className="text-blue-500" size={18} />
                    <span>
                      <strong>Sucursal / Zona:</strong>{' '}
                      {sucursalAsignada
                        ? `${sucursalAsignada.nombre_sucursal || 'N/A'}${
                            sucursalAsignada.comuna_sucursal ? ` · ${sucursalAsignada.comuna_sucursal}` : ''
                          }`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No tienes un vehículo asignado en este momento. Si necesitas uno, contacta al coordinador.
              </p>
            )}
          </div>
        </div>

        {sortedDriverHistory.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            <FileText className="mx-auto text-gray-300 mb-4" size={56} />
            <p>No tienes registros de horas agendadas todavía.</p>
            <p className="text-sm mt-1">Cuando solicites un diagnóstico o ruta aparecerá aquí su progreso.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDriverHistory.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <Truck className="text-blue-600" size={22} />
                      <span className="text-lg font-semibold text-gray-900">{item.patente}</span>
                      <span className={`px-3 py-1 text-xs font-semibold rounded ${item.estadoBadgeClass}`}>
                        {item.estadoActual}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-gray-600 space-y-1">
                      <div>
                        <strong>Motivo:</strong> {item.problema}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="text-gray-400" size={16} />
                        <span>
                          <strong>Programado:</strong> {item.fechaFormateada}
                          {item.hora && ` · ${item.hora}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
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
                          <div className="text-xs mt-1">{step.formattedDate}</div>
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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">
          Bienvenido, {user?.usuario}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          title="Empleados Totales"
          value={stats.totalEmployees}
          icon={Users}
          color="bg-blue-600"
        />
        <Card
          title="Vehículos Disponibles"
          value={stats.availableVehicles}
          icon={Truck}
          color="bg-green-600"
        />
        <Card
          title="Órdenes Activas"
          value={stats.activeOrders}
          icon={FileText}
          color="bg-orange-600"
        />
        <Card
          title="Incidencias Pendientes"
          value={stats.pendingIncidents}
          icon={AlertCircle}
          color="bg-red-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {user?.rol === 'driver' ? 'Mis Órdenes Recientes' : 'Órdenes de Trabajo Recientes'}
        </h2>
        <Table columns={columns} data={recentOrders} emptyMessage="No hay órdenes de trabajo" />
      </div>
    </div>
  );
}
