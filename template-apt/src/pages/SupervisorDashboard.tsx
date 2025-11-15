import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Calendar, Truck, AlertCircle, FileText, BarChart3, Settings, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastProvider';

interface SupervisorDashboardProps {
  activeSection?: 'tablero' | 'diagnosticos' | 'emergencias' | 'indicadores';
}

export default function SupervisorDashboard({ activeSection = 'tablero' }: SupervisorDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [diagnosticosHistorico, setDiagnosticosHistorico] = useState<any[]>([]);
  const [diagnosticoTab, setDiagnosticoTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [tableroMetrics, setTableroMetrics] = useState({
    total: 0,
    activas: 0,
    finalizadas: 0,
    pendientes: 0,
    atrasadas: 0,
  });
  const [tableroFilter, setTableroFilter] = useState<'todos' | 'activas' | 'finalizadas' | 'pendientes' | 'atrasadas'>('todos');

  const { user } = useAuth();
  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const { showToast } = useToast();

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    if (activeSection === 'tablero') {
      loadTableroData();
    } else if (activeSection === 'diagnosticos') {
      loadDiagnosticos();
    }
  }, [activeSection]);

  const loadTableroData = async () => {
    try {
      setLoading(true);
      let ordenesFuente: any[] = [];

      if (hasEnv) {
        const { data, error } = await supabase
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
            fecha_programada_reparacion,
            hora_programada_reparacion,
            estado_reparacion,
            vehiculo:vehiculo_id (
              patente_vehiculo
            ),
            empleado:empleado_id (
              nombre,
              apellido_paterno,
              apellido_materno
            ),
            solicitud:solicitud_diagnostico_id (
              tipo_problema,
              fecha_confirmada,
              bloque_horario_confirmado
            )
          `
          )
          .order('fecha_inicio_ot', { ascending: false, nullsLast: true });

        if (error) {
          console.error('Error cargando OT desde Supabase:', error);
        } else if (Array.isArray(data)) {
          ordenesFuente = data;
        }
      }

      if (ordenesFuente.length === 0) {
        const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
        const empleadosLocal = readLocal('apt_empleados', []);
        const vehiculosLocal = readLocal('apt_vehiculos', []);
        ordenesFuente = ordenesLocal.map((o: any) => ({
          ...o,
          vehiculo: vehiculosLocal.find((v: any) => v.id_vehiculo === o.vehiculo_id) || null,
          empleado: empleadosLocal.find((e: any) => e.id_empleado === o.empleado_id) || null,
          solicitud: null,
        }));
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const ordenesEnriquecidas = (ordenesFuente || []).map((orden: any) => {
        const empleado = orden.empleado || {};
        const vehiculo = orden.vehiculo || {};
        const solicitud = orden.solicitud || {};
        const estado = (orden.estado_ot || '').toLowerCase();
        const prioridad = (orden.prioridad_ot || '').toLowerCase();
        const inicio = orden.fecha_inicio_ot ? new Date(orden.fecha_inicio_ot) : null;
        const esFinalizada = estado.includes('finaliza');
        const esPendiente = estado.includes('diagnostico') || estado.includes('pendiente');
        const esActiva = !esFinalizada && !esPendiente;
        const esAtrasada = !esFinalizada && inicio && !Number.isNaN(inicio.getTime()) && inicio < hoy;

        let categoria: 'activas' | 'finalizadas' | 'pendientes' | 'atrasadas' = 'activas';
        if (esAtrasada) categoria = 'atrasadas';
        else if (esFinalizada) categoria = 'finalizadas';
        else if (esPendiente) categoria = 'pendientes';

        return {
          ...orden,
          empleado_nombre: empleado.nombre
            ? `${empleado.nombre} ${empleado.apellido_paterno || ''}`.trim()
            : 'Sin asignar',
          patente_vehiculo: vehiculo.patente_vehiculo || 'Sin registrar',
          tipo_problema: solicitud.tipo_problema || orden.descripcion_ot || 'Sin descripción',
          fecha_programada: solicitud.fecha_confirmada || orden.fecha_inicio_ot,
          bloque_horario: solicitud.bloque_horario_confirmado || '',
          estado_normalizado: estado,
          prioridad_normalizada: prioridad,
          fecha_programada_reparacion: orden.fecha_programada_reparacion || null,
          hora_programada_reparacion: orden.hora_programada_reparacion || null,
          estado_reparacion: orden.estado_reparacion || 'pendiente',
          categoria,
          esAtrasada,
          esActiva,
          esPendiente,
        };
      });

      const metrics = ordenesEnriquecidas.reduce(
        (acc, orden) => {
          acc.total += 1;
          if (orden.categoria === 'activas') acc.activas += 1;
          if (orden.categoria === 'finalizadas') acc.finalizadas += 1;
          if (orden.categoria === 'pendientes') acc.pendientes += 1;
          if (orden.categoria === 'atrasadas') acc.atrasadas += 1;
          return acc;
        },
        { total: 0, activas: 0, finalizadas: 0, pendientes: 0, atrasadas: 0 }
      );

      setTableroMetrics(metrics);
      setWorkOrders(ordenesEnriquecidas);
    } catch (error) {
      console.error('Error loading tablero data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDiagnosticos = async () => {
    try {
      setLoading(true);
      let pendientes: any[] = [];
      let historial: any[] = [];

      if (hasEnv) {
        const { data, error } = await supabase
          .from('aprobacion_asignacion_ot')
          .select(
            `
            id_aprobacion,
            estado,
            comentarios,
            created_at,
            orden:orden_trabajo_id (
              id_orden_trabajo,
              descripcion_ot,
              estado_ot,
              mecanico_apoyo_ids,
              fecha_inicio_ot,
              fecha_programada_reparacion,
              hora_programada_reparacion,
              estado_reparacion,
              vehiculo:vehiculo_id(patente_vehiculo),
              solicitud:solicitud_diagnostico_id(
                tipo_problema,
                fecha_confirmada,
                bloque_horario_confirmado,
                prioridad
              )
            ),
            mecanico:mecanico_id (
              id_empleado,
              nombre,
              apellido_paterno,
              apellido_materno
            ),
            aprobado_por:aprobado_por,
            aprobado_en:aprobado_en
          `
          )
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error cargando aprobaciones de asignación:', error);
        } else if (Array.isArray(data)) {
          const mapped = data.map((row: any) => ({
            id: row.id_aprobacion,
            estado: row.estado,
            comentarios: row.comentarios,
            created_at: row.created_at,
            orden: row.orden || null,
            mecanico: row.mecanico || null,
            aprobado_por: row.aprobado_por || null,
            aprobado_en: row.aprobado_en || null,
          }));
          pendientes = mapped.filter((row: any) => (row.estado || '').toLowerCase() === 'pendiente');
          historial = mapped.filter((row: any) => (row.estado || '').toLowerCase() !== 'pendiente');
        }
      } else {
        const asignaciones = readLocal('apt_aprobacion_asignacion', []);
        pendientes = asignaciones.filter((row: any) => (row.estado || '').toLowerCase() === 'pendiente');
        historial = asignaciones.filter((row: any) => (row.estado || '').toLowerCase() !== 'pendiente');
      }

      setDiagnosticos(pendientes);
      setDiagnosticosHistorico(historial);
    } catch (error) {
      console.error('Error loading diagnosticos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAssignment = async (asignacion: any) => {
    if (!hasEnv) {
      showToast({
        type: 'error',
        message: 'No es posible aprobar asignaciones sin conexión a la base de datos.',
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('aprobacion_asignacion_ot')
        .update({
          estado: 'aprobada',
          aprobado_por: user?.id_usuario || null,
          aprobado_en: now,
          updated_at: now,
        })
        .eq('id_aprobacion', asignacion.id);

      if (error) {
        throw error;
      }

      showToast({
        type: 'success',
        message: 'Asignación aprobada correctamente.',
      });
      await loadDiagnosticos();
    } catch (err) {
      console.error('Error aprobando asignación:', err);
      showToast({
        type: 'error',
        message: 'No se pudo aprobar la asignación. Revisa la consola.',
      });
    }
  };

  const handleRejectAssignment = async (asignacion: any) => {
    if (!hasEnv) {
      showToast({
        type: 'error',
        message: 'No es posible rechazar asignaciones sin conexión a la base de datos.',
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('aprobacion_asignacion_ot')
        .update({
          estado: 'rechazada',
          aprobado_por: user?.id_usuario || null,
          aprobado_en: now,
          updated_at: now,
        })
        .eq('id_aprobacion', asignacion.id);

      if (updateError) {
        throw updateError;
      }

      const mecanicoId = asignacion?.mecanico?.id_empleado;
      const ordenId = asignacion?.orden?.id_orden_trabajo;
      const mecanicosActuales = Array.isArray(asignacion?.orden?.mecanico_apoyo_ids)
        ? asignacion.orden.mecanico_apoyo_ids
        : [];

      if (ordenId && mecanicoId && mecanicosActuales.length > 0) {
        const filtrados = mecanicosActuales.filter((id: number) => id !== mecanicoId);
        const { error: otError } = await supabase
          .from('orden_trabajo')
          .update({ mecanico_apoyo_ids: filtrados })
          .eq('id_orden_trabajo', ordenId);

        if (otError) {
          console.warn('⚠️ No se pudo actualizar la OT al rechazar la asignación:', otError);
        }
      }

      showToast({
        type: 'success',
        message: 'Asignación rechazada.',
      });
      await loadDiagnosticos();
    } catch (err) {
      console.error('Error rechazando asignación:', err);
      showToast({
        type: 'error',
        message: 'No se pudo rechazar la asignación. Revisa la consola.',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date =
        /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
      return date.toLocaleDateString('es-ES');
    } catch {
      return 'N/A';
    }
  };

  const formatStatusBadge = (estado: string) => {
    const normalized = (estado || '').toLowerCase();
    if (normalized.includes('finaliza')) {
      return { label: 'Finalizada', classes: 'bg-emerald-100 text-emerald-700' };
    }
    if (normalized.includes('diagnostico')) {
      return { label: 'Programada', classes: 'bg-slate-100 text-slate-700' };
    }
    if (normalized.includes('repar') || normalized.includes('curso') || normalized.includes('prueba') || normalized.includes('esperando')) {
      return { label: 'En proceso', classes: 'bg-blue-100 text-blue-700' };
    }
    if (normalized.includes('pendiente')) {
      return { label: 'Pendiente', classes: 'bg-amber-100 text-amber-700' };
    }
    return { label: estado || 'Sin estado', classes: 'bg-gray-100 text-gray-700' };
  };

  const filteredWorkOrders = workOrders.filter((orden) => {
    if (tableroFilter === 'todos') return true;
    return orden.categoria === tableroFilter;
  });

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Contenido de Tablero de OT */}
      {activeSection === 'tablero' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Activity size={14} />
                  Tablero operativo
                </span>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Tablero de OT</h1>
                  <p className="text-sm text-slate-500">
                    Visión general de las OT en curso, finalizadas y pendientes, con focos para detectar atrasos.
                  </p>
                </div>
              </div>
              <div className="grid w-full max-w-lg grid-cols-2 gap-3 md:max-w-xs">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm font-semibold text-blue-700">
                  Totales
                  <p className="mt-1 text-3xl text-blue-900">{tableroMetrics.total}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm font-semibold text-emerald-700">
                  Finalizadas
                  <p className="mt-1 text-3xl text-emerald-900">{tableroMetrics.finalizadas}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[{
              label: 'OT activas',
              value: tableroMetrics.activas,
              classes: 'border-blue-100 bg-blue-50 text-blue-700',
              filter: 'activas' as const,
            }, {
              label: 'OT pendientes',
              value: tableroMetrics.pendientes,
              classes: 'border-amber-100 bg-amber-50 text-amber-700',
              filter: 'pendientes' as const,
            }, {
              label: 'OT finalizadas',
              value: tableroMetrics.finalizadas,
              classes: 'border-emerald-100 bg-emerald-50 text-emerald-700',
              filter: 'finalizadas' as const,
            }, {
              label: 'OT atrasadas',
              value: tableroMetrics.atrasadas,
              classes: 'border-rose-100 bg-rose-50 text-rose-700',
              filter: 'atrasadas' as const,
            }].map((card) => (
              <button
                key={card.label}
                onClick={() => setTableroFilter(card.filter)}
                className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${card.classes} ${
                  tableroFilter === card.filter ? 'ring-2 ring-offset-2 ring-current' : ''
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide">{card.label}</p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs">Ver detalle</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {([
              { id: 'todos', label: 'Todas' },
              { id: 'activas', label: 'En proceso' },
              { id: 'pendientes', label: 'Pendientes' },
              { id: 'finalizadas', label: 'Finalizadas' },
              { id: 'atrasadas', label: 'Atrasadas' },
            ] as const).map((item) => (
              <button
                key={item.id}
                onClick={() => setTableroFilter(item.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  tableroFilter === item.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-white text-slate-600 hover:text-blue-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {filteredWorkOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
              <FileText className="mx-auto text-slate-300" size={48} />
              <p className="mt-4 text-sm text-slate-500">No hay OT en la categoría seleccionada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWorkOrders.map((order) => {
                const statusBadge = formatStatusBadge(order.estado_ot);
                const esAtrasada = order.categoria === 'atrasadas';
                const prioridad = order.prioridad_normalizada;
                const prioridadClasses =
                  prioridad === 'critica' || prioridad === 'crítica'
                    ? 'bg-rose-100 text-rose-700'
                    : prioridad === 'alta'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700';

                return (
                  <div
                    key={order.id_orden_trabajo}
                    className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${
                      esAtrasada ? 'ring-2 ring-offset-1 ring-rose-200' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-white">
                            OT #{order.id_orden_trabajo}
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.classes}`}>
                            {statusBadge.label}
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${prioridadClasses}`}>
                            {prioridad === 'critica' || prioridad === 'crítica'
                              ? 'Crítica'
                              : prioridad === 'alta'
                              ? 'Alta'
                              : 'Normal'}
                          </span>
                          {esAtrasada && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                              ⏱️ Atrasada
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-slate-600">
                          {order.tipo_problema}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-500">
                          <p><strong>Vehículo:</strong> {order.patente_vehiculo}</p>
                          <p><strong>Responsable:</strong> {order.empleado_nombre}</p>
                          <p><strong>Inicio:</strong> {formatDate(order.fecha_programada || order.fecha_inicio_ot)}</p>
                          <p>
                            <strong>Bloque:</strong>{' '}
                            {order.bloque_horario || 'Sin bloque asignado'}
                          </p>
                          <p>
                            <strong>Reparación:</strong>{' '}
                            {order.fecha_programada_reparacion
                              ? `${formatDate(order.fecha_programada_reparacion)}${
                                  order.hora_programada_reparacion
                                    ? ` · ${order.hora_programada_reparacion}`
                                    : ''
                                }`
                              : 'Pendiente de programar'}
                          </p>
                          <p>
                            <strong>Estado reparación:</strong>{' '}
                            {(order.estado_reparacion || 'pendiente').replace(/_/g, ' ')}
                          </p>
                          <p>
                            <strong>Cierre técnico:</strong>{' '}
                            {order.fecha_cierre_tecnico ? formatDate(order.fecha_cierre_tecnico) : 'Pendiente'}
                          </p>
                          <p>
                            <strong>Estado cierre:</strong>{' '}
                            {(order.estado_cierre || '—').toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contenido de Aprobación de Asignaciones */}
      {activeSection === 'diagnosticos' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <CheckCircle size={14} />
                  Flujo de aprobaciones
                </span>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Aprobación de Asignaciones</h1>
                  <p className="text-sm text-slate-500">
                    Revisa las solicitudes del Jefe de Taller, valida recursos y responde rápidamente.
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600">
                {diagnosticos.length} pendientes · {diagnosticosHistorico.length} en historial
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <button
              onClick={() => setDiagnosticoTab('pendientes')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                diagnosticoTab === 'pendientes'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-white text-slate-600 hover:text-blue-600'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setDiagnosticoTab('historial')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                diagnosticoTab === 'historial'
                  ? 'bg-slate-800 text-white shadow-lg shadow-slate-300'
                  : 'bg-white text-slate-600 hover:text-slate-800'
              }`}
            >
              Historial de decisiones
            </button>
          </div>

          {(diagnosticoTab === 'pendientes') ? (
            diagnosticos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
                <CheckCircle className="mx-auto text-slate-300" size={48} />
                <p className="mt-4 text-sm text-slate-500">No hay asignaciones pendientes de aprobación.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {diagnosticos.map((asignacion: any) => {
                  const orden = asignacion?.orden || {};
                  const vehiculo = orden?.vehiculo || {};
                  const solicitud = orden?.solicitud || {};
                  const mecanico = asignacion?.mecanico || {};
                  const mecanicoNombre = [mecanico?.nombre, mecanico?.apellido_paterno]
                    .filter(Boolean)
                    .join(' ') || 'Mecánico sin nombre';

                  return (
                    <div key={asignacion.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow">
                              <Truck size={16} />
                              {vehiculo?.patente_vehiculo || 'Patente no registrada'}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              OT #{orden?.id_orden_trabajo || 'N/A'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {solicitud?.tipo_problema || orden?.descripcion_ot || 'Sin descripción'}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-500">
                            <p><strong>Mecánico propuesto:</strong> {mecanicoNombre}</p>
                            <p>
                              <strong>Programado:</strong>{' '}
                              {formatDate(solicitud?.fecha_confirmada || orden?.fecha_inicio_ot || '')}
                              {solicitud?.bloque_horario_confirmado ? ` · ${solicitud.bloque_horario_confirmado}` : ''}
                            </p>
                            <p>
                              <strong>Reparación:</strong>{' '}
                              {orden?.fecha_programada_reparacion
                                ? `${formatDate(orden.fecha_programada_reparacion)}${
                                    orden.hora_programada_reparacion ? ` · ${orden.hora_programada_reparacion}` : ''
                                  }`
                                : 'Pendiente de programar'}
                            </p>
                            <p>
                              <strong>Estado reparación:</strong>{' '}
                              {(orden?.estado_reparacion || 'pendiente').replace(/_/g, ' ')}
                            </p>
                            <p>
                              <strong>Comentarios:</strong>{' '}
                              {asignacion?.comentarios || 'Sin comentarios'}
                            </p>
                            <p>
                              <strong>Solicitud:</strong> {formatDate(asignacion.created_at || '')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 md:w-40">
                          <button
                            onClick={() => handleApproveAssignment(asignacion)}
                            className="inline-flex items-center.justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleRejectAssignment(asignacion)}
                            className="inline-flex items-center.justify-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            diagnosticosHistorico.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
                <FileText className="mx-auto text-slate-300" size={48} />
                <p className="mt-4 text-sm text-slate-500">Aún no se registra historial de decisiones.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {diagnosticosHistorico.map((asignacion: any) => {
                  const orden = asignacion?.orden || {};
                  const vehiculo = orden?.vehiculo || {};
                  const solicitud = orden?.solicitud || {};
                  const mecanico = asignacion?.mecanico || {};
                  const mecanicoNombre = [mecanico?.nombre, mecanico?.apellido_paterno]
                    .filter(Boolean)
                    .join(' ') || 'Mecánico sin nombre';
                  const estado = (asignacion.estado || '').toLowerCase();
                  const badgeClasses = estado === 'aprobada'
                    ? 'bg-emerald-100 text-emerald-700'
                    : estado === 'rechazada'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-slate-100 text-slate-700';

                  return (
                    <div key={asignacion.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <span className="inline-flex.items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-white">
                              <Truck size={16} />
                              {vehiculo?.patente_vehiculo || 'Patente no registrada'}
                            </span>
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}>
                              {asignacion.estado?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Mecánico propuesto: {mecanicoNombre}
                          </p>
                          <p className="text-xs text-slate-500">
                            Trabajo: {solicitud?.tipo_problema || orden?.descripcion_ot || 'Sin descripción'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Reparación: {orden?.fecha_programada_reparacion
                              ? `${formatDate(orden.fecha_programada_reparacion)}${
                                  orden.hora_programada_reparacion ? ` · ${orden.hora_programada_reparacion}` : ''
                                }`
                              : 'Pendiente de programar'}
                          </p>
                          <p className="text-xs text-slate-500">
                            Resuelto el {formatDate(asignacion.aprobado_en || asignacion.updated_at || asignacion.created_at || '')}
                          </p>
                          {asignacion?.comentarios && (
                            <p className="text-xs text-slate-500">
                              Comentarios: {asignacion.comentarios}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* Contenido de Emergencias en Ruta */}
      {activeSection === 'emergencias' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergencias en Ruta</h1>
          <p className="text-gray-600 mb-6">Revisar casos críticos, priorizar atención y asignación de mecánico.</p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay emergencias activas</h3>
            <p className="text-gray-600">
              Aquí aparecerán las emergencias en ruta que requieran supervisión y priorización.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Indicadores y Productividad */}
      {activeSection === 'indicadores' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <BarChart3 size={14} />
                  Indicadores operativos
                </span>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Indicadores y Productividad</h1>
                  <p className="text-sm text-slate-500">
                    Metas por mecánico, tiempos promedio y alertas para anticipar retrabajos o asistencias en ruta.
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600">
                Panel ejecutivo
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[{
              label: 'Tiempo promedio de reparación',
              value: '-- horas',
              icon: Clock,
              classes: 'bg-blue-50 text-blue-700 border-blue-100',
            }, {
              label: 'Asistencias en ruta (mes)',
              value: '0',
              icon: Activity,
              classes: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            }, {
              label: 'Retrabajos detectados',
              value: '0',
              icon: AlertCircle,
              classes: 'bg-rose-50 text-rose-700 border-rose-100',
            }, {
              label: 'Cumplimiento meta mecánicos',
              value: '— %',
              icon: CheckCircle,
              classes: 'bg-slate-50 text-slate-700 border-slate-100',
            }].map((metric) => (
              <div key={metric.label} className={`rounded-2xl border px-5 py-4 shadow-sm ${metric.classes}`}>
                <div className="flex items-center gap-3">
                  <metric.icon size={24} />
                  <div className="text-xs font-semibold uppercase tracking-wide">{metric.label}</div>
                </div>
                <p className="mt-3 text-3xl font-bold">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Seguimiento de vehículos</h3>
              <p className="text-xs text-slate-500 mb-4">Activos/inactivos, mantenciones y estados críticos.</p>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                Reportes detallados próximamente.
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Cumplimiento por mecánico</h3>
              <p className="text-xs text-slate-500 mb-4">Horas productivas vs. estimadas, tareas críticas y alertas.</p>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                Estamos conectando estos indicadores con los registros de avances.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}







