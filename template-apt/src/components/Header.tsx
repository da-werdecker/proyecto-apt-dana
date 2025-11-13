import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationsDropdown from './NotificationsDropdown';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Cargar nombre del empleado
  useEffect(() => {
    const loadEmployeeName = async () => {
      if (!user?.usuario) return;

      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      try {
        if (hasEnv) {
          const { data } = await supabase
            .from('empleado')
            .select('nombre, apellido_paterno')
            .eq('rut', user.usuario)
            .maybeSingle();
          
          if (data) {
            setUserDisplayName(`${data.nombre} ${data.apellido_paterno}`);
            return;
          }
        }

        // Si no hay BD o no encontró, buscar en localStorage
        const empleados = JSON.parse(localStorage.getItem('apt_empleados') || '[]');
        const found = empleados.find((e: any) => e.rut === user.usuario);
        
        if (found) {
          setUserDisplayName(`${found.nombre} ${found.apellido_paterno}`);
        } else {
          setUserDisplayName(user.usuario); // Fallback al RUT
        }
      } catch (error) {
        console.error('Error cargando nombre:', error);
        setUserDisplayName(user.usuario);
      }
    };

    loadEmployeeName();
  }, [user]);

  const getRoleLabel = () => {
    switch (user?.rol) {
      case 'admin':
        return 'Administrador';
      case 'planner':
        return 'Coordinador';
      case 'supervisor':
        return 'Supervisor';
      case 'mechanic':
        return 'Mecánico';
      case 'guard':
        return 'Guardia';
      case 'repuestos':
        return 'Asistente de Repuestos';
      case 'driver':
        return 'Chofer';
      case 'jefe_taller':
        return 'Jefe de Taller';
      default:
        return 'Usuario';
    }
  };

  return (
    <>
      {/* Top bar azul oscuro */}
      <div className="bg-blue-900 h-2 w-full"></div>
      
      {/* Header principal */}
      <header className="bg-white shadow-sm border-b border-gray-200 rounded-t-xl -mt-2 relative z-10">
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          {/* Botón hamburguesa solo en móvil */}
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={24} className="text-gray-600" />
          </button>
          <div className="hidden md:block w-24"></div>

          {/* Iconos y usuario */}
          <div className="flex items-center gap-2 md:gap-4 ml-auto">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Search size={20} className="text-gray-600" />
            </button>
            <NotificationsDropdown />
            <div className="relative" ref={dropdownRef}>
              <div 
                className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs md:text-base">
                  {userDisplayName ? userDisplayName.charAt(0).toUpperCase() : user?.usuario.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{userDisplayName || user?.usuario}</span>
                  <span className="text-xs text-gray-500">{getRoleLabel()}</span>
                </div>
                <svg className="hidden md:block w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Dropdown menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                  <button
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <LogOut size={18} className="text-gray-600" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

