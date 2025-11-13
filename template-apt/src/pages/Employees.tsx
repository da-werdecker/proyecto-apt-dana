import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { Empleado, Cargo } from '../types/database';
import { sendEmail } from '../lib/email';

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key: string, value: any) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const [formData, setFormData] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    rut: '',
    email: '',
    telefono1: '',
    telefono2: '',
    fecha_nacimiento: '',
    cargo_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      console.log('🔍 loadData - hasEnv:', hasEnv);
      
      let employeesData = [];
      if (hasEnv) {
        console.log('📊 Cargando desde Supabase...');
        const [employeesRes, cargosRes] = await Promise.all([
          supabase.from('empleado').select(`
            *,
            cargo:cargo_id(nombre_cargo)
          `).order('id_empleado', { ascending: true }),
          supabase.from('cargo').select('*'),
        ]);

        console.log('📊 Supabase employees:', employeesRes.data);
        employeesData = employeesRes.data || [];
        
        // Si Supabase está vacío, intentar localStorage como backup
        if (employeesData.length === 0) {
          console.log('⚠️ Supabase vacío, intentando localStorage...');
          const employeesLS = readLocal('apt_empleados', []);
          if (employeesLS.length > 0) {
            console.log('✅ Encontró empleados en localStorage');
            employeesData = employeesLS;
          }
        }
        
        setCargos(cargosRes.data || []);
      } else {
        // Cargar desde localStorage
        console.log('📊 Cargando desde localStorage...');
        const employeesLS = readLocal('apt_empleados', []);
        console.log('📊 Empleados LS raw:', employeesLS);
        employeesData = employeesLS;
        const cargosLS = readLocal('apt_cargos', []);
        console.log('📊 Cargos LS:', cargosLS);
        setCargos(cargosLS);
      }

      // Enriquecer empleados con datos de usuarios (para mostrar contraseñas)
      const usuarios = readLocal('apt_usuarios', []);
      console.log('📋 Empleados cargados:', employeesData);
      console.log('📋 Usuarios aprobados:', usuarios);
      const employeesEnriquecidos = employeesData.map((emp: any) => {
        const usuario = usuarios.find((u: any) => u.usuario === emp.rut);
        return {
          ...emp,
          password: usuario ? usuario.clave : null,
          usuario_aprobado: !!usuario
        };
      });
      console.log('📋 Empleados enriquecidos:', employeesEnriquecidos);

      setEmployees(employeesEnriquecidos);

      // Cargar usuarios pendientes
      const pending = readLocal('apt_pending_users', []);
      setPendingUsers(pending);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        await supabase
          .from('empleado')
          .update(formData)
          .eq('id_empleado', editingEmployee.id_empleado);
      } else {
        await supabase.from('empleado').insert([formData]);
      }

      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Error al guardar el empleado');
    }
  };

  const handleEdit = (employee: Empleado) => {
    setEditingEmployee(employee);
    setFormData({
      nombre: employee.nombre,
      apellido_paterno: employee.apellido_paterno,
      apellido_materno: employee.apellido_materno || '',
      rut: employee.rut,
      email: employee.email || '',
      telefono1: employee.telefono1 || '',
      telefono2: employee.telefono2 || '',
      fecha_nacimiento: employee.fecha_nacimiento || '',
      cargo_id: employee.cargo_id.toString(),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este empleado?')) return;

    try {
      await supabase.from('empleado').delete().eq('id_empleado', id);
      loadData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Error al eliminar el empleado');
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      nombre: '',
      apellido_paterno: '',
      apellido_materno: '',
      rut: '',
      email: '',
      telefono1: '',
      telefono2: '',
      fecha_nacimiento: '',
      cargo_id: '',
    });
  };

  const handleApproveEmployee = async (pendingUser: any) => {
    try {
      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      // Determinar rol según cargo
      const cargoSeleccionado = cargos.find(c => c.id_cargo === pendingUser.empleado_id?.cargo_id) || 
                                cargos.find(c => c.nombre_cargo === pendingUser.cargo);
      
      let rol = 'driver'; // Por defecto
      const cargoNombre = cargoSeleccionado?.nombre_cargo?.toLowerCase() || '';
      
      if (cargoNombre.includes('jefe de taller')) {
        rol = 'admin';
      } else if (cargoNombre.includes('coordinador')) {
        rol = 'planner';
      } else if (cargoNombre.includes('supervisor')) {
        rol = 'supervisor';
      } else if (cargoNombre.includes('mecánico')) {
        rol = 'mechanic';
      } else if (cargoNombre.includes('guardia')) {
        rol = 'guard';
      } else if (cargoNombre.includes('asistente de repuestos')) {
        rol = 'repuestos';
      } else if (cargoNombre.includes('chofer')) {
        rol = 'driver';
      }
      
      console.log('🔍 Cargo:', cargoNombre, '-> Rol:', rol);

      // Crear usuario en BD
      let userId = null;
      if (hasEnv) {
        const { data: usuarioData, error: usuarioError } = await supabase
          .from('usuario')
          .insert([{
            usuario: pendingUser.rut,
            clave: pendingUser.password,
            rol: rol,
            estado_usuario: true,
          }])
          .select()
          .single();

        if (usuarioError) {
          // Si falla por RLS, usar localStorage
          console.log('⚠️ Error en Supabase, usando localStorage:', usuarioError.message);
        } else {
          userId = usuarioData.id_usuario;

          // Actualizar empleado con usuario_id
          const { error: updateError } = await supabase
            .from('empleado')
            .update({ usuario_id: userId })
            .eq('id_empleado', pendingUser.empleado_id);
          
          if (updateError) {
            console.log('⚠️ Error actualizando empleado, usando localStorage');
          }
        }
      }
      
      // Si no se creó en BD (falló o hasEnv es false)
      if (!userId) {
        // Modo localStorage
        const usuarios = readLocal('apt_usuarios', []);
        userId = Date.now();
        usuarios.push({
          id_usuario: userId,
          usuario: pendingUser.rut,
          clave: pendingUser.password,
          rol: rol,
          estado_usuario: true,
          ultima_conexion: null,
          created_at: new Date().toISOString(),
        });
        writeLocal('apt_usuarios', usuarios);

        // Actualizar empleado
        const empleados = readLocal('apt_empleados', []);
        const empleadoIndex = empleados.findIndex((e: any) => e.id_empleado === pendingUser.empleado_id);
        if (empleadoIndex !== -1) {
          empleados[empleadoIndex].usuario_id = userId;
          writeLocal('apt_empleados', empleados);
        }
      }

      // Remover de pendientes
      const updatedPending = pendingUsers.filter(p => p.empleado_id !== pendingUser.empleado_id);
      writeLocal('apt_pending_users', updatedPending);
      setPendingUsers(updatedPending);

      // Enviar correo de bienvenida al empleado
      await enviarCorreoAprobacion(pendingUser);

      alert(`✅ Empleado ${pendingUser.nombre_completo} aprobado exitosamente.`);
      loadData();
    } catch (error: any) {
      console.error('Error aprobando empleado:', error);
      alert('Error al aprobar empleado: ' + (error.message || 'Error desconocido'));
    }
  };

  const handleRejectEmployee = (pendingUser: any) => {
    if (!confirm(`¿Está seguro de rechazar la solicitud de ${pendingUser.nombre_completo}?`)) return;

    const updatedPending = pendingUsers.filter(p => p.empleado_id !== pendingUser.empleado_id);
    writeLocal('apt_pending_users', updatedPending);
    setPendingUsers(updatedPending);
    
    // Remover también el empleado
    const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (hasEnv) {
      supabase.from('empleado').delete().eq('id_empleado', pendingUser.empleado_id);
    } else {
      const empleados = readLocal('apt_empleados', []);
      const filtered = empleados.filter((e: any) => e.id_empleado !== pendingUser.empleado_id);
      writeLocal('apt_empleados', filtered);
    }

    alert(`❌ Solicitud de ${pendingUser.nombre_completo} rechazada.`);
    loadData();
  };

  const enviarCorreoAprobacion = async (pendingUser: any) => {
    try {
      const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true';
      if (!emailEnabled) {
        console.log('📧 Correos deshabilitados');
        return;
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
              .success-box { background: #d1fae5; border: 2px solid #059669; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center; }
              .credentials { background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 6px; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 ¡Cuenta Aprobada!</h1>
              </div>
              <div class="content">
                <p>Estimado/a <strong>${pendingUser.nombre_completo}</strong>,</p>
                
                <div class="success-box">
                  <h2 style="margin: 0; color: #059669;">✅ Tu registro ha sido aprobado</h2>
                  <p>Ya puedes acceder al sistema APT Taller</p>
                </div>
                
                <div class="credentials">
                  <h3 style="margin-top: 0;">🔐 Tus Credenciales de Acceso</h3>
                  <p><strong>Usuario:</strong> ${pendingUser.rut}</p>
                  <p><strong>Contraseña:</strong> La que configuraste durante el registro</p>
                  ${pendingUser.cargo ? `<p><strong>Cargo:</strong> ${pendingUser.cargo}</p>` : ''}
                </div>
                
                <p style="margin-top: 30px;">Puedes iniciar sesión ahora haciendo clic en el botón de abajo:</p>
                
                <div style="text-align: center;">
                  <a href="${window.location.origin}/login" class="button">
                    Iniciar Sesión en APT Taller
                  </a>
                </div>
                
                <p style="margin-top: 30px; color: #dc2626; font-weight: bold;">
                  ⚠️ IMPORTANTE: Guarda estas credenciales en un lugar seguro.
                </p>
                
                <p>Saludos cordiales,<br><strong>Equipo APT Taller</strong></p>
              </div>
              <div class="footer">
                <p>Este es un correo automático. Por favor no respondas a este mensaje.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = await sendEmail({
        to: pendingUser.email,
        subject: '🎉 ¡Cuenta Aprobada - APT Taller!',
        html: emailHtml
      });

      if (result.ok) {
        console.log('✅ Correo de aprobación enviado a:', pendingUser.email);
      }
    } catch (error) {
      console.error('Error enviando correo de aprobación:', error);
    }
  };

  // Columnas para desktop - todas las columnas
  const columnsDesktop = [
    { 
      header: 'RUT', 
      accessor: 'rut',
      render: (value: any) => <div className="min-w-[140px]">{value || '-'}</div>
    },
    { header: 'Nombre', accessor: 'nombre' },
    { header: 'Apellido Paterno', accessor: 'apellido_paterno' },
    { header: 'Apellido Materno', accessor: 'apellido_materno' },
    {
      header: 'Cargo',
      accessor: 'cargo',
      render: (value: any) => value?.nombre_cargo || '-',
    },
    { header: 'Email', accessor: 'email' },
    { header: 'Teléfono', accessor: 'telefono1' },
    {
      header: 'Usuario',
      accessor: 'usuario_aprobado',
      render: (value: any, row: any) => (
        value ? (
          <div>
            <div className="text-xs text-gray-600">RUT: {row.rut}</div>
            <div className="text-xs text-gray-600">Pwd: {row.password}</div>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">Sin aprobar</span>
        )
      ),
    },
    {
      header: 'Acciones',
      accessor: 'id_empleado',
      render: (_: any, row: Empleado) => (
                  <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800 p-1"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => handleDelete(row.id_empleado)}
            className="text-red-600 hover:text-red-800 p-1"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  // Columnas para móvil - solo las esenciales
  const columnsMobile = [
    { 
      header: 'RUT', 
      accessor: 'rut',
      render: (value: any) => <div className="min-w-[120px]">{value || '-'}</div>
    },
    { 
      header: 'Nombre Completo', 
      accessor: 'nombre',
      render: (value: any, row: any) => (
        <div>
          <div className="font-medium">{value} {row.apellido_paterno} {row.apellido_materno}</div>
        </div>
      )
    },
    {
      header: 'Cargo',
      accessor: 'cargo',
      render: (value: any) => <span className="text-xs">{value?.nombre_cargo || '-'}</span>,
    },
    {
      header: 'Acciones',
      accessor: 'id_empleado',
      render: (_: any, row: Empleado) => (
                  <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800 p-1"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => handleDelete(row.id_empleado)}
            className="text-red-600 hover:text-red-800 p-1"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Agregar Empleado</span>
          <span className="sm:hidden">Agregar</span>
        </button>
      </div>

      {/* Solicitudes Pendientes */}
      {pendingUsers.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <Clock className="text-yellow-600" size={28} />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Solicitudes Pendientes de Aprobación</h2>
            <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
              {pendingUsers.length}
            </span>
          </div>
          
          <div className="grid gap-4">
            {pendingUsers.map((pendingUser: any) => (
              <div key={pendingUser.empleado_id} className="bg-white rounded-lg p-4 border border-yellow-300 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:justify-between items-start gap-4">
                  <div className="flex-1 w-full">
                    <h3 className="font-bold text-base md:text-lg text-gray-900 mb-2">
                      {pendingUser.nombre_completo}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">RUT:</span>
                        <p className="text-gray-900">{pendingUser.rut}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Email:</span>
                        <p className="text-gray-900">{pendingUser.email}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Cargo:</span>
                        <p className="text-gray-900">{pendingUser.cargo || 'Sin especificar'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Fecha de Solicitud:</span>
                        <p className="text-gray-900">
                          {new Date(pendingUser.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full lg:w-auto">
                    <button
                      onClick={() => handleApproveEmployee(pendingUser)}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={18} />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleRejectEmployee(pendingUser)}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle size={18} />
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Tabla para desktop */}
        <div className="hidden lg:block">
          <Table columns={columnsDesktop} data={employees} />
        </div>
        {/* Tabla para móvil */}
        <div className="lg:hidden">
          <Table columns={columnsMobile} data={employees} />
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingEmployee ? 'Editar Empleado' : 'Agregar Empleado'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT
              </label>
              <input
                type="text"
                value={formData.rut}
                onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo
              </label>
              <select
                value={formData.cargo_id}
                onChange={(e) => setFormData({ ...formData, cargo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar cargo</option>
                {cargos.map((cargo) => (
                  <option key={cargo.id_cargo} value={cargo.id_cargo}>
                    {cargo.nombre_cargo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido Paterno
              </label>
              <input
                type="text"
                value={formData.apellido_paterno}
                onChange={(e) => setFormData({ ...formData, apellido_paterno: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido Materno
              </label>
              <input
                type="text"
                value={formData.apellido_materno}
                onChange={(e) => setFormData({ ...formData, apellido_materno: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={formData.fecha_nacimiento}
                onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono 1
              </label>
              <input
                type="tel"
                value={formData.telefono1}
                onChange={(e) => setFormData({ ...formData, telefono1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono 2
              </label>
              <input
                type="tel"
                value={formData.telefono2}
                onChange={(e) => setFormData({ ...formData, telefono2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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
              {editingEmployee ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
