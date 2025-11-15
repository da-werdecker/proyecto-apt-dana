import { useState, useEffect } from 'react';
import { Home, Users, Truck, FileText, Key, ClipboardList, Shield, ChevronDown, ChevronRight, X, Calendar, CheckSquare, Wrench, AlertCircle, Settings, BarChart3, Activity, CheckCircle, Gauge } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentPage, onNavigate, isOpen = true, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [showAdminSubmenu, setShowAdminSubmenu] = useState(true);
  const [showGateSubmenu, setShowGateSubmenu] = useState(true);
  const [showCoordinatorSubmenu, setShowCoordinatorSubmenu] = useState(true);
  const [showSupervisorSubmenu, setShowSupervisorSubmenu] = useState(true);
  const [showMechanicSubmenu, setShowMechanicSubmenu] = useState(true);
  const [showWorkshopChiefSubmenu, setShowWorkshopChiefSubmenu] = useState(true);
  const [userDisplayName, setUserDisplayName] = useState('');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['guard', 'driver'] },
    { id: 'admin', label: 'Administrador', icon: Settings, roles: ['admin'], hasSubmenu: true },
    { id: 'schedule-diagnostic', label: 'Agendar Diagnóstico', icon: Calendar, roles: ['driver'] },
    { id: 'coordinator', label: 'Coordinador', icon: CheckSquare, roles: ['planner'], hasSubmenu: true },
    { id: 'supervisor', label: 'Supervisor', icon: Activity, roles: ['supervisor'], hasSubmenu: true },
    { id: 'mechanic', label: 'Mecánico', icon: Settings, roles: ['mechanic'], hasSubmenu: true },
    { id: 'workshop-chief', label: 'Jefe de Taller', icon: Wrench, roles: ['jefe_taller'], hasSubmenu: true },
    { id: 'gate', label: 'Portería', icon: Shield, roles: ['guard'] },
  ];

  const adminSubmenuItems = [
    { id: 'admin-usuarios', label: 'Usuarios', icon: Users },
    { id: 'admin-vehiculos', label: 'Gestión de Vehículos', icon: Truck },
    { id: 'admin-ordenes', label: 'Órdenes de Trabajo', icon: FileText },
    { id: 'admin-roles', label: 'Roles y Permisos', icon: Shield },
    { id: 'admin-catalogos', label: 'Catálogos del Taller', icon: ClipboardList },
    { id: 'admin-agenda', label: 'Configuración de Agenda', icon: Calendar },
    { id: 'admin-auditoria', label: 'Auditoría y Seguridad', icon: Key },
  ];

  const gateSubmenuItems = [
    { id: 'gate-ingreso', label: 'Ingreso de Vehículos', icon: Truck },
    { id: 'gate-salida', label: 'Salida de Vehículos', icon: Truck },
    { id: 'gate-historial', label: 'Historial del Día', icon: Calendar },
  ];

  const coordinatorSubmenuItems = [
    { id: 'coordinator-agenda', label: 'Agenda del Taller', icon: Calendar },
    { id: 'coordinator-solicitudes', label: 'Solicitudes', icon: ClipboardList },
    { id: 'coordinator-emergencias', label: 'Emergencias en Ruta', icon: AlertCircle },
    { id: 'coordinator-ordenes', label: 'Órdenes de Trabajo', icon: Settings },
    { id: 'coordinator-vehiculos', label: 'Estado de Vehículos', icon: Truck },
    { id: 'coordinator-reportes', label: 'Reportes Operativos', icon: BarChart3 },
  ];

  const workshopChiefSubmenuItems = [
    { id: 'workshop-agenda', label: 'Agenda de Diagnósticos', icon: Calendar },
    { id: 'workshop-checklists', label: 'Checklists de Diagnóstico', icon: ClipboardList },
    { id: 'workshop-asignacion', label: 'Asignación de Mecánicos', icon: Users },
    { id: 'workshop-reparacion', label: 'OT en Reparación', icon: Settings },
    { id: 'workshop-cierre', label: 'Cierre Técnico de OT', icon: CheckCircle },
    { id: 'workshop-carga', label: 'Carga del Taller', icon: Activity },
  ];

  const supervisorSubmenuItems = [
    { id: 'supervisor-tablero', label: 'Tablero de OT', icon: FileText },
    { id: 'supervisor-diagnosticos', label: 'Aprobación de Asignaciones', icon: CheckCircle },
    { id: 'supervisor-emergencias', label: 'Emergencias en Ruta', icon: AlertCircle },
    { id: 'supervisor-indicadores', label: 'Indicadores y Productividad', icon: BarChart3 },
  ];

