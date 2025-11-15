import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ChecklistData {
  // Datos generales
  patente: string;
  tipo_vehiculo: string;
  kilometraje_actual: string;
  fecha_hora_ingreso: string;
  nombre_chofer: string;
  reporte_falla_chofer: string;
  
  // Revisión visual y de seguridad inicial
  fugas_aceite: string; // 'si', 'no', 'n/a'
  fugas_refrigerante: string;
  fugas_combustible: string;
  fugas_aire: string;
  golpes_abolladuras: string;
  estado_parabrisas: string;
  espejos_retrovisores: string;
  cinturones_seguridad: string;
  bocina: string;
  extintor: string;
  elementos_seguridad: string;
  
  // Niveles y fluidos
  nivel_aceite_motor: string;
  nivel_refrigerante: string;
  nivel_liquido_frenos: string;
  nivel_direccion_hidraulica: string;
  nivel_liquido_limpiaparabrisas: string;
  contaminaciones: string;
  
  // Neumáticos y suspensión
  profundidad_dibujo: string;
  desgaste_parejo: string;
  presion_neumaticos: string;
  cortes_deformaciones: string;
  revision_suspension_visual: string;
  ruidos_suspension: string;
  
  // Sistema de frenos
  pedal_freno_recorrido: string;
  freno_estacionamiento: string;
  fugas_frenos: string;
  test_frenado_recto: string;
  test_abs: string;
  
  // Dirección
  volante_juego: string;
  direccion_tira: string;
  ruidos_direccion: string;
  revision_terminales: string;
  
  // Motor y rendimiento
  arranque_normal: string;
  ralenti_estable: string;
  ruidos_motor: string;
  humo_anormal: string;
  respuesta_aceleracion: string;
  
  // Sistema eléctrico e iluminación
  bateria_estado: string;
  luces_bajas_altas: string;
  luces_freno: string;
  luces_giro: string;
  luces_retroceso: string;
  luces_emergencia: string;
  testigos_tablero: string;
  limpiaparabrisas: string;
  
  // Cabina y carrocería
  fijacion_carroceria: string;
  puertas_cerraduras: string;
  anclajes_carga: string;
  estado_piso: string;
  asientos: string;
  
  // Prueba de ruta básica
  ruidos_marcha: string;
  vibraciones: string;
  caja_cambios: string;
  tirones: string;
  
  // Cierre de diagnóstico
  hallazgos_principales: string;
  clasificacion_prioridad: string; // 'critico', 'alta', 'normal'
  repuestos_preliminares: string;
  horas_estimadas: string;
  recomendacion: string; // 'apto', 'no_apto'
}

interface ChecklistDiagnosticoProps {
  ordenTrabajo: any;
  onSave: (checklistData: ChecklistData) => void;
  onCancel: () => void;
  initialData?: Partial<ChecklistData>;
  readOnly?: boolean;
}

