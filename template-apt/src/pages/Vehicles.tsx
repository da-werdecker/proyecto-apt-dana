import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { Vehiculo } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

export default function Vehicles() {
  const { user } = useAuth();
  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [modelos, setModelos] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehiculo | null>(null);
  const [formData, setFormData] = useState({
    patente_vehiculo: '',
    anio_vehiculo: '',
    fecha_adquisicion_vehiculo: '',
    capacidad_carga_vehiculo: '',
    estado_vehiculo: 'disponible',
    kilometraje_vehiculo: '',
    modelo_vehiculo_id: '',
    tipo_vehiculo_id: '',
    sucursal_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vehiclesRes, modelosRes, tiposRes, sucursalesRes] = await Promise.all([
        supabase
          .from('vehiculo')
          .select(
            `
          *,
          modelo:modelo_vehiculo_id(nombre_modelo, marca:marca_vehiculo_id(nombre_marca)),
          tipo:tipo_vehiculo_id(tipo_vehiculo),
          sucursal:sucursal_id(nombre_sucursal)
        `
          )
          .order('id_vehiculo', { ascending: true }),
        supabase
          .from('modelo_vehiculo')
          .select(
            `
          *,
          marca:marca_vehiculo_id(nombre_marca)
        `
          ),
        supabase.from('tipo_vehiculo').select('*'),
        supabase.from('sucursal').select('*'),
      ]);

      const hasError =
        vehiclesRes.error || modelosRes.error || tiposRes.error || sucursalesRes.error;

      if (hasError) {
        throw new Error('Supabase error loading vehicles metadata');
      }

      setVehicles(vehiclesRes.data ?? []);
      setModelos(modelosRes.data ?? []);
      setTipos(tiposRes.data ?? []);
      setSucursales(sucursalesRes.data ?? []);
    } catch (error) {
      // Cargar desde localStorage
      const vehiclesLS = readLocal('apt_vehiculos', []);
      const modelosLS = readLocal('apt_modelos', []);
      const tiposLS = readLocal('apt_tipos', []);
      const sucursalesLS = readLocal('apt_sucursales', []);
      
      setVehicles(vehiclesLS);
      setModelos(modelosLS);
      setTipos(tiposLS);
      setSucursales(sucursalesLS);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      anio_vehiculo: formData.anio_vehiculo ? parseInt(formData.anio_vehiculo) : null,
      capacidad_carga_vehiculo: formData.capacidad_carga_vehiculo ? parseFloat(formData.capacidad_carga_vehiculo) : null,
      kilometraje_vehiculo: formData.kilometraje_vehiculo ? parseFloat(formData.kilometraje_vehiculo) : null,
      modelo_vehiculo_id: parseInt(formData.modelo_vehiculo_id),
      tipo_vehiculo_id: parseInt(formData.tipo_vehiculo_id),
      sucursal_id: parseInt(formData.sucursal_id),
    };

    try {
      if (editingVehicle) {
        await supabase
          .from('vehiculo')
          .update(submitData)
          .eq('id_vehiculo', editingVehicle.id_vehiculo);
      } else {
        await supabase.from('vehiculo').insert([submitData]);
      }

      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Error al guardar el vehículo');
    }
  };

  const handleEdit = (vehicle: Vehiculo) => {
    setEditingVehicle(vehicle);
    setFormData({
      patente_vehiculo: vehicle.patente_vehiculo,
      anio_vehiculo: vehicle.anio_vehiculo?.toString() || '',
      fecha_adquisicion_vehiculo: vehicle.fecha_adquisicion_vehiculo || '',
      capacidad_carga_vehiculo: vehicle.capacidad_carga_vehiculo?.toString() || '',
      estado_vehiculo: vehicle.estado_vehiculo,
      kilometraje_vehiculo: vehicle.kilometraje_vehiculo?.toString() || '',
      modelo_vehiculo_id: vehicle.modelo_vehiculo_id.toString(),
      tipo_vehiculo_id: vehicle.tipo_vehiculo_id.toString(),
      sucursal_id: vehicle.sucursal_id.toString(),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este vehículo?')) return;

    try {
      await supabase.from('vehiculo').delete().eq('id_vehiculo', id);
      loadData();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Error al eliminar el vehículo');
    }
  };

  const resetForm = () => {
    setEditingVehicle(null);
    setFormData({
      patente_vehiculo: '',
      anio_vehiculo: '',
      fecha_adquisicion_vehiculo: '',
      capacidad_carga_vehiculo: '',
      estado_vehiculo: 'disponible',
      kilometraje_vehiculo: '',
      modelo_vehiculo_id: '',
      tipo_vehiculo_id: '',
      sucursal_id: '',
    });
  };

  const columns = [
    { header: 'Patente', accessor: 'patente_vehiculo' },
    {
      header: 'Modelo',
      accessor: 'modelo',
      render: (value: any) =>
        value ? `${value.marca?.nombre_marca} ${value.nombre_modelo}` : '-',
    },
    {
      header: 'Tipo',
      accessor: 'tipo',
      render: (value: any) => value?.tipo_vehiculo || '-',
    },
    { header: 'Año', accessor: 'anio_vehiculo' },
    {
      header: 'Estado',
      accessor: 'estado_vehiculo',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'disponible'
              ? 'bg-green-100 text-green-800'
              : value === 'en ruta'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      header: 'Kilometraje',
      accessor: 'kilometraje_vehiculo',
      render: (value: number) => value ? `${value.toLocaleString()} km` : '-',
    },
    user?.rol === 'guard'
      ? {
          header: 'Acciones',
          accessor: 'id_vehiculo',
          render: (_: any, row: Vehiculo) => (
            <div className="flex gap-2">
              <button onClick={() => handleEdit(row)} className="text-blue-600 hover:text-blue-800">
                <Edit size={18} />
              </button>
              <button onClick={() => handleDelete(row.id_vehiculo)} className="text-red-600 hover:text-red-800">
                <Trash2 size={18} />
              </button>
            </div>
          ),
        }
      : null,
  ].filter(Boolean) as any;

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        {user?.rol === 'guard' && (
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Agregar Vehículo
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Table columns={columns} data={vehicles} />
      </div>

      {user?.rol === 'guard' && (
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingVehicle ? 'Editar Vehículo' : 'Agregar Vehículo'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patente
              </label>
              <input
                type="text"
                value={formData.patente_vehiculo}
                onChange={(e) => setFormData({ ...formData, patente_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo
              </label>
              <select
                value={formData.modelo_vehiculo_id}
                onChange={(e) => setFormData({ ...formData, modelo_vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar modelo</option>
                {modelos.map((modelo) => (
                  <option key={modelo.id_modelo_vehiculo} value={modelo.id_modelo_vehiculo}>
                    {modelo.marca?.nombre_marca} {modelo.nombre_modelo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={formData.tipo_vehiculo_id}
                onChange={(e) => setFormData({ ...formData, tipo_vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar tipo</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id_tipo_vehiculo} value={tipo.id_tipo_vehiculo}>
                    {tipo.tipo_vehiculo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sucursal
              </label>
              <select
                value={formData.sucursal_id}
                onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar sucursal</option>
                {sucursales.map((sucursal) => (
                  <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                    {sucursal.nombre_sucursal}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Año
              </label>
              <input
                type="number"
                value={formData.anio_vehiculo}
                onChange={(e) => setFormData({ ...formData, anio_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={formData.estado_vehiculo}
                onChange={(e) => setFormData({ ...formData, estado_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="disponible">Disponible</option>
                <option value="en ruta">En Ruta</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Adquisición
              </label>
              <input
                type="date"
                value={formData.fecha_adquisicion_vehiculo}
                onChange={(e) => setFormData({ ...formData, fecha_adquisicion_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacidad de Carga (ton)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.capacidad_carga_vehiculo}
                onChange={(e) => setFormData({ ...formData, capacidad_carga_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kilometraje
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.kilometraje_vehiculo}
                onChange={(e) => setFormData({ ...formData, kilometraje_vehiculo: e.target.value })}
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
              {editingVehicle ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
      )}
    </div>
  );
}
