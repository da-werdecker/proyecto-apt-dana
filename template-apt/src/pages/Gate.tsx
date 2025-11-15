import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import { useNotifications } from '../contexts/NotificationContext';
import { sendEmail } from '../lib/email';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

interface GateProps {
  activeSection?: 'ingreso' | 'salida' | 'sin-cita' | 'historial' | 'consulta';
}

export default function Gate({ activeSection = 'ingreso' }: GateProps) {
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
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
  const [modelos, setModelos] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Estados para registro de ingreso
  const [searchPatente, setSearchPatente] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [diagnosticRequest, setDiagnosticRequest] = useState<any | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [nivelCombustible, setNivelCombustible] = useState('');
  const [danosVisibles, setDanosVisibles] = useState('');
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [historialAutorizados, setHistorialAutorizados] = useState<any[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPatente, setQrPatente] = useState<string>('');
  
  // Estados para registro de salida
  const [searchPatenteSalida, setSearchPatenteSalida] = useState('');
  const [foundVehicleSalida, setFoundVehicleSalida] = useState<any | null>(null);
  const [searchingSalida, setSearchingSalida] = useState(false);
  const [historialSalidas, setHistorialSalidas] = useState<any[]>([]);

  // Estados para QR
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScannerActive, setQrScannerActive] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [selectedVehicleForQR, setSelectedVehicleForQR] = useState<any | null>(null);
  const [availableCamerasQR, setAvailableCamerasQR] = useState<any[]>([]);
  const [selectedCameraIdQR, setSelectedCameraIdQR] = useState<string>('');

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
    tipo_caso: 'emergencia',
  });

  // Modales para agregar modelo y sucursal
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newModel, setNewModel] = useState({ nombre_modelo: '', marca_nombre: '' });
  const [newBranch, setNewBranch] = useState({ nombre_sucursal: '' });
  const [newType, setNewType] = useState({ tipo_vehiculo: '' });

  useEffect(() => {
    loadData();
    loadHistorialAutorizados();
    loadHistorialSalidas();
  }, []);

  const loadHistorialAutorizados = () => {
    const historial = readLocal('apt_historial_autorizados', []);
    // Ordenar por fecha más reciente primero
    const historialOrdenado = historial.sort((a: any, b: any) => 
      new Date(b.fecha_busqueda).getTime() - new Date(a.fecha_busqueda).getTime()
    );
    setHistorialAutorizados(historialOrdenado);
  };

  const loadHistorialSalidas = () => {
    const historial = readLocal('apt_historial_salidas', []);
    // Ordenar por fecha más reciente primero
    const historialOrdenado = historial.sort((a: any, b: any) => 
      new Date(b.fecha_salida).getTime() - new Date(a.fecha_salida).getTime()
    );
    setHistorialSalidas(historialOrdenado);
  };

  const guardarEnHistorialSalidas = (vehicle: any, motivo: string) => {
    const fechaHora = new Date();
    const registroHistorial = {
      id: Date.now(),
      patente: vehicle.patente_vehiculo,
      modelo: vehicle.modelo?.nombre_modelo || vehicle.modelo?.marca?.nombre_marca || 'N/A',
      marca: vehicle.modelo?.marca?.nombre_marca || 'N/A',
      tipo: vehicle.tipo?.tipo_vehiculo || 'N/A',
      estado_vehiculo: vehicle.estado_vehiculo || 'N/A',
      motivo: motivo,
      fecha_salida: fechaHora.toISOString(),
      hora_salida: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };

    const historial = readLocal('apt_historial_salidas', []);
    const nuevoHistorial = [registroHistorial, ...historial];
    // Mantener solo los últimos 100 registros
    const historialLimitado = nuevoHistorial.slice(0, 100);
    writeLocal('apt_historial_salidas', historialLimitado);
    
    // Actualizar estado
    setHistorialSalidas(historialLimitado);
    
    // También guardar en Supabase si está configurado
    if (hasEnv) {
      try {
        supabase.from('historial_salidas').insert([registroHistorial]).catch(() => {
          // Silenciar errores si la tabla no existe
        });
      } catch (error) {
        // Silenciar errores
      }
    }
    
    console.log('✅ Registro de salida guardado en historial:', registroHistorial);
  };

  const guardarEnHistorial = (vehicle: any, autorizado: boolean, motivo: string, diagnosticRequest?: any) => {
    const fechaHora = new Date();
    const registroHistorial = {
      id: Date.now(),
      patente: vehicle.patente_vehiculo,
      modelo: vehicle.modelo?.nombre_modelo || vehicle.modelo?.marca?.nombre_marca || 'N/A',
      marca: vehicle.modelo?.marca?.nombre_marca || 'N/A',
      tipo: vehicle.tipo?.tipo_vehiculo || 'N/A',
      estado_vehiculo: vehicle.estado_vehiculo || 'N/A',
      autorizado: autorizado,
      motivo: motivo,
      fecha_busqueda: fechaHora.toISOString(),
      hora_busqueda: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      tiene_diagnostico: diagnosticRequest ? true : false,
      tipo_problema: diagnosticRequest?.tipo_problema || null,
      fecha_cita: diagnosticRequest?.fecha_confirmada || diagnosticRequest?.fecha_solicitada || null,
      horario_cita: diagnosticRequest?.bloque_horario_confirmado || diagnosticRequest?.bloque_horario || null,
      es_para_hoy: diagnosticRequest?.esParaHoy || false,
    };

    const historial = readLocal('apt_historial_autorizados', []);
    const nuevoHistorial = [registroHistorial, ...historial];
    // Mantener solo los últimos 100 registros para no llenar el localStorage
    const historialLimitado = nuevoHistorial.slice(0, 100);
    writeLocal('apt_historial_autorizados', historialLimitado);
    
    // Actualizar estado
    setHistorialAutorizados(historialLimitado);
    
    // También guardar en Supabase si está configurado
    if (hasEnv) {
      try {
        supabase.from('historial_autorizados').insert([registroHistorial]).catch(() => {
          // Silenciar errores si la tabla no existe
        });
      } catch (error) {
        // Silenciar errores
      }
    }
    
    console.log('✅ Registro guardado en historial:', registroHistorial);
  };

  // Limpiar el escáner QR al desmontar el componente
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        stopQRScanner();
      }
    };
  }, []);

  useEffect(() => {
    // Detener el escáner cuando se cambia de sección
    if (activeSection !== 'ingreso' && qrScannerActive) {
      stopQRScanner();
    }
  }, [activeSection]);

  // Cargar cámaras disponibles al montar el componente
  useEffect(() => {
    loadAvailableCamerasQR();
  }, []);

  // Cargar datos según la sección activa
  useEffect(() => {
    if (activeSection === 'historial') {
      loadHistorialAutorizados();
      loadHistorialSalidas();
    }
  }, [activeSection]);

  const loadData = async () => {
    try {
      const [modelosRes, tiposRes, sucursalesRes, vehiclesRes] = await Promise.all([
        supabase.from('modelo_vehiculo').select(`*, marca:marca_vehiculo_id(nombre_marca)`),
        supabase.from('tipo_vehiculo').select('*'),
        supabase.from('sucursal').select('*'),
        supabase.from('vehiculo').select(`
          *,
          modelo:modelo_vehiculo_id(nombre_modelo, marca:marca_vehiculo_id(nombre_marca)),
          tipo:tipo_vehiculo_id(tipo_vehiculo),
          sucursal:sucursal_id(nombre_sucursal)
        `).order('created_at', { ascending: false }),
      ]);

      // Verificar si hay errores
      if (modelosRes.error || tiposRes.error || sucursalesRes.error || vehiclesRes.error) {
        throw new Error('Error loading data from database');
      }

      // Solo cargar datos de Supabase si tienen contenido
      const hasModelos = modelosRes.data && modelosRes.data.length > 0;
      const hasTipos = tiposRes.data && tiposRes.data.length > 0;
      const hasSucursales = sucursalesRes.data && sucursalesRes.data.length > 0;
      const hasVehicles = vehiclesRes.data && vehiclesRes.data.length > 0;

      if (hasModelos || hasTipos || hasSucursales || hasVehicles) {
        if (hasModelos) setModelos(modelosRes.data);
        if (hasTipos) setTipos(tiposRes.data);
        if (hasSucursales) setSucursales(sucursalesRes.data);
        if (hasVehicles) setVehicles(vehiclesRes.data);
        return; // Éxito, salir
      }

      // Si llegamos aquí, la BD está vacía o inaccesible
      throw new Error('Empty lists');
    } catch (_err) {
      // Cargar desde localStorage primero
      const modelosLS = readLocal('apt_modelos', []);
      const tiposLS = readLocal('apt_tipos', []);
      const sucursalesLS = readLocal('apt_sucursales', []);
      const vehiclesLS = readLocal('apt_vehiculos', []);
      
      if (modelosLS.length || tiposLS.length || sucursalesLS.length || vehiclesLS.length) {
        setModelos(modelosLS);
        setTipos(tiposLS);
        setSucursales(sucursalesLS);
        setVehicles(vehiclesLS);
        return;
      }
      
      // Si no hay datos locales, usar demo
      const demoModelos = [
        { id_modelo_vehiculo: -1, nombre_modelo: 'FMX', marca: { nombre_marca: 'Volvo' } },
        { id_modelo_vehiculo: -2, nombre_modelo: 'Actros', marca: { nombre_marca: 'Mercedes' } },
      ];
      const demoTipos = [
        { id_tipo_vehiculo: -1, tipo_vehiculo: 'Camión' },
        { id_tipo_vehiculo: -2, tipo_vehiculo: 'Furgón' },
      ];
      const demoSucursales = [
        { id_sucursal: -1, nombre_sucursal: 'Santa Marta' },
      ];
      setModelos(demoModelos);
      setTipos(demoTipos);
      setSucursales(demoSucursales);
      setVehicles([]);
      if (!hasEnv) {
        writeLocal('apt_modelos', demoModelos);
        writeLocal('apt_tipos', demoTipos);
        writeLocal('apt_sucursales', demoSucursales);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        anio_vehiculo: formData.anio_vehiculo ? parseInt(formData.anio_vehiculo) : null,
        capacidad_carga_vehiculo: formData.capacidad_carga_vehiculo ? parseFloat(formData.capacidad_carga_vehiculo) : null,
        kilometraje_vehiculo: formData.kilometraje_vehiculo ? parseFloat(formData.kilometraje_vehiculo) : null,
        modelo_vehiculo_id: parseInt(formData.modelo_vehiculo_id),
        tipo_vehiculo_id: parseInt(formData.tipo_vehiculo_id),
        sucursal_id: parseInt(formData.sucursal_id),
      };
      // Intentar guardar en Supabase si hay variables de entorno
      let savedInDatabase = false;
      if (hasEnv) {
        const { error } = await supabase.from('vehiculo').insert([payload]);
        if (!error) {
          savedInDatabase = true;
        }
      }
      
      // Si no se guardó en BD (no hay variables de entorno o falló), guardar localmente
      if (!savedInDatabase) {
        // Encontrar los objetos relacionados para mostrar
        const modeloSeleccionado = modelos.find(m => String(m.id_modelo_vehiculo) === formData.modelo_vehiculo_id);
        const tipoSeleccionado = tipos.find(t => String(t.id_tipo_vehiculo) === formData.tipo_vehiculo_id);
        const sucursalSeleccionada = sucursales.find(s => String(s.id_sucursal) === formData.sucursal_id);
        
        const vehiculoEnriquecido = {
          id_vehiculo: Date.now(),
          ...payload,
          modelo: modeloSeleccionado,
          tipo: tipoSeleccionado,
          sucursal: sucursalSeleccionada,
        };
        
        const current = readLocal('apt_vehiculos', []);
        writeLocal('apt_vehiculos', [vehiculoEnriquecido, ...current]);
        setVehicles([vehiculoEnriquecido, ...current]);
      } else {
        // Si se guardó en BD, recargar datos
        loadData();
      }
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
      alert('Vehículo registrado');
      addNotification(`Nuevo vehículo registrado: ${formData.patente_vehiculo}`);
    } catch (error) {
      // Si ocurre un error inesperado, aún así intentar guardar localmente
      const modeloSeleccionado = modelos.find(m => String(m.id_modelo_vehiculo) === formData.modelo_vehiculo_id);
      const tipoSeleccionado = tipos.find(t => String(t.id_tipo_vehiculo) === formData.tipo_vehiculo_id);
      const sucursalSeleccionada = sucursales.find(s => String(s.id_sucursal) === formData.sucursal_id);
      
      const vehiculoEnriquecido = {
        id_vehiculo: Date.now(),
        patente_vehiculo: formData.patente_vehiculo,
        anio_vehiculo: formData.anio_vehiculo ? parseInt(formData.anio_vehiculo) : null,
        fecha_adquisicion_vehiculo: formData.fecha_adquisicion_vehiculo || null,
        capacidad_carga_vehiculo: formData.capacidad_carga_vehiculo ? parseFloat(formData.capacidad_carga_vehiculo) : null,
        kilometraje_vehiculo: formData.kilometraje_vehiculo ? parseFloat(formData.kilometraje_vehiculo) : null,
        estado_vehiculo: formData.estado_vehiculo,
        modelo_vehiculo_id: parseInt(formData.modelo_vehiculo_id),
        tipo_vehiculo_id: parseInt(formData.tipo_vehiculo_id),
        sucursal_id: parseInt(formData.sucursal_id),
        modelo: modeloSeleccionado,
        tipo: tipoSeleccionado,
        sucursal: sucursalSeleccionada,
      };
      
      const current = readLocal('apt_vehiculos', []);
      writeLocal('apt_vehiculos', [vehiculoEnriquecido, ...current]);
      alert('Vehículo registrado');
      addNotification(`Nuevo vehículo registrado: ${formData.patente_vehiculo}`);
    } finally {
      setSaving(false);
    }
  };

  const addModel = async () => {
    if (!newModel.nombre_modelo || !newModel.marca_nombre) {
      alert('Completa Marca y Modelo');
      return;
    }
    try {
      // Asegura que exista la marca, créala si no
      const { data: marca, error: marcaError } = await supabase
        .from('marca_vehiculo')
        .select('*')
        .eq('nombre_marca', newModel.marca_nombre)
        .maybeSingle();

      if (marcaError) {
        throw marcaError;
      }

      let marcaId = marca?.id_marca_vehiculo;
      if (!marcaId) {
        const { data: inserted, error: insertMarcaError } = await supabase
          .from('marca_vehiculo')
          .insert([{ nombre_marca: newModel.marca_nombre }])
          .select()
          .single();
        
        if (insertMarcaError) {
          throw insertMarcaError;
        }
        marcaId = inserted?.id_marca_vehiculo;
      }

      const { data: nuevoModelo, error: modeloError } = await supabase
        .from('modelo_vehiculo')
        .insert([{ nombre_modelo: newModel.nombre_modelo, marca_vehiculo_id: marcaId }])
        .select()
        .single();

      if (modeloError) {
        throw modeloError;
      }

      if (nuevoModelo?.id_modelo_vehiculo) {
        // Añade de inmediato para que se vea sin esperar recarga
        const withMarca = { ...nuevoModelo, marca: { nombre_marca: newModel.marca_nombre } } as any;
        setModelos(prev => [withMarca, ...prev]);
        setFormData((prev) => ({ ...prev, modelo_vehiculo_id: String(nuevoModelo.id_modelo_vehiculo) }));
      }

      setNewModel({ nombre_modelo: '', marca_nombre: '' });
      setNewModelOpen(false);
      // si hay BD, recarga en segundo plano; si no, mantiene estado local
      if (hasEnv) loadData();
    } catch (_err) {
      // Fallback demo: agrega a estado local y selecciona
      const tempId = Math.min(0, ...modelos.map(m => m.id_modelo_vehiculo || 0)) - 1;
      const nuevo = { id_modelo_vehiculo: tempId, nombre_modelo: newModel.nombre_modelo, marca: { nombre_marca: newModel.marca_nombre } };
      const nuevosModelos = [nuevo, ...modelos];
      setModelos(nuevosModelos);
      writeLocal('apt_modelos', nuevosModelos);
      setFormData(prev => ({ ...prev, modelo_vehiculo_id: String(tempId) }));
      setNewModel({ nombre_modelo: '', marca_nombre: '' });
      setNewModelOpen(false);
    }
  };

  const addBranch = async () => {
    if (!newBranch.nombre_sucursal) { alert('Ingresa el nombre de la sucursal'); return; }
    try {
      const { data: nuevaSucursal, error } = await supabase
        .from('sucursal')
        .insert([{ nombre_sucursal: newBranch.nombre_sucursal }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (nuevaSucursal?.id_sucursal) {
        setSucursales(prev => [nuevaSucursal, ...prev]);
        setFormData((prev) => ({ ...prev, sucursal_id: String(nuevaSucursal.id_sucursal) }));
      }

      setNewBranch({ nombre_sucursal: '' });
      setNewBranchOpen(false);
      if (hasEnv) loadData();
    } catch (_err) {
      // Fallback demo: agrega a estado local
      const tempId = Math.min(0, ...sucursales.map(s => s.id_sucursal || 0)) - 1;
      const nueva = { id_sucursal: tempId, nombre_sucursal: newBranch.nombre_sucursal };
      const nuevasSucursales = [nueva, ...sucursales];
      setSucursales(nuevasSucursales);
      writeLocal('apt_sucursales', nuevasSucursales);
      setFormData(prev => ({ ...prev, sucursal_id: String(tempId) }));
      setNewBranch({ nombre_sucursal: '' });
      setNewBranchOpen(false);
    }
  };

  // Función para buscar vehículo por patente
  const searchVehicle = async () => {
    if (!searchPatente.trim()) {
      alert('Ingresa una patente');
      return;
    }
    
    setSearching(true);
    setFoundVehicle(null);
    setDiagnosticRequest(null);
    
    try {
      const patenteNormalizada = searchPatente.trim().toUpperCase();
      let vehicle = null;
      
      // Buscar en los vehículos ya cargados (case-insensitive)
      const found = vehicles.find((v: any) => 
        v.patente_vehiculo?.toUpperCase() === patenteNormalizada
      );
      if (found) {
        vehicle = found;
      }
      
      // También buscar en localStorage si no se encontró
      if (!vehicle) {
        const vehiculosLocal = readLocal('apt_vehiculos', []);
        const foundLocal = vehiculosLocal.find((v: any) => 
          v.patente_vehiculo?.toUpperCase() === patenteNormalizada
        );
        if (foundLocal) {
          vehicle = foundLocal;
        }
      }
      
      // Buscar solicitudes confirmadas para hoy
      const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const hoy = new Date().toISOString().split('T')[0];
      
      console.log('🔍 Buscando vehículo:', patenteNormalizada);
      console.log('📅 Fecha de hoy:', hoy);
      console.log('📋 Total de solicitudes:', solicitudes.length);
      console.log('📋 Solicitudes disponibles:', solicitudes.map((s: any) => ({
        patente: s.patente_vehiculo,
        estado: s.estado_solicitud,
        fecha_confirmada: s.fecha_confirmada,
        fecha_solicitada: s.fecha_solicitada
      })));
      
      // Buscar solicitud confirmada con esta patente (puede ser para hoy o cualquier día)
      const solicitudConfirmada = solicitudes.find((s: any) => {
        const fechaSolicitud = s.fecha_confirmada || s.fecha_solicitada;
        const fechaSolicitudNormalizada = fechaSolicitud ? new Date(fechaSolicitud).toISOString().split('T')[0] : null;
        const patenteMatch = s.patente_vehiculo?.toUpperCase() === patenteNormalizada;
        const estadoConfirmado = s.estado_solicitud === 'confirmada';
        
        // Permitir solicitudes confirmadas independientemente de la fecha
        const match = patenteMatch && estadoConfirmado;
        
        if (patenteMatch) {
          console.log('🔍 Solicitud encontrada con patente:', {
            patente: s.patente_vehiculo,
            estado: s.estado_solicitud,
            fecha_confirmada: fechaSolicitudNormalizada,
            fecha_hoy: hoy,
            estadoConfirmado,
            fechaCoincide: fechaSolicitudNormalizada === hoy,
            esParaHoy: fechaSolicitudNormalizada === hoy,
            match
          });
        }
        
        return match;
      });
      
      // Verificar si la solicitud confirmada es para hoy
      const fechaSolicitudConfirmada = solicitudConfirmada 
        ? (solicitudConfirmada.fecha_confirmada || solicitudConfirmada.fecha_solicitada)
        : null;
      const fechaSolicitudNormalizada = fechaSolicitudConfirmada 
        ? new Date(fechaSolicitudConfirmada).toISOString().split('T')[0] 
        : null;
      const esParaHoy = fechaSolicitudNormalizada === hoy;
      
      // Si no se encontró vehículo pero sí hay solicitud confirmada, crear vehículo virtual
      if (!vehicle && solicitudConfirmada) {
        // Buscar la OT asociada
        const ordenAsociada = ordenes.find((o: any) => 
          o.id_orden_trabajo === solicitudConfirmada.orden_trabajo_id ||
          o.solicitud_diagnostico_id === solicitudConfirmada.id_solicitud_diagnostico
        );
        
        // Crear vehículo virtual basado en la solicitud
        vehicle = {
          id_vehiculo: solicitudConfirmada.vehiculo_id || Date.now(),
          patente_vehiculo: patenteNormalizada,
          estado_vehiculo: 'disponible',
          modelo: null,
          tipo: null,
          sucursal: null,
        };
        
        setDiagnosticRequest({
          ...solicitudConfirmada,
          orden: ordenAsociada,
          esParaHoy: esParaHoy, // Agregar flag para saber si es para hoy
        });
        console.log('✅ Solicitud de diagnóstico encontrada:', solicitudConfirmada);
        console.log('✅ Vehículo virtual creado desde solicitud');
        console.log('📅 Es para hoy?', esParaHoy);
      } else if (solicitudConfirmada) {
        // Buscar la OT asociada
        const ordenAsociada = ordenes.find((o: any) => 
          o.id_orden_trabajo === solicitudConfirmada.orden_trabajo_id ||
          o.solicitud_diagnostico_id === solicitudConfirmada.id_solicitud_diagnostico
        );
        
        setDiagnosticRequest({
          ...solicitudConfirmada,
          orden: ordenAsociada,
          esParaHoy: esParaHoy, // Agregar flag para saber si es para hoy
        });
        console.log('✅ Solicitud de diagnóstico encontrada:', solicitudConfirmada);
        console.log('📅 Es para hoy?', esParaHoy);
      }

      if (vehicle) {
        // Verificar el último movimiento del vehículo
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const registrosSalida = readLocal('apt_registros_salida', []);
        
        // Combinar y ordenar todos los registros por fecha
        const todosRegistros = [
          ...registrosIngreso.map((r: any) => ({ ...r, tipo: 'ingreso' })),
          ...registrosSalida.map((r: any) => ({ ...r, tipo: 'salida' })),
        ].sort((a, b) => new Date(b.fecha || b.fecha_busqueda || b.fecha_salida).getTime() - new Date(a.fecha || a.fecha_busqueda || a.fecha_salida).getTime());
        
        // Buscar el último movimiento de este vehículo (normalizar patente)
        const ultimoRegistro = todosRegistros.find((r: any) => 
          (r.patente || '').toUpperCase() === patenteNormalizada
        );
        
        // Si el último movimiento fue una entrada, mostrar que ya está adentro
        if (ultimoRegistro && ultimoRegistro.tipo === 'ingreso' && (ultimoRegistro.estado === 'autorizado' || ultimoRegistro.autorizado === true)) {
          alert('Este vehículo ya está registrado en el taller. Ya ingresó anteriormente.');
          setSearching(false);
          return;
        }
        
        setFoundVehicle(vehicle);
        
        // Guardar en historial de autorizados
        const motivoAutorizacion = diagnosticRequest 
          ? `Diagnóstico - ${diagnosticRequest.tipo_problema}`
          : 'Acceso autorizado';
        guardarEnHistorial(vehicle, true, motivoAutorizacion, diagnosticRequest || undefined);
        
        // Si hay solicitud confirmada, mostrar información pero NO abrir el modal automáticamente
        // El usuario debe hacer clic en el botón "Registrar Ingreso con Observaciones"
        if (!diagnosticRequest) {
          alert('Vehículo encontrado - Acceso autorizado');
          
          // Guardar registro de ingreso autorizado (sin diagnóstico)
          const fechaHora = new Date();
          const patenteNormalizada = vehicle.patente_vehiculo.toUpperCase().trim();
          const registro = {
            id: Date.now(),
            patente: patenteNormalizada,
            chofer: 'N/A',
            motivo: 'Acceso autorizado',
            hora: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            fecha: fechaHora.toISOString(),
            estado: 'autorizado',
          };
          
          const registros = readLocal('apt_registros_ingreso', []);
          writeLocal('apt_registros_ingreso', [registro, ...registros]);
          
          // Generar y mostrar QR con la patente
          setQrPatente(patenteNormalizada);
          setShowQRModal(true);
        } else {
          // Si hay diagnóstico, solo mostrar mensaje informativo, NO abrir modal
          alert('Vehículo encontrado con hora de diagnóstico confirmada. Puedes registrar el ingreso con observaciones usando el botón.');
        }

        // Enviar correo de notificación de ingreso
        try {
          console.log('📧 Intentando enviar correo de notificación...');
          
          const fechaFormateada = fechaHora.toLocaleString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          });
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #1f2937; 
                    background: #f3f4f6;
                    padding: 20px;
                  }
                  .alert-container { 
                    max-width: 650px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  }
                  .alert-header { 
                    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                    color: white; 
                    padding: 25px 30px;
                    text-align: center;
                    position: relative;
                  }
                  .alert-header::before {
                    content: '🚨';
                    font-size: 48px;
                    display: block;
                    margin-bottom: 10px;
                  }
                  .alert-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  .alert-subtitle {
                    font-size: 14px;
                    opacity: 0.95;
                  }
                  .alert-content { 
                    padding: 30px;
                    background: #ffffff;
                  }
                  .alert-badge {
                    display: inline-block;
                    background: #d1fae5;
                    color: #065f46;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 13px;
                    margin-bottom: 25px;
                  }
                  .vehicle-info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 25px;
                  }
                  .info-card {
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 15px;
                    transition: all 0.2s;
                  }
                  .info-card.highlight {
                    background: #eff6ff;
                    border-color: #3b82f6;
                    grid-column: 1 / -1;
                  }
                  .info-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #6b7280;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    margin-bottom: 5px;
                  }
                  .info-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                  }
                  .info-value.large {
                    font-size: 20px;
                    color: #059669;
                  }
                  .separator {
                    height: 1px;
                    background: #e5e7eb;
                    margin: 25px 0;
                  }
                  .timestamp-section {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px 20px;
                    border-radius: 6px;
                    margin-top: 20px;
                  }
                  .timestamp-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #92400e;
                    font-weight: 600;
                    margin-bottom: 5px;
                  }
                  .timestamp-value {
                    font-size: 16px;
                    color: #78350f;
                    font-weight: 600;
                  }
                  .footer { 
                    background: #1f2937;
                    color: #9ca3af;
                    padding: 20px 30px; 
                    text-align: center; 
                    font-size: 12px;
                  }
                  .footer-brand {
                    color: #ffffff;
                    font-weight: 600;
                    margin-bottom: 5px;
                  }
                  @media only screen and (max-width: 600px) {
                    .vehicle-info-grid {
                      grid-template-columns: 1fr;
                    }
                    .info-card.highlight {
                      grid-column: 1;
                    }
                    body {
                      padding: 10px;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="alert-container">
                  <div class="alert-header">
                    <div class="alert-title">ALERTA DE INGRESO DE VEHÍCULO</div>
                    <div class="alert-subtitle">Registro de acceso autorizado al taller</div>
                  </div>
                  
                  <div class="alert-content">
                    <div class="alert-badge">✓ ACCESO AUTORIZADO</div>
                    
                    <div class="vehicle-info-grid">
                      <div class="info-card highlight">
                        <div class="info-label">Patente del Vehículo</div>
                        <div class="info-value large">${vehicle.patente_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Marca</div>
                        <div class="info-value">${vehicle.modelo?.marca?.nombre_marca || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Modelo</div>
                        <div class="info-value">${vehicle.modelo?.nombre_modelo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Tipo de Vehículo</div>
                        <div class="info-value">${vehicle.tipo?.tipo_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Estado</div>
                        <div class="info-value">${vehicle.estado_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Sucursal</div>
                        <div class="info-value">${vehicle.sucursal?.nombre_sucursal || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Año</div>
                        <div class="info-value">${vehicle.anio_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Kilometraje</div>
                        <div class="info-value">${vehicle.kilometraje_vehiculo ? vehicle.kilometraje_vehiculo.toLocaleString('es-ES') + ' km' : 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Capacidad de Carga</div>
                        <div class="info-value">${vehicle.capacidad_carga_vehiculo ? vehicle.capacidad_carga_vehiculo + ' ton' : 'N/A'}</div>
                      </div>
                      
                      ${vehicle.fecha_adquisicion_vehiculo ? `
                      <div class="info-card">
                        <div class="info-label">Fecha de Adquisición</div>
                        <div class="info-value">${new Date(vehicle.fecha_adquisicion_vehiculo).toLocaleDateString('es-ES')}</div>
                      </div>
                      ` : ''}
                      
                      <div class="info-card">
                        <div class="info-label">ID del Vehículo</div>
                        <div class="info-value">${vehicle.id_vehiculo || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div class="separator"></div>
                    
                    <div class="timestamp-section">
                      <div class="timestamp-label">Fecha y Hora de Ingreso</div>
                      <div class="timestamp-value">${fechaFormateada}</div>
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div class="footer-brand">APT Taller - Sistema de Gestión</div>
                    <div>Este es un correo automático generado por el sistema</div>
                  </div>
                </div>
              </body>
            </html>
          `;

          // Enviar correo a administradores
          // NOTA: Para habilitar el envío de correos, cambia VITE_ENABLE_EMAIL a 'true' en .env.local
          const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true' || import.meta.env.VITE_ENABLE_EMAIL === true;
          
          if (emailEnabled) {
            const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'dwerdecker@gmail.com';
            console.log('📧 Destinatario:', adminEmail);
            
            const emailResult = await sendEmail({
              to: adminEmail,
              subject: `🚛 Ingreso de Vehículo - ${vehicle.patente_vehiculo}`,
              html: emailHtml
            });

            console.log('📧 Resultado del envío:', emailResult);

            if (emailResult.ok) {
              console.log('✅ Correo enviado exitosamente. ID:', emailResult.id);
              addNotification(`Correo de notificación enviado a ${adminEmail}`);
            } else {
              console.error('❌ Error al enviar correo:', emailResult.error);
              console.error('📧 Detalles completos:', emailResult);
              // Mostrar alerta al usuario si falla
              alert(`Advertencia: No se pudo enviar el correo de notificación.\nError: ${emailResult.error || 'Error desconocido'}\n\nVerifica la consola para más detalles.`);
            }
          } else {
            console.log('📧 Envío de correos deshabilitado (VITE_ENABLE_EMAIL no está en true)');
          }
        } catch (error: any) {
          // Solo mostrar error si los correos están habilitados
          const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true' || import.meta.env.VITE_ENABLE_EMAIL === true;
          if (emailEnabled) {
            console.error('❌ Error al enviar correo de notificación:', error);
            console.error('📧 Stack:', error.stack);
            alert(`Error al enviar correo:\n${error.message || 'Error desconocido'}\n\nAbre la consola del navegador (F12) para más detalles.`);
          }
          // No bloquear el flujo si falla el correo
        }
      } else {
        // Antes de denegar, verificar si hay alguna solicitud pendiente o confirmada para esta patente
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const solicitudConPatente = solicitudes.find((s: any) => 
          s.patente_vehiculo?.toUpperCase() === patenteNormalizada
        );
        
        if (solicitudConPatente) {
          // Hay una solicitud pero no está confirmada
          if (solicitudConPatente.estado_solicitud !== 'confirmada') {
            alert(`Vehículo encontrado pero la solicitud está en estado: ${solicitudConPatente.estado_solicitud}\nEspera la confirmación del coordinador.`);
          } else {
            alert('Vehículo no encontrado - Acceso denegado');
          }
        } else {
          alert('Vehículo no encontrado - Acceso denegado');
        }
        
        // Guardar registro de ingreso denegado
        const registro = {
          id: Date.now(),
          patente: searchPatente,
          chofer: 'N/A',
          motivo: 'Vehículo no registrado o sin hora confirmada para hoy',
          hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: new Date().toISOString(),
          estado: 'denegado',
        };
        
        const registros = readLocal('apt_registros_ingreso', []);
        writeLocal('apt_registros_ingreso', [registro, ...registros]);
      }
    } catch (error) {
      alert('Error al buscar el vehículo');
    } finally {
      setSearching(false);
    }
  };

  // Función para registrar ingreso de diagnóstico
  const handleRegistrarIngresoDiagnostico = async () => {
    if (!diagnosticRequest || !foundVehicle) {
      alert('Error: No hay solicitud de diagnóstico o vehículo seleccionado');
      return;
    }

    try {
      const fechaHora = new Date();
      
      // Registrar ingreso con observaciones
      const patenteNormalizada = foundVehicle.patente_vehiculo.toUpperCase().trim();
      const registro = {
        id: Date.now(),
        patente: patenteNormalizada,
        chofer: 'N/A',
        motivo: `Diagnóstico - ${diagnosticRequest.tipo_problema}`,
        hora: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        fecha: fechaHora.toISOString(),
        estado: 'autorizado',
        observaciones: observaciones || null,
        nivel_combustible: nivelCombustible || null,
        danos_visibles: danosVisibles || null,
        solicitud_diagnostico_id: diagnosticRequest.id_solicitud_diagnostico,
      };
      
      const registros = readLocal('apt_registros_ingreso', []);
      writeLocal('apt_registros_ingreso', [registro, ...registros]);
      
      // Cambiar estado de la OT a "En diagnóstico"
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const ordenIndex = ordenes.findIndex((o: any) => 
        o.id_orden_trabajo === diagnosticRequest.orden_trabajo_id ||
        o.solicitud_diagnostico_id === diagnosticRequest.id_solicitud_diagnostico
      );
      
      if (ordenIndex !== -1) {
        ordenes[ordenIndex] = {
          ...ordenes[ordenIndex],
          estado_ot: 'en curso', // Cambiar a "en curso" cuando ingresa para diagnóstico
        };
        writeLocal('apt_ordenes_trabajo', ordenes);
        console.log('✅ Estado de OT cambiado a "en curso" (En diagnóstico)');
      }
      
      // También actualizar en Supabase si está configurado
      if (hasEnv) {
        try {
          await supabase
            .from('orden_trabajo')
            .update({ estado_ot: 'en curso' })
            .eq('id_orden_trabajo', diagnosticRequest.orden_trabajo_id);
        } catch (error) {
          console.error('Error actualizando OT en Supabase:', error);
        }
      }
      
      // Actualizar historial después de registrar el ingreso
      loadHistorialAutorizados();
      
      // Generar y mostrar QR con la patente
      setQrPatente(patenteNormalizada);
      setShowIngresoModal(false);
      setShowQRModal(true);
      
      setFoundVehicle(null);
      setDiagnosticRequest(null);
      setSearchPatente('');
      setObservaciones('');
      setNivelCombustible('');
      setDanosVisibles('');
    } catch (error) {
      console.error('Error registrando ingreso:', error);
      alert('Error al registrar el ingreso. Por favor intenta nuevamente.');
    }
  };

  // Función para buscar vehículo por patente (salida)
  const searchVehicleSalida = async () => {
    if (!searchPatenteSalida.trim()) {
      alert('Ingresa una patente');
      return;
    }
    
    setSearchingSalida(true);
    setFoundVehicleSalida(null);
    
    try {
      const patenteNormalizada = searchPatenteSalida.trim().toUpperCase();
      let vehicle = null;
      
      // Buscar en los vehículos ya cargados (case-insensitive)
      const found = vehicles.find((v: any) => 
        v.patente_vehiculo?.toUpperCase() === patenteNormalizada
      );
      if (found) {
        vehicle = found;
      }
      
      // También buscar en localStorage si no se encontró
      if (!vehicle) {
        const vehiculosLocal = readLocal('apt_vehiculos', []);
        const foundLocal = vehiculosLocal.find((v: any) => 
          v.patente_vehiculo?.toUpperCase() === patenteNormalizada
        );
        if (foundLocal) {
          vehicle = foundLocal;
        }
      }
      
      // Si aún no se encuentra, buscar en historial de autorizados o solicitudes de diagnóstico
      if (!vehicle) {
        const historialAutorizados = readLocal('apt_historial_autorizados', []);
        const registroAutorizado = historialAutorizados.find((r: any) => 
          r.patente?.toUpperCase() === patenteNormalizada && r.autorizado === true
        );
        
        if (registroAutorizado) {
          // Crear vehículo virtual desde el historial
          vehicle = {
            id_vehiculo: Date.now(),
            patente_vehiculo: patenteNormalizada,
            estado_vehiculo: 'disponible',
            modelo: registroAutorizado.modelo && registroAutorizado.modelo !== 'N/A' 
              ? { nombre_modelo: registroAutorizado.modelo, marca: { nombre_marca: registroAutorizado.marca } }
              : null,
            tipo: registroAutorizado.tipo && registroAutorizado.tipo !== 'N/A'
              ? { tipo_vehiculo: registroAutorizado.tipo }
              : null,
            sucursal: null,
          };
          console.log('✅ Vehículo virtual creado desde historial de autorizados:', vehicle);
        } else {
          // Buscar en solicitudes de diagnóstico
          const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
          const solicitudConPatente = solicitudes.find((s: any) => 
            s.patente_vehiculo?.toUpperCase() === patenteNormalizada
          );
          
          if (solicitudConPatente) {
            vehicle = {
              id_vehiculo: solicitudConPatente.vehiculo_id || Date.now(),
              patente_vehiculo: patenteNormalizada,
              estado_vehiculo: 'disponible',
              modelo: null,
              tipo: null,
              sucursal: null,
            };
            console.log('✅ Vehículo virtual creado desde solicitud de diagnóstico:', vehicle);
          }
        }
      }

      console.log('🔍 Búsqueda de vehículo para salida:', {
        patente: patenteNormalizada,
        encontrado: vehicle ? 'Sí' : 'No',
        vehiculo: vehicle ? vehicle.patente_vehiculo : null
      });

      if (vehicle) {
        // Verificar el último movimiento del vehículo
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const registrosSalida = readLocal('apt_registros_salida', []);
        const historialAutorizados = readLocal('apt_historial_autorizados', []);
        const historialSalidas = readLocal('apt_historial_salidas', []);
        
        console.log('🔍 Verificando registros para salida:', {
          patente: patenteNormalizada,
          registrosIngreso: registrosIngreso.length,
          registrosSalida: registrosSalida.length,
          historialAutorizados: historialAutorizados.length,
          historialSalidas: historialSalidas.length,
        });
        
        // Combinar todos los registros y ordenar por fecha
        const todosRegistros = [
          ...registrosIngreso.map((r: any) => ({ ...r, tipo: 'ingreso', fecha_ref: r.fecha, patente_ref: r.patente })),
          ...registrosSalida.map((r: any) => ({ ...r, tipo: 'salida', fecha_ref: r.fecha, patente_ref: r.patente })),
          ...historialAutorizados.filter((r: any) => r.autorizado).map((r: any) => ({ ...r, tipo: 'ingreso', fecha_ref: r.fecha_busqueda, patente_ref: r.patente })),
          ...historialSalidas.map((r: any) => ({ ...r, tipo: 'salida', fecha_ref: r.fecha_salida, patente_ref: r.patente })),
        ].sort((a, b) => new Date(b.fecha_ref || 0).getTime() - new Date(a.fecha_ref || 0).getTime());
        
        console.log('🔍 Todos los registros encontrados:', todosRegistros.filter((r: any) => 
          (r.patente_ref || r.patente || '').toUpperCase() === patenteNormalizada
        ));
        
        // Buscar el último movimiento de este vehículo (normalizar patente)
        const ultimoRegistro = todosRegistros.find((r: any) => {
          const patenteRegistro = (r.patente_ref || r.patente || '').toUpperCase();
          return patenteRegistro === patenteNormalizada;
        });
        
        console.log('🔍 Último registro encontrado:', ultimoRegistro);
        
        // Si el último movimiento fue una salida, mostrar que ya salió
        if (ultimoRegistro && ultimoRegistro.tipo === 'salida') {
          alert('Este vehículo ya fue registrado como salida del taller. Ya se retiró anteriormente.');
          setSearchingSalida(false);
          return;
        }
        
        // Si no hay registros previos o el último fue un ingreso, permitir la salida
        if (!ultimoRegistro || ultimoRegistro.tipo !== 'ingreso') {
          console.log('⚠️ No se encontró ingreso previo:', {
            ultimoRegistro: ultimoRegistro,
            tipo: ultimoRegistro?.tipo,
          });
          alert('Este vehículo no tiene registro de ingreso previo. No se puede registrar salida sin ingreso.');
          setSearchingSalida(false);
          return;
        }
        
        setFoundVehicleSalida(vehicle);
        
        // Guardar registro de salida
        const fechaHora = new Date();
        const registro = {
          id: Date.now(),
          patente: vehicle.patente_vehiculo,
          chofer: 'N/A',
          motivo: 'Salida autorizada',
          hora: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: fechaHora.toISOString(),
          tipo: 'salida',
        };
        
        const registros = readLocal('apt_registros_salida', []);
        writeLocal('apt_registros_salida', [registro, ...registros]);
        
        // Guardar en historial de salidas
        guardarEnHistorialSalidas(vehicle, 'Salida autorizada');
        
        // Actualizar historial después de registrar la salida
        loadHistorialSalidas();
        
        // Agregar notificación
        addNotification(`Vehículo salió del taller: ${vehicle.patente_vehiculo}`);
        
        alert('✅ Salida registrada exitosamente');
      } else {
        alert('Vehículo no encontrado - Salida no autorizada');
      }
    } catch (error) {
      console.error('Error al buscar vehículo:', error);
      alert('Error al buscar el vehículo');
    } finally {
      setSearchingSalida(false);
    }
  };

  // Función para cargar cámaras disponibles
  const loadAvailableCamerasQR = async () => {
    try {
      // Primero solicitar permisos básicos para listar dispositivos
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permError) {
        // Ignorar errores de permisos aquí, solo necesitamos listar
      }

      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setAvailableCamerasQR(devices);
        
        // Buscar iVCam o cámara del celular (generalmente tiene "iVCam" en el nombre)
        const ivcamDevice = devices.find((device: any) => {
          const label = (device.label || '').toLowerCase();
          return label.includes('ivcam') ||
                 label.includes('mobile') ||
                 label.includes('phone') ||
                 label.includes('e2esoft'); // iVCam a veces aparece con el nombre del desarrollador
        });
        
        if (ivcamDevice) {
          setSelectedCameraIdQR(ivcamDevice.id);
          console.log('✅ iVCam detectada y seleccionada para escáner QR:', ivcamDevice.label);
        } else if (devices.length > 0) {
          // Si hay múltiples cámaras, usar la primera disponible
          setSelectedCameraIdQR(devices[0].id);
          console.log('📷 Cámara seleccionada para escáner QR:', devices[0].label);
        }
      } else {
        console.log('⚠️ No se encontraron cámaras disponibles');
      }
    } catch (error: any) {
      console.log('Error listando cámaras para escáner QR:', error);
      // Intentar obtener cámaras usando la API nativa
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
          const mappedDevices = videoDevices.map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Cámara ${index + 1}`
          }));
          setAvailableCamerasQR(mappedDevices);
          setSelectedCameraIdQR(mappedDevices[0].id);
        }
      } catch (enumError) {
        console.log('Error enumerando dispositivos:', enumError);
      }
    }
  };

  // Función para iniciar el escáner QR
  const startQRScanner = async () => {
    try {
      // Primero mostrar el elemento
      setShowQRScanner(true);
      
      // Esperar a que React renderice el elemento
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verificar que el elemento existe antes de continuar
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) {
        throw new Error('El elemento del escáner no se encontró. Por favor, recarga la página.');
      }

      // Recargar lista de cámaras disponibles
      await loadAvailableCamerasQR();
      
      setQrScannerActive(true);
      
      const scanner = new Html5Qrcode('qr-reader');
      qrScannerRef.current = scanner;

      // Configuración para escanear desde la cámara
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      };

      // Determinar qué cámara usar
      let cameraToUse: string | { facingMode: string };
      
      if (selectedCameraIdQR && availableCamerasQR.length > 0) {
        // Usar la cámara seleccionada (iVCam u otra)
        cameraToUse = selectedCameraIdQR;
        console.log('📷 Usando cámara seleccionada:', availableCamerasQR.find(c => c.id === selectedCameraIdQR)?.label || selectedCameraIdQR);
      } else if (availableCamerasQR.length > 0) {
        // Si hay cámaras pero no se seleccionó ninguna, usar la primera
        cameraToUse = availableCamerasQR[0].id;
        console.log('📷 Usando primera cámara disponible:', availableCamerasQR[0].label);
      } else {
        // Si no hay cámaras listadas, intentar con environment (móviles)
        cameraToUse = { facingMode: 'environment' };
        console.log('📷 Intentando con cámara trasera (environment)');
      }

      // Intentar iniciar el escáner con la cámara seleccionada
      try {
        await scanner.start(
          cameraToUse,
          config,
          (decodedText) => {
            // Cuando se escanea un QR, extraer la patente y buscar el vehículo
            handleQRScanned(decodedText);
          },
          (errorMessage) => {
            // Ignorar errores de escaneo continuo
          }
        );
      } catch (cameraError: any) {
        // Si falla, intentar con environment como respaldo
        if (typeof cameraToUse !== 'string') {
          throw cameraError;
        }
        
        console.log('⚠️ Error con cámara seleccionada, intentando con cámara trasera...');
        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleQRScanned(decodedText);
          },
          (errorMessage) => {
            // Ignorar errores de escaneo continuo
          }
        );
      }
    } catch (error: any) {
      console.error('Error al iniciar el escáner QR:', error);
      let errorMessage = 'Error al iniciar el escáner. ';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Asegúrate de permitir el acceso a la cámara.';
      }
      
      alert(errorMessage);
      setShowQRScanner(false);
      setQrScannerActive(false);
    }
  };

  // Función para detener el escáner QR
  const stopQRScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        await qrScannerRef.current.clear();
      } catch (error) {
        console.error('Error al detener el escáner:', error);
      }
      qrScannerRef.current = null;
    }
    setQrScannerActive(false);
    setShowQRScanner(false);
  };

  // Función que se ejecuta cuando se escanea un QR
  const handleQRScanned = async (scannedText: string) => {
    // El QR debe contener la patente del vehículo
    // Puede ser solo la patente o un objeto JSON con la patente
    let patente = scannedText.trim();
    
    try {
      // Intentar parsear como JSON en caso de que el QR contenga más información
      const parsed = JSON.parse(scannedText);
      if (parsed.patente) {
        patente = parsed.patente.trim();
      }
    } catch {
      // Si no es JSON, usar el texto directamente como patente
    }

    // Detener el escáner
    await stopQRScanner();
    
    // Actualizar el estado y buscar el vehículo
    setSearchPatente(patente);
    
    // Buscar el vehículo directamente usando la patente escaneada
    if (!patente) {
      alert('No se pudo leer la patente del código QR');
      return;
    }
    
    // Usar la función searchVehicle pero con la patente directamente
    setSearching(true);
    setFoundVehicle(null);
    
    try {
      let vehicle = null;
      
      // Buscar en los vehículos ya cargados (case-sensitive)
      const found = vehicles.find((v: any) => 
        v.patente_vehiculo === patente
      );
      if (found) {
        vehicle = found;
      }

      if (vehicle) {
        // Verificar el último movimiento del vehículo
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const registrosSalida = readLocal('apt_registros_salida', []);
        
        // Combinar y ordenar todos los registros por fecha
        const todosRegistros = [
          ...registrosIngreso.map((r: any) => ({ ...r, tipo: 'ingreso' })),
          ...registrosSalida.map((r: any) => ({ ...r, tipo: 'salida' })),
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        
        // Buscar el último movimiento de este vehículo
        const ultimoRegistro = todosRegistros.find((r: any) => r.patente === patente);
        
        // Si el último movimiento fue una entrada, mostrar que ya está adentro
        if (ultimoRegistro && ultimoRegistro.tipo === 'ingreso' && ultimoRegistro.estado === 'autorizado') {
          alert('Este vehículo ya está registrado en el taller. Ya ingresó anteriormente.');
          setSearching(false);
          return;
        }
        
        setFoundVehicle(vehicle);
        alert('Vehículo encontrado - Acceso autorizado');
        
        // Guardar registro de ingreso autorizado (copiado de searchVehicle)
        const fechaHora = new Date();
        const registro = {
          id: Date.now(),
          patente: vehicle.patente_vehiculo,
          chofer: 'N/A',
          motivo: 'Acceso autorizado',
          hora: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: fechaHora.toISOString(),
          estado: 'autorizado',
        };
        
        const registros = readLocal('apt_registros_ingreso', []);
        writeLocal('apt_registros_ingreso', [registro, ...registros]);

        // Enviar correo de notificación (código copiado de searchVehicle)
        try {
          console.log('📧 Intentando enviar correo de notificación...');
          
          const fechaFormateada = fechaHora.toLocaleString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          });
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #1f2937; 
                    background: #f3f4f6;
                    padding: 20px;
                  }
                  .alert-container { 
                    max-width: 650px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  }
                  .alert-header { 
                    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                    color: white; 
                    padding: 25px 30px;
                    text-align: center;
                    position: relative;
                  }
                  .alert-header::before {
                    content: '🚨';
                    font-size: 48px;
                    display: block;
                    margin-bottom: 10px;
                  }
                  .alert-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  .alert-subtitle {
                    font-size: 14px;
                    opacity: 0.95;
                  }
                  .alert-content { 
                    padding: 30px;
                    background: #ffffff;
                  }
                  .alert-badge {
                    display: inline-block;
                    background: #d1fae5;
                    color: #065f46;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 13px;
                    margin-bottom: 25px;
                  }
                  .vehicle-info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 25px;
                  }
                  .info-card {
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 15px;
                    transition: all 0.2s;
                  }
                  .info-card.highlight {
                    background: #eff6ff;
                    border-color: #3b82f6;
                    grid-column: 1 / -1;
                  }
                  .info-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #6b7280;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    margin-bottom: 5px;
                  }
                  .info-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                  }
                  .info-value.large {
                    font-size: 20px;
                    color: #059669;
                  }
                  .separator {
                    height: 1px;
                    background: #e5e7eb;
                    margin: 25px 0;
                  }
                  .timestamp-section {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px 20px;
                    border-radius: 6px;
                    margin-top: 20px;
                  }
                  .timestamp-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #92400e;
                    font-weight: 600;
                    margin-bottom: 5px;
                  }
                  .timestamp-value {
                    font-size: 16px;
                    color: #78350f;
                    font-weight: 600;
                  }
                  .footer { 
                    background: #1f2937;
                    color: #9ca3af;
                    padding: 20px 30px; 
                    text-align: center; 
                    font-size: 12px;
                  }
                  .footer-brand {
                    color: #ffffff;
                    font-weight: 600;
                    margin-bottom: 5px;
                  }
                  @media only screen and (max-width: 600px) {
                    .vehicle-info-grid {
                      grid-template-columns: 1fr;
                    }
                    .info-card.highlight {
                      grid-column: 1;
                    }
                    body {
                      padding: 10px;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="alert-container">
                  <div class="alert-header">
                    <div class="alert-title">ALERTA DE INGRESO DE VEHÍCULO</div>
                    <div class="alert-subtitle">Registro de acceso autorizado al taller</div>
                  </div>
                  
                  <div class="alert-content">
                    <div class="alert-badge">✓ ACCESO AUTORIZADO</div>
                    
                    <div class="vehicle-info-grid">
                      <div class="info-card highlight">
                        <div class="info-label">Patente del Vehículo</div>
                        <div class="info-value large">${vehicle.patente_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Marca</div>
                        <div class="info-value">${vehicle.modelo?.marca?.nombre_marca || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Modelo</div>
                        <div class="info-value">${vehicle.modelo?.nombre_modelo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Tipo de Vehículo</div>
                        <div class="info-value">${vehicle.tipo?.tipo_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Estado</div>
                        <div class="info-value">${vehicle.estado_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Sucursal</div>
                        <div class="info-value">${vehicle.sucursal?.nombre_sucursal || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div class="separator"></div>
                    
                    <div class="timestamp-section">
                      <div class="timestamp-label">Fecha y Hora de Ingreso</div>
                      <div class="timestamp-value">${fechaFormateada}</div>
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div class="footer-brand">APT Taller - Sistema de Gestión</div>
                    <div>Este es un correo automático generado por el sistema</div>
                  </div>
                </div>
              </body>
            </html>
          `;

          const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true' || import.meta.env.VITE_ENABLE_EMAIL === true;
          
          if (emailEnabled) {
            const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'dwerdecker@gmail.com';
            await sendEmail({
              to: adminEmail,
              subject: `🚛 Ingreso de Vehículo - ${vehicle.patente_vehiculo}`,
              html: emailHtml
            });
            addNotification(`Correo de notificación enviado a ${adminEmail}`);
          }
        } catch (error: any) {
          const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true' || import.meta.env.VITE_ENABLE_EMAIL === true;
          if (emailEnabled) {
            console.error('❌ Error al enviar correo de notificación:', error);
          }
        }
      } else {
        alert('Vehículo no encontrado - Acceso denegado');
        
        // Guardar registro de ingreso denegado
        const registro = {
          id: Date.now(),
          patente: patente,
          chofer: 'N/A',
          motivo: 'Vehículo no registrado',
          hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: new Date().toISOString(),
          estado: 'denegado',
        };
        
        const registros = readLocal('apt_registros_ingreso', []);
        writeLocal('apt_registros_ingreso', [registro, ...registros]);
      }
    } catch (error) {
      alert('Error al buscar el vehículo');
    } finally {
      setSearching(false);
    }
  };

  // Función para generar QR de un vehículo
  const generateQRForVehicle = (vehicle: any) => {
    setSelectedVehicleForQR(vehicle);
    setShowQRGenerator(true);
  };

  return (
    <div className="space-y-6">
      {/* Vista previa de vehículos recientes */}
      {vehicles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Vehículos Registrados Recientes</h2>
          <div className="flex flex-wrap gap-3">
            {vehicles
              .filter((vehicle: any) => 
                !vehicle.patente_vehiculo?.toLowerCase().includes('pene')
              )
              .slice(0, 10)
              .map((vehicle: any) => (
              <div
                key={vehicle.id_vehiculo || vehicle.id_local}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-900"
              >
                <span>{vehicle.patente_vehiculo}</span>
                <button
                  onClick={() => generateQRForVehicle(vehicle)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                  title="Generar código QR"
                >
                  QR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenido de la pestaña Registrar Vehículo */}
      {/* Contenido de Ingresos sin Cita */}
      {activeSection === 'sin-cita' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ingresos sin Cita</h1>
          <p className="text-gray-600 mb-6">Registrar ingresos de emergencia o sin OT previa, marcando tipo de caso.</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Caso <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.tipo_caso}
              onChange={(e) => setFormData({ ...formData, tipo_caso: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="emergencia">Emergencia</option>
              <option value="sin_ot">Sin OT Previa</option>
              <option value="urgente">Urgente</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patente</label>
              <input
                type="text"
                value={formData.patente_vehiculo}
                onChange={(e) => setFormData({ ...formData, patente_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                <button type="button" className="text-blue-600 text-sm" onClick={() => setNewModelOpen(true)}>+ Crear modelo</button>
              </div>
              <select
                value={formData.modelo_vehiculo_id}
                onChange={(e) => setFormData({ ...formData, modelo_vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar modelo</option>
                {modelos.map((modelo) => (
                  <option key={modelo.id_modelo_vehiculo} value={String(modelo.id_modelo_vehiculo)}>
                    {modelo.marca?.nombre_marca} {modelo.nombre_modelo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <button type="button" className="text-blue-600 text-sm" onClick={() => setNewTypeOpen(true)}>+ Crear tipo</button>
              </div>
              <select
                value={formData.tipo_vehiculo_id}
                onChange={(e) => setFormData({ ...formData, tipo_vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar tipo</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id_tipo_vehiculo} value={String(tipo.id_tipo_vehiculo)}>{tipo.tipo_vehiculo}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                <button type="button" className="text-blue-600 text-sm" onClick={() => setNewBranchOpen(true)}>+ Crear sucursal</button>
              </div>
              <select
                value={formData.sucursal_id}
                onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar sucursal</option>
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={String(s.id_sucursal)}>{s.nombre_sucursal}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input type="number" value={formData.anio_vehiculo} onChange={(e) => setFormData({ ...formData, anio_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formData.estado_vehiculo} onChange={(e) => setFormData({ ...formData, estado_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                <option value="disponible">Disponible</option>
                <option value="en ruta">En Ruta</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Adquisición</label>
              <input type="date" value={formData.fecha_adquisicion_vehiculo} onChange={(e) => setFormData({ ...formData, fecha_adquisicion_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad de Carga (ton)</label>
              <input type="number" step="0.01" value={formData.capacidad_carga_vehiculo} onChange={(e) => setFormData({ ...formData, capacidad_carga_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kilometraje</label>
              <input type="number" step="0.01" value={formData.kilometraje_vehiculo} onChange={(e) => setFormData({ ...formData, kilometraje_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
        </div>
      )}

      {/* Contenido de la pestaña Registro de Ingreso */}
      {/* Contenido de Ingreso de Vehículos */}
      {activeSection === 'ingreso' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-500 text-white shadow-xl shadow-blue-200/70">
            <div className="p-6 md:p-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">Flujo guiado</p>
                <h1 className="text-3xl font-bold">Ingreso de Vehículos</h1>
                <p className="text-white/85 max-w-2xl">
                  Escanea el QR o escribe la patente, verifica los datos y autoriza el acceso en menos de un minuto.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="bg-white/15 rounded-2xl p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Autorizados hoy</p>
                  <p className="text-2xl font-bold">{historialAutorizados.filter((registro) => {
                    const fecha = new Date(registro.fecha_busqueda);
                    const hoy = new Date();
                    return (
                      fecha.getDate() === hoy.getDate() &&
                      fecha.getMonth() === hoy.getMonth() &&
                      fecha.getFullYear() === hoy.getFullYear()
                    );
                  }).length}</p>
                </div>
                <div className="bg-white/15 rounded-2xl p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Vehículos registrados</p>
                  <p className="text-2xl font-bold">{vehicles.length}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/20 px-6 md:px-8 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: 'Escanea o escribe',
                    desc: 'Captura la patente con QR o teclea manualmente.',
                    icon: '📷',
                  },
                  {
                    title: 'Verifica datos',
                    desc: 'Revisa marca, modelo y citas programadas.',
                    icon: '🧾',
                  },
                  {
                    title: 'Autoriza ingreso',
                    desc: 'Registra observaciones y confirma el acceso.',
                    icon: '✅',
                  },
                ].map((step) => (
                  <div key={step.title} className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm flex gap-3">
                    <span className="text-2xl">{step.icon}</span>
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="text-sm text-white/80">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col gap-2 mb-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Panel de búsqueda y escaneo</h2>
                    <p className="text-sm text-slate-500">
                      Introduce la patente o activa el lector QR. El sistema te mostrará el detalle del vehículo automáticamente.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Escáner {qrScannerActive ? 'activo' : 'disponible'}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="flex-1 relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">🚗</span>
                      <input
                        id="patente-search"
                        type="text"
                        value={searchPatente}
                        onChange={(e) => setSearchPatente(e.target.value)}
                        placeholder="Ingresa la patente · Ej: BDKJ34"
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-lg font-semibold tracking-wide uppercase shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && searchVehicle()}
                      />
                    </div>
                    <button
                      onClick={searchVehicle}
                      disabled={searching}
                      className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {searching ? 'Buscando...' : 'Buscar'}
                    </button>
                    <button
                      onClick={qrScannerActive ? stopQRScanner : startQRScanner}
                      className={`px-6 py-3 rounded-xl font-semibold shadow transition ${
                        qrScannerActive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {qrScannerActive ? 'Detener escáner' : 'Escanear QR'}
                    </button>
                  </div>

                  {!qrScannerActive && availableCamerasQR.length > 1 && (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                      <label className="block text-sm font-medium text-blue-900 mb-2">
                        📷 Selecciona la cámara que usarás
                      </label>
                      <select
                        value={selectedCameraIdQR}
                        onChange={(e) => setSelectedCameraIdQR(e.target.value)}
                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        {availableCamerasQR.map((camera: any) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.label || `Cámara ${camera.id}`}
                            {camera.label?.toLowerCase().includes('ivcam') ? ' 📱 (iVCam - Celular)' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-blue-700 mt-2">
                        {availableCamerasQR.find((c: any) => c.id === selectedCameraIdQR)?.label?.toLowerCase().includes('ivcam')
                          ? '✅ Usando la cámara del celular vía iVCam'
                          : '💡 Elige "iVCam" si quieres usar tu celular como cámara.'}
                      </p>
                    </div>
                  )}

                  {!qrScannerActive && availableCamerasQR.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold">{availableCamerasQR.length}</span> dispositivos detectados
                      {availableCamerasQR.some((c: any) => c.label?.toLowerCase().includes('ivcam')) && (
                        <span className="text-emerald-600 font-semibold">· iVCam listo</span>
                      )}
                    </div>
                  )}

                  {showQRScanner && (
                    <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 p-4">
                      <div 
                        id="qr-reader" 
                        className="w-full max-w-xl mx-auto rounded-xl overflow-hidden border border-blue-400 shadow-inner"
                        style={{ minHeight: '320px' }}
                      ></div>
                      <p className="text-sm text-blue-900 mt-3 text-center font-medium">
                        {qrScannerActive ? 'Escaneando...' : 'Iniciando escáner, prepara el código QR.'}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-dashed border-blue-200 p-4 bg-blue-50/60">
                    <p className="text-sm text-blue-900 mb-3 flex items-center gap-2">
                      💡 <strong>¿Necesitas el lector en pantalla completa?</strong>
                    </p>
                    <button
                      onClick={() => navigate('/gate-qr-scanner')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                    >
                      Abrir Escáner QR (Modo completo)
                    </button>
                  </div>
                </div>
              </div>

              {foundVehicle && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-emerald-900">Acceso autorizado</h3>
                        {diagnosticRequest && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                            {diagnosticRequest.esParaHoy ? 'Cita para hoy' : 'Cita en otra fecha'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">Patente</p>
                          <p className="text-lg font-semibold text-slate-900">{foundVehicle.patente_vehiculo}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Modelo</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {foundVehicle.modelo?.marca?.nombre_marca} {foundVehicle.modelo?.nombre_modelo}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Tipo</p>
                          <p className="text-slate-900 font-semibold">{foundVehicle.tipo?.tipo_vehiculo}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Sucursal</p>
                          <p className="text-slate-900 font-semibold">{foundVehicle.sucursal?.nombre_sucursal || 'N/A'}</p>
                        </div>
                      </div>

                      {diagnosticRequest && (
                        <div className={`p-4 rounded-2xl border ${diagnosticRequest.esParaHoy ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
                          <h4 className="font-semibold text-slate-900 mb-2">Detalle de diagnóstico</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-slate-500">Problema</p>
                              <p className="font-semibold text-slate-900">{diagnosticRequest.tipo_problema}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Horario confirmado</p>
                              <p className="font-semibold text-slate-900">
                                {diagnosticRequest.bloque_horario_confirmado || diagnosticRequest.bloque_horario || 'Por confirmar'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Fecha de la cita</p>
                              <p className="font-semibold text-slate-900">
                                {diagnosticRequest.fecha_confirmada
                                  ? new Date(diagnosticRequest.fecha_confirmada).toLocaleDateString('es-CL', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })
                                  : diagnosticRequest.fecha_solicitada
                                  ? new Date(diagnosticRequest.fecha_solicitada).toLocaleDateString('es-CL', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Prioridad</p>
                              <p className="font-semibold text-slate-900 capitalize">{diagnosticRequest.prioridad}</p>
                            </div>
                          </div>
                          {!diagnosticRequest.esParaHoy && (
                            <div className="mt-3 text-sm text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg p-3">
                              ⚠️ Esta unidad tiene cita en otra fecha. Confirma con el coordinador si corresponde adelantar el ingreso.
                            </div>
                          )}
                          <button
                            onClick={() => setShowIngresoModal(true)}
                            className="mt-4 px-5 py-2 rounded-xl font-semibold text-white shadow transition-colors bg-blue-600 hover:bg-blue-700"
                          >
                            Registrar ingreso + observaciones
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Checklist rápido</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  {[
                    'Pide siempre cédula y licencia del chofer.',
                    'Asegúrate de que el motivo de ingreso coincide con la orden.',
                    'Confirma el kilometraje reportado cuando corresponda.',
                    'Agrega observaciones de daños visibles o faltantes.',
                  ].map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Preguntas frecuentes</h3>
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-800">¿Y si el QR no lee?</p>
                    <p>Revisa la cámara seleccionada o ingresa manualmente la patente. Puedes abrir el modo pantalla completa.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">¿Qué hacer con un ingreso no registrado?</p>
                    <p>Contacta de inmediato al coordinador. Registra la patente para trazabilidad.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Historial de Vehículos Autorizados */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Historial de Vehículos Autorizados</h2>
              <span className="text-sm text-gray-500">
                {historialAutorizados.length} registro(s)
              </span>
            </div>
            {historialAutorizados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No hay registros en el historial aún.</p>
                <p className="text-sm mt-2">Los vehículos autorizados aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha y Hora
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vehículo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Motivo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Diagnóstico
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {historialAutorizados.map((registro) => (
                      <tr key={registro.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(registro.fecha_busqueda).toLocaleDateString('es-CL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {registro.hora_busqueda}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {registro.patente}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900">
                            {registro.marca && registro.marca !== 'N/A' ? `${registro.marca} ` : ''}
                            {registro.modelo && registro.modelo !== 'N/A' ? registro.modelo : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {registro.tipo && registro.tipo !== 'N/A' ? registro.tipo : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-900">{registro.motivo}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            registro.autorizado
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {registro.autorizado ? 'Autorizado' : 'Denegado'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {registro.tiene_diagnostico ? (
                            <div className="text-sm">
                              <div className="text-gray-900 font-medium">{registro.tipo_problema}</div>
                              {registro.fecha_cita && (
                                <div className="text-xs text-gray-500">
                                  {new Date(registro.fecha_cita).toLocaleDateString('es-CL', {
                                    day: '2-digit',
                                    month: '2-digit'
                                  })}
                                  {registro.horario_cita && ` - ${registro.horario_cita}`}
                                  {registro.es_para_hoy && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                      Hoy
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido de la pestaña Registro de Salida */}
      {/* Contenido de Salida de Vehículos */}
      {activeSection === 'salida' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-blue-500 to-indigo-500 text-white shadow-xl shadow-blue-200/70">
            <div className="p-6 md:p-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">Cierre de jornada</p>
                <h1 className="text-3xl font-bold">Salida de Vehículos</h1>
                <p className="text-white/85 max-w-2xl">
                  Revisa la patente, confirma kilometraje y motivo de salida antes de autorizar el egreso.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="bg-white/15 rounded-2xl p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Salidas hoy</p>
                  <p className="text-2xl font-bold">
                    {historialSalidas.filter((registro) => {
                      const fecha = new Date(registro.fecha_salida);
                      const hoy = new Date();
                      return (
                        fecha.getDate() === hoy.getDate() &&
                        fecha.getMonth() === hoy.getMonth() &&
                        fecha.getFullYear() === hoy.getFullYear()
                      );
                    }).length}
                  </p>
                </div>
                <div className="bg-white/15 rounded-2xl p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Vehículos en taller</p>
                  <p className="text-2xl font-bold">
                    {Math.max(historialAutorizados.length - historialSalidas.length, 0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/20 px-6 md:px-8 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: 'Verifica datos',
                    desc: 'Confirma patente y orden antes de egresar.',
                    icon: '🧾',
                  },
                  {
                    title: 'Revisa checklist',
                    desc: 'Kilometraje, daños y combustible informados.',
                    icon: '🛠️',
                  },
                  {
                    title: 'Registra salida',
                    desc: 'Autoriza y deja bitácora de motivo.',
                    icon: '🚦',
                  },
                ].map((step) => (
                  <div key={step.title} className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm flex gap-3">
                    <span className="text-2xl">{step.icon}</span>
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="text-sm text-white/80">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col gap-2 mb-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Panel de búsqueda y escaneo</h2>
                    <p className="text-sm text-slate-500">
                      Ingresa la patente o abre el lector QR. Si el vehículo tiene OT abierta, se mostrará al instante.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Escáner {qrScannerActive ? 'activo' : 'disponible'}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="flex-1 relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">🚚</span>
                      <input
                        type="text"
                        value={searchPatenteSalida}
                        onChange={(e) => setSearchPatenteSalida(e.target.value)}
                        placeholder="Patente para salida · Ej: KT-ZR-21"
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-lg font-semibold tracking-wide uppercase shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && searchVehicleSalida()}
                      />
                    </div>
                    <button
                      onClick={searchVehicleSalida}
                      disabled={searchingSalida}
                      className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {searchingSalida ? 'Buscando...' : 'Buscar'}
                    </button>
                    <button
                      onClick={() => navigate('/gate-qr-scanner?mode=salida')}
                      className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition"
                    >
                      Escáner QR
                    </button>
                  </div>

                  {!qrScannerActive && availableCamerasQR.length > 1 && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        📷 Selecciona la cámara que usarás
                      </label>
                      <select
                        value={selectedCameraIdQR}
                        onChange={(e) => setSelectedCameraIdQR(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {availableCamerasQR.map((camera: any) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.label || `Cámara ${camera.id}`}
                            {camera.label?.toLowerCase().includes('ivcam') ? ' 📱 (iVCam - Celular)' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-2">
                        {availableCamerasQR.find((c: any) => c.id === selectedCameraIdQR)?.label?.toLowerCase().includes('ivcam')
                          ? '✅ Usando la cámara del celular vía iVCam'
                          : '💡 Elige "iVCam" si quieres usar tu celular como cámara.'}
                      </p>
                    </div>
                  )}

                  {foundVehicleSalida && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-bold text-blue-900">Salida autorizada</h3>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/70 text-blue-900">
                              Checklist pendiente
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-slate-500">Patente</p>
                              <p className="text-lg font-semibold text-slate-900">{foundVehicleSalida.patente_vehiculo}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Modelo</p>
                              <p className="text-lg font-semibold text-slate-900">
                                {foundVehicleSalida.modelo?.marca?.nombre_marca} {foundVehicleSalida.modelo?.nombre_modelo}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Tipo</p>
                              <p className="text-slate-900 font-semibold">{foundVehicleSalida.tipo?.tipo_vehiculo}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Sucursal</p>
                              <p className="text-slate-900 font-semibold">{foundVehicleSalida.sucursal?.nombre_sucursal || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="bg-white rounded-xl p-3 border border-blue-100">
                              <p className="text-xs uppercase text-slate-500 tracking-wide">Estado actual</p>
                              <p className="text-blue-900 font-semibold">{foundVehicleSalida.estado_vehiculo}</p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-blue-100">
                          <p className="text-xs uppercase text-slate-500 tracking-wide">Último movimiento</p>
                          <p className="text-blue-900 font-semibold">
                            {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-blue-100">
                              <p className="text-xs uppercase text-slate-500 tracking-wide">Revisión</p>
                              <p className="text-blue-900 font-semibold">Registrar motivo y combustible</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Checklist rápido</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  {[
                    'Confirma el motivo del egreso y quién retira el vehículo.',
                    'Verifica kilometraje y nivel de combustible entregado.',
                    'Registra daños o elementos faltantes antes de que salga.',
                    'Asegúrate de que la OT esté cerrada o con autorización.',
                  ].map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Atajos útiles</h3>
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-800">¿No encuentras la orden?</p>
                    <p>Revisa la sección de historial o consulta al coordinador para validar la OT antes de liberar la unidad.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">¿Salida fuera de horario?</p>
                    <p>Registra observaciones y adjunta evidencia en Auditoría para trazabilidad.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Salidas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Historial de Salidas</h2>
                <p className="text-sm text-slate-500">Últimos movimientos registrados por portería</p>
              </div>
              <span className="text-sm text-slate-500">
                {historialSalidas.length} registro(s)
              </span>
            </div>
            {historialSalidas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No hay registros de salidas aún.</p>
                <p className="text-sm mt-2">Las salidas registradas aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historialSalidas.map((registro) => (
                  <div
                    key={registro.id}
                    className="rounded-2xl border border-slate-100 p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between hover:border-blue-200 transition"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {new Date(registro.fecha_salida).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {registro.hora_salida}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Salida registrada
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">Patente</p>
                          <p className="font-semibold text-slate-900">{registro.patente}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Vehículo</p>
                          <p className="font-semibold text-slate-900">
                            {registro.marca && registro.marca !== 'N/A' ? `${registro.marca} ` : ''}
                            {registro.modelo && registro.modelo !== 'N/A' ? registro.modelo : 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">{registro.tipo && registro.tipo !== 'N/A' ? registro.tipo : ''}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Motivo</p>
                          <p className="font-semibold text-slate-900">{registro.motivo}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Registro de ingreso para diagnóstico */}
      <Modal 
        isOpen={showIngresoModal} 
        onClose={() => {
          setShowIngresoModal(false);
          setObservaciones('');
          setNivelCombustible('');
          setDanosVisibles('');
        }} 
        title="Registrar Ingreso - Diagnóstico"
      >
        {diagnosticRequest && foundVehicle && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Información del Vehículo</h4>
              <p className="text-sm text-gray-700"><strong>Patente:</strong> {foundVehicle.patente_vehiculo}</p>
              <p className="text-sm text-gray-700"><strong>Problema:</strong> {diagnosticRequest.tipo_problema}</p>
              <p className="text-sm text-gray-700"><strong>Horario:</strong> {diagnosticRequest.bloque_horario_confirmado || diagnosticRequest.bloque_horario}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel de Combustible
              </label>
              <select
                value={nivelCombustible}
                onChange={(e) => setNivelCombustible(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                <option value="lleno">Lleno</option>
                <option value="3/4">3/4</option>
                <option value="1/2">1/2</option>
                <option value="1/4">1/4</option>
                <option value="reserva">Reserva</option>
                <option value="vacio">Vacío</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daños Visibles
              </label>
              <textarea
                value={danosVisibles}
                onChange={(e) => setDanosVisibles(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe cualquier daño visible en el vehículo..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observaciones Adicionales
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Observaciones generales del vehículo al ingreso..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowIngresoModal(false);
                  setObservaciones('');
                  setNivelCombustible('');
                  setDanosVisibles('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarIngresoDiagnostico}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Registrar Ingreso
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: QR Code */}
      <Modal 
        isOpen={showQRModal} 
        onClose={() => setShowQRModal(false)} 
        title="Código QR del Vehículo"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Código QR generado para el vehículo con patente:
            </p>
            <p className="text-xl font-bold text-gray-900 mb-6">{qrPatente}</p>
            
            <div className="flex justify-center items-center bg-white p-6 rounded-lg border-2 border-gray-200 mb-4">
              <QRCodeSVG
                value={`${window.location.origin}/vehiculo/${encodeURIComponent(qrPatente)}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <p className="text-xs text-gray-500 mb-2">
              Escanea este código QR con tu celular para ver la información del vehículo
            </p>
            <p className="text-xs text-gray-400">
              URL: {window.location.origin}/vehiculo/{qrPatente}
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setShowQRModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: nuevo modelo */}
      <Modal isOpen={newModelOpen} onClose={() => setNewModelOpen(false)} title="Crear modelo">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <input type="text" value={newModel.marca_nombre} onChange={(e) => setNewModel({ ...newModel, marca_nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej. Volvo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
            <input type="text" value={newModel.nombre_modelo} onChange={(e) => setNewModel({ ...newModel, nombre_modelo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej. FMX" />
          </div>
          <div className="flex justify-end">
            <button onClick={addModel} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </Modal>

      {/* Modal: nuevo tipo */}
      <Modal isOpen={newTypeOpen} onClose={() => setNewTypeOpen(false)} title="Crear tipo">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del tipo</label>
            <input type="text" value={newType.tipo_vehiculo} onChange={(e) => setNewType({ tipo_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej. Camión" />
          </div>
          <div className="flex justify-end">
            <button onClick={async () => {
              if (!newType.tipo_vehiculo) { alert('Ingresa el nombre del tipo'); return; }
              try {
                const { data: inserted, error } = await supabase
                  .from('tipo_vehiculo')
                  .insert([{ tipo_vehiculo: newType.tipo_vehiculo }])
                  .select()
                  .single();
                
                if (error) {
                  throw error;
                }
                
                if (inserted?.id_tipo_vehiculo) {
                  setFormData(prev => ({ ...prev, tipo_vehiculo_id: String(inserted.id_tipo_vehiculo) }));
                  setTipos(prev => [inserted, ...prev]);
                }
                setNewType({ tipo_vehiculo: '' });
                setNewTypeOpen(false);
                if (hasEnv) loadData();
              } catch (_err) {
                const tempId = Math.min(0, ...tipos.map(t => t.id_tipo_vehiculo || 0)) - 1;
                const nuevo = { id_tipo_vehiculo: tempId, tipo_vehiculo: newType.tipo_vehiculo };
                const nuevosTipos = [nuevo, ...tipos];
                setTipos(nuevosTipos);
                writeLocal('apt_tipos', nuevosTipos);
                setFormData(prev => ({ ...prev, tipo_vehiculo_id: String(tempId) }));
                setNewType({ tipo_vehiculo: '' });
                setNewTypeOpen(false);
              }
            }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </Modal>

      {/* Modal: nueva sucursal */}
      <Modal isOpen={newBranchOpen} onClose={() => setNewBranchOpen(false)} title="Crear sucursal">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de sucursal</label>
            <input type="text" value={newBranch.nombre_sucursal} onChange={(e) => setNewBranch({ nombre_sucursal: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Santa Marta" />
          </div>
          <div className="flex justify-end">
            <button onClick={addBranch} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Generar código QR */}
      <Modal isOpen={showQRGenerator} onClose={() => setShowQRGenerator(false)} title="Código QR del Vehículo">
        {selectedVehicleForQR && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Patente: <strong>{selectedVehicleForQR.patente_vehiculo}</strong></p>
              <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-gray-200">
                <QRCodeSVG
                  value={selectedVehicleForQR.patente_vehiculo}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Escanea este código QR en la entrada para validar el ingreso del vehículo
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  // Crear un SVG para descargar
                  const svg = document.querySelector('svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `QR-${selectedVehicleForQR.patente_vehiculo}.svg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Descargar QR
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Contenido de Historial del Día */}
      {activeSection === 'historial' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Historial del Día</h1>
          <p className="text-gray-600 mb-6">Lista de vehículos que han entrado/salido en el turno.</p>
          
          <div className="space-y-6">
            {/* Vehículos existentes en la base de datos */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Vehículos registrados en la base de datos
              </h2>
              {vehicles.length === 0 ? (
                <p className="text-center py-4 text-gray-500">
                  Aún no hay vehículos registrados en la base de datos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sucursal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registrado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vehicles.map((vehicle: any) => {
                        const createdAt = vehicle.created_at || vehicle.fecha_creacion || vehicle.fecha_adquisicion_vehiculo;
                        const fechaRegistro = createdAt
                          ? new Date(createdAt).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A';

                        return (
                          <tr key={vehicle.id_vehiculo || vehicle.id_local} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {vehicle.patente_vehiculo || 'Sin patente'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {vehicle.modelo?.nombre_modelo ||
                                vehicle.modelo_nombre ||
                                'Sin modelo'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {vehicle.tipo?.tipo_vehiculo ||
                                vehicle.tipo_vehiculo ||
                                'Sin tipo'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {vehicle.sucursal?.nombre_sucursal ||
                                vehicle.sucursal_nombre ||
                                'No asignada'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                                  (vehicle.estado_vehiculo || '').toLowerCase() === 'disponible'
                                    ? 'bg-green-100 text-green-800'
                                    : (vehicle.estado_vehiculo || '').toLowerCase() === 'mantenimiento'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {vehicle.estado_vehiculo || 'Sin estado'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{fechaRegistro}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Historial de Ingresos */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Ingresos del Día</h2>
              {historialAutorizados.length === 0 ? (
                <p className="text-center py-4 text-gray-500">No hay ingresos registrados hoy.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chofer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {historialAutorizados.map((registro: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{registro.patente}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{registro.hora_busqueda || registro.hora}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{registro.chofer || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{registro.motivo_ingreso || 'Diagnóstico'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                              Autorizado
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Historial de Salidas */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Salidas del Día</h2>
              {historialSalidas.length === 0 ? (
                <p className="text-center py-4 text-gray-500">No hay salidas registradas hoy.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora Salida</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {historialSalidas.map((registro: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{registro.patente}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{registro.hora_salida}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{registro.motivo_salida || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                              Completado
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Consulta Rápida de Vehículo */}
      {activeSection === 'consulta' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Consulta Rápida de Vehículo</h1>
          <p className="text-gray-600 mb-6">Ver si el vehículo tiene OT abierta, si está en taller o ya salió.</p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar por Patente
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchPatente}
                onChange={(e) => setSearchPatente(e.target.value)}
                placeholder="Ingrese la patente del vehículo"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && searchVehicle()}
              />
              <button
                onClick={searchVehicle}
                disabled={searching}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          {foundVehicle && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Vehículo</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Patente</p>
                  <p className="text-lg font-semibold text-gray-900">{foundVehicle.patente_vehiculo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  <span className={`inline-block px-3 py-1 text-sm font-semibold rounded ${
                    foundVehicle.estado_vehiculo === 'en_taller' ? 'bg-yellow-100 text-yellow-800' :
                    foundVehicle.estado_vehiculo === 'disponible' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {foundVehicle.estado_vehiculo === 'en_taller' ? 'En Taller' :
                     foundVehicle.estado_vehiculo === 'disponible' ? 'Disponible' :
                     foundVehicle.estado_vehiculo}
                  </span>
                </div>
              </div>

              {/* Verificar si tiene OT abierta */}
              {(() => {
                const ordenes = readLocal('apt_ordenes_trabajo', []);
                const otAbierta = ordenes.find((o: any) => 
                  o.vehiculo_id === foundVehicle.id_vehiculo && 
                  o.estado_ot !== 'finalizada'
                );
                
                if (otAbierta) {
                  return (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 mb-2">✓ Tiene OT Abierta</p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>OT #:</strong> {otAbierta.id_orden_trabajo}</p>
                        <p><strong>Estado:</strong> {otAbierta.estado_ot}</p>
                        <p><strong>Fecha inicio:</strong> {new Date(otAbierta.fecha_inicio_ot).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                  );
                }
                
                // Verificar si está en historial de ingreso
                const historial = readLocal('apt_historial_autorizados', []);
                const ingresoReciente = historial.find((h: any) => 
                  h.patente?.toUpperCase() === foundVehicle.patente_vehiculo?.toUpperCase()
                );
                
                if (ingresoReciente) {
                  return (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-semibold text-green-900 mb-2">✓ Vehículo en Taller</p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>Hora de ingreso:</strong> {ingresoReciente.hora_busqueda}</p>
                        <p><strong>Motivo:</strong> {ingresoReciente.motivo_ingreso || 'Diagnóstico'}</p>
                      </div>
                    </div>
                  );
                }
                
                // Verificar si ya salió
                const historialSalidas = readLocal('apt_historial_salidas', []);
                const salidaReciente = historialSalidas.find((h: any) => 
                  h.patente?.toUpperCase() === foundVehicle.patente_vehiculo?.toUpperCase()
                );
                
                if (salidaReciente) {
                  return (
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Vehículo ya Salió</p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p><strong>Hora de salida:</strong> {salidaReciente.hora_salida}</p>
                        <p><strong>Fecha:</strong> {new Date(salidaReciente.fecha_salida).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">No hay registros de movimiento para este vehículo hoy.</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


