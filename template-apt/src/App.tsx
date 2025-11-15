import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Vehicles from './pages/Vehicles';
import WorkOrders from './pages/WorkOrders';
import Keys from './pages/Keys';
import Incidents from './pages/Incidents';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Gate from './pages/Gate';
import GateDashboard from './pages/GateDashboard';
import EmployeeRegister from './pages/EmployeeRegister';
import ScheduleDiagnostic from './pages/ScheduleDiagnostic';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import WorkshopChiefDashboard from './pages/WorkshopChiefDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import MechanicDashboard from './pages/MechanicDashboard';
import AdminDashboard from './pages/AdminDashboard';
import VehicleQRView from './pages/VehicleQRView';
import GateQRScanner from './pages/GateQRScanner';

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Home onGoToLogin={() => {}} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<EmployeeRegister />} />
        <Route path="/vehiculo/:patente" element={<VehicleQRView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Determinar currentPage basado en la ruta actual
  const currentPage = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
  const handleNavigate = (page: string) => {
    navigate(`/${page}`);
    setSidebarOpen(false); // Cerrar sidebar al navegar en móvil
  };

  // Determinar la ruta inicial según el rol del usuario
  const getInitialRoute = () => {
    if (user?.rol === 'admin') {
      return '/admin-usuarios';
    }
    if (user?.rol === 'guard') {
      return '/gate-ingreso';
    }
    if (user?.rol === 'jefe_taller') {
      return '/workshop-agenda';
    }
    if (user?.rol === 'planner') {
      return '/coordinator-solicitudes';
    }
    if (user?.rol === 'supervisor') {
      return '/supervisor-tablero';
    }
    if (user?.rol === 'mechanic') {
      return '/mechanic-dashboard';
    }
    if (user?.rol === 'driver') {
      return '/schedule-diagnostic';
    }
    return '/dashboard';
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col ml-0 md:ml-64 w-full md:w-auto overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 overflow-y-auto bg-gray-100">
          <main className="p-4 md:p-8 min-h-full">
            <Routes>
              <Route path="/" element={<Navigate to={getInitialRoute()} replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin-usuarios" element={<AdminDashboard activeSection="usuarios" />} />
              <Route path="/admin-vehiculos" element={<AdminDashboard activeSection="vehiculos" />} />
              <Route path="/admin-ordenes" element={<AdminDashboard activeSection="ordenes" />} />
              <Route path="/admin-roles" element={<AdminDashboard activeSection="roles" />} />
              <Route path="/admin-catalogos" element={<AdminDashboard activeSection="catalogos" />} />
              <Route path="/admin-agenda" element={<AdminDashboard activeSection="agenda" />} />
              <Route path="/admin-flota" element={<AdminDashboard activeSection="flota" />} />
              <Route path="/admin-auditoria" element={<AdminDashboard activeSection="auditoria" />} />
              <Route path="/gate-ingreso" element={<Gate activeSection="ingreso" />} />
              <Route path="/gate-salida" element={<Gate activeSection="salida" />} />
              <Route path="/gate-historial" element={<Gate activeSection="historial" />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/keys" element={<Keys />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/schedule-diagnostic" element={<ScheduleDiagnostic />} />
            <Route path="/coordinator-agenda" element={<CoordinatorDashboard activeSection="agenda" />} />
            <Route path="/coordinator-solicitudes" element={<CoordinatorDashboard activeSection="solicitudes" />} />
            <Route path="/coordinator-emergencias" element={<CoordinatorDashboard activeSection="emergencias" />} />
            <Route path="/coordinator-ordenes" element={<CoordinatorDashboard activeSection="ordenes" />} />
            <Route path="/coordinator-vehiculos" element={<CoordinatorDashboard activeSection="vehiculos" />} />
            <Route path="/coordinator-reportes" element={<CoordinatorDashboard activeSection="reportes" />} />
            <Route path="/workshop-agenda" element={<WorkshopChiefDashboard activeSection="agenda" />} />
            <Route path="/workshop-checklists" element={<WorkshopChiefDashboard activeSection="checklists" />} />
            <Route path="/workshop-asignacion" element={<WorkshopChiefDashboard activeSection="asignacion" />} />
            <Route path="/workshop-reparacion" element={<WorkshopChiefDashboard activeSection="reparacion" />} />
            <Route path="/workshop-cierre" element={<WorkshopChiefDashboard activeSection="cierre" />} />
            <Route path="/workshop-carga" element={<WorkshopChiefDashboard activeSection="carga" />} />
            <Route path="/supervisor-tablero" element={<SupervisorDashboard activeSection="tablero" />} />
            <Route path="/supervisor-diagnosticos" element={<SupervisorDashboard activeSection="diagnosticos" />} />
            <Route path="/supervisor-emergencias" element={<SupervisorDashboard activeSection="emergencias" />} />
            <Route path="/supervisor-indicadores" element={<SupervisorDashboard activeSection="indicadores" />} />
            <Route path="/mechanic-dashboard" element={<MechanicDashboard activeSection="overview" />} />
            <Route path="/mechanic-ots" element={<MechanicDashboard activeSection="ot-progress" initialCombinedTab="ordenes" />} />
            <Route path="/mechanic-assigned" element={<MechanicDashboard activeSection="assigned" initialCombinedTab="ordenes" />} />
            <Route path="/mechanic-progress" element={<MechanicDashboard activeSection="progress" initialCombinedTab="registro" />} />
            <Route path="/vehiculo/:patente" element={<VehicleQRView />} />
            <Route path="*" element={<Navigate to={getInitialRoute()} replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
