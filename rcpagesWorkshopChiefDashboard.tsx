warning: in the working copy of 'template-apt/src/pages/WorkshopChiefDashboard.tsx', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/template-apt/src/pages/WorkshopChiefDashboard.tsx b/template-apt/src/pages/WorkshopChiefDashboard.tsx[m
[1mindex f0c68de..3a52df9 100644[m
[1m--- a/template-apt/src/pages/WorkshopChiefDashboard.tsx[m
[1m+++ b/template-apt/src/pages/WorkshopChiefDashboard.tsx[m
[36m@@ -13,7 +13,7 @@[m [mconst PRIORIDADES_OT = [[m
 ];[m
 [m
 interface WorkshopChiefDashboardProps {[m
[31m-  activeSection?: 'agenda' | 'checklists' | 'plan' | 'asignacion' | 'reparacion' | 'cierre' | 'carga';[m
[32m+[m[32m  activeSection?: 'agenda' | 'checklists' | 'plan' | 'reparacion' | 'cierre';[m
 }[m
 [m
 export default function WorkshopChiefDashboard({ activeSection = 'agenda' }: WorkshopChiefDashboardProps) {[m
[36m@@ -77,6 +77,12 @@[m [mexport default function WorkshopChiefDashboard({ activeSection = 'agenda' }: Wor[m
     return nombre || `Mecánico #${mechanic?.id_empleado ?? 'N/A'}`;[m
   };[m
 [m
[32m+[m[32m  const getMechanicDisplayName = (mechanicId?: number | null) => {[m
[32m+[m[32m    if (!mechanicId) return null;[m
[32m+[m[32m    const mechanic = mechanics.find((m: any) => m.id_empleado === mechanicId);[m
[32m+[m[32m    return mechanic ? getMechanicName(mechanic) : `Mecánico #${mechanicId}`;[m
[32m+[m[32m  };[m
[32m+[m
   const mechanicOptions = useMemo([m
     () =>[m
       mechanics.map((mechanic) => ({[m
[36m@@ -168,7 +174,7 @@[m [mexport default function WorkshopChiefDashboard({ activeSection = 'agenda' }: Wor[m
       // Cargar datos base (solicitudes + órdenes)[m
       let solicitudes: any[] = readLocal('apt_solicitudes_diagnostico', []);[m
       let ordenes: any[] = readLocal('apt_ordenes_trabajo', []);[m
[31m-      const historialAutorizados = readLocal('apt_historial_autorizados', []);[m
[32m+[m[32m      let historialAutorizados = readLocal('apt_historial_autorizados', []);[m
       const empleadosLocal = readLocal('apt_empleados', []);[m
       const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);[m
       let ordenesActualizadas = [...ordenes];[m
[36m@@ -178,6 +184,18 @@[m [mexport default function WorkshopChiefDashboard({ activeSection = 'agenda' }: Wor[m
 [m
       if (hasEnv) {[m
         try {[m
[32m+[m[32m          const { data: historialDb, error: historialError } = await supabase[m
[32m+[m[32m            .from('historial_accesos')[m
[32m+[m[32m            .select('*')[m
[32m+[m[32m            .order('created_at', { ascending: false, nullsLast: true });[m
[32m+[m
[32m+[m[32m          if (historialError) {[m
[32m+[m[32m            console.error('⚠️ Error cargando historial de ingresos:', historialError);[m
[32m+[m[32m          } else if (Array.isArray(historialDb)) {[m
[32m+[m[32m            historialAutorizados = historialDb;[m
[32m+[m[32m            writeLocal('apt_historial_autorizados', historialDb);[m
[32m+[m[32m          }[m
[32m+[m
           // Cargar solicitudes confirmadas y pendientes desde Supabase[m
           const { data: solicitudesDb, error: solicitudesError } = await supabase[m
             .from('solicitud_diagnostico')[m
[36m@@ -213,60 +231,16 @@[m [mexport default function WorkshopChiefDashboard({ activeSection = 'agenda' }: Wor[m
           }[m
 [m
           // Cargar órdenes de trabajo relacionadas con diagnósticos[m
[31m-          const { data: ordenesDb, error: ordenesError } = await supabase[m
[31m-            .from('orden_trabajo')[m
[31m-            .select([m
[31m-              `[m
[31m-                id_orden_trabajo,[m
[31m-                descripcion_ot,[m
[31m-                estado_ot,[m
[31m-                prioridad_ot,[m
[31m-                empleado_id,[m
[31m-                vehiculo_id,[m
[31m-                solicitud_diagnostico_id,[m
[31m-                checklist_id,[m
[31m-                mecanico_apoyo_ids,[m
[31m-                confirmado_ingreso,[m
[31m-                fecha_programada_reparacion,[m
[31m-                hora_programada_reparacion,[m
[31m-                estado_reparacion,[m
[31m-                hora_confirmada,[m
[31m-                fecha_inicio_ot,[m
[31m-                fecha_cierre_ot,[m
[31m-          estado_cierre,[m
[31m-          fecha_cierre_tecnico,[m
[31m-              detalle_reparacion,[m
[31m-                created_at,[m
[31m-              avances:avance_ot([m
[31m-                id_avance_ot,[m
[31m-                descripcion_trabajo,[m
[31m-                hora_inicio,[m
[31m-                hora_fin,[m
[31m-                observaciones,[m
[31m-                fotos,[m
[31m-                mecanico_id,[m
[31m-                created_at[m
[31m-              ),[m
[31m-                solicitud:solicitud_diagnostico_id([m
[31m-                  id_solicitud_diagnostico,[m
[31m-                  fecha_confirmada,[m
[31m-                  fecha_solicitada,[m
[31m-                  bloque_horario_confirmado,[m
[31m-                  bloque_horario,[m
[31m-                  tipo_problema,[m
[31m-                  prioridad,[m
[31m-                  estado_solicitud,[m
[31m-                  empleado_id,[m
[31m-                  vehiculo_id,[m
[31m-                  patente_vehiculo,[m
[31m-                  tipo_trabajo,[m
[31m-                  mecanico_id[m
[31m-                ),[m
[31m-                vehiculo:vehiculo_id([m
[31m-                  patente_vehiculo[m
[31m-                )[m
[31m-              `[m
[31m-            );[m
[32m+[m[32m        const { data: ordenesDb, error: ordenesError } = await supabase[m
[32m+[m[32m          .from('orden_trabajo')[m
[32m+[m[32m          .select([m
[32m+[m[32m            `[m
[32m+[m[32m              *,[m
[32m+[m[32m              avances:avance_ot(*),[m
[32m+[m[32m              solicitud:solicitud_diagnostico_id(*),[m
[32m+[m[32m              vehiculo:vehiculo_id(patente_vehiculo)[m
[32m+[m[32m            `[m
[32m+[m[32m          );[m
 [m
           if (!ordenesError && Array.isArray(ordenesDb)) {[m
             const ordenesIds = ordenesDb.map((o: any) => o.id_orden_trabajo).filter(Boolean);[m
[36m@@ -277,20 +251,17 @@[m [mexport default function WorkshopChiefDashboard({ activeSection = 'agenda' }: Wor[m
               try {[m
                 const { data: avancesDb, error: avancesError } = await supabase[m
                   .from('avance_ot')[m
[31m-                  .select([m
[31m-                    `[m
[31m-                      id_avance_ot,[m
[31m-                      orden_trabajo_id,[m
[31m-                      descripcion_trabajo,[m
[31m-                      observaciones,[m
[31m-                      hora_inicio,[m
[31m-                      hora_fin,[m
[31m-                      fotos,[m
[31m-                      mecanico_id,[m
[31m-                      created_at,[m
[31m-                      estado_ot[m
[31m-                    `[m
[31m-                  )[m
[32m+[m[32m                  .select(`[m
[32m+[m[32m                    id_avance_ot,[m
[32m+[m[32m                    orden_trabajo_id,[m
[32m+[m[32m                    descripcion_trabajo,[m
[32m+[m[32m                    observaciones,[m
[32m+[m[32m                    hora_inicio,[m
[32m+[m[32m                    hora_fin,[m
[32m+[m[32m                    fotos,[m
[32m+[m[32m                    mecanico_id,[m
[32m+[m[32m                    created_at[m
[32m+[m[32m                  `)[m
                   .in('orden_trabajo_id', ordenesIds)[m
                   .order('created_at', { ascending: false });[m
 [m
[36m@@ -298,8 +269,12 @@[m [mexport default function WorkshopChiefDashboard({ activeSection = 'agenda' }: Wor[m
                   console.error('⚠️ Error cargando avances de Supabase:', avancesError);[m
                 } else if (Array.isArray(avancesDb)) {[m
                