import { useState, useEffect } from 'react';
import { Truck, Calendar, MapPin, Gauge, Wrench, AlertCircle, ArrowLeft } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function VehicleQRView() {
  const { patente } = useParams<{ patente: string }>();
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    loadVehicle();
  }, [patente]);

  const loadVehicle = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!patente) {
        setError('Patente no especificada');
        setLoading(false);
        return;
      }

      const patenteNormalizada = decodeURIComponent(patente).toUpperCase().trim();

      // Buscar vehículo en Supabase
      if (hasEnv) {
        try {
          const { data, error: supabaseError } = await supabase
            .from('vehiculo')
            .select(`
              *,
              modelo_vehiculo:modelo_vehiculo_id (
                nombre_modelo,
                anio_modelo,
                marca_vehiculo:marca_vehiculo_id (
                  nombre_marca
                )
              ),
              tipo_vehiculo:tipo_vehiculo_id (
                tipo_vehiculo,
                descripcion_tipo_vehiculo
              ),
              sucursal:sucursal_id (
                nombre_sucursal,
                direccion_sucursal,
                comuna_sucursal,
                region_sucursal
              )
            `)
            .eq('patente_vehiculo', patenteNormalizada)
            .maybeSingle();

          if (!supabaseError && data) {
            setVehicle(data);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error buscando en Supabase:', error);
        }
      }

      // Buscar en localStorage
      const vehiculos = readLocal('apt_vehiculos', []);
      const vehiculoEncontrado = vehiculos.find((v: any) => 
        v.patente_vehiculo?.toUpperCase() === patenteNormalizada
      );

      if (vehiculoEncontrado) {
        // Enriquecer con datos relacionados
        const modelos = readLocal('apt_modelos', []);
        const tipos = readLocal('apt_tipos', []);
        const sucursales = readLocal('apt_sucursales', []);
        const marcas = readLocal('apt_marcas', []);

        const modelo = modelos.find((m: any) => 
          m.id_modelo_vehiculo === vehiculoEncontrado.modelo_vehiculo_id
        );
        const tipo = tipos.find((t: any) => 
          t.id_tipo_vehiculo === vehiculoEncontrado.tipo_vehiculo_id
        );
        const sucursal = sucursales.find((s: any) => 
          s.id_sucursal === vehiculoEncontrado.sucursal_id
        );

        let marca = null;
        if (modelo) {
          marca = marcas.find((m: any) => 
            m.id_marca_vehiculo === modelo.marca_vehiculo_id
          );
        }

        setVehicle({
          ...vehiculoEncontrado,
          modelo_vehiculo: modelo ? {
            ...modelo,
            marca_vehiculo: marca ? { nombre_marca: marca.nombre_marca } : null
          } : null,
          tipo_vehiculo: tipo || null,
          sucursal: sucursal || null,
        });
      } else {
        setError('Vehículo no encontrado');
      }
    } catch (err: any) {
      console.error('Error cargando vehículo:', err);
      setError(err.message || 'Error al cargar el vehículo');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información del vehículo...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vehículo no encontrado</h1>
          <p className="text-gray-600 mb-4">
            {error || 'No se encontró información para el vehículo buscado.'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Patente: <strong>{patente ? decodeURIComponent(patente).toUpperCase() : 'N/A'}</strong>
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Información del Vehículo</h1>
            <Truck className="text-white" size={32} />
          </div>
          <p className="text-blue-100">Detalles del vehículo registrado</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patente destacada */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center">
            <p className="text-sm text-blue-600 font-semibold mb-2">PATENTE</p>
            <p className="text-4xl font-bold text-blue-900">
              {vehicle.patente_vehiculo?.toUpperCase() || 'N/A'}
            </p>
          </div>

          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Marca</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.modelo_vehiculo?.marca_vehiculo?.nombre_marca || 
                 vehicle.modelo_vehiculo?.marca?.nombre_marca || 
                 'N/A'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Modelo</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.modelo_vehiculo?.nombre_modelo || 'N/A'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Tipo</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.tipo_vehiculo?.tipo_vehiculo || 'N/A'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Año</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.anio_vehiculo || vehicle.modelo_vehiculo?.anio_modelo || 'N/A'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Kilometraje</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.kilometraje_vehiculo 
                  ? `${vehicle.kilometraje_vehiculo.toLocaleString('es-ES')} km`
                  : 'N/A'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Estado</p>
              </div>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {vehicle.estado_vehiculo || 'N/A'}
              </p>
            </div>
          </div>

          {/* Sucursal */}
          {vehicle.sucursal && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Sucursal</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.sucursal.nombre_sucursal || 'N/A'}
              </p>
              {vehicle.sucursal.direccion_sucursal && (
                <p className="text-sm text-gray-600 mt-1">
                  {vehicle.sucursal.direccion_sucursal}
                  {vehicle.sucursal.comuna_sucursal && `, ${vehicle.sucursal.comuna_sucursal}`}
                  {vehicle.sucursal.region_sucursal && `, ${vehicle.sucursal.region_sucursal}`}
                </p>
              )}
            </div>
          )}

          {/* Capacidad de carga */}
          {vehicle.capacidad_carga_vehiculo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Capacidad de Carga</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {vehicle.capacidad_carga_vehiculo} toneladas
              </p>
            </div>
          )}

          {/* Fecha de adquisición */}
          {vehicle.fecha_adquisicion_vehiculo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="text-gray-400" size={20} />
                <p className="text-sm font-semibold text-gray-600">Fecha de Adquisición</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(vehicle.fecha_adquisicion_vehiculo).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}

          {/* Botón de regreso */}
          <div className="pt-4 border-t">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft size={18} />
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}











