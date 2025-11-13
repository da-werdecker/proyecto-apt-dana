import { useEffect, useState } from 'react';
import { Truck, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function GateDashboard() {
  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  
  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const [stats, setStats] = useState({
    totalVehicles: 0,
    arrivalsToday: 0,
    authorizedAccess: 0,
    deniedAccess: 0,
    departuresToday: 0,
  });

  const [arrivalQueue, setArrivalQueue] = useState<any[]>([]);
  const [deniedAccess, setDeniedAccess] = useState<any[]>([]);
  const [departures, setDepartures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllArrivals, setShowAllArrivals] = useState(false);
  const [showAllDenied, setShowAllDenied] = useState(false);
  const [showAllDepartures, setShowAllDepartures] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Actualizar cada 5 segundos para reflejar cambios en tiempo real
    const interval = setInterval(() => {
      loadDashboardData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Cargar vehículos y registros desde localStorage
      const vehicles = readLocal('apt_vehiculos', []);
      const registrosIngreso = readLocal('apt_registros_ingreso', []);
      const registrosSalida = readLocal('apt_registros_salida', []);
      
      // Filtrar registros de hoy
      const hoy = new Date().toDateString();
      const registrosHoy = registrosIngreso.filter((r: any) => {
        const fechaRegistro = new Date(r.fecha).toDateString();
        return fechaRegistro === hoy;
      });
      
      const registrosSalidaHoy = registrosSalida.filter((r: any) => {
        const fechaRegistro = new Date(r.fecha).toDateString();
        return fechaRegistro === hoy;
      });
      
      const autorizados = registrosHoy.filter((r: any) => r.estado === 'autorizado').length;
      const denegados = registrosHoy.filter((r: any) => r.estado === 'denegado').length;
      
      // Calcular vehículos actualmente en el taller
      // Total de ingresos autorizados - Total de salidas
      const totalIngresos = registrosIngreso.filter((r: any) => r.estado === 'autorizado').length;
      const totalSalidas = registrosSalida.length;
      const vehiculosEnTaller = totalIngresos - totalSalidas;
      
      setStats({
        totalVehicles: vehiculosEnTaller,
        arrivalsToday: registrosHoy.length,
        authorizedAccess: autorizados,
        deniedAccess: denegados,
        departuresToday: registrosSalidaHoy.length,
      });

      // Guardar todos los registros (sin límite)
      const registrosAutorizados = registrosIngreso.filter((r: any) => r.estado === 'autorizado');
      setArrivalQueue(registrosAutorizados);
      
      const registrosDenegados = registrosIngreso.filter((r: any) => r.estado === 'denegado');
      setDeniedAccess(registrosDenegados);
      
      setDepartures(registrosSalida);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">En Taller</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalVehicles}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Truck size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Llegadas Hoy</p>
              <p className="text-3xl font-bold text-gray-900">{stats.arrivalsToday}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Clock size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Accesos Autorizados</p>
              <p className="text-3xl font-bold text-gray-900">{stats.authorizedAccess}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Accesos Denegados</p>
              <p className="text-3xl font-bold text-gray-900">{stats.deniedAccess}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle size={24} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Han Salido</p>
              <p className="text-3xl font-bold text-gray-900">{stats.departuresToday}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Cola de llegadas */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Cola de llegadas</h2>
        </div>
        <div className="overflow-x-auto">
          {arrivalQueue.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Truck size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay vehículos en la cola de llegadas</p>
              <p className="text-sm mt-2">Los vehículos registrados aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chofer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllArrivals ? arrivalQueue : arrivalQueue.slice(0, 4)).map((arrival, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {arrival.patente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {arrival.chofer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {arrival.motivo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {arrival.hora}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        arrival.estado === 'autorizado' 
                          ? 'bg-green-100 text-green-800' 
                          : arrival.estado === 'pendiente'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {arrival.estado === 'autorizado' ? 'Autorizado' : 
                         arrival.estado === 'pendiente' ? 'Pendiente' : 'Denegado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {arrivalQueue.length > 4 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => setShowAllArrivals(!showAllArrivals)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAllArrivals ? 'Ver menos' : `Ver todas (${arrivalQueue.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Accesos Denegados */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Accesos Denegados</h2>
        </div>
        <div className="overflow-x-auto">
          {deniedAccess.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay accesos denegados</p>
              <p className="text-sm mt-2">Los intentos de acceso denegados aparecerán aquí</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllDenied ? deniedAccess : deniedAccess.slice(0, 4)).map((denied, index) => (
                  <tr key={index} className="hover:bg-red-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-900">
                      {denied.patente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {denied.motivo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {denied.hora}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(denied.fecha).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {deniedAccess.length > 4 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => setShowAllDenied(!showAllDenied)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAllDenied ? 'Ver menos' : `Ver todos (${deniedAccess.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Vehículos que han salido */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Vehículos que han salido</h2>
        </div>
        <div className="overflow-x-auto">
          {departures.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Truck size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay registros de salida</p>
              <p className="text-sm mt-2">Los vehículos que salgan aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(showAllDepartures ? departures : departures.slice(0, 4)).map((departure, index) => (
                  <tr key={index} className="hover:bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                      {departure.patente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {departure.motivo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {departure.hora}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(departure.fecha).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {departures.length > 4 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => setShowAllDepartures(!showAllDepartures)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAllDepartures ? 'Ver menos' : `Ver todos (${departures.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertCircle size={24} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Instrucciones de Uso</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Utiliza la opción "Registro de Ingreso" para verificar vehículos por patente</li>
              <li>• Los accesos autorizados se registrarán automáticamente</li>
              <li>• La cola de llegadas se actualiza en tiempo real</li>
              <li>• Contacta con un administrador para vehículos no registrados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