const mechanicSubmenuItems = [
  { id: 'mechanic-dashboard', label: 'Mi Tablero', icon: Gauge },
  { id: 'mechanic-ots', label: 'OT´s y Registro de Avances', icon: FileText },
];

  const visibleItems = menuItems.filter(item =>
    user && item.roles.includes(user.rol)
  );

  // Cargar nombre del empleado
  useEffect(() => {
    const loadEmployeeName = async () => {
      if (!user?.id_usuario) return;

      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      try {
        if (hasEnv) {
          const { data } = await supabase
            .from('empleado')
            .select('nombre, apellido_paterno')
            .eq('usuario_id', user.id_usuario)
            .maybeSingle();
          
          if (data) {
            setUserDisplayName(`${data.nombre} ${data.apellido_paterno}`);
            return;
          }
        }

        // Si no hay BD o no encontró, buscar en localStorage
        const empleados = JSON.parse(localStorage.getItem('apt_empleados') || '[]');
        const found = empleados.find((e: any) => e.usuario_id === user.id_usuario);
        
        if (found) {
          setUserDisplayName(`${found.nombre} ${found.apellido_paterno}`);
        } else {
          setUserDisplayName(user.usuario); // Fallback al RUT
        }
      } catch (error) {
        setUserDisplayName(user.usuario);
      }
    };

    loadEmployeeName();
  }, [user]);

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-800 text-white h-screen flex flex-col z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">PepsiCo</h1>
            <button 
              onClick={onClose}
              className="md:hidden text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {user?.rol === 'admin' && 'Jefe de Taller'}
            {user?.rol === 'planner' && 'Coordinador'}
            {user?.rol === 'supervisor' && 'Supervisor'}
            {user?.rol === 'mechanic' && 'Mecánico'}
            {user?.rol === 'guard' && 'Guardia'}
            {user?.rol === 'repuestos' && 'Asistente de Repuestos'}
            {user?.rol === 'driver' && 'Chofer'}
            {user?.rol === 'jefe_taller' && 'Jefe de Taller'}
          </p>
        </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            
            // Si es Administrador, mostrar con submenú
            if (item.id === 'admin') {
              const isActive = currentPage.startsWith('admin-');
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowAdminSubmenu(!showAdminSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showAdminSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showAdminSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        {adminSubmenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(subItem.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                                  currentPage === subItem.id
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <SubIcon size={16} />
                                {subItem.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Si es Coordinador, mostrar con submenú
            if (item.id === 'coordinator') {
              const isActive = currentPage.startsWith('coordinator-');
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowCoordinatorSubmenu(!showCoordinatorSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showCoordinatorSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showCoordinatorSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        {coordinatorSubmenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(subItem.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                                  currentPage === subItem.id
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <SubIcon size={16} />
                                {subItem.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Si es Supervisor, mostrar con submenú
            if (item.id === 'supervisor') {
              const isActive = currentPage.startsWith('supervisor-');
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowSupervisorSubmenu(!showSupervisorSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showSupervisorSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showSupervisorSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        {supervisorSubmenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(subItem.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                                  currentPage === subItem.id
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <SubIcon size={16} />
                                {subItem.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Si es Mecánico, mostrar con submenú
            if (item.id === 'mechanic') {
              const isActive = currentPage.startsWith('mechanic-');
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowMechanicSubmenu(!showMechanicSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showMechanicSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showMechanicSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        {mechanicSubmenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(subItem.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                                  currentPage === subItem.id
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <SubIcon size={16} />
                                {subItem.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Si es Jefe de Taller, mostrar con submenú
            if (item.id === 'workshop-chief') {
              const isActive = currentPage.startsWith('workshop-');
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowWorkshopChiefSubmenu(!showWorkshopChiefSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showWorkshopChiefSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showWorkshopChiefSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        {workshopChiefSubmenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(subItem.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                                  currentPage === subItem.id
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <SubIcon size={16} />
                                {subItem.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Si es Portería, mostrar con submenú
            if (item.id === 'gate') {
              const isActive = currentPage.startsWith('gate-');
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowGateSubmenu(!showGateSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showGateSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showGateSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        {gateSubmenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(subItem.id);
                                }}
                                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                                  currentPage === subItem.id
                                    ? 'bg-blue-700 text-white'
                                    : 'text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <SubIcon size={16} />
                                {subItem.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Para los demás items, renderizar normal
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="px-4">
          <p className="text-sm font-medium text-slate-300 truncate">{userDisplayName || user?.usuario}</p>
        </div>
      </div>
    </aside>
    </>
  );
}
