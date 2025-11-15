import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Usuario } from '../types/database';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('apt_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const normalizedUsername = (username || '').trim();
    const normalizedPassword = (password || '').trim();
    const usernameLower = normalizedUsername.toLowerCase();

    const normalizeRut = (value: string) =>
      value ? value.replace(/[.\-]/g, '').toLowerCase() : '';

    const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

    const demoUsers: Record<string, Omit<Usuario, 'id_usuario' | 'created_at' | 'ultima_conexion'>> = {
      admin: { usuario: 'admin', clave: 'admin123', rol: 'admin', estado_usuario: true },
      planner: { usuario: 'planner', clave: 'planner123', rol: 'planner', estado_usuario: true },
      coordinador: { usuario: 'coordinador', clave: 'coordinador123', rol: 'planner', estado_usuario: true },
      supervisor: { usuario: 'supervisor', clave: 'supervisor123', rol: 'supervisor', estado_usuario: true },
      mecanico: { usuario: 'mecanico', clave: 'mecanico123', rol: 'mechanic', estado_usuario: true },
      driver1: { usuario: 'driver1', clave: 'driver123', rol: 'driver', estado_usuario: true },
      chofer: { usuario: 'chofer', clave: 'chofer123', rol: 'driver', estado_usuario: true },
      guardia: { usuario: 'guardia', clave: 'guardia123', rol: 'guard', estado_usuario: true },
      jefedetaller: { usuario: 'jefedetaller', clave: 'jefedetaller123', rol: 'jefe_taller', estado_usuario: true },
    };

    const buildUsuario = (source: any): Usuario => ({
      id_usuario: source.id_usuario ?? -1,
      usuario: source.usuario,
      clave: source.clave,
      rol: source.rol,
      ultima_conexion: new Date().toISOString(),
      estado_usuario: true,
      created_at: source.created_at || new Date().toISOString(),
    });

    const resolveLocalUser = (): Usuario | null => {
      const usuariosLS = JSON.parse(localStorage.getItem('apt_usuarios') || '[]');
      const empleadosLS = JSON.parse(localStorage.getItem('apt_empleados') || '[]');
      
      let usuarioLocal = usuariosLS.find(
        (u: any) =>
          u.estado_usuario &&
          typeof u.usuario === 'string' &&
          u.usuario.toLowerCase() === usernameLower &&
          u.clave === normalizedPassword
      );

      if (!usuarioLocal) {
        const rutNormalizado = normalizeRut(normalizedUsername);
        if (rutNormalizado) {
          const empleadoPorRut = empleadosLS.find((e: any) => {
            if (!e.rut_empleado && !e.rut) return false;
            const rutEmpleado = e.rut_empleado || e.rut;
            return normalizeRut(rutEmpleado) === rutNormalizado;
          });
          
          if (empleadoPorRut) {
            usuarioLocal = usuariosLS.find(
              (u: any) =>
                u.estado_usuario &&
                u.id_usuario === empleadoPorRut.usuario_id &&
                u.clave === normalizedPassword
            );
          }
        }
      }

      return usuarioLocal ? buildUsuario(usuarioLocal) : null;
    };

    const isBlockedLocalUser = (): boolean => {
      const usuariosLS = JSON.parse(localStorage.getItem('apt_usuarios') || '[]');
      const empleadosLS = JSON.parse(localStorage.getItem('apt_empleados') || '[]');

      const matchDirecto = usuariosLS.find(
        (u: any) => typeof u.usuario === 'string' && u.usuario.toLowerCase() === usernameLower
      );
      if (matchDirecto && matchDirecto.estado_usuario === false) {
        return true;
      }

      const rutNormalizado = normalizeRut(normalizedUsername);
      if (rutNormalizado) {
        const empleado = empleadosLS.find((e: any) => {
          if (!e.rut_empleado && !e.rut) return false;
          const rutEmpleado = e.rut_empleado || e.rut;
          return normalizeRut(rutEmpleado) === rutNormalizado;
        });
        if (empleado) {
          const usuarioRelacionado = usuariosLS.find((u: any) => u.id_usuario === empleado.usuario_id);
          if (usuarioRelacionado && usuarioRelacionado.estado_usuario === false) {
            return true;
          }
        }
      }

      return false;
    };

    const resolveDemoUser = (): Usuario | null => {
      const found = Object.values(demoUsers).find(
        (u) =>
          u.estado_usuario &&
          u.usuario.toLowerCase() === usernameLower &&
          u.clave === normalizedPassword
      );

      if (!found) return null;

      return {
        id_usuario: -1,
        usuario: found.usuario,
        clave: found.clave,
        rol: found.rol,
        ultima_conexion: new Date().toISOString(),
        estado_usuario: true,
        created_at: new Date().toISOString(),
      };
    };

    const persistUser = (resolvedUser: Usuario) => {
      setUser(resolvedUser);
      localStorage.setItem('apt_user', JSON.stringify(resolvedUser));
    };

    const findSupabaseUser = async (): Promise<Usuario | null> => {
      const { data: usuarioCoincidencia, error: usuarioError } = await supabase
        .from('usuario')
        .select('*')
        .ilike('usuario', normalizedUsername)
        .limit(1)
        .maybeSingle();

      if (usuarioError && usuarioError.code !== 'PGRST116') {
        throw usuarioError;
      }

      if (usuarioCoincidencia && usuarioCoincidencia.estado_usuario === false) {
        throw new Error('Usuario inactivo');
      }

      let candidato = usuarioCoincidencia as Usuario | null;

      if (!candidato || (candidato.clave || '').trim() !== normalizedPassword) {
        const rutNormalizado = normalizeRut(normalizedUsername);

        if (rutNormalizado) {
          const { data: empleadosData, error: empleadosError } = await supabase
            .from('empleado')
            .select('rut, usuario:usuario_id (*)')
            .not('usuario_id', 'is', null);

          if (empleadosError) {
            throw empleadosError;
          }

          const coincidencia = (empleadosData || []).find((empleado: any) => {
            if (!empleado?.rut) return false;
            return normalizeRut(empleado.rut) === rutNormalizado;
          });

          if (coincidencia?.usuario) {
            if (coincidencia.usuario.estado_usuario === false) {
              throw new Error('Usuario inactivo');
            }
            candidato = coincidencia.usuario as Usuario;
          }
        }
      }

      if (!candidato) return null;

      if (!candidato.estado_usuario) {
        throw new Error('Usuario inactivo');
      }

      if ((candidato.clave || '').trim() !== normalizedPassword) {
        return null;
      }

      return candidato;
    };

    if (!hasEnv) {
      const localUser = resolveLocalUser();
      if (localUser) {
        persistUser(localUser);
        return;
      }

      if (isBlockedLocalUser()) {
        throw new Error('Usuario inactivo');
      }

      const demoUser = resolveDemoUser();
      if (demoUser) {
        persistUser(demoUser);
        return;
      }

      throw new Error('Credenciales inválidas');
    }

    try {
      const supabaseUser = await findSupabaseUser();

      if (!supabaseUser) {
        throw new Error('Credenciales inválidas');
      }

      const ultimaConexion = new Date().toISOString();

      await supabase
        .from('usuario')
        .update({ ultima_conexion: ultimaConexion })
        .eq('id_usuario', supabaseUser.id_usuario);

      persistUser({ ...supabaseUser, ultima_conexion: ultimaConexion });
    } catch (error) {
      if (error instanceof Error && error.message === 'Usuario inactivo') {
        throw error;
      }

      const localUser = resolveLocalUser();
      if (localUser) {
        persistUser(localUser);
        return;
      }

      if (isBlockedLocalUser()) {
        throw new Error('Usuario inactivo');
      }

      const demoUser = resolveDemoUser();
      if (demoUser) {
        persistUser(demoUser);
        return;
      }

      throw (error instanceof Error ? error : new Error('Credenciales inválidas'));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('apt_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
