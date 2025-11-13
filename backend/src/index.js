import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const port = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '⚠️  Variables SUPABASE_URL o SUPABASE_SERVICE_KEY no definidas. Algunas rutas pueden fallar.'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ordenes/cerradas', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('orden_trabajo')
      .select(
        `
        id_orden_trabajo,
        descripcion_ot,
        estado_ot,
        estado_cierre,
        fecha_cierre_tecnico,
        fecha_cierre_ot,
        prioridad_ot,
        vehiculo:vehiculo_id (
          patente_vehiculo,
          modelo_vehiculo_id,
          kilometraje_vehiculo
        ),
        solicitud:solicitud_diagnostico_id (
          tipo_problema,
          fecha_confirmada,
          bloque_horario_confirmado
        )
      `
      )
      .eq('estado_cierre', 'cerrada')
      .order('fecha_cierre_tecnico', { ascending: false, nullsLast: true });

    if (error) {
      console.error('Error consultando Supabase:', error);
      return res.status(500).json({ error: 'Error consultando Supabase' });
    }

    res.json(data);
  } catch (err) {
    console.error('Error interno del servidor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend escuchando en http://localhost:${port}`);
});