export default function ChecklistDiagnostico({ ordenTrabajo, onSave, onCancel, initialData = {}, readOnly = false }: ChecklistDiagnosticoProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['datos-generales']));
  const [formData, setFormData] = useState<ChecklistData>({
    patente: initialData.patente || ordenTrabajo.patente_vehiculo || '',
    tipo_vehiculo: initialData.tipo_vehiculo || '',
    kilometraje_actual: initialData.kilometraje_actual || '',
    fecha_hora_ingreso: initialData.fecha_hora_ingreso || new Date().toISOString().slice(0, 16),
    nombre_chofer: initialData.nombre_chofer || ordenTrabajo.empleado_nombre || '',
    reporte_falla_chofer: initialData.reporte_falla_chofer || '',
    fugas_aceite: initialData.fugas_aceite || 'no',
    fugas_refrigerante: initialData.fugas_refrigerante || 'no',
    fugas_combustible: initialData.fugas_combustible || 'no',
    fugas_aire: initialData.fugas_aire || 'no',
    golpes_abolladuras: initialData.golpes_abolladuras || 'no',
    estado_parabrisas: initialData.estado_parabrisas || 'bueno',
    espejos_retrovisores: initialData.espejos_retrovisores || 'bueno',
    cinturones_seguridad: initialData.cinturones_seguridad || 'bueno',
    bocina: initialData.bocina || 'bueno',
    extintor: initialData.extintor || 'bueno',
    elementos_seguridad: initialData.elementos_seguridad || 'bueno',
    nivel_aceite_motor: initialData.nivel_aceite_motor || 'normal',
    nivel_refrigerante: initialData.nivel_refrigerante || 'normal',
    nivel_liquido_frenos: initialData.nivel_liquido_frenos || 'normal',
    nivel_direccion_hidraulica: initialData.nivel_direccion_hidraulica || 'normal',
    nivel_liquido_limpiaparabrisas: initialData.nivel_liquido_limpiaparabrisas || 'normal',
    contaminaciones: initialData.contaminaciones || 'no',
    profundidad_dibujo: initialData.profundidad_dibujo || 'bueno',
    desgaste_parejo: initialData.desgaste_parejo || 'si',
    presion_neumaticos: initialData.presion_neumaticos || 'correcta',
    cortes_deformaciones: initialData.cortes_deformaciones || 'no',
    revision_suspension_visual: initialData.revision_suspension_visual || 'bueno',
    ruidos_suspension: initialData.ruidos_suspension || 'no',
    pedal_freno_recorrido: initialData.pedal_freno_recorrido || 'normal',
    freno_estacionamiento: initialData.freno_estacionamiento || 'operativo',
    fugas_frenos: initialData.fugas_frenos || 'no',
    test_frenado_recto: initialData.test_frenado_recto || 'bueno',
    test_abs: initialData.test_abs || 'n/a',
    volante_juego: initialData.volante_juego || 'normal',
    direccion_tira: initialData.direccion_tira || 'no',
    ruidos_direccion: initialData.ruidos_direccion || 'no',
    revision_terminales: initialData.revision_terminales || 'bueno',
    arranque_normal: initialData.arranque_normal || 'si',
    ralenti_estable: initialData.ralenti_estable || 'si',
    ruidos_motor: initialData.ruidos_motor || 'no',
    humo_anormal: initialData.humo_anormal || 'no',
    respuesta_aceleracion: initialData.respuesta_aceleracion || 'buena',
    bateria_estado: initialData.bateria_estado || 'bueno',
    luces_bajas_altas: initialData.luces_bajas_altas || 'operativas',
    luces_freno: initialData.luces_freno || 'operativas',
    luces_giro: initialData.luces_giro || 'operativas',
    luces_retroceso: initialData.luces_retroceso || 'operativas',
    luces_emergencia: initialData.luces_emergencia || 'operativas',
    testigos_tablero: initialData.testigos_tablero || 'normales',
    limpiaparabrisas: initialData.limpiaparabrisas || 'operativo',
    fijacion_carroceria: initialData.fijacion_carroceria || 'buena',
    puertas_cerraduras: initialData.puertas_cerraduras || 'buenas',
    anclajes_carga: initialData.anclajes_carga || 'n/a',
    estado_piso: initialData.estado_piso || 'bueno',
    asientos: initialData.asientos || 'buenos',
    ruidos_marcha: initialData.ruidos_marcha || 'no',
    vibraciones: initialData.vibraciones || 'no',
    caja_cambios: initialData.caja_cambios || 'buena',
    tirones: initialData.tirones || 'no',
    hallazgos_principales: initialData.hallazgos_principales || '',
    clasificacion_prioridad: initialData.clasificacion_prioridad || 'normal',
    repuestos_preliminares: initialData.repuestos_preliminares || '',
    horas_estimadas: initialData.horas_estimadas || '',
    recomendacion: initialData.recomendacion || 'apto',
  });

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateField = (fieldName: keyof ChecklistData, value: string) => {
    if (readOnly) return;
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const renderSection = (sectionId: string, title: string, content: React.ReactNode) => {
    const isExpanded = expandedSections.has(sectionId);
    return (
      <div className="border border-gray-300 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
        >
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {isExpanded && (
          <div className="p-4 bg-white rounded-b-lg">
            {content}
          </div>
        )}
      </div>
    );
  };

  const renderSelectField = (
    label: string,
    fieldName: keyof ChecklistData,
    options: { value: string; label: string }[]
  ) => {
    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
      readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-300'
    }`;
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
          value={formData[fieldName]}
          onChange={(e) => updateField(fieldName, e.target.value)}
          disabled={readOnly}
          className={baseClasses}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderTextArea = (label: string, fieldName: keyof ChecklistData, placeholder?: string) => {
    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
      readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-300'
    }`;
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea
          value={formData[fieldName]}
          onChange={(e) => updateField(fieldName, e.target.value)}
          placeholder={placeholder}
          rows={3}
          disabled={readOnly}
          className={baseClasses}
        />
      </div>
    );
  };

  const renderInput = (label: string, fieldName: keyof ChecklistData, type: string = 'text', placeholder?: string) => {
    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
      readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-300'
    }`;
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
          type={type}
          value={formData[fieldName]}
          onChange={(e) => updateField(fieldName, e.target.value)}
          placeholder={placeholder}
          disabled={readOnly}
          className={baseClasses}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Checklist de Diagnóstico</h2>
        <p className="text-sm text-gray-600">
          Patente: <strong>{ordenTrabajo.patente_vehiculo}</strong> | 
          Chofer: <strong>{ordenTrabajo.empleado_nombre}</strong>
        </p>
      </div>

      {/* Datos Generales */}
      {renderSection('datos-generales', '1. Datos Generales', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderInput('Patente', 'patente', 'text')}
          {renderInput('Tipo de vehículo', 'tipo_vehiculo', 'text', 'Ej: Camión, Furgón, etc.')}
          {renderInput('Kilometraje actual', 'kilometraje_actual', 'number', 'Ej: 50000')}
          {renderInput('Fecha y hora de ingreso', 'fecha_hora_ingreso', 'datetime-local')}
          {renderInput('Nombre del chofer', 'nombre_chofer', 'text')}
          {renderTextArea('Reporte de falla según chofer', 'reporte_falla_chofer', 'Descripción breve del problema reportado...')}
        </div>
      ))}

      {/* Revisión Visual y de Seguridad */}
      {renderSection('revision-visual', '2. Revisión Visual y de Seguridad Inicial', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Fugas visibles - Aceite', 'fugas_aceite', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Fugas visibles - Refrigerante', 'fugas_refrigerante', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Fugas visibles - Combustible', 'fugas_combustible', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Fugas visibles - Aire', 'fugas_aire', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Golpes, abolladuras o daños estructurales', 'golpes_abolladuras', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Estado de parabrisas y vidrios', 'estado_parabrisas', [
            { value: 'bueno', label: 'Bueno' },
            { value: 'regular', label: 'Regular' },
            { value: 'malo', label: 'Malo' },
          ])}
          {renderSelectField('Espejos retrovisores', 'espejos_retrovisores', [
            { value: 'bueno', label: 'Bueno' },
            { value: 'regular', label: 'Regular' },
            { value: 'malo', label: 'Malo' },
          ])}
          {renderSelectField('Cinturones de seguridad', 'cinturones_seguridad', [
            { value: 'bueno', label: 'Operativos' },
            { value: 'malo', label: 'No operativos' },
          ])}
          {renderSelectField('Bocina', 'bocina', [
            { value: 'bueno', label: 'Funcional' },
            { value: 'malo', label: 'No funcional' },
          ])}
          {renderSelectField('Extintor presente y vigente', 'extintor', [
            { value: 'bueno', label: 'Sí' },
            { value: 'malo', label: 'No' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Triángulos / elementos de seguridad', 'elementos_seguridad', [
            { value: 'bueno', label: 'Presentes' },
            { value: 'malo', label: 'Faltantes' },
            { value: 'n/a', label: 'N/A' },
          ])}
        </div>
      ))}

      {/* Niveles y Fluidos */}
      {renderSection('niveles-fluidos', '3. Niveles y Fluidios', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Nivel de aceite motor', 'nivel_aceite_motor', [
            { value: 'normal', label: 'Normal' },
            { value: 'bajo', label: 'Bajo' },
            { value: 'alto', label: 'Alto' },
          ])}
          {renderSelectField('Nivel de refrigerante', 'nivel_refrigerante', [
            { value: 'normal', label: 'Normal' },
            { value: 'bajo', label: 'Bajo' },
            { value: 'alto', label: 'Alto' },
          ])}
          {renderSelectField('Nivel de líquido de frenos', 'nivel_liquido_frenos', [
            { value: 'normal', label: 'Normal' },
            { value: 'bajo', label: 'Bajo' },
            { value: 'alto', label: 'Alto' },
          ])}
          {renderSelectField('Nivel de dirección hidráulica', 'nivel_direccion_hidraulica', [
            { value: 'normal', label: 'Normal' },
            { value: 'bajo', label: 'Bajo' },
            { value: 'alto', label: 'Alto' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Nivel de líquido limpiaparabrisas', 'nivel_liquido_limpiaparabrisas', [
            { value: 'normal', label: 'Normal' },
            { value: 'bajo', label: 'Bajo' },
            { value: 'alto', label: 'Alto' },
          ])}
          {renderSelectField('Contaminaciones (agua en aceite, etc.)', 'contaminaciones', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ])}
        </div>
      ))}

      {/* Neumáticos y Suspensión */}
      {renderSection('neumaticos-suspension', '4. Neumáticos y Suspensión', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Profundidad de dibujo', 'profundidad_dibujo', [
            { value: 'bueno', label: 'Dentro de norma' },
            { value: 'regular', label: 'Al límite' },
            { value: 'malo', label: 'Fuera de norma' },
          ])}
          {renderSelectField('Desgaste parejo', 'desgaste_parejo', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No (desgaste irregular)' },
          ])}
          {renderSelectField('Presión aproximada', 'presion_neumaticos', [
            { value: 'correcta', label: 'Correcta' },
            { value: 'baja', label: 'Baja' },
            { value: 'alta', label: 'Alta' },
          ])}
          {renderSelectField('Cortes, alambres a la vista o deformaciones', 'cortes_deformaciones', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ])}
          {renderSelectField('Revisión visual de suspensión', 'revision_suspension_visual', [
            { value: 'bueno', label: 'Bueno' },
            { value: 'regular', label: 'Regular' },
            { value: 'malo', label: 'Malo' },
          ])}
          {renderSelectField('Ruidos o golpes anormales en suspensión', 'ruidos_suspension', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A (no se probó)' },
          ])}
        </div>
      ))}

      {/* Sistema de Frenos */}
      {renderSection('sistema-frenos', '5. Sistema de Frenos', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Pedal de freno: recorrido y dureza', 'pedal_freno_recorrido', [
            { value: 'normal', label: 'Normal' },
            { value: 'anormal', label: 'Anormal' },
          ])}
          {renderSelectField('Freno de mano / estacionamiento', 'freno_estacionamiento', [
            { value: 'operativo', label: 'Operativo' },
            { value: 'no_operativo', label: 'No operativo' },
          ])}
          {renderSelectField('Fugas visibles en cañerías / flexibles', 'fugas_frenos', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ])}
          {renderSelectField('Test de frenado recto', 'test_frenado_recto', [
            { value: 'bueno', label: 'Bueno (sin desvío)' },
            { value: 'regular', label: 'Regular (desvío leve)' },
            { value: 'malo', label: 'Malo (desvío marcado)' },
            { value: 'n/a', label: 'N/A (no se probó)' },
          ])}
          {renderSelectField('Test de ABS', 'test_abs', [
            { value: 'funcional', label: 'Funcional' },
            { value: 'no_funcional', label: 'No funcional' },
            { value: 'n/a', label: 'N/A (no aplica)' },
          ])}
        </div>
      ))}

      {/* Dirección */}
      {renderSection('direccion', '6. Dirección', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Volante sin juego excesivo', 'volante_juego', [
            { value: 'normal', label: 'Normal' },
            { value: 'excesivo', label: 'Excesivo' },
          ])}
          {renderSelectField('Dirección no tira hacia un lado', 'direccion_tira', [
            { value: 'si', label: 'Sí (tira)' },
            { value: 'no', label: 'No (no tira)' },
          ])}
          {renderSelectField('Ruidos extraños al girar', 'ruidos_direccion', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ])}
          {renderSelectField('Revisión de terminales y barras', 'revision_terminales', [
            { value: 'bueno', label: 'Bueno' },
            { value: 'regular', label: 'Regular (juego/desgaste)' },
            { value: 'malo', label: 'Malo' },
          ])}
        </div>
      ))}

      {/* Motor y Rendimiento */}
      {renderSection('motor-rendimiento', '7. Motor y Rendimiento', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Arranque normal', 'arranque_normal', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No (dificultoso)' },
          ])}
          {renderSelectField('Ralentí estable', 'ralenti_estable', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No (tirones/oscilaciones)' },
          ])}
          {renderSelectField('Ruidos anormales en motor', 'ruidos_motor', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ])}
          {renderSelectField('Humo excesivo o de color anormal', 'humo_anormal', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
          ])}
          {renderSelectField('Respuesta al acelerar', 'respuesta_aceleracion', [
            { value: 'buena', label: 'Buena' },
            { value: 'regular', label: 'Regular' },
            { value: 'mala', label: 'Mala (pérdida de fuerza)' },
          ])}
        </div>
      ))}

      {/* Sistema Eléctrico e Iluminación */}
      {renderSection('sistema-electrico', '8. Sistema Eléctrico e Iluminación', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Batería (fijación y bornes)', 'bateria_estado', [
            { value: 'bueno', label: 'Bueno' },
            { value: 'regular', label: 'Regular' },
            { value: 'malo', label: 'Malo' },
          ])}
          {renderSelectField('Luces bajas y altas', 'luces_bajas_altas', [
            { value: 'operativas', label: 'Operativas' },
            { value: 'no_operativas', label: 'No operativas' },
          ])}
          {renderSelectField('Luces de freno', 'luces_freno', [
            { value: 'operativas', label: 'Operativas' },
            { value: 'no_operativas', label: 'No operativas' },
          ])}
          {renderSelectField('Luces de giro (direccionales)', 'luces_giro', [
            { value: 'operativas', label: 'Operativas' },
            { value: 'no_operativas', label: 'No operativas' },
          ])}
          {renderSelectField('Luces de retroceso', 'luces_retroceso', [
            { value: 'operativas', label: 'Operativas' },
            { value: 'no_operativas', label: 'No operativas' },
          ])}
          {renderSelectField('Luces de emergencia (warning)', 'luces_emergencia', [
            { value: 'operativas', label: 'Operativas' },
            { value: 'no_operativas', label: 'No operativas' },
          ])}
          {renderSelectField('Testigos de tablero', 'testigos_tablero', [
            { value: 'normales', label: 'Normales' },
            { value: 'anormales', label: 'Anormales (check engine, etc.)' },
          ])}
          {renderSelectField('Limpiaparabrisas y lava parabrisas', 'limpiaparabrisas', [
            { value: 'operativo', label: 'Operativo' },
            { value: 'no_operativo', label: 'No operativo' },
          ])}
        </div>
      ))}

      {/* Cabina y Carrocería */}
      {renderSection('cabina-carroceria', '9. Cabina y Carrocería', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Fijación de carrocería / caja', 'fijacion_carroceria', [
            { value: 'buena', label: 'Buena' },
            { value: 'regular', label: 'Regular' },
            { value: 'mala', label: 'Mala' },
          ])}
          {renderSelectField('Puertas, cerraduras y pestillos', 'puertas_cerraduras', [
            { value: 'buenas', label: 'Buenas' },
            { value: 'regulares', label: 'Regulares' },
            { value: 'malas', label: 'Malas' },
          ])}
          {renderSelectField('Anclajes y elementos de sujeción de carga', 'anclajes_carga', [
            { value: 'buenos', label: 'Buenos' },
            { value: 'regulares', label: 'Regulares' },
            { value: 'malos', label: 'Malos' },
            { value: 'n/a', label: 'N/A' },
          ])}
          {renderSelectField('Estado de piso de carrocería / caja', 'estado_piso', [
            { value: 'bueno', label: 'Bueno' },
            { value: 'regular', label: 'Regular' },
            { value: 'malo', label: 'Malo' },
          ])}
          {renderSelectField('Asientos (estado y fijación)', 'asientos', [
            { value: 'buenos', label: 'Buenos' },
            { value: 'regulares', label: 'Regulares' },
            { value: 'malos', label: 'Malos' },
          ])}
        </div>
      ))}

      {/* Prueba de Ruta Básica */}
      {renderSection('prueba-ruta', '10. Prueba de Ruta Básica', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSelectField('Ruidos anormales en marcha', 'ruidos_marcha', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A (no se probó)' },
          ])}
          {renderSelectField('Vibraciones excesivas', 'vibraciones', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A (no se probó)' },
          ])}
          {renderSelectField('Caja de cambios', 'caja_cambios', [
            { value: 'buena', label: 'Buena (engrana bien)' },
            { value: 'regular', label: 'Regular' },
            { value: 'mala', label: 'Mala' },
            { value: 'n/a', label: 'N/A (no se probó)' },
          ])}
          {renderSelectField('Tirones al acelerar o desacelerar', 'tirones', [
            { value: 'si', label: 'Sí' },
            { value: 'no', label: 'No' },
            { value: 'n/a', label: 'N/A (no se probó)' },
          ])}
        </div>
      ))}

      {/* Cierre de Diagnóstico */}
      {renderSection('cierre-diagnostico', '11. Cierre de Diagnóstico', (
        <div className="space-y-4">
          {renderTextArea('Hallazgos principales registrados en la OT', 'hallazgos_principales', 'Describa los principales hallazgos del diagnóstico...')}
          {renderSelectField('Clasificación de prioridad', 'clasificacion_prioridad', [
            { value: 'critico', label: 'Crítico' },
            { value: 'alta', label: 'Alta' },
            { value: 'normal', label: 'Normal' },
          ])}
          {renderTextArea('Repuestos preliminares estimados', 'repuestos_preliminares', 'Lista de repuestos necesarios...')}
          {renderInput('Horas estimadas de reparación', 'horas_estimadas', 'number', 'Ej: 8')}
          {renderSelectField('Recomendación', 'recomendacion', [
            { value: 'apto', label: 'Apto para circular' },
            { value: 'no_apto', label: 'No apto hasta reparación' },
          ])}
        </div>
      ))}

      {/* Botones de acción */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onSave(formData)}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Guardar Checklist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}









