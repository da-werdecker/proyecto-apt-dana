import { useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';

export default function Incidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    descripcion_incidencia: '',
    gravedad_incidencia: 'media',
    estado_incidencia: 'pendiente',
    observaciones_incidencia: '',
    orden_trabajo_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [incidentsRes, ordersRes] = await Promise.all([
        supabase.from('incidencia').select(`
          *,
          orden_trabajo:orden_trabajo_id(
            id_orden_trabajo,
            empleado:empleado_id(nombre, apellido_paterno),
            vehiculo:vehiculo_id(patente_vehiculo)
          )
        `).order('fecha_incidencia', { ascending: false }),
        supabase.from('orden_trabajo').select(`
          *,
          empleado:empleado_id(nombre, apellido_paterno),
          vehiculo:vehiculo_id(patente_vehiculo)
        `).order('fecha_inicio_ot', { ascending: false }),
      ]);

      setIncidents(incidentsRes.data || []);
      setWorkOrders(ordersRes.data || []);
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      descripcion_incidencia: formData.descripcion_incidencia,
      gravedad_incidencia: formData.gravedad_incidencia,
      estado_incidencia: formData.estado_incidencia,
      observaciones_incidencia: formData.observaciones_incidencia,
      orden_trabajo_id: parseInt(formData.orden_trabajo_id),
    };

    try {
      await supabase.from('incidencia').insert([submitData]);
      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving incident:', error);
      alert('Error al guardar la incidencia');
    }
  };

  const resetForm = () => {
    setFormData({
      descripcion_incidencia: '',
      gravedad_incidencia: 'media',
      estado_incidencia: 'pendiente',
      observaciones_incidencia: '',
      orden_trabajo_id: '',
    });
  };

  const columns = [
    { header: 'ID', accessor: 'id_incidencia' },
    {
      header: 'Orden de Trabajo',
      accessor: 'orden_trabajo',
      render: (value: any) => `OT #${value?.id_orden_trabajo}` || '-',
    },
    {
      header: 'Vehículo',
      accessor: 'orden_trabajo',
      render: (value: any) => value?.vehiculo?.patente_vehiculo || '-',
    },
    {
      header: 'Gravedad',
      accessor: 'gravedad_incidencia',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'baja'
              ? 'bg-blue-100 text-blue-800'
              : value === 'media'
              ? 'bg-yellow-100 text-yellow-800'
              : value === 'alta'
              ? 'bg-orange-100 text-orange-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      header: 'Estado',
      accessor: 'estado_incidencia',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'pendiente'
              ? 'bg-yellow-100 text-yellow-800'
              : value === 'en revision'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      header: 'Descripción',
      accessor: 'descripcion_incidencia',
      render: (value: string) => (
        <div className="max-w-xs truncate" title={value}>
          {value || '-'}
        </div>
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fecha_incidencia',
      render: (value: string) => new Date(value).toLocaleString('es-CL'),
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
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Registrar Incidencia
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Table columns={columns} data={incidents} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Registrar Incidencia"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orden de Trabajo
            </label>
            <select
              value={formData.orden_trabajo_id}
              onChange={(e) => setFormData({ ...formData, orden_trabajo_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar orden de trabajo</option>
              {workOrders.map((order) => (
                <option key={order.id_orden_trabajo} value={order.id_orden_trabajo}>
                  OT #{order.id_orden_trabajo} - {order.vehiculo?.patente_vehiculo} - {order.empleado?.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gravedad
            </label>
            <select
              value={formData.gravedad_incidencia}
              onChange={(e) => setFormData({ ...formData, gravedad_incidencia: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.descripcion_incidencia}
              onChange={(e) => setFormData({ ...formData, descripcion_incidencia: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Descripción detallada de la incidencia"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones_incidencia}
              onChange={(e) => setFormData({ ...formData, observaciones_incidencia: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Observaciones adicionales"
            />
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
              Registrar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
