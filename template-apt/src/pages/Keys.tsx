import { useEffect, useState } from 'react';
import { Plus, Key } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';

export default function Keys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehiculo_id: '',
    empleado_id: '',
    observaciones_llaves: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [keysRes, employeesRes, vehiclesRes] = await Promise.all([
        supabase.from('llaves').select(`
          *,
          empleado:empleado_id(nombre, apellido_paterno),
          vehiculo:vehiculo_id(patente_vehiculo)
        `).order('fecha_prestamo_llaves', { ascending: false }),
        supabase.from('empleado').select('*').order('nombre', { ascending: true }),
        supabase.from('vehiculo').select('*').order('patente_vehiculo', { ascending: true }),
      ]);

      setKeys(keysRes.data || []);
      setEmployees(employeesRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (error) {
      console.error('Error loading keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      vehiculo_id: parseInt(formData.vehiculo_id),
      empleado_id: parseInt(formData.empleado_id),
      observaciones_llaves: formData.observaciones_llaves,
    };

    try {
      await supabase.from('llaves').insert([submitData]);
      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving key record:', error);
      alert('Error al registrar el préstamo de llaves');
    }
  };

  const handleReturn = async (id: number) => {
    try {
      await supabase
        .from('llaves')
        .update({ fecha_devolucion_llaves: new Date().toISOString() })
        .eq('id_llaves', id);
      loadData();
    } catch (error) {
      console.error('Error returning keys:', error);
      alert('Error al registrar la devolución');
    }
  };

  const resetForm = () => {
    setFormData({
      vehiculo_id: '',
      empleado_id: '',
      observaciones_llaves: '',
    });
  };

  const columns = [
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any) => value?.patente_vehiculo || '-',
    },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any) =>
        value ? `${value.nombre} ${value.apellido_paterno}` : '-',
    },
    {
      header: 'Fecha Préstamo',
      accessor: 'fecha_prestamo_llaves',
      render: (value: string) => new Date(value).toLocaleString('es-CL'),
    },
    {
      header: 'Fecha Devolución',
      accessor: 'fecha_devolucion_llaves',
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString('es-CL') : '-',
    },
    {
      header: 'Estado',
      accessor: 'fecha_devolucion_llaves',
      render: (value: string | null) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {value ? 'Devuelto' : 'En Préstamo'}
        </span>
      ),
    },
    { header: 'Observaciones', accessor: 'observaciones_llaves' },
    {
      header: 'Acciones',
      accessor: 'id_llaves',
      render: (value: number, row: any) =>
        !row.fecha_devolucion_llaves && (
          <button
            onClick={() => handleReturn(value)}
            className="text-green-600 hover:text-green-800 font-medium text-sm"
          >
            Registrar Devolución
          </button>
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
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Registrar Préstamo
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Table columns={columns} data={keys} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Registrar Préstamo de Llaves"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehículo
            </label>
            <select
              value={formData.vehiculo_id}
              onChange={(e) => setFormData({ ...formData, vehiculo_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar vehículo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                  {vehicle.patente_vehiculo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empleado
            </label>
            <select
              value={formData.empleado_id}
              onChange={(e) => setFormData({ ...formData, empleado_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar empleado</option>
              {employees.map((employee) => (
                <option key={employee.id_empleado} value={employee.id_empleado}>
                  {employee.nombre} {employee.apellido_paterno}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones_llaves}
              onChange={(e) => setFormData({ ...formData, observaciones_llaves: e.target.value })}
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
