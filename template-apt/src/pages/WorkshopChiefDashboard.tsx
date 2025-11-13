import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, Truck, User, AlertCircle, CheckCircle, FileText, Wrench, Settings, ClipboardList, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import ChecklistDiagnostico from '../components/ChecklistDiagnostico';

const PRIORIDADES_OT = [
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800' },
];

interface WorkshopChiefDashboardProps {
  activeSection?: 'agenda' | 'checklists' | 'plan' | 'asignacion' | 'reparacion' | 'cierre' | 'carga';
}

export default function WorkshopChiefDashboard({ activeSection = 'agenda' }: WorkshopChiefDashboardProps) {
  const { user } = useAuth();
  const [diagnosticosDelDia, setDiagnosticosDelDia] = useState<any[]>([]);
  const [diagnosticosProximos, setDiagnosticosProximos] = useState<any[]>([]);
  const [diagnosticosVencidos, setDiagnosticosVencidos] = useState<any[]>([]);
  const [agendaTab, setAgendaTab] = useState<'hoy' | 'proximos' | 'vencidos'>('hoy');
  const [ordenesDiagnostico, setOrdenesDiagnostico] = useState<any[]>([]);
  const [checklistTab, setChecklistTab] = useState<'pendientes' | 'realizados'>('pendientes');
  const [loading, setLoading] = useState(true);
  const [selectedOT, setSelectedOT] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [viewOnlyModal, setViewOnlyModal] = useState(false);
  const [selectedDiagnostico, setSelectedDiagnostico] = useState<any | null>(null);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [reparacionTab, setReparacionTab] = useState<'en_reparacion' | 'esperando_repuestos' | 'en_pruebas' | 'finalizada'>('en_reparacion');
  const [selectedProgressLog, setSelectedProgressLog] = useState<any | null>(null);
  const [progressDetailModal, setProgressDetailModal] = useState(false);
  const [cierreTab, setCierreTab] = useState<'pendientes' | 'finalizadas'>('pendientes');
  const [ordenesFinalizadas, setOrdenesFinalizadas] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    prioridad_ot: 'normal',
    checklist_id: '',
    mecanico_apoyo_ids: [] as number[],
    confirmado_ingreso: false,
    estado_ot: 'en_reparacion',
  });

  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (['agenda', 'checklists', 'reparacion', 'cierre'].includes(activeSection)) {
      loadData();
    }
  }, [activeSection]);

  useEffect(() => {
    const handleLocalUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      const key = customEvent.detail?.key;
      if (!key || key === 'apt_ordenes_trabajo' || key === 'apt_progresos_mecanico') {
        loadData();
      }
    };

    window.addEventListener('apt-local-update', handleLocalUpdate as EventListener);
    return () => window.removeEventListener('apt-local-update', handleLocalUpdate as EventListener);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const hoyDate = new Date();
      hoyDate.setHours(0, 0, 0, 0);
      const hoyMs = hoyDate.getTime();
      const normalizarFechaLocal = (fecha: string | null | undefined) => {
        if (!fecha) return null;
        const date = new Date(fecha);
        if (isNaN(date.getTime())) return null;
        const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return local.getTime();
      };
      
      // Cargar datos base (solicitudes + órdenes)
      let solicitudes: any[] = readLocal('apt_solicitudes_diagnostico', []);
      let ordenes: any[] = readLocal('apt_ordenes_trabajo', []);
      const historialAutorizados = readLocal('apt_historial_autorizados', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
      let ordenesActualizadas = [...ordenes];
      let debeActualizarOrdenes = false;
      const ordenesActualizadasIds: number[] = [];
      let empleadosData: any[] = Array.isArray(empleadosLocal) ? [...empleadosLocal] : [];

      if (hasEnv) {
        try {
          // Cargar solicitudes confirmadas y pendientes desde Supabase
          const { data: solicitudesDb, error: solicitudesError } = await supabase
            .from('solicitud_diagnostico')
            .select(
              `
                id_solicitud_diagnostico,
                empleado_id,
                vehiculo_id,
                patente_vehiculo,
                tipo_problema,
                prioridad,
                fecha_solicitada,
                bloque_horario,
                comentarios,
                fotos,
                estado_solicitud,
                tipo_trabajo,
                fecha_confirmada,
                bloque_horario_confirmado,
                box_id,
                mecanico_id,
                orden_trabajo_id,
                created_at
              `
            );

          if (!solicitudesError && Array.isArray(solicitudesDb)) {
            solicitudes = solicitudesDb.map((s) => ({
              ...s,
              patente_vehiculo: s.patente_vehiculo || null,
            }));
            writeLocal('apt_solicitudes_diagnostico', solicitudes);
          }

          // Cargar órdenes de trabajo relacionadas con diagnósticos
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
                checklist_id,
                mecanico_apoyo_ids,
                confirmado_ingreso,
                hora_confirmada,
                fecha_inicio_ot,
                fecha_cierre_ot,
          estado_cierre,
          fecha_cierre_tecnico,
              detalle_reparacion,
                created_at,
              avances:avance_ot(
                id_avance_ot,
                descripcion_trabajo,
                hora_inicio,
                hora_fin,
                observaciones,
                fotos,
                mecanico_id,
                created_at
              ),
                solicitud:solicitud_diagnostico_id(
                  id_solicitud_diagnostico,
                  fecha_confirmada,
                  fecha_solicitada,
                  bloque_horario_confirmado,
                  bloque_horario,
                  tipo_problema,
                  prioridad,
                  estado_solicitud,
                  empleado_id,
                  vehiculo_id,
                  patente_vehiculo,
                  tipo_trabajo,
                  mecanico_id
                ),
                vehiculo:vehiculo_id(
                  patente_vehiculo
                )
              `
            );

          if (!ordenesError && Array.isArray(ordenesDb)) {
            ordenes = ordenesDb.map((orden: any) => {
              const solicitud = orden.solicitud || null;
              return {
                id_orden_trabajo: orden.id_orden_trabajo,
                descripcion_ot: orden.descripcion_ot,
                estado_ot: orden.estado_ot,
                prioridad_ot: orden.prioridad_ot,
                empleado_id: orden.empleado_id,
                vehiculo_id: orden.vehiculo_id,
                solicitud_diagnostico_id: orden.solicitud_diagnostico_id || solicitud?.id_solicitud_diagnostico || null,
                checklist_id: orden.checklist_id,
                mecanico_apoyo_ids: orden.mecanico_apoyo_ids,
                confirmado_ingreso: orden.confirmado_ingreso,
                hora_confirmada: orden.hora_confirmada,
                fecha_inicio_ot: orden.fecha_inicio_ot,
                fecha_cierre_ot: orden.fecha_cierre_ot,
              estado_cierre: orden.estado_cierre || 'pendiente',
              fecha_cierre_tecnico: orden.fecha_cierre_tecnico || null,
              detalle_reparacion: orden.detalle_reparacion || null,
                created_at: orden.created_at,
                patente_vehiculo: orden.vehiculo?.patente_vehiculo || solicitud?.patente_vehiculo || null,
              avances: Array.isArray(orden.avances)
                ? orden.avances
                    .map((avance: any) => ({
                      ...avance,
                      fecha_registro: avance.created_at,
                    }))
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.created_at || b.fecha_registro || 0).getTime() -
                        new Date(a.created_at || a.fecha_registro || 0).getTime()
                    )
                : [],
                solicitud_detalle: solicitud
                  ? {
                      fecha_confirmada: solicitud.fecha_confirmada,
                      fecha_solicitada: solicitud.fecha_solicitada,
                      bloque_horario_confirmado: solicitud.bloque_horario_confirmado,
                      bloque_horario: solicitud.bloque_horario,
                      tipo_problema: solicitud.tipo_problema,
                      prioridad: solicitud.prioridad,
                      estado_solicitud: solicitud.estado_solicitud,
                      tipo_trabajo: solicitud.tipo_trabajo,
                      mecanico_id: solicitud.mecanico_id,
                    }
                  : null,
              };
            });
            writeLocal('apt_ordenes_trabajo', ordenes);
            ordenesActualizadas = [...ordenes];
          }

          const { data: empleadosDb } = await supabase
            .from('empleado')
            .select(
              `
              id_empleado,
              nombre,
              apellido_paterno,
              apellido_materno,
              estado_empleado,
              cargo_id,
              usuario_id,
              cargo:cargo_id(nombre_cargo),
              usuario:usuario_id(rol)
            `
            );

          if (Array.isArray(empleadosDb)) {
            const mapa = new Map<number, any>();
            empleadosData.forEach((emp: any) => {
              if (emp?.id_empleado) {
                mapa.set(emp.id_empleado, emp);
              }
            });

            empleadosDb.forEach((emp: any) => {
              mapa.set(emp.id_empleado, {
                ...mapa.get(emp.id_empleado),
                ...emp,
                cargo_nombre:
                  emp.cargo?.nombre_cargo || mapa.get(emp.id_empleado)?.cargo_nombre || null,
                rol: emp.usuario?.rol || mapa.get(emp.id_empleado)?.rol || null,
              });
            });

            empleadosData = Array.from(mapa.values());
            writeLocal('apt_empleados', empleadosData);
          }
        } catch (error) {
          console.error('⚠️ Error cargando datos desde Supabase:', error);
        }
      }
      
      // Filtrar órdenes de diagnóstico (incluyendo las que están en curso o en reparación si tienen solicitud de diagnóstico)
      const ordenesDiagnosticoFiltered = ordenes.filter((o: any) => {
        const tieneSolicitud = o.solicitud_diagnostico_id || 
          solicitudes.some((s: any) => s.orden_trabajo_id === o.id_orden_trabajo);
        return o.estado_ot === 'en_diagnostico_programado' || 
          (o.estado_ot === 'en curso' && tieneSolicitud) ||
          (o.estado_ot === 'en_reparacion' && tieneSolicitud) ||
          (o.estado_ot === 'esperando_repuestos' && tieneSolicitud) ||
          (o.estado_ot === 'en_pruebas' && tieneSolicitud) ||
          (o.estado_ot === 'finalizada' && tieneSolicitud);
      });
      
      // Enriquecer órdenes con información de solicitudes
      const ordenesEnriquecidas = ordenesDiagnosticoFiltered.map((orden: any) => {
        const solicitud = solicitudes.find((s: any) => 
          s.orden_trabajo_id === orden.id_orden_trabajo ||
          s.id_solicitud_diagnostico === orden.solicitud_diagnostico_id
        );
        const empleado = empleadosData.find((e: any) => e.id_empleado === orden.empleado_id);
        
        const choferNombre = solicitud?.nombre_operador ||
          solicitud?.nombre_chofer ||
          solicitud?.chofer_nombre ||
          (empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : null);
        
        // Verificar si el vehículo ya ingresó (buscando en historial de autorizados y registros de ingreso)
        const patenteNormalizada = solicitud?.patente_vehiculo?.toUpperCase();
        const ingresoRegistrado = historialAutorizados.find((r: any) => 
          r.patente?.toUpperCase() === patenteNormalizada &&
          r.autorizado === true
        );
        
        // También verificar en registros de ingreso directos
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const ingresoRegistradoDirecto = registrosIngreso.find((r: any) => 
          r.patente?.toUpperCase() === patenteNormalizada &&
          r.estado === 'autorizado'
        );
        
        const yaIngreso = !!ingresoRegistrado || !!ingresoRegistradoDirecto || orden.confirmado_ingreso;

        const checklistExistente = checklistsGuardados.find((c: any) => 
          c.orden_trabajo_id === orden.id_orden_trabajo
        );

        let prioridadFinal = orden.prioridad_ot || null;
        let estadoFinal = orden.estado_ot;
        let checklistIdFinal = orden.checklist_id || null;

        if (checklistExistente && checklistExistente.clasificacion_prioridad) {
          estadoFinal = normalizeMechanicStatus(orden.estado_ot);
          prioridadFinal = checklistExistente.clasificacion_prioridad || prioridadFinal;
          checklistIdFinal = checklistExistente.id;

          const idx = ordenesActualizadas.findIndex((o: any) => o.id_orden_trabajo === orden.id_orden_trabajo);
          if (idx !== -1) {
            const ordenLocal = ordenesActualizadas[idx];
            if (
              ordenLocal.estado_ot !== estadoFinal ||
              ordenLocal.prioridad_ot !== prioridadFinal ||
                  ordenLocal.checklist_id !== checklistIdFinal ||
                  ordenLocal.estado_cierre !== (orden.estado_cierre || ordenLocal.estado_cierre) ||
                  ordenLocal.fecha_cierre_tecnico !== (orden.fecha_cierre_tecnico || ordenLocal.fecha_cierre_tecnico)
            ) {
              ordenesActualizadas[idx] = {
                ...ordenLocal,
                estado_ot: estadoFinal,
                prioridad_ot: prioridadFinal,
                checklist_id: checklistIdFinal,
                    estado_cierre: orden.estado_cierre || ordenLocal.estado_cierre || 'pendiente',
                    fecha_cierre_tecnico: orden.fecha_cierre_tecnico || ordenLocal.fecha_cierre_tecnico || null,
              };
              debeActualizarOrdenes = true;
              if (!ordenesActualizadasIds.includes(ordenLocal.id_orden_trabajo)) {
                ordenesActualizadasIds.push(ordenLocal.id_orden_trabajo);
              }
            }
          }
        } else {
          estadoFinal = normalizeMechanicStatus(orden.estado_ot);
        }
        
        return {
          ...orden,
          estado_ot: estadoFinal,
          solicitud: solicitud,
          empleado_nombre: choferNombre || 'N/A',
          patente_vehiculo: solicitud?.patente_vehiculo || 'N/A',
          tipo_problema: solicitud?.tipo_problema || 'Diagnóstico',
          fecha_confirmada: solicitud?.fecha_confirmada || orden.fecha_inicio_ot,
          bloque_horario: solicitud?.bloque_horario_confirmado || solicitud?.bloque_horario || 'N/A',
          ya_ingreso: yaIngreso,
          ingreso_hora: ingresoRegistrado?.hora_busqueda || ingresoRegistradoDirecto?.hora || null,
          prioridad_ot: prioridadFinal,
          checklist_id: checklistIdFinal,
          mecanico_apoyo_ids: orden.mecanico_apoyo_ids || [],
        };
      });
      
      if (debeActualizarOrdenes) {
        writeLocal('apt_ordenes_trabajo', ordenesActualizadas);
        if (hasEnv) {
          try {
            if (ordenesActualizadasIds.length > 0) {
              await Promise.all(
                ordenesActualizadasIds.map((ordenId) => {
                  const ordenLocal = ordenesActualizadas.find((o: any) => o.id_orden_trabajo === ordenId);
                  if (!ordenLocal) return Promise.resolve();
                  return supabase
                    .from('orden_trabajo')
                    .update({
                      estado_ot: ordenLocal.estado_ot,
                      prioridad_ot: ordenLocal.prioridad_ot,
                          checklist_id: ordenLocal.checklist_id,
                          estado_cierre: ordenLocal.estado_cierre,
                          fecha_cierre_tecnico: ordenLocal.fecha_cierre_tecnico,
                    })
                    .eq('id_orden_trabajo', ordenId);
                })
              );
            }
          } catch (error) {
            console.error('Error sincronizando órdenes actualizadas:', error);
          }
        }
      }
      
      // Ordenar por orden de llegada (más recientes primero)
      const ordenesOrdenadas = ordenesEnriquecidas.sort((a: any, b: any) => {
        const fechaA = new Date(a.created_at || a.fecha_inicio_ot || 0).getTime();
        const fechaB = new Date(b.created_at || b.fecha_inicio_ot || 0).getTime();
        return fechaB - fechaA; // Descendente: más nuevas primero
      });
      
      setOrdenesDiagnostico(ordenesOrdenadas);
      if (hasEnv) {
        setOrdenesFinalizadas(
          ordenesOrdenadas
            .filter((o: any) => o.estado_ot === 'finalizada')
            .map((orden: any) => ({
              ...orden,
              avances: Array.isArray(orden.avances) ? orden.avances : [],
            }))
        );
      } else {
        setOrdenesFinalizadas([]);
      }
      
      // Filtrar diagnósticos para hoy (usando las ordenadas)
      const diagnosticosHoy = ordenesOrdenadas.filter((o: any) => {
        const fechaMs = normalizarFechaLocal(o.fecha_confirmada || o.fecha_inicio_ot);
        return fechaMs !== null && fechaMs === hoyMs;
      });
      
      // Filtrar diagnósticos próximos (fechas futuras, usando las ordenadas)
      const diagnosticosFuturos = ordenesOrdenadas.filter((o: any) => {
        const fechaMs = normalizarFechaLocal(o.fecha_confirmada || o.fecha_inicio_ot);
        return fechaMs !== null && fechaMs > hoyMs;
      }).sort((a: any, b: any) => {
        // Ordenar por fecha más cercana primero
        const fechaA = normalizarFechaLocal(a.fecha_confirmada || a.fecha_inicio_ot) ?? 0;
        const fechaB = normalizarFechaLocal(b.fecha_confirmada || b.fecha_inicio_ot) ?? 0;
        return fechaA - fechaB;
      });
      
      const diagnosticosPasados = ordenesOrdenadas.filter((o: any) => {
        const fechaMs = normalizarFechaLocal(o.fecha_confirmada || o.fecha_inicio_ot);
        return fechaMs !== null && fechaMs < hoyMs;
      }).sort((a: any, b: any) => {
        const fechaA = normalizarFechaLocal(a.fecha_confirmada || a.fecha_inicio_ot) ?? 0;
        const fechaB = normalizarFechaLocal(b.fecha_confirmada || b.fecha_inicio_ot) ?? 0;
        return fechaA - fechaB;
      });
      
      setDiagnosticosDelDia(diagnosticosHoy);
      setDiagnosticosProximos(diagnosticosFuturos);
      setDiagnosticosVencidos(diagnosticosPasados);
      
      // Cargar mecánicos (empleados con cargo 'Mecánico' o rol mechanic)
      let mechanicsDisponibles: any[] = Array.isArray(empleadosData)
        ? empleadosData.filter((e: any) => {
            const cargoNombreLocal = String(
              e.cargo_nombre || e.nombre_cargo || e.cargo?.nombre_cargo || ''
            ).toLowerCase();
            const rolLocal = (e.rol || '').toLowerCase();
            const estadoLocal = (e.estado_empleado || '').toLowerCase();
            if (estadoLocal === 'inactivo') return false;
            return rolLocal === 'mechanic' || cargoNombreLocal.includes('mec');
          })
        : [];

      if (hasEnv) {
        try {
          const { data: mechanicsDb } = await supabase
            .from('empleado')
            .select('id_empleado, nombre, apellido_paterno, apellido_materno, estado_empleado, cargo:cargo_id(nombre_cargo), usuario:usuario_id(rol)');

          if (Array.isArray(mechanicsDb)) {
            mechanicsDisponibles = mechanicsDb.filter((m: any) => {
              const cargoNombre = m.cargo?.nombre_cargo?.toLowerCase?.() || '';
              const rol = (m.usuario?.rol || '').toLowerCase();
              const estado = (m.estado_empleado || '').toLowerCase();
              return estado !== 'inactivo' && (rol === 'mechanic' || cargoNombre.includes('mec'));
            });
          }
        } catch (error) {
          console.error('⚠️ Error cargando mecánicos desde Supabase:', error);
        }
      }

      setMechanics(
        mechanicsDisponibles.map((m: any) => ({
          id_empleado: m.id_empleado,
          nombre: m.nombre,
          apellido_paterno: m.apellido_paterno,
          apellido_materno: m.apellido_materno,
        }))
      );
      
      // Cargar checklists guardados (combinando Supabase y localStorage)
      let checklistsRemotos: any[] = [];
      if (hasEnv) {
        try {
          const { data: checklistsDb } = await supabase
            .from('checklist_diagnostico')
            .select('*');

          if (Array.isArray(checklistsDb)) {
            checklistsRemotos = checklistsDb.map((row: any) => {
              const datos = row.datos || {};
              return {
                id: row.id_checklist,
                orden_trabajo_id: row.orden_trabajo_id,
                empleado_id: row.empleado_id || null,
                fecha_creacion: row.created_at,
                fecha_actualizacion: row.updated_at,
                clasificacion_prioridad: row.clasificacion_prioridad || datos.clasificacion_prioridad || 'normal',
                estado: row.estado || 'completado',
                ...datos,
              };
            });
          }
        } catch (error) {
          console.error('⚠️ Error cargando checklists desde Supabase:', error);
        }
      }

      const checklistMap = new Map<number, any>();
      const todosChecklists = [...checklistsRemotos, ...checklistsGuardados];
      todosChecklists.forEach((check: any) => {
        const key = check.orden_trabajo_id;
        if (!key) return;
        if (!checklistMap.has(key) || (checklistMap.get(key)?.fecha_actualizacion || '') < (check.fecha_actualizacion || '')) {
          checklistMap.set(key, check);
        }
      });
      const checklistsCombinados = Array.from(checklistMap.values());
      setChecklists(checklistsCombinados);
      writeLocal('apt_checklists_diagnostico', checklistsCombinados);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDiagnostico = (diagnostico: any) => {
    setSelectedDiagnostico(diagnostico);
    setViewOnlyModal(true);
  };

  const handleOpenOT = (orden: any) => {
    setSelectedOT(orden);
    
    // Buscar si existe un checklist guardado para esta OT
    const checklistExistente = checklists.find((c: any) => c.orden_trabajo_id === orden.id_orden_trabajo);
    
    setFormData({
      prioridad_ot: orden.prioridad_ot || 'normal',
      checklist_id: checklistExistente ? checklistExistente.id.toString() : (orden.checklist_id || ''),
      mecanico_apoyo_ids: orden.mecanico_apoyo_ids || [],
      confirmado_ingreso: orden.ya_ingreso || false,
      estado_ot: orden.estado_ot || 'en_reparacion',
    });
    setModalOpen(true);
  };

  const syncAssignmentApprovals = async (ordenId: number, mechanicIds: number[]) => {
    if (!hasEnv || !ordenId) return;

    try {
      const now = new Date().toISOString();
      const { data: existingRows, error: existingError } = await supabase
        .from('aprobacion_asignacion_ot')
        .select('id_aprobacion, mecanico_id, estado')
        .eq('orden_trabajo_id', ordenId);

      if (existingError) {
        console.error('⚠️ Error obteniendo aprobaciones existentes:', existingError);
        return;
      }

      const existingMap = new Map<number, { id_aprobacion: number; estado: string }>();
      (existingRows || []).forEach((row: any) => {
        if (row?.mecanico_id) {
          existingMap.set(row.mecanico_id, {
            id_aprobacion: row.id_aprobacion,
            estado: row.estado,
          });
        }
      });

      const selectedSet = new Set(mechanicIds);
      const inserts: any[] = [];
      const reactivateIds: number[] = [];

      mechanicIds.forEach((mecanicoId) => {
        if (!mecanicoId) return;
        const existing = existingMap.get(mecanicoId);
        if (!existing) {
          inserts.push({
            orden_trabajo_id: ordenId,
            mecanico_id: mecanicoId,
            estado: 'pendiente',
            updated_at: now,
          });
        } else if (existing.estado === 'rechazada' || existing.estado === 'revocada') {
          reactivateIds.push(existing.id_aprobacion);
        }
      });

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('aprobacion_asignacion_ot').insert(inserts);
        if (insertError) {
          console.error('⚠️ Error creando aprobaciones de asignación:', insertError);
        }
      }

      if (reactivateIds.length > 0) {
        const { error: reactivateError } = await supabase
          .from('aprobacion_asignacion_ot')
          .update({ estado: 'pendiente', updated_at: now })
          .in('id_aprobacion', reactivateIds);
        if (reactivateError) {
          console.error('⚠️ Error reactivando aprobaciones:', reactivateError);
        }
      }

      const revokeIds =
        existingRows
          ?.filter((row: any) => row?.id_aprobacion && !selectedSet.has(row.mecanico_id))
          .map((row: any) => row.id_aprobacion) || [];

      if (revokeIds.length > 0) {
        const { error: revokeError } = await supabase
          .from('aprobacion_asignacion_ot')
          .update({ estado: 'revocada', updated_at: now })
          .in('id_aprobacion', revokeIds);
        if (revokeError) {
          console.error('⚠️ Error marcando aprobaciones como revocadas:', revokeError);
        }
      }
    } catch (error) {
      console.error('⚠️ Error sincronizando aprobaciones de asignación:', error);
    }
  };

  const handleSaveOT = async () => {
    if (!selectedOT) return;

    try {
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const ordenIndex = ordenes.findIndex((o: any) => 
        o.id_orden_trabajo === selectedOT.id_orden_trabajo
      );

      if (ordenIndex !== -1) {
        const estadoActualizado =
          formData.confirmado_ingreso && ordenes[ordenIndex].estado_ot === 'en_diagnostico_programado'
            ? 'en curso'
            : ordenes[ordenIndex].estado_ot;

        ordenes[ordenIndex] = {
          ...ordenes[ordenIndex],
          prioridad_ot: formData.prioridad_ot,
          checklist_id: formData.checklist_id ? Number(formData.checklist_id) : null,
          mecanico_apoyo_ids: formData.mecanico_apoyo_ids,
          confirmado_ingreso: formData.confirmado_ingreso,
          estado_ot: estadoActualizado,
        };
        
        writeLocal('apt_ordenes_trabajo', ordenes);
        
        // También actualizar en Supabase si está configurado
        if (hasEnv) {
          try {
            await supabase
              .from('orden_trabajo')
              .update({
                prioridad_ot: formData.prioridad_ot,
                checklist_id: formData.checklist_id ? Number(formData.checklist_id) : null,
                mecanico_apoyo_ids: formData.mecanico_apoyo_ids,
                confirmado_ingreso: formData.confirmado_ingreso,
                estado_ot: estadoActualizado,
              })
              .eq('id_orden_trabajo', selectedOT.id_orden_trabajo);

            await syncAssignmentApprovals(selectedOT.id_orden_trabajo, formData.mecanico_apoyo_ids || []);
          } catch (error) {
            console.error('Error actualizando en Supabase:', error);
          }
        }
        
        alert('✅ Orden de trabajo actualizada exitosamente');
        setModalOpen(false);
        loadData();
      }
    } catch (error) {
      console.error('Error saving OT:', error);
      alert('Error al guardar la orden de trabajo');
    }
  };

  const handleOpenChecklist = () => {
    // Cerrar el modal de gestión antes de abrir el checklist
    setModalOpen(false);
    setShowChecklist(true);
  };

  const handleSaveChecklist = async (checklistData: any) => {
    if (!selectedOT) return;

    try {
      // Guardar el checklist
      const checklistsLS = readLocal('apt_checklists_diagnostico', []);
      let checklistId: number;
      
      // Si ya existe un checklist para esta OT, actualizarlo; si no, crear uno nuevo
      const existingChecklistIndex = checklistsLS.findIndex((c: any) => 
        c.orden_trabajo_id === selectedOT.id_orden_trabajo
      );
      
      const checklistCompleto = {
        id: existingChecklistIndex !== -1 ? checklistsLS[existingChecklistIndex].id : Date.now(),
        orden_trabajo_id: selectedOT.id_orden_trabajo,
        fecha_creacion: existingChecklistIndex !== -1 
          ? checklistsLS[existingChecklistIndex].fecha_creacion 
          : new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString(),
        ...checklistData,
      };
      
      if (existingChecklistIndex !== -1) {
        // Actualizar checklist existente
        checklistsLS[existingChecklistIndex] = checklistCompleto;
        checklistId = checklistCompleto.id;
      } else {
        // Crear nuevo checklist
        checklistsLS.push(checklistCompleto);
        checklistId = checklistCompleto.id;
      }

      // Guardar en Supabase si está disponible
      if (hasEnv) {
        try {
          const payload: any = {
            orden_trabajo_id: selectedOT.id_orden_trabajo,
            empleado_id:
              formData.mecanico_apoyo_ids && formData.mecanico_apoyo_ids.length > 0
                ? formData.mecanico_apoyo_ids[0]
                : null,
            datos: checklistCompleto,
            clasificacion_prioridad: checklistData.clasificacion_prioridad || null,
            estado: 'completado',
          };

          if (existingChecklistIndex !== -1) {
            const existing = checklistsLS[existingChecklistIndex];
            if (existing?.id) {
              payload.id_checklist = existing.id;
            }
          }

          const { data: upserted, error: checklistError } = await supabase
            .from('checklist_diagnostico')
            .upsert(payload, { onConflict: 'orden_trabajo_id' })
            .select()
            .single();

          if (checklistError) {
            console.error('Error guardando checklist en Supabase:', checklistError);
          } else if (upserted) {
            checklistId = upserted.id_checklist;
            checklistCompleto.id = upserted.id_checklist;
            checklistCompleto.fecha_creacion = upserted.created_at;
            checklistCompleto.fecha_actualizacion = upserted.updated_at;
            if (formData.mecanico_apoyo_ids.length === 0 && upserted.empleado_id) {
              setFormData((prev) => ({
                ...prev,
                mecanico_apoyo_ids: [...prev.mecanico_apoyo_ids, upserted.empleado_id],
              }));
            }
          }
        } catch (error) {
          console.error('⚠️ Error sincronizando checklist en Supabase:', error);
        }
      }
      
      if (existingChecklistIndex !== -1) {
        checklistsLS[existingChecklistIndex] = checklistCompleto;
      } else {
        checklistsLS[checklistsLS.length - 1] = checklistCompleto;
      }
      writeLocal('apt_checklists_diagnostico', checklistsLS);
      setChecklists((prev) => {
        const filtered = prev.filter((c: any) => c.orden_trabajo_id !== selectedOT.id_orden_trabajo);
        return [
          ...filtered,
          {
            ...checklistCompleto,
            id: checklistId,
          },
        ];
      });
      
      // Actualizar la OT con el checklist_id
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const ordenIndex = ordenes.findIndex((o: any) => 
        o.id_orden_trabajo === selectedOT.id_orden_trabajo
      );
      
      if (ordenIndex !== -1) {
        // Si el checklist tiene clasificación de prioridad, cambiar estado a "en_reparacion"
        const nuevoEstado = checklistData.clasificacion_prioridad ? 'en_reparacion' : ordenes[ordenIndex].estado_ot;
        
        ordenes[ordenIndex] = {
          ...ordenes[ordenIndex],
          checklist_id: checklistId,
          // Actualizar prioridad si viene del checklist
          prioridad_ot: checklistData.clasificacion_prioridad || ordenes[ordenIndex].prioridad_ot,
          // Cambiar estado a "en_reparacion" si el checklist está completo
          estado_ot: nuevoEstado,
        };
        writeLocal('apt_ordenes_trabajo', ordenes);
        
        console.log(`✅ OT #${selectedOT.id_orden_trabajo} cambiada a estado: ${nuevoEstado}`);
        
        // Actualizar en Supabase si está configurado
        if (hasEnv) {
          try {
            await supabase
              .from('orden_trabajo')
              .update({
                checklist_id: checklistId,
                prioridad_ot: checklistData.clasificacion_prioridad || selectedOT.prioridad_ot,
                estado_ot: nuevoEstado,
              })
              .eq('id_orden_trabajo', selectedOT.id_orden_trabajo);
          } catch (error) {
            console.error('Error actualizando en Supabase:', error);
          }
        }
      }
      
      setFormData({
        ...formData,
        checklist_id: checklistId.toString(),
        prioridad_ot: checklistData.clasificacion_prioridad || formData.prioridad_ot,
      });
      
      const mensajeExito = checklistData.clasificacion_prioridad 
        ? '✅ Checklist guardado exitosamente. La OT ha pasado a estado "En Reparación".'
        : '✅ Checklist guardado exitosamente.';
      
      alert(mensajeExito);
      setShowChecklist(false);
      // Reabrir el modal de gestión después de guardar el checklist
      setModalOpen(true);
      loadData();
    } catch (error) {
      console.error('Error saving checklist:', error);
      alert('Error al guardar el checklist');
    }
  };

  const handleCancelChecklist = () => {
    setShowChecklist(false);
    // Reabrir el modal de gestión después de cerrar el checklist
    if (selectedOT) {
      setModalOpen(true);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return null;
    }
  };

  const normalizeMechanicStatus = (estado: string | undefined) => {
    if (!estado) return 'en_reparacion';
    const normalized = estado.toLowerCase();
    if (normalized.includes('repuesto')) return 'esperando_repuestos';
    if (normalized.includes('prueba')) return 'en_pruebas';
    if (normalized.includes('finaliza')) return 'finalizada';
    return 'en_reparacion';
  };

  const selectedDataState = (ordenId: number) => {
    try {
      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const found = Array.isArray(ordenesLocal)
        ? ordenesLocal.find((o: any) => o.id_orden_trabajo === ordenId)
        : null;
      return found?.estado_ot || null;
    } catch {
      return null;
    }
  };

  const checklistAggregation = useMemo(() => {
    const map = new Map<number, any>();
    checklists.forEach((check) => {
      if (!check?.orden_trabajo_id) return;
      const previous = map.get(check.orden_trabajo_id);
      const previousTime = previous ? new Date(previous.fecha_actualizacion || previous.created_at || 0).getTime() : 0;
      const currentTime = new Date(check.fecha_actualizacion || check.fecha_creacion || 0).getTime();
      if (!previous || currentTime >= previousTime) {
        map.set(check.orden_trabajo_id, check);
      }
    });

    const pendientes: any[] = [];
    const realizados: any[] = [];

    ordenesDiagnostico.forEach((orden) => {
      const checklist = map.get(orden.id_orden_trabajo);
      if (!checklist) {
        pendientes.push(orden);
        return;
      }

      const estadoChecklist = (checklist.estado || '').toLowerCase();
      const completado = estadoChecklist === 'completado' || Boolean(checklist.clasificacion_prioridad);
      if (completado) {
        realizados.push(orden);
      } else {
        pendientes.push(orden);
      }
    });

    return {
      checklistMap: map,
      ordenesPendientes: pendientes,
      ordenesRealizadas: realizados,
    };
  }, [ordenesDiagnostico, checklists]);

  const checklistMap = checklistAggregation.checklistMap;
  const ordenesPendientesChecklist = checklistAggregation.ordenesPendientes;
  const ordenesRealizadasChecklist = checklistAggregation.ordenesRealizadas;

  const readProgressSummary = (ordenId: number) => {
    try {
      if (hasEnv) {
        const target =
          ordenesDiagnostico.find((o: any) => o.id_orden_trabajo === ordenId) ||
          ordenesFinalizadas.find((o: any) => o.id_orden_trabajo === ordenId);
        const avances = Array.isArray(target?.avances) ? target.avances : [];
        if (avances.length === 0) return null;
        const sorted = [...avances].sort(
          (a: any, b: any) =>
            new Date(b.created_at || b.fecha_registro || 0).getTime() -
            new Date(a.created_at || a.fecha_registro || 0).getTime()
        );
        return sorted[0] || null;
      }

      const progresos = readLocal('apt_progresos_mecanico', []);
      if (!Array.isArray(progresos)) return null;
      const latest = progresos
        .filter((p: any) => p.orden_trabajo_id === ordenId)
        .sort(
          (a: any, b: any) =>
            new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
        )[0];
      return latest || null;
    } catch {
      return null;
    }
  };

  const getFinalizadaOrders = () => {
    if (hasEnv) {
      return ordenesFinalizadas
        .map((orden: any) => {
          const resumen = readProgressSummary(orden.id_orden_trabajo);
          return {
            ...orden,
            tipo_problema:
              orden.tipo_problema ||
              orden.solicitud?.tipo_problema ||
              orden.descripcion_ot ||
              'N/A',
            chofer:
              orden.chofer ||
              orden.empleado_nombre ||
              orden.solicitud?.nombre_operador ||
              orden.solicitud?.nombre_chofer ||
              'N/A',
            patente_vehiculo:
              orden.patente_vehiculo ||
              orden.solicitud?.patente_vehiculo ||
              'N/A',
            resumen_progreso: resumen,
          };
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.fecha_cierre_ot || b.fecha_inicio_ot || 0).getTime() -
            new Date(a.fecha_cierre_ot || a.fecha_inicio_ot || 0).getTime()
        );
    }

    const ordenes = readLocal('apt_ordenes_trabajo', []);
    const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
    const empleados = readLocal('apt_empleados', []);
    const vehiculos = readLocal('apt_vehiculos', []);
    if (!Array.isArray(ordenes)) return [];

    return ordenes
      .filter((o: any) => o.estado_ot === 'finalizada')
      .map((o: any) => {
        const solicitud = Array.isArray(solicitudes)
          ? solicitudes.find(
              (s: any) =>
                s.orden_trabajo_id === o.id_orden_trabajo ||
                s.id_solicitud_diagnostico === o.solicitud_diagnostico_id
            )
          : null;
        const vehiculo = Array.isArray(vehiculos)
          ? vehiculos.find((v: any) => v.id_vehiculo === o.vehiculo_id)
          : null;
        const empleado = Array.isArray(empleados)
          ? empleados.find((e: any) => e.id_empleado === o.empleado_id)
          : null;

        const choferNombre =
          o.chofer ||
          solicitud?.nombre_operador ||
          solicitud?.nombre_chofer ||
          solicitud?.chofer_nombre ||
          (empleado ? `${empleado.nombre} ${empleado.apellido_paterno}`.trim() : null);
        const problema =
          o.tipo_problema ||
          solicitud?.tipo_problema ||
          solicitud?.descripcion_problema ||
          o.descripcion_ot ||
          'N/A';
        const patente =
          o.patente_vehiculo ||
          solicitud?.patente_vehiculo ||
          vehiculo?.patente_vehiculo ||
          'N/A';

        return {
          ...o,
          tipo_problema: problema,
          chofer: choferNombre || 'N/A',
          patente_vehiculo: patente,
          detalle_reparacion: o.detalle_reparacion || solicitud?.detalle_reparacion || '',
        };
      });
  };

  const marcarCierreTecnico = (ordenId: number) => {
    const ordenes = readLocal('apt_ordenes_trabajo', []);
    if (!Array.isArray(ordenes)) return;
    const index = ordenes.findIndex((o: any) => o.id_orden_trabajo === ordenId);
    if (index === -1) return;

    const cierreTimestamp = new Date().toISOString();

    ordenes[index] = {
      ...ordenes[index],
      estado_cierre: 'cerrada',
      fecha_cierre_tecnico: cierreTimestamp,
    };
    writeLocal('apt_ordenes_trabajo', ordenes);
    window.dispatchEvent(
      new CustomEvent('apt-local-update', {
        detail: { key: 'apt_ordenes_trabajo' },
      })
    );
    if (hasEnv) {
      supabase
        .from('orden_trabajo')
        .update({
          estado_cierre: 'cerrada',
          fecha_cierre_tecnico: cierreTimestamp,
        })
        .eq('id_orden_trabajo', ordenId)
        .then(({ error }) => {
          if (error) {
            console.error('⚠️ Error actualizando cierre técnico en Supabase:', error);
          }
          loadData();
          setCierreTab('finalizadas');
        });
    } else {
      loadData();
      setCierreTab('finalizadas');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Contenido de Agenda de Diagnósticos */}
      {activeSection === 'agenda' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agenda de Diagnósticos</h1>
          <p className="text-gray-600 mb-4">Vehículos programados para diagnóstico, separados por fecha.</p>
          
          {/* Pestañas */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setAgendaTab('hoy')}
              className={`px-4 py-2 font-medium transition-colors ${
                agendaTab === 'hoy'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📅 Hoy
              {diagnosticosDelDia.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {diagnosticosDelDia.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAgendaTab('proximos')}
              className={`px-4 py-2 font-medium transition-colors ${
                agendaTab === 'proximos'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🗓️ Próximos
              {diagnosticosProximos.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">
                  {diagnosticosProximos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAgendaTab('vencidos')}
              className={`px-4 py-2 font-medium transition-colors ${
                agendaTab === 'vencidos'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ⏰ Vencidos
              {diagnosticosVencidos.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {diagnosticosVencidos.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Fecha actual (solo si estamos en "Hoy") */}
          {agendaTab === 'hoy' && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <Clock size={16} />
              {new Date().toLocaleDateString('es-CL', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          )}
        
        {/* Contenido de "Hoy" */}
        {agendaTab === 'hoy' && (diagnosticosDelDia.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
            <p>No hay diagnósticos programados para hoy.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {diagnosticosDelDia.map((diagnostico) => (
              <div
                key={diagnostico.id_orden_trabajo}
                className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-[2px] hover:shadow-lg ${
                  diagnostico.ya_ingreso ? 'ring-1 ring-emerald-100' : ''
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        <Truck size={16} />
                        {diagnostico.patente_vehiculo}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        Programado
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        Normal
                      </span>
                      {diagnostico.ya_ingreso && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                          ✓ Ingresó
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-blue-700">
                        <Calendar size={16} />
                        {formatDate(diagnostico.fecha_confirmada)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <strong>Horario:</strong> {diagnostico.bloque_horario}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <strong>Chofer:</strong> {diagnostico.empleado_nombre}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <AlertCircle size={16} className="text-slate-400" />
                        <strong>Problema:</strong> {diagnostico.tipo_problema}
                      </span>
                      {diagnostico.ya_ingreso && diagnostico.ingreso_hora && (
                        <span className="inline-flex items-center gap-2 text-emerald-600">
                          <CheckCircle size={16} />
                          <strong>Ingreso registrado:</strong> {diagnostico.ingreso_hora}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewDiagnostico(diagnostico)}
                    className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  >
                    <FileText size={18} />
                    Ver Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
        
        {/* Contenido de "Próximos" */}
        {agendaTab === 'proximos' && (diagnosticosProximos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
            <p>No hay diagnósticos programados para fechas próximas.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {diagnosticosProximos.map((diagnostico) => (
              <div
                key={diagnostico.id_orden_trabajo}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-[2px] hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        <Truck size={16} />
                        {diagnostico.patente_vehiculo}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        Programado
                      </span>
                      {diagnostico.prioridad_ot && (
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            PRIORIDADES_OT.find((p) => p.value === diagnostico.prioridad_ot)?.color ||
                            'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {PRIORIDADES_OT.find((p) => p.value === diagnostico.prioridad_ot)?.label ||
                            diagnostico.prioridad_ot}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-blue-700">
                        <Calendar size={16} />
                        {formatDate(diagnostico.fecha_confirmada)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <strong>Horario:</strong> {diagnostico.bloque_horario}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <strong>Chofer:</strong> {diagnostico.empleado_nombre}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <AlertCircle size={16} className="text-slate-400" />
                        <strong>Problema:</strong> {diagnostico.tipo_problema}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewDiagnostico(diagnostico)}
                    className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  >
                    <FileText size={18} />
                    Ver Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
        
        {/* Contenido de "Vencidos" */}
        {agendaTab === 'vencidos' && (diagnosticosVencidos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
            <p>No se registran diagnósticos vencidos. ¡Todo al día!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {diagnosticosVencidos.map((diagnostico) => {
              const fechaReferencia = diagnostico.fecha_confirmada || diagnostico.fecha_inicio_ot;
              const fechaObj = fechaReferencia ? new Date(fechaReferencia) : null;
              const hoyLocal = new Date();
              hoyLocal.setHours(0, 0, 0, 0);
              const fechaLocal = fechaObj ? new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate()) : null;
              const diffMs = fechaLocal ? hoyLocal.getTime() - fechaLocal.getTime() : 0;
              const diasRetraso = fechaLocal ? Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24))) : 0;

              return (
                <div
                  key={diagnostico.id_orden_trabajo}
                  className="p-4 rounded-lg border-l-4 bg-red-50 border-red-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Truck className="text-gray-600" size={20} />
                        <span className="font-semibold text-gray-900 text-lg">
                          {diagnostico.patente_vehiculo}
                        </span>
                        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                          Vencido
                        </span>
                        {diagnostico.ya_ingreso && (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                            ✓ Ingresó
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-red-500" size={16} />
                          <span className="text-red-700 font-semibold">
                            {fechaObj ? formatDate(fechaReferencia) : 'Fecha no disponible'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Horario:</strong> {diagnostico.bloque_horario}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Chofer:</strong> {diagnostico.empleado_nombre}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="text-red-500" size={16} />
                          <span className="text-red-700">
                            <strong>Retraso:</strong> {diasRetraso} {diasRetraso === 1 ? 'día' : 'días'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <AlertCircle className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Problema:</strong> {diagnostico.tipo_problema}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleViewDiagnostico(diagnostico)}
                      className="shrink-0 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <FileText size={18} />
                      Ver Info
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        </div>
      )}

      {/* Contenido de Checklists de Diagnóstico */}
      {activeSection === 'checklists' && (
        <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/40">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Checklists de Diagnóstico</h1>
            <p className="text-sm text-slate-500">
              Visualiza el avance de los diagnósticos y gestiona los checklist completados o pendientes.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                <ClipboardList size={18} />
                Pendientes
              </div>
              <p className="mt-2 text-3xl font-semibold text-amber-700">{ordenesPendientesChecklist.length}</p>
              <p className="mt-1 text-xs text-amber-600/70">
                Checklists aún por completar o clasificar.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <CheckCircle size={18} />
                Realizados
              </div>
              <p className="mt-2 text-3xl font-semibold text-emerald-700">{ordenesRealizadasChecklist.length}</p>
              <p className="mt-1 text-xs text-emerald-600/70">
                Diagnósticos listos para avanzar a reparación.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Truck size={18} />
                Total monitoreado
              </div>
              <p className="mt-2 text-3xl font-semibold text-slate-800">
                {ordenesPendientesChecklist.length + ordenesRealizadasChecklist.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Órdenes con diagnóstico programado en seguimiento.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setChecklistTab('pendientes')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                checklistTab === 'pendientes'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ClipboardList size={16} />
              Pendientes
              {ordenesPendientesChecklist.length > 0 && (
                <span
                  className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-2 text-xs ${
                    checklistTab === 'pendientes' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {ordenesPendientesChecklist.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setChecklistTab('realizados')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                checklistTab === 'realizados'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle size={16} />
              Realizados
              {ordenesRealizadasChecklist.length > 0 && (
                <span
                  className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-2 text-xs ${
                    checklistTab === 'realizados' ? 'bg-white text-emerald-600' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {ordenesRealizadasChecklist.length}
                </span>
              )}
            </button>
          </div>

          {checklistTab === 'pendientes' && (
            <>
              {ordenesPendientesChecklist.length === 0 ? (
                <div className="mt-10 text-center text-slate-500">
                  <ClipboardList className="mx-auto text-slate-300" size={64} />
                  <p className="mt-3 text-sm">No hay checklists pendientes. ¡Todo al día!</p>
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {ordenesPendientesChecklist.map((orden) => {
                    const checklist = checklistMap.get(orden.id_orden_trabajo);
                    const prioridad = PRIORIDADES_OT.find((p) => p.value === (orden.prioridad_ot || checklist?.clasificacion_prioridad));
                    const estadoEtiqueta = orden.estado_ot === 'en curso' ? 'En curso' : 'Programado';
                    const ultimaActualizacion = formatDateTime(checklist?.fecha_actualizacion || checklist?.fecha_creacion);

                    return (
                      <div
                        key={orden.id_orden_trabajo}
                        className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white via-amber-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                <Truck size={16} className="text-slate-500" />
                                {orden.patente_vehiculo}
                              </span>
                              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                {estadoEtiqueta}
                              </span>
                              {prioridad && (
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${prioridad.color}`}>
                                  {prioridad.label}
                                </span>
                              )}
                              {orden.ya_ingreso && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
                                  <CheckCircle size={14} />
                                  Ingreso confirmado
                                </span>
                              )}
                            </div>

                            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                              <span className="inline-flex items-center gap-2">
                                <User size={16} className="text-slate-400" />
                                <strong>Chofer:</strong> {orden.empleado_nombre}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <AlertCircle size={16} className="text-slate-400" />
                                <strong>Problema:</strong> {orden.tipo_problema}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Calendar size={16} className="text-slate-400" />
                                <strong>Fecha:</strong> {formatDate(orden.fecha_confirmada)}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" />
                                <strong>Horario:</strong> {orden.bloque_horario || 'N/A'}
                              </span>
                              {ultimaActualizacion && (
                                <span className="inline-flex items-center gap-2 text-xs text-amber-700">
                                  <ClipboardList size={14} />
                                  Última actualización checklist: {ultimaActualizacion}
                                </span>
                              )}
                            </div>

                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                              <ClipboardList size={14} />
                              Checklist pendiente de completar o clasificar.
                            </div>
                          </div>

                          <div className="flex flex-col items-stretch gap-2 md:items-end">
                            <button
                              onClick={() => handleOpenOT(orden)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                            >
                              <Settings size={18} />
                              Gestionar
                            </button>
                            {ultimaActualizacion ? (
                              <span className="text-xs font-medium text-amber-600">
                                Revisado el {ultimaActualizacion}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Aún sin registro de checklist</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {checklistTab === 'realizados' && (
            <>
              {ordenesRealizadasChecklist.length === 0 ? (
                <div className="mt-10 text-center text-slate-500">
                  <CheckCircle className="mx-auto text-slate-300" size={64} />
                  <p className="mt-3 text-sm">Aún no hay diagnósticos finalizados.</p>
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {ordenesRealizadasChecklist.map((orden) => {
                    const checklist = checklistMap.get(orden.id_orden_trabajo);
                    const prioridad = PRIORIDADES_OT.find((p) => p.value === (checklist?.clasificacion_prioridad || orden.prioridad_ot));
                    const ultimaActualizacion = formatDateTime(checklist?.fecha_actualizacion || checklist?.fecha_creacion);
                    const estadoChecklist = (checklist?.estado || '').toLowerCase();

                    return (
                      <div
                        key={orden.id_orden_trabajo}
                        className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                <Truck size={16} className="text-slate-500" />
                                {orden.patente_vehiculo}
                              </span>
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow">
                                ✓ Checklist completado
                              </span>
                              {prioridad && (
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${prioridad.color}`}>
                                  {prioridad.label}
                                </span>
                              )}
                              {estadoChecklist && estadoChecklist !== 'completado' && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                  Estado: {checklist?.estado}
                                </span>
                              )}
                            </div>

                            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                              <span className="inline-flex items-center gap-2">
                                <User size={16} className="text-slate-400" />
                                <strong>Chofer:</strong> {orden.empleado_nombre}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <AlertCircle size={16} className="text-slate-400" />
                                <strong>Problema:</strong> {orden.tipo_problema}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Calendar size={16} className="text-slate-400" />
                                <strong>Fecha:</strong> {formatDate(orden.fecha_confirmada)}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" />
                                <strong>Horario:</strong> {orden.bloque_horario || 'N/A'}
                              </span>
                              {ultimaActualizacion && (
                                <span className="inline-flex items-center gap-2 text-xs text-emerald-700">
                                  <ClipboardList size={14} />
                                  Última revisión checklist: {ultimaActualizacion}
                                </span>
                              )}
                            </div>

                            {checklist && (
                              <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-slate-700 shadow-inner shadow-emerald-100/40">
                                <div className="flex items-center gap-2 text-emerald-700">
                                  <ClipboardList size={16} />
                                  <strong>Resumen técnico</strong>
                                </div>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {checklist.clasificacion_prioridad && (
                                    <p>
                                      <strong>Clasificación:</strong>{' '}
                                      {PRIORIDADES_OT.find((p) => p.value === checklist.clasificacion_prioridad)?.label ||
                                        checklist.clasificacion_prioridad}
                                    </p>
                                  )}
                                  {checklist.empleado_id && (
                                    <p>
                                      <strong>Mecánico que registró:</strong> #{checklist.empleado_id}
                                    </p>
                                  )}
                                  {checklist.observaciones && (
                                    <p className="sm:col-span-2">
                                      <strong>Observaciones:</strong> {checklist.observaciones}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-stretch gap-2 md:items-end">
                            <button
                              onClick={() => handleOpenOT(orden)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                            >
                              <FileText size={18} />
                              Revisar checklist
                            </button>
                            <span className="text-xs text-slate-400">
                              ID OT: {orden.id_orden_trabajo}
                              {checklist?.id ? ` ・ Checklist #${checklist.id}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contenido de Plan de Reparación */}
      {activeSection === 'plan' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Plan de Reparación</h1>
          <p className="text-gray-600 mb-6">Definir trabajos, horas estimadas y repuestos sugeridos para cada OT.</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <FileText className="mx-auto text-blue-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Funcionalidad en desarrollo</h3>
            <p className="text-gray-600">
              Aquí podrás definir el plan de reparación con detalle de trabajos, tiempos y repuestos.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Asignación de Mecánicos */}
      {activeSection === 'asignacion' && (() => {
        const otSinAsignar = ordenesDiagnostico.filter((orden: any) => {
          const principal = orden.solicitud?.mecanico_id || orden.solicitud_detalle?.mecanico_id;
          const apoyos = Array.isArray(orden.mecanico_apoyo_ids) ? orden.mecanico_apoyo_ids.length : 0;
          return !principal && apoyos === 0;
        });

        const otPendientesIngreso = ordenesDiagnostico.filter((orden: any) => {
          const principal = orden.solicitud?.mecanico_id || orden.solicitud_detalle?.mecanico_id;
          const apoyos = Array.isArray(orden.mecanico_apoyo_ids) ? orden.mecanico_apoyo_ids.length : 0;
          return (principal || apoyos > 0) && !orden.confirmado_ingreso;
        });

        const proximasAsignaciones = otSinAsignar
          .filter((orden: any) => orden.fecha_confirmada)
          .sort((a: any, b: any) => new Date(a.fecha_confirmada).getTime() - new Date(b.fecha_confirmada).getTime())
          .slice(0, 3);

        const totalAsignadas = ordenesDiagnostico.length - otSinAsignar.length;

        return (
          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/50 space-y-8">
            <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 px-8 py-10 text-white shadow-lg">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase tracking-wide">
                    <User size={14} />
                    Gestión de Asignaciones
                  </span>
                  <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                    Organiza tu equipo para cada orden de trabajo
                  </h1>
                  <p className="max-w-2xl text-blue-100">
                    Visualiza el estado de las OTs pendientes de asignar, identifica priorizaciones y deja notas para el
                    supervisor antes de solicitar aprobación.
                  </p>
                </div>
                <div className="grid w-full max-w-xs gap-3 rounded-2xl bg-white/15 p-4 text-sm backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-50">Mecánicos disponibles</span>
                    <strong className="text-lg">{mechanics.length}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-50">OT sin asignar</span>
                    <strong className="text-lg">{otSinAsignar.length}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-50">Pendientes de ingreso</span>
                    <strong className="text-lg">{otPendientesIngreso.length}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                  <Calendar size={18} />
                  Agenda del día
                </h3>
                <p className="mt-3 text-3xl font-bold text-blue-900">{otSinAsignar.length}</p>
                <p className="mt-1 text-xs text-blue-700/80">
                  OTs programadas sin mecánico asignado todavía.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle size={18} />
                  Asignaciones en curso
                </h3>
                <p className="mt-3 text-3xl font-bold text-emerald-900">{totalAsignadas}</p>
                <p className="mt-1 text-xs text-emerald-700/80">
                  OTs con al menos un mecánico propuesto o asignado.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertCircle size={18} />
                  Requiere seguimiento
                </h3>
                <p className="mt-3 text-3xl font-bold text-amber-900">{otPendientesIngreso.length}</p>
                <p className="mt-1 text-xs text-amber-700/80">
                  Asignaciones enviadas al supervisor pero aún sin ingreso confirmando.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner shadow-white">
                <h3 className="text-lg font-semibold text-slate-900">Siguiente paso sugerido</h3>
                <ol className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      1
                    </span>
                    Revisa las OTs sin mecánico y asigna un responsable principal desde el modal de gestión.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      2
                    </span>
                    Añade mecánicos de apoyo cuando la OT requiera varias tareas o especialidades.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      3
                    </span>
                    Envía la asignación al Supervisor y monitorea la aprobación desde la pestaña de "Cierre Técnico".
                  </li>
                </ol>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Próximas OTs a asignar</h3>
                    <p className="text-sm text-slate-500">
                      Prioriza según fecha confirmada y tipo de problema.
                    </p>
                  </div>
                  <button
                    onClick={() => setAgendaTab('proximos')}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600"
                  >
                    <Calendar size={16} />
                    Ver agenda completa
                  </button>
                </div>

                {proximasAsignaciones.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                    No hay próximas OTs sin asignación. ¡Todo al día!
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {proximasAsignaciones.map((orden: any) => (
                      <div
                        key={orden.id_orden_trabajo}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition hover:border-blue-200 hover:bg-white"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                <Truck size={14} className="text-slate-400" />
                                {orden.patente_vehiculo || 'Patente N/A'}
                              </span>
                              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {orden.tipo_problema || 'Diagnóstico pendiente'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(orden.fecha_confirmada)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock size={14} />
                                {orden.bloque_horario || 'Horario por confirmar'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <User size={14} />
                                {orden.empleado_nombre || 'Chofer sin registrar'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenOT(orden)}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                          >
                            <Settings size={16} />
                            Gestionar OT
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Contenido de OT en Reparación */}
      {activeSection === 'reparacion' && (() => {
        const progresos = hasEnv
          ? ordenesDiagnostico.flatMap((orden: any) =>
              (Array.isArray(orden.avances) ? orden.avances : []).map((avance: any) => ({
                ...avance,
                orden_trabajo_id: orden.id_orden_trabajo,
              }))
            )
          : readLocal('apt_progresos_mecanico', []);
        const ordenesPorEstado = {
          en_reparacion: ordenesDiagnostico.filter((o: any) => o.estado_ot === 'en_reparacion'),
          esperando_repuestos: ordenesDiagnostico.filter((o: any) => o.estado_ot === 'esperando_repuestos'),
          en_pruebas: ordenesDiagnostico.filter((o: any) => o.estado_ot === 'en_pruebas'),
          finalizada: ordenesDiagnostico.filter((o: any) => o.estado_ot === 'finalizada'),
        } as Record<typeof reparacionTab, any[]>;
        const visibles = ordenesPorEstado[reparacionTab];

        const tabLabel: Record<typeof reparacionTab, string> = {
          en_reparacion: 'En reparación',
          esperando_repuestos: 'Esperando repuestos',
          en_pruebas: 'En pruebas',
          finalizada: 'Finalizadas',
        };

        const estadoStyles: Record<string, string> = {
          finalizada: 'from-emerald-50 via-white to-white border-emerald-200',
          esperando_repuestos: 'from-amber-50 via-white to-white border-amber-200',
          en_pruebas: 'from-indigo-50 via-white to-white border-indigo-200',
          en_reparacion: 'from-blue-50 via-white to-white border-blue-200',
        };

        return (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                    <Wrench size={14} />
                    Seguimiento en tiempo real
                  </span>
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900">OT en Reparación</h1>
                    <p className="text-sm text-slate-500">
                      Controla tareas, tiempos y observaciones del taller para cada orden.
                    </p>
                  </div>
                </div>
                <div className="grid w-full max-w-md gap-3 rounded-2xl border border-blue-100 bg-blue-50/30 p-4 text-sm text-slate-500 md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-blue-700">Órdenes activas</p>
                    <p className="text-2xl font-bold text-blue-900">{ordenesDiagnostico.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-700">Avances registrados</p>
                    <p className="text-2xl font-bold text-blue-900">{progresos.length}</p>
                  </div>
                  <div className="md:col-span-2 rounded-xl bg-white/70 px-4 py-3 text-xs font-medium text-blue-700">
                    Actualizado al {new Date().toLocaleString('es-CL')}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner shadow-white">
              <div className="flex flex-wrap gap-2">
                {(['en_reparacion', 'esperando_repuestos', 'en_pruebas', 'finalizada'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setReparacionTab(key)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      reparacionTab === key
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'bg-white text-slate-600 hover:text-blue-600'
                    }`}
                  >
                    {key === 'en_reparacion' && <Wrench size={16} />}
                    {key === 'esperando_repuestos' && <AlertCircle size={16} />}
                    {key === 'en_pruebas' && <Activity size={16} />}
                    {key === 'finalizada' && <CheckCircle size={16} />}
                    {tabLabel[key]}
                    <span
                      className={`ml-1 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-2 text-xs ${
                        reparacionTab === key ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {ordenesPorEstado[key].length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {visibles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
                <Settings className="mx-auto text-slate-300" size={56} />
                <p className="mt-4 text-sm font-medium text-slate-600">
                  No hay órdenes con estado {tabLabel[reparacionTab].toLowerCase()}.
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {visibles.map((orden) => {
                  const progresosOT = progresos.filter(
                    (p: any) => p.orden_trabajo_id === orden.id_orden_trabajo
                  );
                  const resumenProgreso = readProgressSummary(orden.id_orden_trabajo);
                  const estadoActual = normalizeMechanicStatus(
                    orden.estado_ot || resumenProgreso?.estado_ot || selectedDataState(orden.id_orden_trabajo)
                  );

                  return (
                    <div
                      key={orden.id_orden_trabajo}
                      className={`rounded-3xl border bg-gradient-to-br p-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${
                        estadoStyles[estadoActual] || 'from-slate-50 via-white to-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow">
                              <Wrench size={16} />
                              {orden.patente_vehiculo}
                            </span>
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                estadoActual === 'finalizada'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : estadoActual === 'esperando_repuestos'
                                  ? 'bg-amber-100 text-amber-700'
                                  : estadoActual === 'en_pruebas'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {tabLabel[estadoActual as typeof reparacionTab] || estadoActual}
                            </span>
                            {orden.prioridad_ot && (
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                  PRIORIDADES_OT.find((p) => p.value === orden.prioridad_ot)?.color ||
                                  'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {PRIORIDADES_OT.find((p) => p.value === orden.prioridad_ot)?.label || orden.prioridad_ot}
                              </span>
                            )}
                          </div>

                          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                            <span className="inline-flex items-center gap-2">
                              <User size={16} className="text-slate-400" />
                              <strong>Chofer:</strong> {orden.empleado_nombre}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <AlertCircle size={16} className="text-slate-400" />
                              <strong>Problema:</strong> {orden.tipo_problema}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Calendar size={16} className="text-slate-400" />
                              <strong>Fecha:</strong> {formatDate(orden.fecha_confirmada)}
                            </span>
                            {orden.bloque_horario && (
                              <span className="inline-flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" />
                                <strong>Horario:</strong> {orden.bloque_horario}
                              </span>
                            )}
                            {orden.detalle_reparacion && (
                              <span className="inline-flex items-center gap-2 text-blue-700 lg:col-span-3">
                                <FileText size={16} className="text-blue-500" />
                                <strong>Detalle de reparación:</strong> {orden.detalle_reparacion}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenOT(orden)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                        >
                          <FileText size={18} />
                          Ver detalles
                        </button>
                      </div>

                      <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner shadow-blue-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                            <Activity size={18} />
                            Avances registrados
                          </div>
                          <span className="text-xs font-semibold text-blue-500">
                            {progresosOT.length} actualización(es)
                          </span>
                        </div>
                        {progresosOT.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {progresosOT.map((progreso: any, index: number) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setSelectedProgressLog({
                                    ...progreso,
                                    patente: orden.patente_vehiculo,
                                    chofer: orden.empleado_nombre,
                                    estado_ot: estadoActual,
                                  });
                                  setProgressDetailModal(true);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <CheckCircle size={16} className="text-emerald-600" />
                                    {new Date(progreso.fecha_registro || progreso.created_at).toLocaleDateString('es-CL', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                  {(progreso.hora_inicio || progreso.hora_fin) && (
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                      <Clock size={14} />
                                      {progreso.hora_inicio || '--:--'} - {progreso.hora_fin || '--:--'}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 text-sm text-slate-700">
                                  <strong>Trabajo:</strong> {progreso.descripcion_trabajo || 'Sin descripción'}
                                </p>
                                {progreso.observaciones && (
                                  <p className="text-xs text-slate-500">
                                    <strong>Observaciones:</strong> {progreso.observaciones}
                                  </p>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
                            {resumenProgreso
                              ? `Último avance registrado el ${new Date(resumenProgreso.fecha_registro).toLocaleString('es-CL')}`
                              : 'Aún no se registran avances para esta OT.'}
                            {resumenProgreso?.descripcion_trabajo && (
                              <p className="mt-1 text-xs text-amber-600">{resumenProgreso.descripcion_trabajo}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Contenido de Cierre Técnico de OT */}
      {activeSection === 'cierre' && (() => {
        const todas = getFinalizadaOrders();
        const finalizadas = todas.filter((o: any) => o.estado_cierre !== 'cerrada');
        const cerradas = todas.filter((o: any) => o.estado_cierre === 'cerrada');

        const renderLista = (ordenes: any[], vacio: string, cerradasFlag = false) => {
          if (ordenes.length === 0) {
            return (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-12 text-center shadow-sm">
                <Activity className="mx-auto text-slate-300" size={56} />
                <p className="mt-4 text-sm font-medium text-slate-600">{vacio}</p>
              </div>
            );
          }

          return (
            <div className="space-y-5">
              {ordenes.map((orden) => {
                const resumen = readProgressSummary(orden.id_orden_trabajo);
                const estadoCerrada = orden.estado_cierre === 'cerrada';
                const cierreBadge = estadoCerrada ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700';
                const fechaCierre = orden.fecha_cierre_tecnico || orden.fecha_actualizacion;

                return (
                  <div
                    key={orden.id_orden_trabajo}
                    className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow">
                            <CheckCircle size={16} />
                            {orden.patente_vehiculo || 'Patente N/A'}
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cierreBadge}`}>
                            {estadoCerrada ? 'Cierre técnico completado' : 'Pendiente de cierre'}
                          </span>
                          {cierreBadge === 'bg-emerald-100 text-emerald-700' && resumen && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Último avance: {new Date(resumen.fecha_registro).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>

                        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                          <span>
                            <strong>Problema:</strong> {orden.tipo_problema || 'N/A'}
                          </span>
                          <span>
                            <strong>Chofer:</strong> {orden.chofer || orden.empleado_nombre || 'N/A'}
                          </span>
                          <span>
                            <strong>Asignada a:</strong> {orden.mecanico_principal || 'Sin registro'}
                          </span>
                          <span className="lg:col-span-3 text-slate-700">
                            <strong>Detalle reparación:</strong>{' '}
                            {orden.detalle_reparacion || resumen?.descripcion_trabajo || 'Sin detalle ingresado'}
                          </span>
                          {resumen?.observaciones && (
                            <span className="lg:col-span-3 text-xs text-slate-500">
                              <strong>Observaciones del mecánico:</strong> {resumen.observaciones}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 md:items-end">
                        {!estadoCerrada ? (
                          <>
                            <button
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                              onClick={() => {
                                setSelectedOT(orden);
                                setModalOpen(true);
                              }}
                            >
                              <FileText size={16} />
                              Revisar detalle
                            </button>
                            <button
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600"
                              onClick={() => marcarCierreTecnico(orden.id_orden_trabajo)}
                            >
                              <CheckCircle size={16} />
                              Cerrar OT
                            </button>
                          </>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-inner">
                            <span className="inline-flex items-center gap-2 font-medium text-emerald-600">
                              <CheckCircle size={14} />
                              Cerrada el {fechaCierre ? new Date(fechaCierre).toLocaleString('es-CL') : '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle size={14} />
                    Control de calidad final
                  </span>
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900">Cierre Técnico de OT</h1>
                    <p className="text-sm text-slate-500">
                      Revisa los trabajos terminados por el mecánico y valida la conformidad técnica antes del cierre.
                    </p>
                  </div>
                </div>
                <div className="grid w.full max-w-md gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-slate-500 md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-emerald-700">Pendientes de cierre</p>
                    <p className="text-2xl font-bold text-emerald-900">{finalizadas.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700">OT cerradas</p>
                    <p className="text-2xl font-bold text-emerald-900">{cerradas.length}</p>
                  </div>
                  <div className="md:col-span-2 rounded-xl bg-white/80 px-4 py-3 text-xs font-medium text-emerald-700">
                    Asegúrate de revisar la evidencia de avances antes de cerrar definitivamente.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner shadow-white">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCierreTab('pendientes')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    cierreTab === 'pendientes'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                      : 'bg-white text-slate-600 hover:text-emerald-600'
                  }`}
                >
                  <AlertCircle size={16} />
                  Pendientes de cierre
                  <span
                    className={`ml-1 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-2 text-xs ${
                      cierreTab === 'pendientes' ? 'bg-white text-emerald-600' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {finalizadas.length}
                  </span>
                </button>
                <button
                  onClick={() => setCierreTab('finalizadas')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    cierreTab === 'finalizadas'
                      ? 'bg-slate-800 text-white shadow-lg shadow-slate-200'
                      : 'bg-white text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <CheckCircle size={16} />
                  Cerradas
                  <span
                    className={`ml-1 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-2 text-xs ${
                      cierreTab === 'finalizadas' ? 'bg-white text-slate-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cerradas.length}
                  </span>
                </button>
              </div>
            </div>

            {cierreTab === 'pendientes'
              ? renderLista(finalizadas, 'No hay OT finalizadas pendientes de cierre técnico.')
              : renderLista(cerradas, 'Aún no tienes OT cerradas.', true)}
          </div>
        );
      })()}

      {/* Contenido de Carga del Taller */}
      {activeSection === 'carga' && (() => {
        const estadosActivos = ['en_reparacion', 'esperando_repuestos', 'en_pruebas'];
        const ordenesActivas = ordenesDiagnostico.filter((o: any) => estadosActivos.includes((o.estado_ot || '').toLowerCase()))
          .sort((a: any, b: any) => new Date(a.fecha_confirmada || a.fecha_inicio_ot || 0).getTime() - new Date(b.fecha_confirmada || b.fecha_inicio_ot || 0).getTime());

        const totalOrdenes = ordenesDiagnostico.length;
        const boxesOcupados = ordenesActivas.length;
        const prioridadCritica = ordenesActivas.filter((o: any) => (o.prioridad_ot || '').toLowerCase() === 'critica');

        const mecanicosTotales = mechanics.length;
        const mecanicosAsignados = new Set<number>();
        ordenesActivas.forEach((orden: any) => {
          const principal = orden.solicitud?.mecanico_id || orden.solicitud_detalle?.mecanico_id || orden.empleado_id;
          const apoyos = Array.isArray(orden.mecanico_apoyo_ids) ? orden.mecanico_apoyo_ids : [];
          if (principal) mecanicosAsignados.add(principal);
          apoyos.forEach((id: number) => id && mecanicosAsignados.add(id));
        });
        const mecanicosOcupados = mecanicosAsignados.size;
        const mecanicosDisponibles = Math.max(mecanicosTotales - mecanicosOcupados, 0);

        const proximasOrdenes = ordenesDiagnostico
          .filter((orden: any) => orden.fecha_confirmada)
          .sort((a: any, b: any) => new Date(a.fecha_confirmada).getTime() - new Date(b.fecha_confirmada).getTime())
          .slice(0, 4);

        const cargaPorEstado = estadosActivos.map((estado) => ({
          estado,
          label:
            estado === 'en_reparacion'
              ? 'En reparación'
              : estado === 'esperando_repuestos'
              ? 'Esperando repuestos'
              : 'En pruebas',
          cantidad: ordenesDiagnostico.filter((o: any) => (o.estado_ot || '').toLowerCase() === estado).length,
        }));

        return (
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-200/60">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                    <Activity size={14} />
                    Monitor en tiempo real
                  </span>
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900">Carga del Taller</h1>
                    <p className="text-sm text-slate-500">
                      Distribución de órdenes, disponibilidad de mecánicos y prioridades críticas.
                    </p>
                  </div>
                </div>
                <div className="grid w-full max-w-xl gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Boxes ocupados</p>
                    <p className="mt-1 text-3xl font-bold text-blue-900">
                      {boxesOcupados}
                      <span className="text-base text-blue-500"> / {totalOrdenes}</span>
                    </p>
                    <p className="text-xs text-blue-600/70">{totalOrdenes === 0 ? 'Sin órdenes registradas' : `${Math.round((boxesOcupados / totalOrdenes) * 100 || 0)}% de utilización`}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Mecánicos disponibles</p>
                    <p className="mt-1 text-3xl font-bold text-emerald-900">{mecanicosDisponibles}</p>
                    <p className="text-xs text-emerald-600/70">{mecanicosTotales} total • {mecanicosOcupados} ocupados</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">OT críticas</p>
                    <p className="mt-1 text-3xl font-bold text-rose-900">{prioridadCritica.length}</p>
                    <p className="text-xs text-rose-600/70">Prioridad crítica pendiente de atención</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Distribución por estado</h3>
                <p className="text-sm text-slate-500">Resumen de cargas activas según avance técnico.</p>
                <div className="mt-4 space-y-3">
                  {cargaPorEstado.map((item) => (
                    <div key={item.estado} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <span className="text-lg font-semibold text-slate-900">{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Próximas OTs programadas</h3>
                    <p className="text-sm text-slate-500">Coordina recursos anticipadamente según la agenda confirmada.</p>
                  </div>
                  <button
                    onClick={() => setAgendaTab('proximos')}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600"
                  >
                    <Calendar size={14} />
                    Ir a agenda
                  </button>
                </div>

                {proximasOrdenes.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                    No hay programaciones próximas.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {proximasOrdenes.map((orden: any) => (
                      <div key={orden.id_orden_trabajo} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                                <Truck size={14} className="text-slate-400" />
                                {orden.patente_vehiculo || 'Patente N/A'}
                              </span>
                              {orden.prioridad_ot && (
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                  PRIORIDADES_OT.find((p) => p.value === orden.prioridad_ot)?.color || 'bg-slate-100 text-slate-700'
                                }`}>
                                  {PRIORIDADES_OT.find((p) => p.value === orden.prioridad_ot)?.label || orden.prioridad_ot}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(orden.fecha_confirmada)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock size={14} />
                                {orden.bloque_horario || 'Horario por confirmar'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <User size={14} />
                                {orden.empleado_nombre || 'Chofer sin registrar'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenOT(orden)}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
                          >
                            <Settings size={14} />
                            Gestionar OT
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
              <Activity className="mx-auto text-slate-300" size={48} />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Monitoreo ampliado próximamente</h3>
              <p className="text-sm text-slate-500">
                Estamos preparando gráficos de carga por turno y módulos de capacidad en tiempo real.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Modal de Checklist */}
      <Modal
        isOpen={showChecklist}
        onClose={handleCancelChecklist}
        title="Checklist de Diagnóstico"
        size="large"
      >
        {selectedOT && (
          <ChecklistDiagnostico
            ordenTrabajo={selectedOT}
            onSave={handleSaveChecklist}
            onCancel={handleCancelChecklist}
            initialData={checklistMap.get(selectedOT.id_orden_trabajo) || {}}
          />
        )}
      </Modal>

      {/* Modal de Gestión de OT */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOT(null);
          setShowChecklist(false);
        }}
        title="Gestionar Orden de Trabajo"
      >
        {selectedOT && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Información de la OT</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>Patente:</strong> {selectedOT.patente_vehiculo}
                </div>
                <div>
                  <strong>Problema:</strong> {selectedOT.tipo_problema}
                </div>
                <div>
                  <strong>Chofer:</strong> {selectedOT.empleado_nombre}
                </div>
                <div>
                  <strong>Horario:</strong> {selectedOT.bloque_horario}
                </div>
              </div>
            </div>

            {/* Confirmar Ingreso */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="confirmado_ingreso"
                checked={formData.confirmado_ingreso}
                onChange={(e) => setFormData({ ...formData, confirmado_ingreso: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="confirmado_ingreso" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CheckCircle className="text-green-600" size={18} />
                Confirmar que el vehículo ya ingresó al taller (guardia lo registró)
              </label>
            </div>

            {/* Prioridad de la OT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad de la OT
              </label>
              <select
                value={formData.prioridad_ot}
                onChange={(e) => setFormData({ ...formData, prioridad_ot: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {PRIORIDADES_OT.map((prioridad) => (
                  <option key={prioridad.value} value={prioridad.value}>
                    {prioridad.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Checklist de Diagnóstico */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checklist de Diagnóstico
              </label>
              {formData.checklist_id ? (
                <div className="p-3 bg-green-50 rounded-lg mb-2">
                  <p className="text-sm text-green-700">
                    ✓ Checklist completado (ID: {formData.checklist_id})
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 rounded-lg mb-2">
                  <p className="text-sm text-yellow-700">
                    ⚠ Checklist pendiente de completar
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleOpenChecklist}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ClipboardList size={18} />
                {formData.checklist_id ? 'Ver/Editar Checklist' : 'Abrir Checklist de Diagnóstico'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Selecciona y completa el checklist según tipo de vehículo/falla
              </p>
            </div>

        {/* Información del avance final (solo si la OT está finalizada) */}
        {normalizeMechanicStatus(selectedOT.estado_ot) === 'finalizada' && (() => {
          const resumenProgreso = readProgressSummary(selectedOT.id_orden_trabajo);
          const avancesOrden = hasEnv
            ? (Array.isArray(selectedOT.avances) ? selectedOT.avances : [])
            : (readLocal('apt_progresos_mecanico', []) as any[]).filter(
                (p: any) => p.orden_trabajo_id === selectedOT.id_orden_trabajo
              );
          const avancesOrdenados = [...avancesOrden].sort(
            (a: any, b: any) =>
              new Date(b.created_at || b.fecha_registro || 0).getTime() -
              new Date(a.created_at || a.fecha_registro || 0).getTime()
          );

          return (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <Activity className="text-green-600" size={18} />
              Resumen técnico del mecánico
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <div>
                <strong>Detalle de reparación:</strong>{' '}
                {selectedOT.detalle_reparacion || resumenProgreso?.descripcion_trabajo || 'Sin registrar'}
              </div>
              <div>
                <strong>Última actualización:</strong>{' '}
                {resumenProgreso?.created_at
                  ? new Date(resumenProgreso.created_at).toLocaleString('es-CL')
                  : '—'}
              </div>
              <div>
                <strong>Estado reportado por mecánico:</strong>{' '}
                {resumenProgreso?.estado_ot || selectedOT.estado_ot || 'N/A'}
              </div>
              <div>
                <strong>Observaciones:</strong>{' '}
                {resumenProgreso?.observaciones || 'Sin observaciones'}
              </div>
              {(resumenProgreso?.hora_inicio || resumenProgreso?.hora_fin) && (
                <div>
                  <strong>Rango de trabajo:</strong>{' '}
                  {`${resumenProgreso.hora_inicio || '--:--'} - ${resumenProgreso.hora_fin || '--:--'}`}
                </div>
              )}
            </div>

            {Array.isArray(resumenProgreso?.fotos) && resumenProgreso.fotos.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Fotografías adjuntas</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {resumenProgreso.fotos.map((foto: string, index: number) => (
                    <img
                      key={index}
                      src={foto}
                      alt={`Evidencia ${index + 1}`}
                      className="w-full h-32 object-cover rounded border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            )}

            {avancesOrdenados.length > 0 ? (
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-900">Avances registrados</p>
                {avancesOrdenados.slice(0, 3).map((avance: any, index: number) => (
                  <div
                    key={`${avance.id_avance_ot || index}`}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {new Date(avance.created_at || avance.fecha_registro).toLocaleString('es-CL')}
                      </span>
                      {(avance.hora_inicio || avance.hora_fin) && (
                        <span>
                          ⏱️ {avance.hora_inicio || '--:--'} - {avance.hora_fin || '--:--'}
                        </span>
                      )}
                    </div>
                    <div>
                      <strong>Trabajo:</strong> {avance.descripcion_trabajo || 'N/A'}
                    </div>
                    {avance.observaciones && (
                      <div className="text-xs text-gray-500">
                        <strong>Obs:</strong> {avance.observaciones}
                      </div>
                    )}
                  </div>
                ))}
                {avancesOrdenados.length > 3 && (
                  <p className="text-xs text-gray-500">
                    {avancesOrdenados.length - 3} avance(s) adicionales registrados.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 pt-3 border-t border-gray-200">
                No se encontraron avances registrados para esta OT.
              </p>
            )}
          </div>
          );
        })()}

        {/* Mecánicos asignados (solo lectura) */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Mecánicos asignados
          </label>
          {(() => {
            const principalId =
              selectedOT.solicitud?.mecanico_id ||
              selectedOT.solicitud_detalle?.mecanico_id ||
              selectedOT.empleado_id ||
              null;
            const apoyoIds = Array.isArray(selectedOT.mecanico_apoyo_ids)
              ? selectedOT.mecanico_apoyo_ids
              : [];
            const assignedIds = Array.from(
              new Set([principalId, ...apoyoIds].filter(Boolean))
            ) as number[];

            if (assignedIds.length === 0) {
              return <p className="text-sm text-gray-500">No hay mecánicos asignados a esta OT.</p>;
            }

            const mechanicsMap = new Map<number, any>();
            mechanics.forEach((m) => mechanicsMap.set(m.id_empleado, m));

            return (
              <ul className="space-y-2">
                {assignedIds.map((id, index) => {
                  const mechanicInfo = mechanicsMap.get(id);
                  const nombre = mechanicInfo
                    ? `${mechanicInfo.nombre} ${mechanicInfo.apellido_paterno || ''}`.trim()
                    : `Mecánico #${id}`;
                  const esPrincipal = index === 0 && principalId !== null;
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700"
                    >
                      <span>{nombre}</span>
                      {esPrincipal && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                          Principal
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedOT(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOT}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Solo Visualización */}
      <Modal
        isOpen={viewOnlyModal}
        onClose={() => {
          setViewOnlyModal(false);
          setSelectedDiagnostico(null);
        }}
        title="Información del Diagnóstico"
        size="large"
      >
        {selectedDiagnostico && (
          <div className="space-y-6">
            {/* Header con Patente */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center gap-3">
                <Truck className="text-blue-600" size={32} />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedDiagnostico.patente_vehiculo}</h3>
                  <p className="text-sm text-gray-600">OT #{selectedDiagnostico.id_orden_trabajo}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedDiagnostico.ya_ingreso ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    ✓ Vehículo Ingresado
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    ⏳ Pendiente de Ingreso
                  </span>
                )}
                {selectedDiagnostico.prioridad_ot && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    PRIORIDADES_OT.find(p => p.value === selectedDiagnostico.prioridad_ot)?.color || 'bg-gray-100 text-gray-800'
                  }`}>
                    {PRIORIDADES_OT.find(p => p.value === selectedDiagnostico.prioridad_ot)?.label || selectedDiagnostico.prioridad_ot}
                  </span>
                )}
              </div>
            </div>

            {/* Información General */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Fecha Programada</h4>
                </div>
                <p className="text-lg text-gray-700 font-medium">
                  {formatDate(selectedDiagnostico.fecha_confirmada)}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Horario</h4>
                </div>
                <p className="text-lg text-gray-700 font-medium">
                  {selectedDiagnostico.bloque_horario}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Chofer</h4>
                </div>
                <p className="text-lg text-gray-700">
                  {selectedDiagnostico.empleado_nombre}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-orange-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Problema Reportado</h4>
                </div>
                <p className="text-lg text-gray-700">
                  {selectedDiagnostico.tipo_problema}
                </p>
              </div>
            </div>

            {/* Información de Ingreso */}
            {selectedDiagnostico.ya_ingreso && selectedDiagnostico.ingreso_hora && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Registro de Ingreso</h4>
                </div>
                <p className="text-gray-700">
                  <strong>Hora de ingreso:</strong> {selectedDiagnostico.ingreso_hora}
                </p>
              </div>
            )}

            {/* Comentarios */}
            {selectedDiagnostico.solicitud?.comentarios && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Comentarios del Chofer</h4>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {selectedDiagnostico.solicitud.comentarios}
                </p>
              </div>
            )}

            {/* Fotos */}
            {selectedDiagnostico.solicitud?.fotos && selectedDiagnostico.solicitud.fotos.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Fotos Adjuntas</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedDiagnostico.solicitud.fotos.map((foto: string, index: number) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={foto}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(foto, '_blank')}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Haz clic en una imagen para verla en tamaño completo
                </p>
              </div>
            )}

            {/* Botón de Cerrar */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setViewOnlyModal(false);
                  setSelectedDiagnostico(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={progressDetailModal}
        onClose={() => {
          setProgressDetailModal(false);
          setSelectedProgressLog(null);
        }}
        title={`Detalle de avance ${selectedProgressLog?.patente ? `· ${selectedProgressLog.patente}` : ''}`}
      >
        {selectedProgressLog && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-900">
              <p><strong>OT:</strong> #{selectedProgressLog.orden_trabajo_id}</p>
              <p><strong>Chofer:</strong> {selectedProgressLog.chofer || 'N/A'}</p>
              <p><strong>Fecha registro:</strong> {new Date(selectedProgressLog.fecha_registro).toLocaleString('es-CL')}</p>
            </div>
            <div className="space-y-2 text-sm text-gray-800">
              <p><strong>Trabajo realizado:</strong> {selectedProgressLog.descripcion_trabajo || 'N/A'}</p>
              {selectedProgressLog.observaciones && (
                <p><strong>Observaciones:</strong> {selectedProgressLog.observaciones}</p>
              )}
              {selectedProgressLog.hora_inicio && selectedProgressLog.hora_fin && (
                <p>
                  <strong>Horario:</strong> {selectedProgressLog.hora_inicio} - {selectedProgressLog.hora_fin}
                </p>
              )}
            </div>
            {Array.isArray(selectedProgressLog.fotos) && selectedProgressLog.fotos.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fotografías</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedProgressLog.fotos.map((foto: string, idx: number) => (
                    <img
                      key={idx}
                      src={foto}
                      alt={`Foto avance ${idx + 1}`}
                      className="w-full h-24 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
                      onClick={() => window.open(foto, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setProgressDetailModal(false);
                  setSelectedProgressLog(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

