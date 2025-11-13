import { useState, useEffect } from 'react';
import { Users, Key, ClipboardList, Calendar, Truck, Shield, Plus, Edit, Trash2, CheckCircle, XCircle, Layers, Activity, MapPin, ListChecks, Clock3, CalendarClock, SunMedium, Timer, Search, UserPlus, UserCircle, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';

interface AdminDashboardProps {
  activeSection?: 'usuarios' | 'vehiculos' | 'roles' | 'catalogos' | 'agenda' | 'flota' | 'auditoria';
}

const ROLES = [
  { 
    value: 'planner', 
    label: 'Coordinador',
    descripcion: 'Agenda trabajos, solicita ingresos y reporta estados.',
    color: 'bg-blue-100 text-blue-800',
  },
  { 
    value: 'jefe_taller', 
    label: 'Jefe de Taller',
    descripcion: 'Lidera diagnóstico, checklist, asigna mecánicos y valida cierre de OT.',
    color: 'bg-purple-100 text-purple-800',
  },
  { 
    value: 'mechanic', 
    label: 'Mecánico',
    descripcion: 'Ejecutan mantenciones y registran avances.',
    color: 'bg-green-100 text-green-800',
  },
  { 
    value: 'supervisor', 
    label: 'Supervisor',
    descripcion: 'Aprueba asignaciones, controla tiempos y calidad técnica.',
    color: 'bg-orange-100 text-orange-800',
  },
  { 
    value: 'guard', 
    label: 'Guardia',
    descripcion: 'Registra ingresos y salidas de vehículos.',
    color: 'bg-gray-100 text-gray-800',
  },
  { 
    value: 'driver', 
    label: 'Chofer',
    descripcion: 'Usuario informativo para trazabilidad del vehículo.',
    color: 'bg-yellow-100 text-yellow-800',
  },
  { 
    value: 'admin', 
    label: 'Administrador',
    descripcion: 'Acceso total al sistema, gestiona usuarios, roles y configuraciones.',
    color: 'bg-red-100 text-red-800',
  },
];

const ROLE_TO_CARGO_NAMES: Record<string, string[]> = {
  admin: ['Administrador', 'Admin'],
  planner: ['Coordinador', 'Planner'],
  jefe_taller: ['Jefe de Taller', 'Shop Chief'],
  supervisor: ['Supervisor'],
  mechanic: ['Mecánico', 'Mechanic'],
  guard: ['Guardia', 'Guard'],
  driver: ['Chofer', 'Driver'],
};

const getPreferredCargoName = (role: string) =>
  ROLE_TO_CARGO_NAMES[role]?.[0] ?? role;

const ROLE_PROFILES: Record<
  string,
  {
    titulo: string;
    landing: string;
    modulos: string[];
    widgets: string[];
  }
> = {
  admin: {
    titulo: 'Administrador',
    landing: 'admin-usuarios',
    modulos: [
      'admin-usuarios',
      'admin-vehiculos',
      'admin-roles',
      'admin-catalogos',
      'admin-agenda',
      'admin-flota',
      'admin-auditoria',
    ],
    widgets: ['dashboard', 'usuarios', 'vehiculos', 'auditoria'],
  },
  planner: {
    titulo: 'Coordinador',
    landing: 'coordinator-agenda',
    modulos: [
      'coordinator-agenda',
      'coordinator-solicitudes',
      'coordinator-emergencias',
      'coordinator-ordenes',
      'coordinator-vehiculos',
      'coordinator-reportes',
    ],
    widgets: ['agenda', 'ordenes', 'inspecciones'],
  },
  supervisor: {
    titulo: 'Supervisor',
    landing: 'supervisor-tablero',
    modulos: [
      'supervisor-tablero',
      'supervisor-diagnosticos',
      'supervisor-emergencias',
      'supervisor-calidad',
      'supervisor-indicadores',
    ],
    widgets: ['indicadores', 'ot-activa', 'calidad'],
  },
  mechanic: {
    titulo: 'Mecánico',
    landing: 'mechanic-assigned',
    modulos: ['mechanic-assigned', 'mechanic-progress', 'mechanic-history'],
    widgets: ['ot-asignadas', 'progreso'],
  },
  jefe_taller: {
    titulo: 'Jefe de Taller',
    landing: 'workshop-agenda',
    modulos: [
      'workshop-agenda',
      'workshop-checklists',
      'workshop-plan',
      'workshop-asignacion',
      'workshop-reparacion',
      'workshop-cierre',
      'workshop-carga',
    ],
    widgets: ['agenda', 'capacidad', 'reparaciones'],
  },
  guard: {
    titulo: 'Guardia',
    landing: 'gate-ingreso',
    modulos: ['gate-ingreso', 'gate-salida', 'gate-sin-cita', 'gate-historial', 'gate-consulta'],
    widgets: ['ingresos', 'alertas'],
  },
  driver: {
    titulo: 'Chofer',
    landing: 'schedule-diagnostic',
    modulos: ['schedule-diagnostic'],
    widgets: ['diagnosticos', 'vehiculos'],
  },
  default: {
    titulo: 'Colaborador',
    landing: 'dashboard',
    modulos: ['dashboard'],
    widgets: [],
  },
};

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const hasSupabase =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

const sanitizeString = (value: string) =>
  value
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
    : '';

const capitalizeFirst = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const extractPrimaryToken = (value: string) => {
  if (!value) return '';
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens[0] || '';
};

const generateUniqueUsername = (base: string, existingUsernames: string[]) => {
  const sanitizedBase = sanitizeString(base) || 'usuario';
  const normalizedExisting = new Set(existingUsernames.map((u) => u.toLowerCase()));
  if (!normalizedExisting.has(sanitizedBase)) {
    return sanitizedBase;
  }
  let counter = 2;
  let candidate = `${sanitizedBase}${counter}`;
  while (normalizedExisting.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${sanitizedBase}${counter}`;
  }
  return candidate;
};

const generateDefaultPassword = (base: string) => {
  const sanitizedBase = sanitizeString(base) || 'clave';
  let password = `${sanitizedBase}123`;
  if (password.length < 6) {
    password = password.padEnd(6, '1');
  }
  return password;
};

const PERMISOS_DISPONIBLES = [
  { id: 'ver_reportes', label: 'Ver Reportes', roles: ['admin', 'supervisor', 'planner', 'jefe_taller'] },
  { id: 'crear_ot', label: 'Crear OT', roles: ['admin', 'planner', 'supervisor'] },
  { id: 'cerrar_ot', label: 'Cerrar OT', roles: ['admin', 'supervisor', 'jefe_taller'] },
  { id: 'ver_vehiculos', label: 'Ver Vehículos', roles: ['admin', 'planner', 'supervisor', 'jefe_taller'] },
  { id: 'editar_catalogos', label: 'Editar Catálogos', roles: ['admin'] },
  { id: 'ver_agenda', label: 'Ver Agenda', roles: ['admin', 'planner', 'supervisor', 'jefe_taller'] },
  { id: 'asignar_mecanicos', label: 'Asignar Mecánicos', roles: ['admin', 'supervisor', 'jefe_taller'] },
  { id: 'aprobar_diagnosticos', label: 'Aprobar Diagnósticos', roles: ['admin', 'supervisor'] },
  { id: 'gestionar_usuarios', label: 'Gestionar Usuarios', roles: ['admin'] },
  { id: 'registrar_avances', label: 'Registrar Avances', roles: ['mechanic'] },
  { id: 'agendar_diagnostico', label: 'Agendar Diagnóstico', roles: ['driver'] },
  { id: 'registrar_entradas_salidas', label: 'Registrar Entradas/Salidas', roles: ['guard'] },
];

export default function AdminDashboard({ activeSection = 'usuarios' }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [usuariosSupabaseRaw, setUsuariosSupabaseRaw] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [asignacionesActivas, setAsignacionesActivas] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [catalogos, setCatalogos] = useState<any>({
    categorias_vehiculos: [],
    modelos_vehiculo: [],
    tipos_vehiculo: [],
    tipos_falla: [],
    estados_ot: [],
    prioridades: [],
    zonas: [],
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChoferVehiculo, setModalChoferVehiculo] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [modalTipoFalla, setModalTipoFalla] = useState(false);
  const [modalPrioridad, setModalPrioridad] = useState(false);
  const [modalSucursal, setModalSucursal] = useState(false);
  const [modalNuevoUsuario, setModalNuevoUsuario] = useState(false);
  const [modalPasswordAuditoria, setModalPasswordAuditoria] = useState(false);
  const [modalResetPassword, setModalResetPassword] = useState(false);
  const [auditoriaAutenticada, setAuditoriaAutenticada] = useState(false);
  const [usuarioParaReset, setUsuarioParaReset] = useState<any | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedChofer, setSelectedChofer] = useState<any | null>(null);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<string>('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>('');
  const [selectedCategoriaIndex, setSelectedCategoriaIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'usuarios' | 'choferes'>('usuarios');
  const [usuariosAuditoria, setUsuariosAuditoria] = useState<any[]>([]);
  const [categoriaFormData, setCategoriaFormData] = useState({
    categoria: '',
    modelos: '',
    color: 'bg-blue-50 border-blue-200 text-blue-800'
  });
  const [nuevoTipoFalla, setNuevoTipoFalla] = useState('');
  const [prioridadFormData, setPrioridadFormData] = useState({
    value: '',
    label: ''
  });
  const [sucursalFormData, setSucursalFormData] = useState({
    nombre_sucursal: '',
    direccion_sucursal: '',
    comuna_sucursal: ''
  });
  const [agendaConfig, setAgendaConfig] = useState({
    hora_inicio: '07:30',
    hora_fin: '16:30',
    hora_inicio_colacion: '12:30',
    hora_fin_colacion: '13:15',
    duracion_diagnostico: '2',
    duracion_reparacion: '4',
    dias_habiles: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  });
  const [nuevoUsuarioForm, setNuevoUsuarioForm] = useState({
    usuario: '',
    clave: '',
    rol: 'driver',
    nombre_completo: '',
    rut: '',
    telefono: '',
    correo: ''
  });
  const [modalVehiculo, setModalVehiculo] = useState(false);
  const [vehiculoEditando, setVehiculoEditando] = useState<any | null>(null);
  const [vehiculoForm, setVehiculoForm] = useState({
    patente_vehiculo: '',
    estado_vehiculo: 'disponible',
    kilometraje_vehiculo: '',
    categoria_id: '',
    modelo_vehiculo_id: '',
    tipo_vehiculo_id: '',
    sucursal_id: '',
  });
  const [busquedaUsuarios, setBusquedaUsuarios] = useState('');
  const diasHabilesSet = new Set(agendaConfig.dias_habiles || []);

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

  const ensureCargoForRole = (role: string) => {
    const cargoName = getPreferredCargoName(role);
    if (!cargoName) return null;

    let cargosLocal = readLocal('apt_cargos', []);
    if (!Array.isArray(cargosLocal)) {
      cargosLocal = [];
    }

    let cargo = cargosLocal.find(
      (c: any) => (c.nombre_cargo || '').toLowerCase() === cargoName.toLowerCase()
    );

    if (!cargo) {
      cargo = {
        id_cargo: Date.now(),
        nombre_cargo: cargoName,
        descripcion_cargo: `Perfil automático para ${cargoName}`,
        created_at: new Date().toISOString(),
      };
      cargosLocal = [...cargosLocal, cargo];
      writeLocal('apt_cargos', cargosLocal);
    }

    return cargo;
  };

  const ensureProfileForUser = (usuario: any, empleado?: any | null) => {
    if (!usuario) return null;

    let perfilesLocal = readLocal('apt_perfiles_usuario', []);
    if (!Array.isArray(perfilesLocal)) {
      perfilesLocal = [];
    }

    const baseProfile = ROLE_PROFILES[usuario.rol] || ROLE_PROFILES.default;
    const nombreMostrado = empleado
      ? `${empleado.nombre || ''} ${empleado.apellido_paterno || ''}`.trim() ||
        capitalizeFirst(usuario.usuario || '')
      : capitalizeFirst(usuario.usuario || '');

    let perfil = perfilesLocal.find((p: any) => p.usuario_id === usuario.id_usuario);
    const perfilBaseData = {
      usuario_id: usuario.id_usuario,
      rol: usuario.rol,
      titulo: baseProfile.titulo,
      nombre_mostrado: nombreMostrado,
      landing_page: baseProfile.landing,
      modulos: baseProfile.modulos,
      widgets: baseProfile.widgets,
      actualizado_en: new Date().toISOString(),
    };

    if (!perfil) {
      perfil = {
        id_perfil: Date.now(),
        ...perfilBaseData,
        creado_en: new Date().toISOString(),
      };
      perfilesLocal = [...perfilesLocal, perfil];
      writeLocal('apt_perfiles_usuario', perfilesLocal);
    } else {
      const requiereActualizacion =
        perfil.rol !== perfilBaseData.rol ||
        perfil.nombre_mostrado !== perfilBaseData.nombre_mostrado ||
        perfil.landing_page !== perfilBaseData.landing_page ||
        JSON.stringify(perfil.modulos) !== JSON.stringify(perfilBaseData.modulos) ||
        JSON.stringify(perfil.widgets) !== JSON.stringify(perfilBaseData.widgets);

      if (requiereActualizacion) {
        perfil = { ...perfil, ...perfilBaseData };
        perfilesLocal = perfilesLocal.map((p: any) =>
          p.usuario_id === usuario.id_usuario ? perfil : p
        );
        writeLocal('apt_perfiles_usuario', perfilesLocal);
      }
    }

    return perfil;
  };

  const ensureCargoForRoleSupabase = async (role: string) => {
    if (!hasSupabase) {
      return ensureCargoForRole(role);
    }

    const cargoNames = ROLE_TO_CARGO_NAMES[role] || [];
    if (cargoNames.length === 0) return null;

    const normalize = (value: string) =>
      (value || '')
        .trim()
        .toLocaleLowerCase('es-ES')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    try {
      const fetchCargo = async () => {
        const {
          data: cargosData,
          error: cargosError,
        } = await supabase
          .from('cargo')
          .select('id_cargo, nombre_cargo, descripcion_cargo');

        if (cargosError) throw cargosError;

        const targets = cargoNames.map(normalize);
        return (
          (cargosData || []).find((cargo: any) =>
            targets.includes(normalize(cargo.nombre_cargo))
          ) ?? null
        );
      };

      let cargoData = await fetchCargo();

      if (!cargoData && cargoNames.length > 0) {
        const nombresParaCrear = cargoNames.map((nombre) => ({
          nombre_cargo: nombre,
          descripcion_cargo: `Perfil auto para ${nombre}`,
        }));

        const { data: insertData, error: insertError } = await supabase
          .from('cargo')
          .upsert(nombresParaCrear, {
            onConflict: 'nombre_cargo',
            ignoreDuplicates: false,
          })
          .select('id_cargo, nombre_cargo, descripcion_cargo');

        if (insertError) {
          if (insertError.code === '23505') {
            cargoData = await fetchCargo();
          } else {
            console.warn(
              `⚠️ No se pudo registrar el cargo "${cargoNames.join(
                ' / '
              )}". Verifica permisos en Supabase.`,
              insertError
            );
            return null;
          }
        } else {
          const targets = cargoNames.map(normalize);
          cargoData =
            (insertData || []).find((cargo: any) =>
              targets.includes(normalize(cargo.nombre_cargo))
            ) ?? null;
        }
      }

      if (!cargoData) {
        console.warn(
          `⚠️ Cargo "${cargoNames.join(
            ' / '
          )}" no encontrado incluso tras intentar crearlo.`
        );
      }

      return cargoData;
    } catch (error) {
      console.error('Error consultando/creando cargo para rol:', error);
      return null;
    }
  };

  const syncProfileForUserSupabase = async (usuarioRecord: any, empleadoRecord?: any | null) => {
    if (!hasSupabase) {
      return ensureProfileForUser(usuarioRecord, empleadoRecord);
    }

    if (!usuarioRecord) return;

    const baseProfile = ROLE_PROFILES[usuarioRecord.rol] || ROLE_PROFILES.default;
    const nombreMostrado = empleadoRecord
      ? `${empleadoRecord.nombre || ''} ${empleadoRecord.apellido_paterno || ''}`.trim() ||
        capitalizeFirst(usuarioRecord.usuario || '')
      : capitalizeFirst(usuarioRecord.usuario || '');

    try {
      await supabase.from('perfil_usuario').upsert(
        {
          usuario_id: usuarioRecord.id_usuario,
          rol: usuarioRecord.rol,
          titulo: baseProfile.titulo,
          landing_page: baseProfile.landing,
          modulos: baseProfile.modulos,
          widgets: baseProfile.widgets,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'usuario_id' }
      );
    } catch (error) {
      console.error('Error syncing profile for user:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (activeSection === 'usuarios') {
      loadUsuarios();
      loadChoferes();
      loadVehiculos();
    } else if (activeSection === 'vehiculos') {
      loadVehiculos();
      loadChoferes();
      loadCatalogos();
    } else if (activeSection === 'catalogos') {
      loadCatalogos();
    } else if (activeSection === 'flota') {
      loadVehiculos();
      loadCatalogos(); // Para el contador
    } else if (activeSection === 'agenda') {
      const configGuardada = readLocal('apt_config_agenda', null);
      if (configGuardada) {
        setAgendaConfig(configGuardada);
      }
    } else if (activeSection === 'auditoria') {
      // Resetear autenticación al cambiar a otra sección
      setAuditoriaAutenticada(false);
      // Solicitar contraseña para acceder a auditoría
      setModalPasswordAuditoria(true);
    }
  }, [activeSection]);

  // Recargar choferes cuando cambia el viewMode
  useEffect(() => {
    if (activeSection === 'usuarios' && viewMode === 'choferes') {
      loadChoferes();
    }
  }, [viewMode]);

  const loadUsuariosAuditoria = async () => {
    const guardarAsignacionLocal = () => {
      // Modo local (conservar lógica existente)
      const empleadosActuales = readLocal('apt_empleados', []);
      const empleadosActualizados = empleadosActuales.map((emp: any) => {
        if (emp.id_empleado === selectedChofer.id_empleado) {
          return {
            ...emp,
            vehiculo_asignado: vehiculoId,
            sucursal_id: sucursalId,
          };
        }
        return emp;
      });

      writeLocal('apt_empleados', empleadosActualizados);
      console.log('✅ Empleados actualizados (local):', empleadosActualizados);

      if (vehiculoId) {
        const vehiculosActuales = readLocal('apt_vehiculos', []);
        const vehiculosActualizados = vehiculosActuales.map((veh: any) => {
          if (veh.id_vehiculo === vehiculoId) {
            return { ...veh, empleado_asignado: selectedChofer.id_empleado };
          }
          if (veh.empleado_asignado === selectedChofer.id_empleado) {
            return { ...veh, empleado_asignado: null };
          }
          return veh;
        });

        writeLocal('apt_vehiculos', vehiculosActualizados);
        console.log('✅ Vehículos actualizados (local):', vehiculosActualizados);
      }

      alert('✅ Vehículo y sucursal asignados correctamente');
      setModalChoferVehiculo(false);
      setSelectedChofer(null);
      setVehiculoSeleccionado('');
      setSucursalSeleccionada('');
      loadChoferes();
    };

    if (hasSupabase) {
      try {
        if (usuariosSupabaseRaw.length === 0) {
          const { data, error } = await supabase
            .from('usuario')
            .select('id_usuario, usuario, clave, rol, estado_usuario, created_at')
            .order('created_at', { ascending: false });
          if (error) throw error;
          setUsuariosSupabaseRaw(data || []);
          setUsuariosAuditoria(data || []);
        } else {
          setUsuariosAuditoria(usuariosSupabaseRaw);
        }
      } catch (error) {
        console.error('Error loading usuarios auditoria:', error);
      }
      return;
    }

    setAsignacionesActivas([]);

    const usuariosLocal = readLocal('apt_usuarios', []);
    setUsuariosAuditoria(usuariosLocal);
  };

  const handleValidarPasswordAuditoria = async (password: string) => {
    if (password === 'admin123') {
      setAuditoriaAutenticada(true);
      setModalPasswordAuditoria(false);
      await loadUsuariosAuditoria();
    } else {
      alert('❌ Contraseña incorrecta. No tienes acceso a esta sección.');
      setModalPasswordAuditoria(false);
      setAuditoriaAutenticada(false);
    }
  };

  const loadUsuarios = async () => {
    try {
      setLoading(true);
      if (hasSupabase) {
        const [
          usuariosRes,
          empleadosRes,
          cargosRes,
        ] = await Promise.all([
          supabase
            .from('usuario')
            .select('id_usuario, usuario, clave, rol, estado_usuario, created_at')
            .order('created_at', { ascending: false }),
          supabase.from('empleado').select('*'),
          supabase.from('cargo').select('id_cargo, nombre_cargo'),
        ]);

        if (usuariosRes.error) throw usuariosRes.error;
        if (empleadosRes.error) throw empleadosRes.error;
        if (cargosRes.error) throw cargosRes.error;

        const usuariosData = usuariosRes.data || [];
        const empleadosData = empleadosRes.data || [];
        const cargosData = cargosRes.data || [];

        setUsuariosSupabaseRaw(usuariosData);
        setUsuariosAuditoria(usuariosData);
        setEmpleados(empleadosData);

        const empleadosMap = new Map(
          empleadosData.map((empleado: any) => [empleado.usuario_id, empleado])
        );
        const cargosMap = new Map(
          cargosData.map((cargo: any) => [cargo.id_cargo, cargo])
        );

        const usuariosEnriquecidos = usuariosData.map((usuarioItem: any) => {
          const empleado = empleadosMap.get(usuarioItem.id_usuario);
          const cargo = empleado ? cargosMap.get(empleado.cargo_id) : null;
          const nombreCompleto = empleado
            ? `${empleado.nombre || ''} ${empleado.apellido_paterno || ''}`.trim() ||
              usuarioItem.usuario
            : usuarioItem.usuario;

          return {
            ...usuarioItem,
            nombre_completo: nombreCompleto,
            rut: empleado?.rut || 'N/A',
            telefono: empleado?.telefono1 || empleado?.telefono2 || 'N/A',
            correo: empleado?.email || 'N/A',
            cargo_nombre: cargo?.nombre_cargo || null,
            empleado,
          };
        });

        const usuariosOrdenados = usuariosEnriquecidos.sort((a: any, b: any) => {
          const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return fechaB - fechaA;
        });

        setUsuarios(usuariosOrdenados);
        return;
      }

      const usuariosLocal = readLocal('apt_usuarios', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      
      setEmpleados(empleadosLocal);
      
      // Combinar usuarios con información de empleados
      const usuariosEnriquecidos = usuariosLocal.map((u: any) => {
        const empleado = empleadosLocal.find((e: any) => e.usuario_id === u.id_usuario);
        const perfil = ensureProfileForUser(u, empleado);
        
        return {
          ...u,
          nombre_completo: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : u.usuario,
          rut: empleado?.rut_empleado || 'N/A',
          telefono: empleado?.telefono_empleado || 'N/A',
          correo: empleado?.correo_empleado || 'N/A',
          empleado: empleado,
          perfil,
        };
      });
      
      const usuariosOrdenados = usuariosEnriquecidos.sort((a: any, b: any) => {
        const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA;
      });
      
      setUsuarios(usuariosOrdenados);
    } catch (error) {
      console.error('Error loading usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChoferes = async () => {
    try {
      if (hasSupabase) {
        const { data: usuariosData, error: usuariosError } = await supabase
          .from('usuario')
          .select('id_usuario, usuario, rol, estado_usuario, created_at')
          .eq('rol', 'driver');

        if (usuariosError) throw usuariosError;
        if (!usuariosData || usuariosData.length === 0) {
          setChoferes([]);
          return;
        }

        const usuarioIds = usuariosData.map((usuarioItem: any) => usuarioItem.id_usuario);

        const [{ data: empleadosData, error: empleadosError }] = await Promise.all([
          supabase.from('empleado').select('*').in('usuario_id', usuarioIds),
        ]);
        if (empleadosError) throw empleadosError;

        const empleadoIds = (empleadosData || []).map((empleado: any) => empleado.id_empleado);

        const [
          asignacionesRes,
          vehiculosRes,
          sucursalesRes,
        ] = empleadoIds.length
          ? await Promise.all([
              supabase
                .from('asignacion_vehiculo')
                .select('*')
                .eq('estado_asignacion', 'activo')
                .in('empleado_id', empleadoIds),
              supabase
                .from('vehiculo')
                .select('id_vehiculo, patente_vehiculo, kilometraje_vehiculo'),
              supabase
                .from('sucursal')
                .select('id_sucursal, nombre_sucursal'),
            ])
          : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

        if (asignacionesRes.error) throw asignacionesRes.error;
        if (vehiculosRes.error) throw vehiculosRes.error;
        if (sucursalesRes.error) throw sucursalesRes.error;

        setAsignacionesActivas(asignacionesRes.data || []);

        const empleadosMap = new Map(
          (empleadosData || []).map((empleado: any) => [empleado.usuario_id, empleado])
        );
        const asignacionMap = new Map(
          (asignacionesRes.data || []).map((asignacion: any) => [asignacion.empleado_id, asignacion])
        );
        const vehiculosMap = new Map(
          (vehiculosRes.data || []).map((vehiculo: any) => [vehiculo.id_vehiculo, vehiculo])
        );
        const sucursalesMap = new Map(
          (sucursalesRes.data || []).map((sucursal: any) => [sucursal.id_sucursal, sucursal])
        );

        const choferesEnriquecidos = usuariosData.map((usuarioItem: any) => {
          const empleado = empleadosMap.get(usuarioItem.id_usuario);
          const asignacion = empleado ? asignacionMap.get(empleado.id_empleado) : null;
          const vehiculo = asignacion ? vehiculosMap.get(asignacion.vehiculo_id) : null;
          const sucursal = asignacion && asignacion.sucursal_id
            ? sucursalesMap.get(asignacion.sucursal_id)
            : null;

          const nombreCompleto = empleado
            ? `${empleado.nombre || ''} ${empleado.apellido_paterno || ''}`.trim() ||
              usuarioItem.usuario
            : usuarioItem.usuario;

          const kilometrajePromedio = vehiculo?.kilometraje_vehiculo
            ? Number(vehiculo.kilometraje_vehiculo)
            : null;

          return {
            ...usuarioItem,
            id_empleado: empleado?.id_empleado,
            nombre_completo: nombreCompleto,
            rut: empleado?.rut || 'N/A',
            telefono: empleado?.telefono1 || empleado?.telefono2 || 'N/A',
            correo: empleado?.email || 'N/A',
            zona: sucursal?.nombre_sucursal || 'N/A',
            asignacion_id: asignacion?.id_asignacion || null,
            sucursal_id: asignacion?.sucursal_id || null,
            vehiculo_asignado: vehiculo?.patente_vehiculo || 'Sin asignar',
            vehiculo_id: vehiculo?.id_vehiculo || null,
            kilometraje_promedio: kilometrajePromedio
              ? `${Math.floor(kilometrajePromedio / 12).toLocaleString('es-ES')} km/mes`
              : 'N/A',
          };
        });

        const choferesOrdenados = choferesEnriquecidos.sort((a: any, b: any) => {
          const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return fechaB - fechaA;
        });

        setChoferes(choferesOrdenados);
        return;
      }

      const usuariosLocal = readLocal('apt_usuarios', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      const sucursalesLocal = readLocal('apt_sucursales', []);
      
      const choferesUsuarios = usuariosLocal.filter((u: any) => u.rol === 'driver');
      
      const choferesEnriquecidos = choferesUsuarios.map((u: any) => {
        const empleado = empleadosLocal.find((e: any) => e.usuario_id === u.id_usuario);
        const sucursal = empleado ? sucursalesLocal.find((s: any) => s.id_sucursal === empleado.sucursal_id) : null;
        
        const vehiculoAsignadoId = empleado?.vehiculo_asignado;
        const vehiculoAsignado = vehiculoAsignadoId 
          ? vehiculosLocal.find((v: any) => v.id_vehiculo === vehiculoAsignadoId)
          : null;
        
        return {
          ...u,
          id_empleado: empleado?.id_empleado,
          nombre_completo: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : u.usuario,
          rut: empleado?.rut_empleado || 'N/A',
          telefono: empleado?.telefono_empleado || 'N/A',
          correo: empleado?.correo_empleado || 'N/A',
          zona: sucursal?.nombre_sucursal || 'N/A',
          vehiculo_asignado: vehiculoAsignado?.patente_vehiculo || 'Sin asignar',
          vehiculo_id: vehiculoAsignado?.id_vehiculo || null,
          kilometraje_promedio: vehiculoAsignado?.kilometraje_vehiculo 
            ? `${Math.floor(vehiculoAsignado.kilometraje_vehiculo / 12).toLocaleString('es-ES')} km/mes`
            : 'N/A',
        };
      });
      
      const choferesOrdenados = choferesEnriquecidos.sort((a: any, b: any) => {
        const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA;
      });
      
      setChoferes(choferesOrdenados);
    } catch (error) {
      console.error('Error loading choferes:', error);
    }
  };

  const loadVehiculos = async () => {
    try {
      if (hasSupabase) {
        const { data, error } = await supabase
          .from('vehiculo')
          .select(`
            id_vehiculo,
            patente_vehiculo,
            estado_vehiculo,
            kilometraje_vehiculo,
            modelo_vehiculo_id,
            tipo_vehiculo_id,
            sucursal_id,
            created_at,
            modelo_vehiculo:modelo_vehiculo_id (
              id_modelo_vehiculo,
              nombre_modelo,
              marca_vehiculo:marca_vehiculo_id (
                id_marca_vehiculo,
                nombre_marca
              )
            ),
            tipo_vehiculo:tipo_vehiculo_id (
              id_tipo_vehiculo,
              tipo_vehiculo
            ),
            sucursal:sucursal_id (
              id_sucursal,
              nombre_sucursal,
              comuna_sucursal
            ),
            categoria_vehiculo:categoria_vehiculo_id (
              id_categoria_vehiculo,
              nombre_categoria
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const vehiculosFormateados =
          (data || []).map((vehiculo: any) => ({
            id_vehiculo: vehiculo.id_vehiculo,
            patente_vehiculo: vehiculo.patente_vehiculo,
            estado_vehiculo: vehiculo.estado_vehiculo,
            kilometraje_vehiculo:
              vehiculo.kilometraje_vehiculo !== null && vehiculo.kilometraje_vehiculo !== undefined
                ? Number(vehiculo.kilometraje_vehiculo)
                : null,
            modelo_vehiculo_id: vehiculo.modelo_vehiculo_id,
            tipo_vehiculo_id: vehiculo.tipo_vehiculo_id,
            sucursal_id: vehiculo.sucursal_id,
            categoria_vehiculo_id: vehiculo.categoria_vehiculo?.id_categoria_vehiculo || null,
            created_at: vehiculo.created_at,
            modelo_nombre: vehiculo.modelo_vehiculo?.nombre_modelo || null,
            marca_nombre:
              vehiculo.modelo_vehiculo?.marca_vehiculo?.nombre_marca || null,
            tipo_nombre: vehiculo.tipo_vehiculo?.tipo_vehiculo || null,
            sucursal_nombre: vehiculo.sucursal?.nombre_sucursal || null,
            sucursal_comuna: vehiculo.sucursal?.comuna_sucursal || null,
            categoria_nombre: vehiculo.categoria_vehiculo?.nombre_categoria || null,
          })) || [];

        setVehiculos(vehiculosFormateados);
        return;
      }

      const vehiculosLocal = readLocal('apt_vehiculos', []);

      // Ordenar por fecha de creación (más recientes primero)
      const vehiculosOrdenados = vehiculosLocal.sort((a: any, b: any) => {
        const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA; // Más reciente primero
      });

      setVehiculos(vehiculosOrdenados);
    } catch (error) {
      console.error('Error loading vehiculos:', error);
    }
  };

  const handleAsignarVehiculo = (chofer: any) => {
    // Cargar catálogos si no están cargados (para tener las sucursales disponibles)
    if (!catalogos.zonas || catalogos.zonas.length === 0) {
      loadCatalogos();
    }

    setSelectedChofer(chofer);
    setVehiculoSeleccionado(chofer.vehiculo_id ? chofer.vehiculo_id.toString() : '');

    if (hasSupabase) {
      setSucursalSeleccionada(
        chofer.sucursal_id ? chofer.sucursal_id.toString() : ''
      );
    } else {
      const empleados = readLocal('apt_empleados', []);
      const empleado = empleados.find((e: any) => e.id_empleado === chofer.id_empleado);
      setSucursalSeleccionada(
        empleado?.sucursal_id ? empleado.sucursal_id.toString() : ''
      );
    }

    setModalChoferVehiculo(true);
  };

  const getVehiculosDisponibles = () => {
    if (hasSupabase) {
      const asignados = asignacionesActivas
        .filter(
          (asignacion: any) =>
            asignacion.estado_asignacion === 'activo' &&
            asignacion.empleado_id !== selectedChofer?.id_empleado
        )
        .map((asignacion: any) => asignacion.vehiculo_id);

      return vehiculos.filter(
        (vehiculo: any) =>
          !asignados.includes(vehiculo.id_vehiculo) ||
          vehiculo.id_vehiculo === selectedChofer?.vehiculo_id
      );
    }

    const empleadosActuales = readLocal('apt_empleados', []);

    // IDs de vehículos ya asignados a otros empleados (excepto el empleado actual)
    const vehiculosAsignados = empleadosActuales
      .filter(
        (emp: any) =>
          emp.vehiculo_asignado && emp.id_empleado !== selectedChofer?.id_empleado
      )
      .map((emp: any) => emp.vehiculo_asignado);

    // Filtrar vehículos: excluir los ya asignados, pero incluir el actual del chofer
    return vehiculos.filter(
      (v: any) =>
        !vehiculosAsignados.includes(v.id_vehiculo) ||
        v.id_vehiculo === selectedChofer?.vehiculo_id
    );
  };

  const handleGuardarAsignacion = async () => {
    if (!selectedChofer) return;

    const vehiculoId = vehiculoSeleccionado ? parseInt(vehiculoSeleccionado, 10) : null;
    const sucursalId = sucursalSeleccionada ? parseInt(sucursalSeleccionada, 10) : null;

    console.log('💾 Guardando asignación:', {
      chofer: selectedChofer.usuario,
      empleado_id: selectedChofer.id_empleado,
      vehiculo_id: vehiculoId,
      sucursal_id: sucursalId,
    });

    if (hasSupabase) {
      if (!selectedChofer.id_empleado) {
        alert('❌ No se encontró el empleado asociado al chofer.');
        return;
      }

      try {
        setLoading(true);
        const empleadoId = selectedChofer.id_empleado;
        const ahora = new Date().toISOString();

        const asignacionActual = asignacionesActivas.find(
          (asignacion: any) =>
            asignacion.empleado_id === empleadoId &&
            asignacion.estado_asignacion === 'activo'
        );

        // Si se selecciona un nuevo vehículo, liberar cualquier asignación activa que lo use
        if (vehiculoId) {
          const asignacionesConflicto = asignacionesActivas.filter(
            (asignacion: any) =>
              asignacion.estado_asignacion === 'activo' &&
              asignacion.vehiculo_id === vehiculoId &&
              asignacion.empleado_id !== empleadoId
          );

          if (asignacionesConflicto.length > 0) {
            const { error: conflictoError } = await supabase
              .from('asignacion_vehiculo')
              .update({
                estado_asignacion: 'finalizado',
                fecha_fin: ahora,
              })
              .in(
                'id_asignacion',
                asignacionesConflicto.map((a: any) => a.id_asignacion)
              );

            if (conflictoError) throw conflictoError;
          }
        }

        // Cerrar la asignación actual si se elimina el vehículo o cambia a uno nuevo
        if (asignacionActual && (!vehiculoId || asignacionActual.vehiculo_id !== vehiculoId)) {
          const { error: cerrarError } = await supabase
            .from('asignacion_vehiculo')
            .update({
              estado_asignacion: 'finalizado',
              fecha_fin: ahora,
            })
            .eq('id_asignacion', asignacionActual.id_asignacion);

          if (cerrarError) throw cerrarError;
        }

        if (vehiculoId) {
          if (asignacionActual && asignacionActual.vehiculo_id === vehiculoId) {
            const { error: updateError } = await supabase
              .from('asignacion_vehiculo')
              .update({
                sucursal_id: sucursalId,
                fecha_fin: null,
                estado_asignacion: 'activo',
              })
              .eq('id_asignacion', asignacionActual.id_asignacion);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('asignacion_vehiculo')
              .insert({
                empleado_id: empleadoId,
                vehiculo_id: vehiculoId,
                sucursal_id: sucursalId,
                estado_asignacion: 'activo',
                fecha_asignacion: ahora,
              });

            if (insertError) throw insertError;
          }
        }

        alert('✅ Vehículo y sucursal asignados correctamente');
        setModalChoferVehiculo(false);
        setSelectedChofer(null);
        setVehiculoSeleccionado('');
        setSucursalSeleccionada('');
        await Promise.all([loadChoferes(), loadVehiculos()]);
      } catch (error: any) {
        console.error('Error guardando asignación en Supabase:', error);
        const mensajeError = error?.message || '';
        const esPoliticaRLS =
          mensajeError.toLowerCase().includes('row-level security') ||
          mensajeError.toLowerCase().includes('permission denied');

        if (esPoliticaRLS) {
          console.warn('⚠️ Error de RLS al guardar en Supabase. Aplicando modo local.', error);
          alert('⚠️ No se pudo guardar en la base de datos remota (políticas de seguridad). Se guardará en modo local.');
          guardarAsignacionLocal();
        } else {
          alert(`❌ No se pudo guardar la asignación: ${mensajeError || 'Revisa la consola.'}`);
        }
      } finally {
        setLoading(false);
      }

      return;
    }

    guardarAsignacionLocal();
  };

  const handleAgregarCategoria = () => {
    setSelectedCategoriaIndex(null);
    setCategoriaFormData({
      categoria: '',
      modelos: '',
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    });
    setModalCategoria(true);
  };

  const handleEditarCategoria = (categoria: any, index: number) => {
    setSelectedCategoriaIndex(index);
    setCategoriaFormData({
      categoria: categoria.categoria,
      modelos: categoria.modelos.join(', '),
      color: categoria.color
    });
    setModalCategoria(true);
  };

  const handleGuardarCategoria = () => {
    if (!categoriaFormData.categoria || !categoriaFormData.modelos) {
      alert('Por favor completa todos los campos');
      return;
    }

    const modelosArray = categoriaFormData.modelos
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (modelosArray.length === 0) {
      alert('Por favor ingresa al menos un modelo');
      return;
    }

    const categoriaData = {
      categoria: categoriaFormData.categoria,
      modelos: modelosArray,
      color: categoriaFormData.color
    };

    const categoriasActuales = catalogos.categorias_vehiculos || [];
    let categoriasActualizadas;

    if (selectedCategoriaIndex !== null) {
      // Editar categoría existente
      categoriasActualizadas = [...categoriasActuales];
      categoriasActualizadas[selectedCategoriaIndex] = categoriaData;
      alert('✅ Categoría actualizada exitosamente');
    } else {
      // Agregar nueva categoría
      categoriasActualizadas = [...categoriasActuales, categoriaData];
      alert('✅ Categoría agregada exitosamente');
    }
    
    // Guardar en localStorage
    writeLocal('apt_categorias_vehiculos', categoriasActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      categorias_vehiculos: categoriasActualizadas
    });

    setModalCategoria(false);
    setSelectedCategoriaIndex(null);
    setCategoriaFormData({
      categoria: '',
      modelos: '',
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    });
  };

  const handleAgregarTipoFalla = () => {
    setNuevoTipoFalla('');
    setModalTipoFalla(true);
  };

  const handleGuardarTipoFalla = () => {
    if (!nuevoTipoFalla.trim()) {
      alert('Por favor ingresa un tipo de falla');
      return;
    }

    const tipoFallaFormateado = nuevoTipoFalla.trim();
    const tiposFallaActuales = catalogos.tipos_falla || [];

    // Verificar si ya existe
    if (tiposFallaActuales.includes(tipoFallaFormateado)) {
      alert('Este tipo de falla ya existe');
      return;
    }

    const tiposFallaActualizados = [...tiposFallaActuales, tipoFallaFormateado];
    
    // Guardar en localStorage
    writeLocal('apt_tipos_falla', tiposFallaActualizados);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      tipos_falla: tiposFallaActualizados
    });

    alert('✅ Tipo de falla agregado exitosamente');
    setModalTipoFalla(false);
    setNuevoTipoFalla('');
  };

  const handleEliminarTipoFalla = (tipoFalla: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${tipoFalla}"?`)) {
      return;
    }

    const tiposFallaActuales = catalogos.tipos_falla || [];
    const tiposFallaActualizados = tiposFallaActuales.filter((tipo: string) => tipo !== tipoFalla);
    
    // Guardar en localStorage
    writeLocal('apt_tipos_falla', tiposFallaActualizados);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      tipos_falla: tiposFallaActualizados
    });

    alert('✅ Tipo de falla eliminado exitosamente');
  };

  const handleAgregarPrioridad = () => {
    setPrioridadFormData({
      value: '',
      label: ''
    });
    setModalPrioridad(true);
  };

  const handleGuardarPrioridad = () => {
    if (!prioridadFormData.value.trim() || !prioridadFormData.label.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    const prioridadesActuales = catalogos.prioridades || [];

    // Verificar si ya existe
    const existeValue = prioridadesActuales.some((p: any) => p.value === prioridadFormData.value);
    if (existeValue) {
      alert('Ya existe una prioridad con ese valor');
      return;
    }

    const nuevaPrioridad = {
      value: prioridadFormData.value.trim(),
      label: prioridadFormData.label.trim()
    };

    const prioridadesActualizadas = [...prioridadesActuales, nuevaPrioridad];
    
    // Guardar en localStorage
    writeLocal('apt_prioridades', prioridadesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      prioridades: prioridadesActualizadas
    });

    alert('✅ Prioridad agregada exitosamente');
    setModalPrioridad(false);
    setPrioridadFormData({
      value: '',
      label: ''
    });
  };

  const handleEliminarPrioridad = (prioridad: any) => {
    if (!confirm(`¿Estás seguro de eliminar la prioridad "${prioridad.label}"?`)) {
      return;
    }

    const prioridadesActuales = catalogos.prioridades || [];
    const prioridadesActualizadas = prioridadesActuales.filter((p: any) => p.value !== prioridad.value);
    
    // Guardar en localStorage
    writeLocal('apt_prioridades', prioridadesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      prioridades: prioridadesActualizadas
    });

    alert('✅ Prioridad eliminada exitosamente');
  };

  const handleAgregarSucursal = () => {
    setSucursalFormData({
      nombre_sucursal: '',
      direccion_sucursal: '',
      comuna_sucursal: ''
    });
    setModalSucursal(true);
  };

  const handleGuardarSucursal = () => {
    if (!sucursalFormData.nombre_sucursal.trim() || !sucursalFormData.direccion_sucursal.trim() || !sucursalFormData.comuna_sucursal.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    const sucursalesActuales = catalogos.zonas || [];

    const nuevaSucursal = {
      id_sucursal: Date.now(), // Generar ID único
      nombre_sucursal: sucursalFormData.nombre_sucursal.trim(),
      direccion_sucursal: sucursalFormData.direccion_sucursal.trim(),
      comuna_sucursal: sucursalFormData.comuna_sucursal.trim()
    };

    const sucursalesActualizadas = [...sucursalesActuales, nuevaSucursal];
    
    // Guardar en localStorage
    writeLocal('apt_sucursales', sucursalesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      zonas: sucursalesActualizadas
    });

    alert('✅ Sucursal agregada exitosamente');
    setModalSucursal(false);
    setSucursalFormData({
      nombre_sucursal: '',
      direccion_sucursal: '',
      comuna_sucursal: ''
    });
  };

  const handleEliminarSucursal = (sucursal: any) => {
    if (!confirm(`¿Estás seguro de eliminar la sucursal "${sucursal.nombre_sucursal}"?`)) {
      return;
    }

    const sucursalesActuales = catalogos.zonas || [];
    const sucursalesActualizadas = sucursalesActuales.filter((s: any) => s.id_sucursal !== sucursal.id_sucursal);
    
    // Guardar en localStorage
    writeLocal('apt_sucursales', sucursalesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      zonas: sucursalesActualizadas
    });

    alert('✅ Sucursal eliminada exitosamente');
  };

  const handleAgregarVehiculo = async () => {
    if (hasSupabase) {
      const needsReload =
        !catalogos.categorias_vehiculos?.length ||
        !catalogos.modelos_vehiculo?.length ||
        !catalogos.tipos_vehiculo?.length ||
        !catalogos.zonas?.length;
      if (needsReload) {
        await loadCatalogos();
      }
    } else if (!catalogos.categorias_vehiculos || catalogos.categorias_vehiculos.length === 0) {
      loadCatalogos();
    }

    setVehiculoEditando(null);
    setVehiculoForm({
      patente_vehiculo: '',
      estado_vehiculo: 'disponible',
      kilometraje_vehiculo: '',
      categoria_id: '',
      modelo_vehiculo_id: '',
      tipo_vehiculo_id: '',
      sucursal_id: '',
    });
    setModalVehiculo(true);
  };

  const handleEditarVehiculo = async (vehiculo: any) => {
    if (hasSupabase) {
      const needsReload =
        !catalogos.categorias_vehiculos?.length ||
        !catalogos.modelos_vehiculo?.length ||
        !catalogos.tipos_vehiculo?.length ||
        !catalogos.zonas?.length;
      if (needsReload) {
        await loadCatalogos();
      }
    } else if (!catalogos.categorias_vehiculos || catalogos.categorias_vehiculos.length === 0) {
      loadCatalogos();
    }

    const estadoNormalizado =
      vehiculo.estado_vehiculo === 'en_uso'
        ? 'en ruta'
        : vehiculo.estado_vehiculo === 'en_mantenimiento' || vehiculo.estado_vehiculo === 'fuera_servicio'
        ? 'mantenimiento'
        : vehiculo.estado_vehiculo || 'disponible';

    setVehiculoEditando(vehiculo);
    setVehiculoForm({
      patente_vehiculo: vehiculo.patente_vehiculo,
      estado_vehiculo: estadoNormalizado,
      kilometraje_vehiculo: vehiculo.kilometraje_vehiculo?.toString() || '',
      categoria_id: vehiculo.categoria_vehiculo_id
        ? String(vehiculo.categoria_vehiculo_id)
        : vehiculo.categoria
        ? vehiculo.categoria
        : '',
      modelo_vehiculo_id: vehiculo.modelo_vehiculo_id
        ? String(vehiculo.modelo_vehiculo_id)
        : '',
      tipo_vehiculo_id: vehiculo.tipo_vehiculo_id
        ? String(vehiculo.tipo_vehiculo_id)
        : '',
      sucursal_id: vehiculo.sucursal_id ? String(vehiculo.sucursal_id) : '',
    });
    setModalVehiculo(true);
  };

  const handleGuardarVehiculo = async () => {
    if (!vehiculoForm.patente_vehiculo) {
      alert('Por favor ingresa la patente del vehículo');
      return;
    }

    const patenteNormalizada = vehiculoForm.patente_vehiculo.toUpperCase().trim();

    if (!vehiculoForm.modelo_vehiculo_id || !vehiculoForm.tipo_vehiculo_id || !vehiculoForm.sucursal_id) {
      alert('Por favor selecciona modelo, tipo y sucursal para el vehículo.');
      return;
    }

    const kilometraje = vehiculoForm.kilometraje_vehiculo
      ? Number(vehiculoForm.kilometraje_vehiculo)
      : null;

    if (hasSupabase) {
      try {
        setLoading(true);

        const { data: existente, error: existenteError } = await supabase
          .from('vehiculo')
          .select('id_vehiculo')
          .eq('patente_vehiculo', patenteNormalizada)
          .maybeSingle();

        if (existenteError) throw existenteError;

        if (
          existente &&
          (!vehiculoEditando || existente.id_vehiculo !== vehiculoEditando.id_vehiculo)
        ) {
          alert('❌ Ya existe un vehículo con esta patente.');
          return;
        }

        const payload: any = {
          patente_vehiculo: patenteNormalizada,
          estado_vehiculo: vehiculoForm.estado_vehiculo,
          kilometraje_vehiculo: kilometraje,
          modelo_vehiculo_id: Number(vehiculoForm.modelo_vehiculo_id),
          tipo_vehiculo_id: Number(vehiculoForm.tipo_vehiculo_id),
          sucursal_id: Number(vehiculoForm.sucursal_id),
          categoria_vehiculo_id: vehiculoForm.categoria_id
            ? Number(vehiculoForm.categoria_id)
            : null,
        };

        if (vehiculoEditando) {
          const { error: updateError } = await supabase
            .from('vehiculo')
            .update(payload)
            .eq('id_vehiculo', vehiculoEditando.id_vehiculo);

          if (updateError) throw updateError;
          alert('✅ Vehículo actualizado exitosamente');
        } else {
          const { error: insertError } = await supabase
            .from('vehiculo')
            .insert(payload);

          if (insertError) throw insertError;
          alert('✅ Vehículo agregado exitosamente');
        }
      } catch (error: any) {
        console.error('Error guardando vehículo en Supabase:', error);
        alert(`❌ No se pudo guardar el vehículo: ${error.message || 'Revisa la consola.'}`);
        return;
      } finally {
        setLoading(false);
      }

      setModalVehiculo(false);
      setVehiculoEditando(null);
      await Promise.all([loadVehiculos(), loadChoferes()]);
      return;
    }

    // Fallback localStorage
    const vehiculosActuales = readLocal('apt_vehiculos', []);

    if (vehiculoEditando) {
      if (patenteNormalizada !== vehiculoEditando.patente_vehiculo) {
        const patenteExiste = vehiculosActuales.some(
          (v: any) =>
            v.patente_vehiculo?.toUpperCase() === patenteNormalizada &&
            v.id_vehiculo !== vehiculoEditando.id_vehiculo
        );

        if (patenteExiste) {
          alert('❌ Ya existe otro vehículo con esta patente.');
          return;
        }
      }

      const vehiculosActualizados = vehiculosActuales.map((v: any) => {
        if (v.id_vehiculo === vehiculoEditando.id_vehiculo) {
          return {
            ...v,
            patente_vehiculo: patenteNormalizada,
            estado_vehiculo: vehiculoForm.estado_vehiculo,
            kilometraje_vehiculo: kilometraje || 0,
            categoria: vehiculoForm.categoria_id || 'Sin categoría',
            modelo_vehiculo_id: vehiculoForm.modelo_vehiculo_id
              ? Number(vehiculoForm.modelo_vehiculo_id)
              : v.modelo_vehiculo_id,
            tipo_vehiculo_id: vehiculoForm.tipo_vehiculo_id
              ? Number(vehiculoForm.tipo_vehiculo_id)
              : v.tipo_vehiculo_id,
            sucursal_id: vehiculoForm.sucursal_id
              ? Number(vehiculoForm.sucursal_id)
              : v.sucursal_id,
          };
        }
        return v;
      });

      writeLocal('apt_vehiculos', vehiculosActualizados);
      alert('✅ Vehículo actualizado exitosamente');
    } else {
      const patenteExiste = vehiculosActuales.some(
        (v: any) => v.patente_vehiculo?.toUpperCase() === patenteNormalizada
      );

      if (patenteExiste) {
        alert('❌ Ya existe un vehículo con esta patente.');
        return;
      }

      const nuevoVehiculo = {
        id_vehiculo: Date.now(),
        patente_vehiculo: patenteNormalizada,
        estado_vehiculo: vehiculoForm.estado_vehiculo,
        kilometraje_vehiculo: kilometraje || 0,
        categoria: vehiculoForm.categoria_id || 'Sin categoría',
        modelo_vehiculo_id: vehiculoForm.modelo_vehiculo_id
          ? Number(vehiculoForm.modelo_vehiculo_id)
          : 1,
        tipo_vehiculo_id: vehiculoForm.tipo_vehiculo_id
          ? Number(vehiculoForm.tipo_vehiculo_id)
          : 1,
        sucursal_id: vehiculoForm.sucursal_id ? Number(vehiculoForm.sucursal_id) : 1,
        created_at: new Date().toISOString(),
      };

      const vehiculosActualizados = [...vehiculosActuales, nuevoVehiculo];
      writeLocal('apt_vehiculos', vehiculosActualizados);
      alert('✅ Vehículo agregado exitosamente');
    }

    setModalVehiculo(false);
    setVehiculoEditando(null);
    loadVehiculos();
    loadChoferes();
  };

  const handleEliminarVehiculo = async (vehiculo: any) => {
    if (!confirm(`¿Estás seguro de eliminar el vehículo "${vehiculo.patente_vehiculo}"?`)) {
      return;
    }

    if (hasSupabase) {
      try {
        setLoading(true);

        const ahora = new Date().toISOString();

        const { error: cerrarAsignacionesError } = await supabase
          .from('asignacion_vehiculo')
          .update({
            estado_asignacion: 'finalizado',
            fecha_fin: ahora,
          })
          .eq('vehiculo_id', vehiculo.id_vehiculo)
          .eq('estado_asignacion', 'activo');

        if (cerrarAsignacionesError) throw cerrarAsignacionesError;

        const { error: deleteError } = await supabase
          .from('vehiculo')
          .delete()
          .eq('id_vehiculo', vehiculo.id_vehiculo);

        if (deleteError) throw deleteError;

        alert('✅ Vehículo eliminado exitosamente');
        await Promise.all([loadVehiculos(), loadChoferes()]);
      } catch (error: any) {
        console.error('Error eliminando vehículo en Supabase:', error);
        alert(`❌ No se pudo eliminar el vehículo: ${error.message || 'Revisa la consola.'}`);
      } finally {
        setLoading(false);
      }

      return;
    }

    const vehiculosActuales = readLocal('apt_vehiculos', []);
    const vehiculosActualizados = vehiculosActuales.filter((v: any) => v.id_vehiculo !== vehiculo.id_vehiculo);
    
    // Si el vehículo estaba asignado, limpiar la asignación del empleado
    if (vehiculo.empleado_asignado) {
      const empleadosActuales = readLocal('apt_empleados', []);
      const empleadosActualizados = empleadosActuales.map((emp: any) => {
        if (emp.id_empleado === vehiculo.empleado_asignado) {
          return { ...emp, vehiculo_asignado: null };
        }
        return emp;
      });
      writeLocal('apt_empleados', empleadosActualizados);
    }
    
    writeLocal('apt_vehiculos', vehiculosActualizados);
    alert('✅ Vehículo eliminado exitosamente');
    loadVehiculos();
    loadChoferes(); // Actualizar también la vista de Choferes y Vehículos
  };

  const handleGuardarConfigAgenda = () => {
    const password = prompt('Por favor ingresa la contraseña de administrador para guardar la configuración:');
    
    if (!password) {
      return; // Usuario canceló
    }
    
    // Validar contraseña del admin
    if (password !== 'admin123') {
      alert('❌ Contraseña incorrecta. No se guardó la configuración.');
      return;
    }
    
    // Si la contraseña es correcta, guardar
    writeLocal('apt_config_agenda', agendaConfig);
    alert('✅ Configuración de agenda guardada exitosamente');
  };

  const handleAgregarNuevoUsuario = () => {
    setNuevoUsuarioForm({
      usuario: '',
      clave: '',
      rol: 'driver',
      nombre_completo: '',
      rut: '',
      telefono: '',
      correo: ''
    });
    setModalNuevoUsuario(true);
  };

  const handleGuardarNuevoUsuario = async () => {
    console.log('🔵 Intentando crear usuario:', nuevoUsuarioForm);

    if (hasSupabase) {
      try {
        setLoading(true);

        const { data: usernamesData, error: usernamesError } = await supabase
          .from('usuario')
          .select('usuario');
        if (usernamesError) throw usernamesError;

        const existingUsernames = (usernamesData || []).map((u: any) =>
          (u.usuario || '').toLowerCase()
        );

        const primaryToken =
          extractPrimaryToken(nuevoUsuarioForm.nombre_completo) ||
          nuevoUsuarioForm.usuario ||
          nuevoUsuarioForm.rol ||
          'usuario';

        let username = (nuevoUsuarioForm.usuario || '').trim();
        let usernameGenerado = false;
        if (!username) {
          username = generateUniqueUsername(primaryToken, existingUsernames);
          username = capitalizeFirst(username);
          usernameGenerado = true;
        } else {
          username = username.trim();
        }

        if (existingUsernames.includes(username.toLowerCase())) {
          alert('❌ Este nombre de usuario ya existe. Por favor elige otro.');
          return;
        }

        let password = (nuevoUsuarioForm.clave || '').trim();
        let passwordGenerada = false;
        if (!password) {
          password = generateDefaultPassword(primaryToken || username);
          passwordGenerada = true;
        }

        const { data: usuarioInsertado, error: usuarioError } = await supabase
          .from('usuario')
          .insert({
            usuario: username,
            clave: password,
            rol: nuevoUsuarioForm.rol,
            estado_usuario: true,
          })
          .select('id_usuario, usuario, rol, created_at')
          .single();

        if (usuarioError) {
          throw usuarioError;
        }

        const [nombre, ...apellidos] = nuevoUsuarioForm.nombre_completo
          ? nuevoUsuarioForm.nombre_completo.trim().split(/\s+/).filter(Boolean)
          : [capitalizeFirst(username)];

        const apellidoPaterno = apellidos[0] || '';
        const apellidoMaterno = apellidos[1] || '';

        const cargoAsociado = await ensureCargoForRoleSupabase(nuevoUsuarioForm.rol);
        if (!cargoAsociado) {
          alert(
            `⚠️ No pudimos asociar un cargo para el rol "${nuevoUsuarioForm.rol}". ` +
              `Verifica que el catálogo de cargos en Supabase permita lectura/escritura y que el rol tenga un nombre equivalente.`
          );
          setLoading(false);
          return;
        }

        const { data: empleadoInsertado, error: empleadoError } = await supabase
          .from('empleado')
          .insert({
            nombre: nombre || capitalizeFirst(username),
            apellido_paterno: apellidoPaterno,
            apellido_materno: apellidoMaterno,
            rut: nuevoUsuarioForm.rut || null,
            email: nuevoUsuarioForm.correo || null,
            telefono1: nuevoUsuarioForm.telefono || null,
            cargo_id: cargoAsociado.id_cargo,
            usuario_id: usuarioInsertado.id_usuario,
            estado_empleado: 'activo',
          })
          .select('*')
          .single();

        if (empleadoError) {
          throw empleadoError;
        }

        await syncProfileForUserSupabase(usuarioInsertado, empleadoInsertado);

        await supabase.from('auditoria_usuario').insert({
          usuario_id: usuarioInsertado.id_usuario,
          accion: 'create',
          detalle: `Usuario creado desde panel (rol ${nuevoUsuarioForm.rol})`,
        });

        const mensajes: string[] = ['✅ Usuario creado exitosamente.'];
        mensajes.push(`Credenciales: ${username} / ${password}`);
        if (cargoAsociado) {
          mensajes.push(`Perfil asignado: ${cargoAsociado.nombre_cargo}`);
        }
        if (usernameGenerado || passwordGenerada) {
          mensajes.push(
            '💡 Credenciales generadas automáticamente. Puedes modificarlas luego desde la administración.'
          );
        }

        alert(mensajes.join('\n'));
        setModalNuevoUsuario(false);
        setNuevoUsuarioForm({
          usuario: '',
          clave: '',
          rol: 'driver',
          nombre_completo: '',
          rut: '',
          telefono: '',
          correo: '',
        });

        await Promise.all([loadUsuarios(), loadUsuariosAuditoria(), loadChoferes()]);
        return;
      } catch (error: any) {
        console.error('Error creating usuario in Supabase:', error);
        alert(
          `❌ Error al crear el usuario en Supabase: ${error.message || 'Revisa la consola para más detalle'}`
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const usuariosActuales = readLocal('apt_usuarios', []);
    console.log('📋 Usuarios actuales:', usuariosActuales);
    const existingUsernames = usuariosActuales.map(
      (u: any) => (u.usuario || '').toLowerCase()
    );

    const primaryToken =
      extractPrimaryToken(nuevoUsuarioForm.nombre_completo) ||
      nuevoUsuarioForm.usuario ||
      nuevoUsuarioForm.rol ||
      'usuario';

    let username = (nuevoUsuarioForm.usuario || '').trim();
    let usernameGenerado = false;
    if (!username) {
      username = generateUniqueUsername(primaryToken, existingUsernames);
      username = capitalizeFirst(username);
      usernameGenerado = true;
    } else {
      username = username.trim();
    }

    if (existingUsernames.includes(username.toLowerCase())) {
      alert('❌ Este nombre de usuario ya existe. Por favor elige otro.');
      return;
    }

    let password = (nuevoUsuarioForm.clave || '').trim();
    let passwordGenerada = false;
    if (!password) {
      password = generateDefaultPassword(primaryToken || username);
      passwordGenerada = true;
    }

    const usuarioId = Date.now();
    const nuevoUsuario = {
      id_usuario: usuarioId,
      usuario: username,
      clave: password,
      rol: nuevoUsuarioForm.rol,
      estado_usuario: true,
      created_at: new Date().toISOString(),
    };

    const usuariosActualizados = [...usuariosActuales, nuevoUsuario];
    writeLocal('apt_usuarios', usuariosActualizados);
    console.log('✅ Nuevo usuario guardado:', nuevoUsuario);
    console.log('📦 Usuarios actualizados:', usuariosActualizados);

    const empleados = readLocal('apt_empleados', []);
    const [nombre, ...apellidos] = nuevoUsuarioForm.nombre_completo
      ? nuevoUsuarioForm.nombre_completo.trim().split(/\s+/).filter(Boolean)
      : [capitalizeFirst(username)];

    const cargoAsociado = ensureCargoForRole(nuevoUsuarioForm.rol);

    const nuevoEmpleado = {
      id_empleado: usuarioId + 1,
      nombre: nombre || capitalizeFirst(username),
      apellido_paterno: apellidos[0] || '',
      apellido_materno: apellidos[1] || '',
      rut_empleado: nuevoUsuarioForm.rut || 'N/A',
      correo_empleado: nuevoUsuarioForm.correo || 'N/A',
      telefono_empleado: nuevoUsuarioForm.telefono || 'N/A',
      cargo_id: cargoAsociado?.id_cargo || null,
      cargo_nombre: cargoAsociado?.nombre_cargo || null,
      rol: nuevoUsuarioForm.rol,
      usuario_id: nuevoUsuario.id_usuario,
      created_at: new Date().toISOString(),
    };
    writeLocal('apt_empleados', [...empleados, nuevoEmpleado]);
    console.log('✅ Empleado asociado creado:', nuevoEmpleado);

    const perfilCreado = ensureProfileForUser(nuevoUsuario, nuevoEmpleado);
    if (perfilCreado) {
      console.log('✅ Perfil asociado creado:', perfilCreado);
    }

    const mensajes: string[] = ['✅ Usuario creado exitosamente.'];
    mensajes.push(`Credenciales: ${username} / ${password}`);
    if (cargoAsociado) {
      mensajes.push(`Perfil asignado: ${cargoAsociado.nombre_cargo}`);
    }
    if (usernameGenerado || passwordGenerada) {
      mensajes.push('💡 Credenciales generadas automáticamente. Puedes modificarlas luego desde la administración.');
    }

    alert(mensajes.join('\n'));
    setModalNuevoUsuario(false);
    setNuevoUsuarioForm({
      usuario: '',
      clave: '',
      rol: 'driver',
      nombre_completo: '',
      rut: '',
      telefono: '',
      correo: '',
    });
    
    // Recargar todas las vistas para que se actualicen
    loadUsuariosAuditoria();
    loadUsuarios(); // Actualizar tabla de "Todos los Usuarios"
    loadChoferes(); // Actualizar "Choferes y Vehículos" si es chofer
  };

  const handleAbrirResetPassword = () => {
    if (usuariosAuditoria.length === 0) {
      alert('No hay usuarios disponibles para resetear contraseña');
      return;
    }
    setUsuarioParaReset(null);
    setNuevaPassword('');
    setModalResetPassword(true);
  };

  const handleResetearPassword = async () => {
    if (!usuarioParaReset) {
      alert('Por favor selecciona un usuario');
      return;
    }

    if (!nuevaPassword || nuevaPassword.length < 4) {
      alert('Por favor ingresa una contraseña válida (mínimo 4 caracteres)');
      return;
    }

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from('usuario')
          .update({ clave: nuevaPassword })
          .eq('id_usuario', usuarioParaReset.id_usuario);
        if (error) throw error;

        await supabase.from('auditoria_usuario').insert({
          usuario_id: usuarioParaReset.id_usuario,
          accion: 'reset_password',
          detalle: 'Contraseña reseteada desde Auditoría y Seguridad',
        });

        alert(`✅ Contraseña del usuario "${usuarioParaReset.usuario}" reseteada exitosamente a: ${nuevaPassword}`);
        setModalResetPassword(false);
        setUsuarioParaReset(null);
        setNuevaPassword('');
        await loadUsuarios();
        await loadUsuariosAuditoria();
        return;
      } catch (error: any) {
        console.error('Error reseteando contraseña en Supabase:', error);
        alert(
          `❌ Error al resetear la contraseña: ${error.message || 'Revisa la consola para más detalles.'}`
        );
        return;
      }
    }

    const usuariosActuales = readLocal('apt_usuarios', []);
    const usuariosActualizados = usuariosActuales.map((u: any) => {
      if (u.id_usuario === usuarioParaReset.id_usuario) {
        return { ...u, clave: nuevaPassword };
      }
      return u;
    });

    writeLocal('apt_usuarios', usuariosActualizados);

    alert(`✅ Contraseña del usuario "${usuarioParaReset.usuario}" reseteada exitosamente a: ${nuevaPassword}`);
    setModalResetPassword(false);
    setUsuarioParaReset(null);
    setNuevaPassword('');
    loadUsuariosAuditoria();
  };

  const loadCatalogos = async ({ showLoader = false }: { showLoader?: boolean } = {}) => {
    try {
      if (showLoader) setLoading(true);

      const categoriasGuardadas = readLocal('apt_categorias_vehiculos', null);
      const tiposFallaGuardados = readLocal('apt_tipos_falla', null);
      const prioridadesGuardadas = readLocal('apt_prioridades', null);
      const sucursalesGuardadas = readLocal('apt_sucursales', null);

      let categoriasVehiculos =
        categoriasGuardadas ||
        [
          {
            categoria: 'Eléctricos',
            modelos: ['Ford E-Transit', 'Maxus eDeliver'],
            color: 'bg-green-50 border-green-200 text-green-800',
          },
          {
            categoria: 'Diésel',
            modelos: ['Boxer', 'Porter', 'RAM'],
            color: 'bg-blue-50 border-blue-200 text-blue-800',
          },
          {
            categoria: 'Vehículos de Ventas',
            modelos: ['Partner', 'Fiorino'],
            color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          },
          {
            categoria: 'Flota de Respaldo',
            modelos: ['Varios modelos de respaldo'],
            color: 'bg-gray-50 border-gray-200 text-gray-800',
          },
        ];

      let tiposFalla =
        tiposFallaGuardados || [
          'Ruido',
          'Frenos',
          'Eléctrico',
          'Motor',
          'Suspensión',
          'Transmisión',
          'Neumáticos',
          'Otro',
        ];

      const prioridades =
        prioridadesGuardadas || [
          { value: 'normal', label: 'Normal' },
          { value: 'alta', label: 'Alta' },
          { value: 'critica', label: 'Crítica' },
        ];

      let sucursales: any[] = sucursalesGuardadas || [];
      let modelosVehiculo: any[] = [];
      let tiposVehiculo: any[] = [];

      if (hasSupabase) {
        const [
          sucursalesRes,
          categoriasRes,
          tiposRes,
          modelosRes,
        ] = await Promise.all([
          supabase
            .from('sucursal')
            .select(
              'id_sucursal, nombre_sucursal, direccion_sucursal, comuna_sucursal, region_sucursal, telefono_sucursal, email_sucursal'
            )
            .order('nombre_sucursal', { ascending: true }),
          supabase
            .from('categoria_vehiculo')
            .select(
              'id_categoria_vehiculo, nombre_categoria, color_hex, descripcion_categoria, modelo_categoria:modelo_categoria (modelo_vehiculo:modelo_vehiculo_id (nombre_modelo))'
            )
            .order('nombre_categoria', { ascending: true }),
          supabase
            .from('tipo_vehiculo')
            .select('id_tipo_vehiculo, tipo_vehiculo, descripcion_tipo_vehiculo')
            .order('tipo_vehiculo', { ascending: true }),
          supabase
            .from('modelo_vehiculo')
            .select(
              'id_modelo_vehiculo, nombre_modelo, anio_modelo, marca_vehiculo:marca_vehiculo_id (id_marca_vehiculo, nombre_marca)'
            )
            .order('nombre_modelo', { ascending: true }),
        ]);

        if (sucursalesRes.error) throw sucursalesRes.error;
        if (categoriasRes.error) throw categoriasRes.error;
        if (tiposRes.error) throw tiposRes.error;
        if (modelosRes.error) throw modelosRes.error;

        sucursales = sucursalesRes.data || [];
        tiposVehiculo = tiposRes.data || [];
        modelosVehiculo = (modelosRes.data || []).map((modelo: any) => ({
          ...modelo,
          marca_nombre: modelo.marca_vehiculo?.nombre_marca || null,
        }));

        categoriasVehiculos = (categoriasRes.data || []).map((categoria: any) => ({
          id_categoria_vehiculo: categoria.id_categoria_vehiculo,
          categoria: categoria.nombre_categoria,
          color:
            categoria.color_hex ||
            'bg-blue-50 border-blue-200 text-blue-800',
          modelos: (categoria.modelo_categoria || [])
            .map((mc: any) => mc.modelo_vehiculo?.nombre_modelo)
            .filter(Boolean),
          descripcion: categoria.descripcion_categoria || '',
        }));
      }

      const catalogosData = {
        categorias_vehiculos: categoriasVehiculos,
        modelos_vehiculo: modelosVehiculo,
        tipos_vehiculo: tiposVehiculo,
        tipos_falla: tiposFalla,
        estados_ot: [
          { value: 'pendiente', label: 'Pendiente' },
          { value: 'en_diagnostico_programado', label: 'En Diagnóstico Programado' },
          { value: 'en curso', label: 'En Curso' },
          { value: 'finalizada', label: 'Finalizada' },
        ],
        prioridades: prioridades,
        zonas: sucursales,
      };
      setCatalogos(catalogosData);
    } catch (error) {
      console.error('Error loading catalogos:', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleDesactivarUsuario = async (usuario: any) => {
    if (!confirm(`¿Desactivar usuario ${usuario.usuario}?`)) return;

    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from('usuario')
          .update({ estado_usuario: false })
          .eq('id_usuario', usuario.id_usuario);
        if (error) throw error;

        await supabase.from('auditoria_usuario').insert({
          usuario_id: usuario.id_usuario,
          accion: 'deactivate',
          detalle: 'Usuario desactivado desde el panel de administración',
        });

        await loadUsuarios();
        await loadUsuariosAuditoria();
        alert('✅ Usuario desactivado');
        return;
      } catch (error: any) {
        console.error('Error desactivando usuario en Supabase:', error);
        alert(`❌ No se pudo desactivar el usuario: ${error.message || 'Revisa la consola.'}`);
        return;
      }
    }

    const usuariosLocal = readLocal('apt_usuarios', []);
    const index = usuariosLocal.findIndex((u: any) => u.id_usuario === usuario.id_usuario);
    
    if (index !== -1) {
      usuariosLocal[index].estado_usuario = false;
      writeLocal('apt_usuarios', usuariosLocal);
      loadUsuarios();
      alert('✅ Usuario desactivado');
    }
  };

  const handleActivarUsuario = async (usuario: any) => {
    if (hasSupabase) {
      try {
        const { error } = await supabase
          .from('usuario')
          .update({ estado_usuario: true })
          .eq('id_usuario', usuario.id_usuario);
        if (error) throw error;

        await supabase.from('auditoria_usuario').insert({
          usuario_id: usuario.id_usuario,
          accion: 'activate',
          detalle: 'Usuario activado desde el panel de administración',
        });

        await loadUsuarios();
        await loadUsuariosAuditoria();
        alert('✅ Usuario activado');
        return;
      } catch (error: any) {
        console.error('Error activando usuario en Supabase:', error);
        alert(`❌ No se pudo activar el usuario: ${error.message || 'Revisa la consola.'}`);
        return;
      }
    }

    const usuariosLocal = readLocal('apt_usuarios', []);
    const index = usuariosLocal.findIndex((u: any) => u.id_usuario === usuario.id_usuario);
    
    if (index !== -1) {
      usuariosLocal[index].estado_usuario = true;
      writeLocal('apt_usuarios', usuariosLocal);
      loadUsuarios();
      alert('✅ Usuario activado');
    }
  };

  const handleEliminarUsuario = async (usuario: any) => {
    const usernameLower = (usuario?.usuario || '').toLowerCase();
    if (usuario.rol === 'admin' && usernameLower === 'admin') {
      alert('⚠️ No puedes eliminar la cuenta principal de administrador.');
      return;
    }

    if (!confirm(`¿Eliminar permanentemente al usuario ${usuario.usuario}?`)) {
      return;
    }

    if (hasSupabase) {
      try {
        // Obtener empleado asociado para limpiar asignaciones
        const { data: empleadoData, error: empleadoError } = await supabase
          .from('empleado')
          .select('id_empleado')
          .eq('usuario_id', usuario.id_usuario)
          .maybeSingle();
        if (empleadoError && empleadoError.code !== 'PGRST116') {
          throw empleadoError;
        }

        const empleadoId = empleadoData?.id_empleado;

        if (empleadoId) {
          await supabase
            .from('asignacion_vehiculo')
            .update({
              estado_asignacion: 'finalizado',
              fecha_fin: new Date().toISOString(),
            })
            .eq('empleado_id', empleadoId)
            .eq('estado_asignacion', 'activo');

          await supabase.from('empleado').delete().eq('id_empleado', empleadoId);
        }

        await supabase.from('perfil_usuario').delete().eq('usuario_id', usuario.id_usuario);

        await supabase.from('auditoria_usuario').insert({
          usuario_id: usuario.id_usuario,
          accion: 'delete',
          detalle: 'Usuario eliminado desde el panel de administración',
        });

        await supabase.from('usuario').delete().eq('id_usuario', usuario.id_usuario);

        await loadUsuarios();
        await loadUsuariosAuditoria();
        await loadChoferes();

        alert('🗑️ Usuario eliminado correctamente');
        return;
      } catch (error: any) {
        console.error('Error eliminando usuario en Supabase:', error);
        alert(`❌ Error al eliminar usuario: ${error.message || 'Revisa la consola para más detalles.'}`);
        return;
      }
    }

    const usuariosLocal = readLocal('apt_usuarios', []);
    const usuariosActualizados = usuariosLocal.filter((u: any) => u.id_usuario !== usuario.id_usuario);
    writeLocal('apt_usuarios', usuariosActualizados);

    const empleadosLocal = readLocal('apt_empleados', []);
    const empleadosActualizados = empleadosLocal.filter((e: any) => e.usuario_id !== usuario.id_usuario);
    writeLocal('apt_empleados', empleadosActualizados);

    const perfilesLocal = readLocal('apt_perfiles_usuario', []);
    if (Array.isArray(perfilesLocal)) {
      const perfilesActualizados = perfilesLocal.filter((p: any) => p.usuario_id !== usuario.id_usuario);
      writeLocal('apt_perfiles_usuario', perfilesActualizados);
    }

    loadUsuarios();
    loadChoferes();
    loadUsuariosAuditoria();
    alert('🗑️ Usuario eliminado correctamente');
  };

  const terminoBusqueda = busquedaUsuarios.trim().toLowerCase();
  const usuariosFiltrados = usuarios.filter((usuario: any) => {
    if (!terminoBusqueda) return true;
    const fields = [
      usuario.usuario,
      usuario.nombre_completo,
      usuario.rut,
      usuario.telefono,
      usuario.correo,
      ROLES.find((r) => r.value === usuario.rol)?.label,
    ];
    return fields
      .filter(Boolean)
      .some((field) => field.toString().toLowerCase().includes(terminoBusqueda));
  });

  const choferesFiltrados = choferes.filter((chofer: any) => {
    if (!terminoBusqueda) return true;
    const fields = [chofer.nombre_completo, chofer.rut, chofer.telefono, chofer.vehiculo_asignado, chofer.zona];
    return fields
      .filter(Boolean)
      .some((field) => field.toString().toLowerCase().includes(terminoBusqueda));
  });

  const totalUsuarios = usuarios.length;
  const totalActivos = usuarios.filter((usuario: any) => usuario.estado_usuario).length;
  const totalInactivos = totalUsuarios - totalActivos;
  const totalChoferes = usuarios.filter((usuario: any) => usuario.rol === 'driver').length;

  const roleBadgeStyles: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    planner: 'bg-blue-100 text-blue-700',
    supervisor: 'bg-orange-100 text-orange-700',
    mechanic: 'bg-green-100 text-green-700',
    jefe_taller: 'bg-purple-100 text-purple-700',
    guard: 'bg-gray-100 text-gray-700',
    driver: 'bg-yellow-100 text-yellow-700',
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Contenido de Usuarios */}
      {activeSection === 'usuarios' && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 opacity-90 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h1>
                <p className="text-slate-600">
                  Administra los accesos, roles y disponibilidad del equipo. Usa los filtros para encontrar perfiles específicos.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    onClick={() => {
                      setViewMode('usuarios');
                      setBusquedaUsuarios('');
                    }}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      viewMode === 'usuarios'
                        ? 'rounded-full bg-blue-600 text-white shadow'
                        : 'rounded-full text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos los Usuarios
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('choferes');
                      setBusquedaUsuarios('');
                    }}
                    className={`px-4 py-2 text-sm font-medium transition ${
                      viewMode === 'choferes'
                        ? 'rounded-full bg-blue-600 text-white shadow'
                        : 'rounded-full text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Choferes y Vehículos
                  </button>
                </div>
                <button
                  onClick={handleAgregarNuevoUsuario}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus size={18} />
                  Crear Usuario
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Usuarios totales</p>
                <p className="mt-2 text-3xl font-bold text-blue-700">{totalUsuarios}</p>
                <p className="text-xs text-slate-500">Incluye todos los perfiles registrados</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-500">Activos</p>
                <p className="mt-2 text-3xl font-bold text-green-600">{totalActivos}</p>
                <p className="text-xs text-slate-500">Usuarios con acceso habilitado</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Inactivos</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">{totalInactivos}</p>
                <p className="text-xs text-slate-500">Cuentas suspendidas o bloqueadas</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Choferes</p>
                <p className="mt-2 text-3xl font-bold text-indigo-600">{totalChoferes}</p>
                <p className="text-xs text-slate-500">Perfiles con rol de chofer</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={busquedaUsuarios}
                  onChange={(e) => setBusquedaUsuarios(e.target.value)}
                  placeholder={viewMode === 'usuarios' ? 'Buscar por nombre, rol o correo...' : 'Buscar por nombre, zona o patente...'}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="text-xs text-slate-500">
                {terminoBusqueda
                  ? `Filtrando resultados por "${busquedaUsuarios.trim()}" (${viewMode === 'usuarios' ? usuariosFiltrados.length : choferesFiltrados.length} coincidencias)`
                  : 'Usa la búsqueda para filtrar por cualquier dato del usuario.'}
              </div>
            </div>

            {/* Vista de Todos los Usuarios */}
            {viewMode === 'usuarios' && (
              <>
                {totalUsuarios === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center text-slate-500">
                    <Users className="mx-auto mb-4 text-slate-300" size={52} />
                    <p className="text-lg font-semibold text-slate-600">No hay usuarios registrados aún</p>
                    <p className="text-sm text-slate-500 mt-1">Utiliza el botón “Crear Usuario” para ingresar la primera cuenta.</p>
                  </div>
                ) : usuariosFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 py-10 text-center text-blue-600">
                    <Search className="mx-auto mb-3" size={32} />
                    <p className="font-semibold">No encontramos usuarios que coincidan con tu búsqueda.</p>
                    <p className="text-sm text-blue-500 mt-1">Intenta con otro término o limpia el filtro.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contacto</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Identificación</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rol</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {usuariosFiltrados.map((usuario: any) => {
                          const rolConfig = ROLES.find((r) => r.value === usuario.rol);
                          const rolBadge = roleBadgeStyles[usuario.rol] || 'bg-slate-100 text-slate-700';
                          return (
                            <tr key={usuario.id_usuario} className="transition hover:bg-blue-50/40">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                    <UserCircle size={22} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{usuario.usuario}</p>
                                    <p className="text-xs text-slate-500">{usuario.nombre_completo || 'Sin nombre asignado'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1 text-xs text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" />
                                    <span>{usuario.telefono || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-slate-400" />
                                    <span>{usuario.correo || 'N/A'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="text-sm text-slate-600">
                                  <p className="font-medium text-slate-800">{usuario.rut || 'N/A'}</p>
                                  <p className="text-xs text-slate-400">Creado: {usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('es-ES') : 'N/A'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${rolBadge}`}>
                                  {rolConfig?.label || usuario.rol}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {usuario.estado_usuario ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                    <CheckCircle size={12} />
                                    Activo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                    <XCircle size={12} />
                                    Inactivo
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button className="rounded-full border border-slate-200 p-2 text-blue-600 transition hover:bg-blue-50 hover:text-blue-700" title="Editar usuario">
                                    <Edit size={16} />
                                  </button>
                                  {usuario.estado_usuario ? (
                                    <button
                                      onClick={() => handleDesactivarUsuario(usuario)}
                                      className="rounded-full border border-slate-200 p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                                      title="Desactivar usuario"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleActivarUsuario(usuario)}
                                      className="rounded-full border border-slate-200 p-2 text-green-600 transition hover:bg-green-50 hover:text-green-700"
                                      title="Activar usuario"
                                    >
                                      <CheckCircle size={16} />
                                    </button>
                                  )}
                                  {(usuario.rol !== 'admin' || (usuario.usuario || '').toLowerCase() !== 'admin') && (
                                    <button
                                      onClick={() => handleEliminarUsuario(usuario)}
                                      className="rounded-full border border-slate-200 p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                                      title="Eliminar usuario"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Vista de Choferes con Vehículos */}
            {viewMode === 'choferes' && (
              <>
                {choferes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 py-12 text-center text-slate-500">
                    <Truck className="mx-auto mb-4 text-slate-300" size={52} />
                    <p className="text-lg font-semibold text-slate-600">No hay choferes registrados aún</p>
                    <p className="text-sm text-slate-500 mt-1">Crea usuarios con rol Chofer para gestionar asignaciones.</p>
                  </div>
                ) : choferesFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 py-10 text-center text-blue-600">
                    <Search className="mx-auto mb-3" size={32} />
                    <p className="font-semibold">No encontramos choferes que coincidan con tu búsqueda.</p>
                    <p className="text-sm text-blue-500 mt-1">Prueba con otro nombre, patente o sucursal.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {choferesFiltrados.map((chofer: any) => (
                      <div
                        key={chofer.id_usuario}
                        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                              <Users size={22} />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">{chofer.nombre_completo}</h3>
                              <p className="text-xs uppercase tracking-wide text-slate-400">RUT {chofer.rut || 'N/A'}</p>
                              {chofer.zona && (
                                <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                                  <MapPin size={12} />
                                  {chofer.zona}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAsignarVehiculo(chofer)}
                            className={`inline-flex items-center gap-2 self-end rounded-xl px-4 py-2 text-sm font-semibold text-white shadow transition ${
                              chofer.vehiculo_asignado === 'Sin asignar'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-orange-500 hover:bg-orange-600'
                            }`}
                          >
                            <Edit size={16} />
                            {chofer.vehiculo_asignado === 'Sin asignar' ? 'Asignar Vehículo' : 'Modificar Vehículo'}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <Phone size={14} className="text-blue-500" />
                              Contacto
                            </p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              <span className="flex items-center gap-2 font-medium">
                                <Phone size={14} className="text-slate-400" />
                                {chofer.telefono || 'N/A'}
                              </span>
                              <span className="flex items-start gap-2 font-medium">
                                <Mail size={14} className="mt-1 text-slate-400" />
                                <span className="break-all leading-5">
                                  {chofer.correo && chofer.correo !== 'N/A' ? chofer.correo : 'Sin correo registrado'}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-100 bg-white p-4">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <MapPin size={14} className="text-indigo-500" />
                              Zona / Sucursal
                            </p>
                            <p className="mt-3 text-sm font-semibold text-slate-900">{chofer.zona || 'Sin asignar'}</p>
                          </div>

                          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                              <Truck size={14} />
                              Vehículo asignado
                            </p>
                            <p className="mt-3 text-sm font-semibold text-blue-700">{chofer.vehiculo_asignado}</p>
                            {chofer.kilometraje_promedio && chofer.kilometraje_promedio !== 'N/A' && (
                              <p className="mt-1 text-xs text-blue-500">Uso promedio mensual: {chofer.kilometraje_promedio}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Contenido de Gestión de Vehículos */}
      {activeSection === 'vehiculos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Vehículos</h1>
              <p className="text-gray-600">Agregar, editar y eliminar vehículos de la flota.</p>
            </div>
            <button 
              onClick={handleAgregarVehiculo}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Truck size={18} />
              Agregar Vehículo
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehiculos.map((vehiculo) => {
                const estado = vehiculo.estado_vehiculo;
                const estadoLabel =
                  estado === 'en ruta'
                    ? 'En ruta'
                    : estado
                    ? capitalizeFirst(estado)
                    : 'Sin estado';
                const estadoClase =
                  estado === 'disponible'
                    ? 'bg-green-100 text-green-800'
                    : estado === 'en ruta'
                    ? 'bg-blue-100 text-blue-800'
                    : estado === 'mantenimiento'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-200 text-gray-700';

                const asignacionActiva = asignacionesActivas.find(
                  (asignacion: any) =>
                    asignacion.estado_asignacion === 'activo' &&
                    asignacion.vehiculo_id === vehiculo.id_vehiculo
                );
                const choferAsignado = asignacionActiva
                  ? choferes.find(
                      (chofer: any) => chofer.id_empleado === asignacionActiva.empleado_id
                    )
                  : null;

                return (
                <div key={vehiculo.id_vehiculo} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-600 font-medium">Patente:</span>
                        <h3 className="text-lg font-bold text-gray-900">{vehiculo.patente_vehiculo}</h3>
                      </div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${estadoClase}`}>
                        {estadoLabel}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditarVehiculo(vehiculo)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar vehículo"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleEliminarVehiculo(vehiculo)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar vehículo"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>{vehiculo.categoria_nombre || vehiculo.categoria || 'Sin categoría'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>Kilometraje: {vehiculo.kilometraje_vehiculo?.toLocaleString('es-ES') || 0} km</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>
                        Modelo: {vehiculo.modelo_nombre || 'N/A'}
                        {vehiculo.marca_nombre ? ` · ${vehiculo.marca_nombre}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>Tipo: {vehiculo.tipo_nombre || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>
                        Sucursal: {vehiculo.sucursal_nombre || 'N/A'}
                        {vehiculo.sucursal_comuna ? ` · ${vehiculo.sucursal_comuna}` : ''}
                      </span>
                    </div>
                    {choferAsignado && (
                      <div className="flex items-center gap-2 text-blue-600 mt-2 pt-2 border-t">
                        <Users size={14} />
                        <span className="text-xs">
                          Chofer asignado: {choferAsignado.nombre_completo || choferAsignado.usuario}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>

            {vehiculos.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <Truck className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">No hay vehículos registrados</p>
                <p className="text-sm text-gray-500 mt-2">Haz clic en "Agregar Vehículo" para crear uno</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido de Roles y Permisos */}
      {activeSection === 'roles' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Roles y Permisos</h1>
              <p className="text-gray-600">
                Vista informativa de cada perfil. Aquí solo se muestra qué puede hacer cada rol dentro del sistema.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-600">Total de Roles</p>
              <p className="text-2xl font-bold text-blue-600">{ROLES.length}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {ROLES.map((rol) => {
              const permisosAsignados = PERMISOS_DISPONIBLES.filter((permiso) =>
                permiso.roles.includes(rol.value)
              );
              const perfil = ROLE_PROFILES[rol.value as keyof typeof ROLE_PROFILES] ?? ROLE_PROFILES.default;
              return (
                <div key={rol.value} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header del rol */}
                  <div className={`p-4 ${rol.color}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg mb-1">{rol.label}</h3>
                        <p className="text-sm opacity-90">{rol.descripcion}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white space-y-5">
                    {/* Permisos del rol */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Shield size={16} className="text-blue-500" />
                        Permisos asignados
                      </h4>
                      {permisosAsignados.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {permisosAsignados.map((permiso) => (
                            <span
                              key={permiso.id}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-sm font-medium"
                            >
                              <CheckCircle size={14} />
                              {permiso.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Este rol no tiene permisos especiales asignados.</p>
                      )}
                    </div>

                    {/* Módulos disponibles */}
                    {perfil?.modulos?.length ? (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Users size={16} className="text-purple-500" />
                          Módulos disponibles
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {perfil.modulos.map((modulo) => (
                            <span
                              key={modulo}
                              className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium uppercase tracking-wide"
                            >
                              {modulo.replace(/-/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contenido de Catálogos del Taller */}
      {activeSection === 'catalogos' && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-white to-blue-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Catálogos del Taller</h1>
                <p className="text-slate-600">
                  Mantén alineadas las listas maestras que alimentan los flujos del taller. Todo lo que modifiques aquí se refleja de inmediato en la operación.
                </p>
              </div>
              <div className="rounded-xl bg-white shadow-inner border border-blue-100 px-5 py-3 max-w-xs">
                <p className="text-sm text-slate-500">Catálogos activos</p>
                <p className="text-2xl font-semibold text-blue-600">{catalogos.categorias_vehiculos?.length + catalogos.tipos_falla.length + catalogos.estados_ot.length + catalogos.prioridades.length + catalogos.zonas.length}</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Categorías de Vehículos */}
              <section className="rounded-2xl border border-blue-100 bg-white shadow-sm">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-blue-100 bg-blue-50/70 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-blue-600/10 p-2 text-blue-600">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Categorías de Vehículos</h3>
                      <p className="text-sm text-slate-600">
                        Clasifica tu flota y agrega los modelos asociados a cada categoría.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAgregarCategoria}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={14} />
                    Agregar categoría
                  </button>
                </header>

                <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3">
                  {catalogos.categorias_vehiculos?.map((categoria: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-xl border border-blue-100/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition-transform hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-blue-900 uppercase tracking-wide">{categoria.categoria}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {categoria.modelos.length > 0 ? `${categoria.modelos.length} modelo(s) asociados` : 'Sin modelos asignados'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleEditarCategoria(categoria, index)}
                          className="rounded-full border border-blue-100 text-blue-600 hover:bg-blue-50 transition-colors p-1"
                          title="Editar categoría"
                        >
                          <Edit size={14} />
                        </button>
                      </div>

                      {categoria.modelos.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {categoria.modelos.map((modelo: string, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                            >
                              <Truck size={12} />
                              {modelo}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-400">Agrega modelos para que aparezcan aquí.</p>
                      )}
                    </div>
                  ))}
                  {(!catalogos.categorias_vehiculos || catalogos.categorias_vehiculos.length === 0) && (
                    <div className="col-span-full rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-6 text-center text-sm text-blue-700">
                      No existen categorías definidas todavía.
                    </div>
                  )}
                </div>
              </section>

              {/* Tipos de Falla */}
              <section className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-emerald-100 bg-emerald-50/70 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-600/10 p-2 text-emerald-600">
                      <Activity size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Tipos de Falla / Mantención</h3>
                      <p className="text-sm text-slate-600">
                        Define las taxonomías que se usarán al diagnosticar y reportar reparaciones.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAgregarTipoFalla}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
                  >
                    <Plus size={14} />
                    Agregar tipo
                  </button>
                </header>

                <div className="px-6 py-6">
                  <div className="flex flex-wrap gap-3">
                    {catalogos.tipos_falla.map((tipo: string, index: number) => (
                      <span
                        key={index}
                        className="group inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                      >
                        {tipo}
                        <button
                          onClick={() => handleEliminarTipoFalla(tipo)}
                          className="rounded-full p-1 text-emerald-600 transition-all hover:bg-white hover:text-red-500"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    ))}
                    {catalogos.tipos_falla.length === 0 && (
                      <span className="text-sm text-slate-400">Agrega tus primeros tipos de falla para comenzar.</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Estados de OT */}
              <section className="rounded-2xl border border-purple-100 bg-white shadow-sm">
                <header className="flex items-start gap-3 border-b border-purple-100 bg-purple-50/70 px-6 py-5">
                  <div className="rounded-full bg-purple-600/10 p-2 text-purple-600">
                    <ListChecks size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Estados de OT</h3>
                    <p className="text-sm text-slate-600">
                      Secuencia de estados disponibles para las órdenes de trabajo.
                    </p>
                  </div>
                </header>

                <div className="px-6 py-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {catalogos.estados_ot.map((estado: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-700 shadow-sm"
                      >
                        {estado.label}
                      </div>
                    ))}
                    {catalogos.estados_ot.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-center text-sm text-purple-700">
                        Aún no hay estados configurados.
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Prioridades */}
              <section className="rounded-2xl border border-amber-100 bg-white shadow-sm">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-amber-100 bg-amber-50/70 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-600/10 p-2 text-amber-600">
                      <Shield size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Prioridades</h3>
                      <p className="text-sm text-slate-600">
                        Etiquetas visuales que ayudan a ordenar el backlog técnico.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAgregarPrioridad}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 transition-colors"
                  >
                    <Plus size={14} />
                    Agregar prioridad
                  </button>
                </header>

                <div className="px-6 py-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {catalogos.prioridades.map((prioridad: any, index: number) => {
                      const baseStyles =
                        prioridad.value === 'critica'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : prioridad.value === 'alta'
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : 'bg-blue-50 border-blue-200 text-blue-700';
                      return (
                        <div
                          key={index}
                          className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${baseStyles}`}
                        >
                          <span className="uppercase tracking-wide">{prioridad.label}</span>
                          <button
                            onClick={() => handleEliminarPrioridad(prioridad)}
                            className="rounded-full p-1 text-current transition-colors hover:bg-white/60 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {catalogos.prioridades.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-6 text-center text-sm text-amber-700">
                        No hay prioridades definidas todavía.
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Zonas / Sucursales */}
              <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-indigo-100 bg-indigo-50/70 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-indigo-600/10 p-2 text-indigo-600">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Zonas / Sucursales</h3>
                      <p className="text-sm text-slate-600">
                        Puntos físicos donde operan los vehículos y equipos de mantenimiento.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAgregarSucursal}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={14} />
                    Agregar sucursal
                  </button>
                </header>

                <div className="px-6 py-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {catalogos.zonas.map((zona: any) => (
                      <div
                        key={zona.id_sucursal}
                        className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-indigo-900">{zona.nombre_sucursal}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {zona.direccion_sucursal}
                              {zona.comuna_sucursal ? ` · ${zona.comuna_sucursal}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => handleEliminarSucursal(zona)}
                            className="rounded-full border border-indigo-100 p-1 text-indigo-500 hover:bg-indigo-50 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {catalogos.zonas.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-center text-sm text-indigo-700">
                        Aún no se configuran sucursales.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Configuración de Agenda */}
      {activeSection === 'agenda' && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 opacity-80 pointer-events-none" />
          <div className="relative z-10 p-6 pb-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Configuración de Agenda</h1>
                <p className="text-slate-600">
                  Visualiza el horario corporativo y ajusta los bloques operativos según la necesidad del taller.
                </p>
              </div>
              <div className="rounded-xl bg-white shadow-inner border border-indigo-100 px-5 py-3 max-w-xs">
                <p className="text-sm text-slate-500">Bloques actuales</p>
                <p className="text-2xl font-semibold text-indigo-600">
                  {agendaConfig.duracion_diagnostico}h diag · {agendaConfig.duracion_reparacion}h rep
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Horarios del Taller */}
              <section className="rounded-2xl border border-sky-100 bg-white shadow-sm">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-sky-100 bg-sky-50/70 px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-sky-600/10 p-2 text-sky-600">
                      <Clock3 size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Horarios del Taller</h3>
                      <p className="text-sm text-slate-600">
                        Horario fijo definido por la empresa. No modificable desde esta vista.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-wide text-sky-600 border border-sky-200 shadow-sm">
                    <CalendarClock size={14} />
                    Horario fijo
                  </span>
                </header>

                <div className="px-6 py-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Jornada Lunes a Viernes
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {agendaConfig.hora_inicio} - {agendaConfig.hora_fin} hrs
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Atención continua</p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Colación diaria
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {agendaConfig.hora_inicio_colacion} - {agendaConfig.hora_fin_colacion} hrs
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Bloque reservado para el equipo</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-sky-200 bg-white/80 px-5 py-4 text-sm text-sky-700 shadow-sm">
                    Sábados: 09:00 a 14:00 hrs (solo cierre o contingencia).
                  </div>
                </div>
              </section>

              {/* Bloques de Trabajo */}
              <section className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <header className="flex items-start gap-3 border-b border-emerald-100 bg-emerald-50/70 px-6 py-5">
                  <div className="rounded-full bg-emerald-600/10 p-2 text-emerald-600">
                    <Timer size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Bloques de Trabajo</h3>
                    <p className="text-sm text-slate-600">
                      Ajusta la duración de diagnóstico y reparación según la capacidad del taller.
                    </p>
                  </div>
                </header>

                <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                      Duración diagnóstico (horas)
                    </label>
                    <input
                      type="number"
                      value={agendaConfig.duracion_diagnostico}
                      onChange={(e) => setAgendaConfig({ ...agendaConfig, duracion_diagnostico: e.target.value })}
                      min="1"
                      max="8"
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base font-semibold text-emerald-700 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Tiempo sugerido para diagnósticos estándar. Incrementa para OT complejas.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-2">
                      Duración reparación (horas)
                    </label>
                    <input
                      type="number"
                      value={agendaConfig.duracion_reparacion}
                      onChange={(e) => setAgendaConfig({ ...agendaConfig, duracion_reparacion: e.target.value })}
                      min="1"
                      max="24"
                      className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base font-semibold text-emerald-700 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Usa múltiplos de bloque para planificar reparaciones prolongadas.
                    </p>
                  </div>
                </div>
              </section>

              {/* Días Hábiles */}
              <section className="rounded-2xl border border-amber-100 bg-white shadow-sm">
                <header className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/70 px-6 py-5">
                  <div className="rounded-full bg-amber-600/10 p-2 text-amber-600">
                    <SunMedium size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Días Hábiles</h3>
                    <p className="text-sm text-slate-600">
                      Vista rápida de los días activos para operación regular del taller.
                    </p>
                  </div>
                </header>

                <div className="px-6 py-6">
                  <div className="flex flex-wrap gap-3">
                    {DIAS_SEMANA.map((dia) => {
                      const activo = diasHabilesSet.has(dia);
                      return (
                        <span
                          key={dia}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                            activo
                              ? 'border-amber-200 bg-amber-50 text-amber-700 shadow-sm'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {dia}
                          {activo && (
                            <span className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                              Activo
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <p className="text-xs text-slate-500">
                Los horarios fijos se gestionan desde RR.HH. Para ajustes operativos modifica los bloques.
              </p>
              <button
                onClick={handleGuardarConfigAgenda}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700 transition-colors"
              >
                Guardar configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Parámetros de Flota */}
      {activeSection === 'flota' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Parámetros de Flota</h1>
          <p className="text-gray-600 mb-6">Registrar datos generales de la flota y asociar vehículos a zonas.</p>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {vehiculos.length}
                </div>
                <div className="text-sm text-gray-600">Total de Vehículos</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {catalogos.zonas ? catalogos.zonas.length : 0}
                </div>
                <div className="text-sm text-gray-600">Sucursales / Zonas</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-1">
                  {catalogos.categorias_vehiculos ? catalogos.categorias_vehiculos.length : 0}
                </div>
                <div className="text-sm text-gray-600">Categorías de Vehículos</div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Truck className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión de flota en desarrollo</h3>
              <p className="text-gray-600">
                Aquí podrás asociar vehículos a zonas y definir parámetros operativos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Auditoría y Seguridad */}
      {activeSection === 'auditoria' && auditoriaAutenticada && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Auditoría y Seguridad</h1>
          <p className="text-gray-600 mb-6">Ver usuarios del sistema y gestionar seguridad.</p>
          
          <div className="space-y-6">
            {/* Usuarios Existentes */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Usuarios del Sistema</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-300">
                      <th className="text-left py-2 px-3">Usuario</th>
                      <th className="text-left py-2 px-3">Contraseña</th>
                      <th className="text-left py-2 px-3">Rol</th>
                      <th className="text-left py-2 px-3">Estado</th>
                      <th className="text-left py-2 px-3">Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosAuditoria.map((usuario) => (
                      <tr key={usuario.id_usuario} className="border-b border-blue-200 hover:bg-blue-100">
                        <td className="py-2 px-3 font-medium">{usuario.usuario}</td>
                        <td className="py-2 px-3">
                          <span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-mono">
                            {usuario.clave || '••••••••'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            usuario.rol === 'admin' ? 'bg-red-100 text-red-800' :
                            usuario.rol === 'planner' ? 'bg-blue-100 text-blue-800' :
                            usuario.rol === 'jefe_taller' ? 'bg-purple-100 text-purple-800' :
                            usuario.rol === 'supervisor' ? 'bg-orange-100 text-orange-800' :
                            usuario.rol === 'mechanic' ? 'bg-green-100 text-green-800' :
                            usuario.rol === 'guard' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {usuario.rol}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            usuario.estado_usuario ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {usuario.estado_usuario ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('es-ES') : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Acciones de Seguridad */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Acciones de Seguridad</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleAgregarNuevoUsuario}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left flex items-center gap-2"
                >
                  <Users size={18} />
                  Agregar Usuario Nuevo de la Empresa
                </button>
                <button 
                  onClick={handleAbrirResetPassword}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-left flex items-center gap-2"
                >
                  <Key size={18} />
                  Resetear Contraseña de Usuario
                </button>
                <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-left flex items-center gap-2">
                  <Shield size={18} />
                  Bloquear Usuario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Asignar Vehículo a Chofer */}
      <Modal
        isOpen={modalChoferVehiculo}
        onClose={() => {
          setModalChoferVehiculo(false);
          setSelectedChofer(null);
          setVehiculoSeleccionado('');
        }}
        title={selectedChofer?.vehiculo_asignado === 'Sin asignar' ? "Asignar Vehículo al Chofer" : "Modificar Vehículo del Chofer"}
      >
        {selectedChofer && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Chofer Seleccionado</h4>
              <p className="text-sm"><strong>Nombre:</strong> {selectedChofer.nombre_completo}</p>
              <p className="text-sm"><strong>RUT:</strong> {selectedChofer.rut}</p>
              <p className="text-sm"><strong>Zona:</strong> {selectedChofer.zona}</p>
              {selectedChofer.vehiculo_asignado !== 'Sin asignar' && (
                <p className="text-sm mt-2">
                  <strong>Vehículo actual:</strong> 
                  <span className="ml-1 bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                    {selectedChofer.vehiculo_asignado}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Vehículo <span className="text-red-500">*</span>
              </label>
              <select
                value={vehiculoSeleccionado}
                onChange={(e) => setVehiculoSeleccionado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin asignar</option>
                {getVehiculosDisponibles().map((vehiculo) => (
                  <option key={vehiculo.id_vehiculo} value={vehiculo.id_vehiculo}>
                    {vehiculo.patente_vehiculo} - {vehiculo.estado_vehiculo}
                    {vehiculo.id_vehiculo === selectedChofer?.vehiculo_id ? ' (Actual)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Solo se muestran vehículos disponibles (sin asignar a otros choferes)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Sucursal / Zona <span className="text-red-500">*</span>
              </label>
              <select
                value={sucursalSeleccionada}
                onChange={(e) => setSucursalSeleccionada(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccione una sucursal --</option>
                {catalogos.zonas?.map((sucursal: any) => (
                  <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                    {sucursal.nombre_sucursal} - {sucursal.comuna_sucursal}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Define la sucursal o zona de trabajo del chofer
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setModalChoferVehiculo(false);
                  setSelectedChofer(null);
                  setVehiculoSeleccionado('');
                  setSucursalSeleccionada('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarAsignacion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Asignación
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Agregar/Editar Categoría de Vehículo */}
      <Modal 
        isOpen={modalCategoria} 
        onClose={() => {
          setModalCategoria(false);
          setSelectedCategoriaIndex(null);
        }} 
        title={selectedCategoriaIndex !== null ? "Editar Categoría de Vehículo" : "Agregar Categoría de Vehículo"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              value={categoriaFormData.categoria}
              onChange={(e) => setCategoriaFormData({ ...categoriaFormData, categoria: e.target.value })}
              placeholder="Ej: Eléctricos, Diésel, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelos (separados por coma) *
            </label>
            <textarea
              value={categoriaFormData.modelos}
              onChange={(e) => setCategoriaFormData({ ...categoriaFormData, modelos: e.target.value })}
              placeholder="Ej: Ford E-Transit, Maxus eDeliver, Mercedes Sprinter"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingresa los modelos separados por comas
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de la Categoría
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Azul' },
                { value: 'bg-green-50 border-green-200 text-green-800', label: 'Verde' },
                { value: 'bg-yellow-50 border-yellow-200 text-yellow-800', label: 'Amarillo' },
                { value: 'bg-red-50 border-red-200 text-red-800', label: 'Rojo' },
                { value: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Morado' },
                { value: 'bg-gray-50 border-gray-200 text-gray-800', label: 'Gris' },
              ].map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setCategoriaFormData({ ...categoriaFormData, color: color.value })}
                  className={`px-3 py-2 border rounded-lg text-sm ${color.value} ${
                    categoriaFormData.color === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalCategoria(false);
                setSelectedCategoriaIndex(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarCategoria}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {selectedCategoriaIndex !== null ? 'Actualizar Categoría' : 'Guardar Categoría'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Tipo de Falla */}
      <Modal 
        isOpen={modalTipoFalla} 
        onClose={() => {
          setModalTipoFalla(false);
          setNuevoTipoFalla('');
        }} 
        title="Agregar Tipo de Falla / Mantención"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Falla / Mantención *
            </label>
            <input
              type="text"
              value={nuevoTipoFalla}
              onChange={(e) => setNuevoTipoFalla(e.target.value)}
              placeholder="Ej: Sistema de refrigeración, Batería, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleGuardarTipoFalla();
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingresa un nuevo tipo de falla o mantención para agregar al catálogo
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalTipoFalla(false);
                setNuevoTipoFalla('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarTipoFalla}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Agregar Tipo de Falla
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Prioridad */}
      <Modal 
        isOpen={modalPrioridad} 
        onClose={() => {
          setModalPrioridad(false);
          setPrioridadFormData({ value: '', label: '' });
        }} 
        title="Agregar Prioridad"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor (Identificador) *
            </label>
            <input
              type="text"
              value={prioridadFormData.value}
              onChange={(e) => setPrioridadFormData({ ...prioridadFormData, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="Ej: muy_alta, baja, media"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Identificador único (se convertirá a minúsculas y sin espacios)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etiqueta (Nombre visible) *
            </label>
            <input
              type="text"
              value={prioridadFormData.label}
              onChange={(e) => setPrioridadFormData({ ...prioridadFormData, label: e.target.value })}
              placeholder="Ej: Muy Alta, Baja, Media"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombre que se mostrará en el sistema
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalPrioridad(false);
                setPrioridadFormData({ value: '', label: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarPrioridad}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Agregar Prioridad
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Sucursal */}
      <Modal 
        isOpen={modalSucursal} 
        onClose={() => {
          setModalSucursal(false);
          setSucursalFormData({ nombre_sucursal: '', direccion_sucursal: '', comuna_sucursal: '' });
        }} 
        title="Agregar Sucursal / Zona"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Sucursal *
            </label>
            <input
              type="text"
              value={sucursalFormData.nombre_sucursal}
              onChange={(e) => setSucursalFormData({ ...sucursalFormData, nombre_sucursal: e.target.value })}
              placeholder="Ej: Taller PepsiCo, Sucursal Norte"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección *
            </label>
            <input
              type="text"
              value={sucursalFormData.direccion_sucursal}
              onChange={(e) => setSucursalFormData({ ...sucursalFormData, direccion_sucursal: e.target.value })}
              placeholder="Ej: Santa Marta, Av. Principal 123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comuna / Ciudad *
            </label>
            <input
              type="text"
              value={sucursalFormData.comuna_sucursal}
              onChange={(e) => setSucursalFormData({ ...sucursalFormData, comuna_sucursal: e.target.value })}
              placeholder="Ej: Santa Marta, Santiago, Valparaíso"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalSucursal(false);
                setSucursalFormData({ nombre_sucursal: '', direccion_sucursal: '', comuna_sucursal: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarSucursal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Agregar Sucursal
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Nuevo Usuario */}
      <Modal 
        isOpen={modalNuevoUsuario} 
        onClose={() => {
          setModalNuevoUsuario(false);
          setNuevoUsuarioForm({ usuario: '', clave: '', rol: 'driver', nombre_completo: '', rut: '', telefono: '', correo: '' });
        }} 
        title="Agregar Usuario Nuevo de la Empresa"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de Usuario * <span className="text-gray-500 text-xs">(para iniciar sesión)</span>
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.usuario}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, usuario: e.target.value })}
              placeholder="Ej: jperez, mgarcia"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña *
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.clave}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, clave: e.target.value })}
              placeholder="Ej: password123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              La contraseña será visible para el administrador
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              value={nuevoUsuarioForm.rol}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, rol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Administrador</option>
              <option value="planner">Coordinador</option>
              <option value="jefe_taller">Jefe de Taller</option>
              <option value="supervisor">Supervisor</option>
              <option value="mechanic">Mecánico</option>
              <option value="guard">Guardia</option>
              <option value="driver">Chofer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.nombre_completo}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, nombre_completo: e.target.value })}
              placeholder="Ej: Juan Pérez González"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.rut}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, rut: e.target.value })}
              placeholder="Ej: 12.345.678-9"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono / Contacto <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="tel"
              value={nuevoUsuarioForm.telefono}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, telefono: e.target.value })}
              placeholder="Ej: +56 9 1234 5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="email"
              value={nuevoUsuarioForm.correo}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, correo: e.target.value })}
              placeholder="Ej: usuario@empresa.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 Se creará automáticamente un registro de empleado asociado con estos datos
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalNuevoUsuario(false);
                setNuevoUsuarioForm({ usuario: '', clave: '', rol: 'driver', nombre_completo: '', rut: '', telefono: '', correo: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarNuevoUsuario}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Crear Usuario
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Validar Contraseña para Auditoría */}
      <Modal 
        isOpen={modalPasswordAuditoria} 
        onClose={() => {
          setModalPasswordAuditoria(false);
          setAuditoriaAutenticada(false);
        }} 
        title="Acceso Restringido - Auditoría y Seguridad"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800">
              <Shield size={20} />
              <p className="font-semibold">Esta sección requiere autenticación de administrador</p>
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const password = formData.get('password') as string;
            handleValidarPasswordAuditoria(password);
          }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Por favor ingresa tu contraseña de administrador:
              </label>
              <input
                type="password"
                name="password"
                autoFocus
                placeholder="Contraseña de administrador"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setModalPasswordAuditoria(false);
                  setAuditoriaAutenticada(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Validar Acceso
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Resetear Contraseña de Usuario */}
      <Modal 
        isOpen={modalResetPassword} 
        onClose={() => {
          setModalResetPassword(false);
          setUsuarioParaReset(null);
          setNuevaPassword('');
        }} 
        title="Resetear Contraseña de Usuario"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-orange-800">
              <Key size={20} />
              <p className="font-semibold">Selecciona el usuario y define su nueva contraseña</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Usuario *
            </label>
            <select
              value={usuarioParaReset?.id_usuario || ''}
              onChange={(e) => {
                const usuario = usuariosAuditoria.find(u => u.id_usuario === parseInt(e.target.value));
                setUsuarioParaReset(usuario || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">-- Seleccione un usuario --</option>
              {usuariosAuditoria.map((usuario) => (
                <option key={usuario.id_usuario} value={usuario.id_usuario}>
                  {usuario.usuario} ({usuario.rol})
                </option>
              ))}
            </select>
          </div>

          {usuarioParaReset && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Usuario seleccionado:</strong> {usuarioParaReset.usuario}</p>
              <p className="text-sm"><strong>Contraseña actual:</strong> <span className="font-mono bg-gray-800 text-white px-2 py-1 rounded text-xs">{usuarioParaReset.clave}</span></p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nueva Contraseña *
            </label>
            <input
              type="text"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Ingresa la nueva contraseña"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 4 caracteres. La contraseña será visible para el administrador.
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalResetPassword(false);
                setUsuarioParaReset(null);
                setNuevaPassword('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetearPassword}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Resetear Contraseña
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar/Editar Vehículo */}
      <Modal 
        isOpen={modalVehiculo} 
        onClose={() => {
          setModalVehiculo(false);
          setVehiculoEditando(null);
          setVehiculoForm({
            patente_vehiculo: '',
            estado_vehiculo: 'disponible',
            kilometraje_vehiculo: '',
            categoria_id: '',
            modelo_vehiculo_id: '',
            tipo_vehiculo_id: '',
            sucursal_id: '',
          });
        }}
        title={vehiculoEditando ? "Editar Vehículo" : "Agregar Vehículo"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patente del Vehículo *
            </label>
            <input
              type="text"
              value={vehiculoForm.patente_vehiculo}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, patente_vehiculo: e.target.value.toUpperCase() })}
              placeholder="Ej: ABCD12"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={vehiculoForm.categoria_id}
              onChange={(e) =>
                setVehiculoForm({ ...vehiculoForm, categoria_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione una categoría --</option>
              {catalogos.categorias_vehiculos?.map((cat: any, index: number) => (
                <option
                  key={index}
                  value={
                    cat.id_categoria_vehiculo
                      ? String(cat.id_categoria_vehiculo)
                      : cat.categoria
                  }
                >
                  {cat.categoria}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado del Vehículo
            </label>
            <select
              value={vehiculoForm.estado_vehiculo}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, estado_vehiculo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="disponible">Disponible</option>
              <option value="en ruta">En Ruta</option>
              <option value="mantenimiento">En Mantenimiento</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kilometraje Actual
            </label>
            <input
              type="number"
              value={vehiculoForm.kilometraje_vehiculo}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, kilometraje_vehiculo: e.target.value })}
              placeholder="Ej: 15000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelo del Vehículo *
            </label>
            <select
              value={vehiculoForm.modelo_vehiculo_id}
              onChange={(e) =>
                setVehiculoForm({ ...vehiculoForm, modelo_vehiculo_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione un modelo --</option>
              {catalogos.modelos_vehiculo?.map((modelo: any) => (
                <option key={modelo.id_modelo_vehiculo} value={String(modelo.id_modelo_vehiculo)}>
                  {modelo.nombre_modelo}
                  {modelo.marca_nombre ? ` · ${modelo.marca_nombre}` : ''}
                  {modelo.anio_modelo ? ` (${modelo.anio_modelo})` : ''}
                </option>
              ))}
            </select>
          </div>

  <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Vehículo *
            </label>
            <select
              value={vehiculoForm.tipo_vehiculo_id}
              onChange={(e) =>
                setVehiculoForm({ ...vehiculoForm, tipo_vehiculo_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione un tipo --</option>
              {catalogos.tipos_vehiculo?.map((tipo: any) => (
                <option key={tipo.id_tipo_vehiculo} value={String(tipo.id_tipo_vehiculo)}>
                  {tipo.tipo_vehiculo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sucursal / Zona *
            </label>
            <select
              value={vehiculoForm.sucursal_id}
              onChange={(e) =>
                setVehiculoForm({ ...vehiculoForm, sucursal_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione una sucursal --</option>
              {catalogos.zonas?.map((sucursal: any) => (
                <option key={sucursal.id_sucursal} value={String(sucursal.id_sucursal)}>
                  {sucursal.nombre_sucursal}
                  {sucursal.comuna_sucursal ? ` · ${sucursal.comuna_sucursal}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 {vehiculoEditando ? 'Los cambios se guardarán y actualizarán el vehículo' : 'El vehículo se creará y estará disponible para asignar a choferes'}
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalVehiculo(false);
                setVehiculoEditando(null);
                setVehiculoForm({
                  patente_vehiculo: '',
                  estado_vehiculo: 'disponible',
                  kilometraje_vehiculo: '',
                  categoria_id: '',
                  modelo_vehiculo_id: '',
                  tipo_vehiculo_id: '',
                  sucursal_id: '',
                });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarVehiculo}
              className={`px-4 py-2 text-white rounded-lg ${
                vehiculoEditando 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {vehiculoEditando ? 'Actualizar Vehículo' : 'Agregar Vehículo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

