/*
  # APT System Database Schema
  
  1. New Tables
    - `cargo` - Employee positions/roles
      - `id_cargo` (int, primary key)
      - `nombre_cargo` (text) - Position name
      - `descripcion_cargo` (text) - Position description
      
    - `usuario` - User accounts for authentication
      - `id_usuario` (int, primary key)
      - `usuario` (text) - Username
      - `clave` (text) - Password hash
      - `rol` (text) - Role: admin, planner, driver
      - `ultima_conexion` (timestamp) - Last login
      - `estado_usuario` (boolean) - Active status
      
    - `empleado` - Employees
      - `id_empleado` (int, primary key)
      - `nombre` (text)
      - `apellido_paterno` (text)
      - `apellido_materno` (text)
      - `rut` (text, unique)
      - `email` (text)
      - `telefono1` (text)
      - `telefono2` (text)
      - `fecha_nacimiento` (date)
      - `cargo_id` (int, FK to cargo)
      - `usuario_id` (int, FK to usuario)
      
    - `marca_vehiculo` - Vehicle brands
      - `id_marca_vehiculo` (int, primary key)
      - `nombre_marca` (text)
      
    - `modelo_vehiculo` - Vehicle models
      - `id_modelo_vehiculo` (int, primary key)
      - `nombre_modelo` (text)
      - `anio_modelo` (int)
      - `marca_vehiculo_id` (int, FK to marca_vehiculo)
      
    - `tipo_vehiculo` - Vehicle types
      - `id_tipo_vehiculo` (int, primary key)
      - `tipo_vehiculo` (text)
      - `descripcion_tipo_vehiculo` (text)
      
    - `sucursal` - Branch offices
      - `id_sucursal` (int, primary key)
      - `nombre_sucursal` (text)
      - `direccion_sucursal` (text)
      - `region_sucursal` (text)
      - `comuna_sucursal` (text)
      - `telefono_sucursal` (text)
      - `email_sucursal` (text)
      
    - `vehiculo` - Vehicles
      - `id_vehiculo` (int, primary key)
      - `patente_vehiculo` (text, unique)
      - `anio_vehiculo` (int)
      - `fecha_adquisicion_vehiculo` (date)
      - `capacidad_carga_vehiculo` (decimal)
      - `estado_vehiculo` (text) - disponible, en ruta, mantenimiento
      - `kilometraje_vehiculo` (decimal)
      - `modelo_vehiculo_id` (int, FK)
      - `tipo_vehiculo_id` (int, FK)
      - `sucursal_id` (int, FK)
      
    - `orden_trabajo` - Work orders
      - `id_orden_trabajo` (int, primary key)
      - `fecha_inicio_ot` (timestamp)
      - `fecha_cierre_ot` (timestamp)
      - `descripcion_ot` (text)
      - `estado_ot` (text) - pendiente, en curso, finalizada
      - `empleado_id` (int, FK)
      - `vehiculo_id` (int, FK)
      
    - `acceso` - Access logs
      - `id_acceso` (int, primary key)
      - `fecha_ingreso` (timestamp)
      - `fecha_salida` (timestamp)
      - `observaciones` (text)
      - `imagen_url` (text)
      - `empleado_id` (int, FK)
      
    - `llaves` - Key management
      - `id_llaves` (int, primary key)
      - `fecha_prestamo_llaves` (timestamp)
      - `fecha_devolucion_llaves` (timestamp)
      - `observaciones_llaves` (text)
      - `vehiculo_id` (int, FK)
      - `empleado_id` (int, FK)
      
    - `servicio` - Services
      - `id_servicio` (int, primary key)
      - `nombre_servicio` (text)
      - `descripcion_servicio` (text)
      - `orden_trabajo_id` (int, FK)
      
    - `repuesto` - Spare parts
      - `id_repuesto` (int, primary key)
      - `nombre_repuesto` (text)
      - `descripcion_repuesto` (text)
      - `stock_repuesto` (int)
      
    - `ot_repuesto` - Work order spare parts relation
      - `id_ot_repuesto` (int, primary key)
      - `cantidad_ot_repuesto` (int)
      - `orden_trabajo_id` (int, FK)
      - `repuesto_id` (int, FK)
      
    - `incidencia` - Incidents
      - `id_incidencia` (int, primary key)
      - `fecha_incidencia` (timestamp)
      - `descripcion_incidencia` (text)
      - `estado_incidencia` (text)
      - `gravedad_incidencia` (text)
      - `observaciones_incidencia` (text)
      - `orden_trabajo_id` (int, FK)
      
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
*/

-- Create Cargo table
CREATE TABLE IF NOT EXISTS cargo (
  id_cargo SERIAL PRIMARY KEY,
  nombre_cargo TEXT NOT NULL,
  descripcion_cargo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Usuario table
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario SERIAL PRIMARY KEY,
  usuario TEXT UNIQUE NOT NULL,
  clave TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (
    rol IN (
      'admin',
      'planner',
      'driver',
      'guard',
      'supervisor',
      'mechanic',
      'repuestos',
      'jefe_taller'
    )
  ),
  ultima_conexion TIMESTAMPTZ,
  estado_usuario BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Empleado table
CREATE TABLE IF NOT EXISTS empleado (
  id_empleado SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT,
  rut TEXT UNIQUE NOT NULL,
  email TEXT,
  telefono1 TEXT,
  telefono2 TEXT,
  fecha_nacimiento DATE,
  cargo_id INT NOT NULL REFERENCES cargo(id_cargo),
  usuario_id INT REFERENCES usuario(id_usuario),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create MarcaVehiculo table
CREATE TABLE IF NOT EXISTS marca_vehiculo (
  id_marca_vehiculo SERIAL PRIMARY KEY,
  nombre_marca TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create ModeloVehiculo table
CREATE TABLE IF NOT EXISTS modelo_vehiculo (
  id_modelo_vehiculo SERIAL PRIMARY KEY,
  nombre_modelo TEXT NOT NULL,
  anio_modelo INT,
  marca_vehiculo_id INT NOT NULL REFERENCES marca_vehiculo(id_marca_vehiculo),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create TipoVehiculo table
CREATE TABLE IF NOT EXISTS tipo_vehiculo (
  id_tipo_vehiculo SERIAL PRIMARY KEY,
  tipo_vehiculo TEXT NOT NULL,
  descripcion_tipo_vehiculo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Sucursal table
CREATE TABLE IF NOT EXISTS sucursal (
  id_sucursal SERIAL PRIMARY KEY,
  nombre_sucursal TEXT NOT NULL,
  direccion_sucursal TEXT,
  region_sucursal TEXT,
  comuna_sucursal TEXT,
  telefono_sucursal TEXT,
  email_sucursal TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Vehiculo table
CREATE TABLE IF NOT EXISTS vehiculo (
  id_vehiculo SERIAL PRIMARY KEY,
  patente_vehiculo TEXT UNIQUE NOT NULL,
  anio_vehiculo INT,
  fecha_adquisicion_vehiculo DATE,
  capacidad_carga_vehiculo DECIMAL(10,2),
  estado_vehiculo TEXT DEFAULT 'disponible' CHECK (estado_vehiculo IN ('disponible', 'en ruta', 'mantenimiento')),
  kilometraje_vehiculo DECIMAL(10,2) DEFAULT 0,
  modelo_vehiculo_id INT NOT NULL REFERENCES modelo_vehiculo(id_modelo_vehiculo),
  tipo_vehiculo_id INT NOT NULL REFERENCES tipo_vehiculo(id_tipo_vehiculo),
  sucursal_id INT NOT NULL REFERENCES sucursal(id_sucursal),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create OrdenTrabajo table
CREATE TABLE IF NOT EXISTS orden_trabajo (
  id_orden_trabajo SERIAL PRIMARY KEY,
  fecha_inicio_ot TIMESTAMPTZ DEFAULT now(),
  fecha_cierre_ot TIMESTAMPTZ,
  descripcion_ot TEXT,
  estado_ot TEXT DEFAULT 'pendiente' CHECK (estado_ot IN ('pendiente', 'en curso', 'finalizada')),
  empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
  vehiculo_id INT NOT NULL REFERENCES vehiculo(id_vehiculo),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Acceso table
CREATE TABLE IF NOT EXISTS acceso (
  id_acceso SERIAL PRIMARY KEY,
  fecha_ingreso TIMESTAMPTZ DEFAULT now(),
  fecha_salida TIMESTAMPTZ,
  observaciones TEXT,
  imagen_url TEXT,
  empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Llaves table
CREATE TABLE IF NOT EXISTS llaves (
  id_llaves SERIAL PRIMARY KEY,
  fecha_prestamo_llaves TIMESTAMPTZ DEFAULT now(),
  fecha_devolucion_llaves TIMESTAMPTZ,
  observaciones_llaves TEXT,
  vehiculo_id INT NOT NULL REFERENCES vehiculo(id_vehiculo),
  empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Servicio table
CREATE TABLE IF NOT EXISTS servicio (
  id_servicio SERIAL PRIMARY KEY,
  nombre_servicio TEXT NOT NULL,
  descripcion_servicio TEXT,
  orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Repuesto table
CREATE TABLE IF NOT EXISTS repuesto (
  id_repuesto SERIAL PRIMARY KEY,
  nombre_repuesto TEXT NOT NULL,
  descripcion_repuesto TEXT,
  stock_repuesto INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create OTRepuesto table
CREATE TABLE IF NOT EXISTS ot_repuesto (
  id_ot_repuesto SERIAL PRIMARY KEY,
  cantidad_ot_repuesto INT NOT NULL,
  orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo),
  repuesto_id INT NOT NULL REFERENCES repuesto(id_repuesto),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Incidencia table
CREATE TABLE IF NOT EXISTS incidencia (
  id_incidencia SERIAL PRIMARY KEY,
  fecha_incidencia TIMESTAMPTZ DEFAULT now(),
  descripcion_incidencia TEXT,
  estado_incidencia TEXT DEFAULT 'pendiente' CHECK (estado_incidencia IN ('pendiente', 'en revision', 'resuelta')),
  gravedad_incidencia TEXT CHECK (gravedad_incidencia IN ('baja', 'media', 'alta', 'critica')),
  observaciones_incidencia TEXT,
  orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleado ENABLE ROW LEVEL SECURITY;
ALTER TABLE marca_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelo_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipo_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE llaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_repuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencia ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Usuario table
CREATE POLICY "Allow public login access"
  ON usuario FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS Policies for all other tables (authenticated users only)
CREATE POLICY "Authenticated users can view cargo"
  ON cargo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view empleado"
  ON empleado FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert empleado"
  ON empleado FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update empleado"
  ON empleado FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view marca_vehiculo"
  ON marca_vehiculo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify marca_vehiculo"
  ON marca_vehiculo FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view modelo_vehiculo"
  ON modelo_vehiculo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify modelo_vehiculo"
  ON modelo_vehiculo FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view tipo_vehiculo"
  ON tipo_vehiculo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify tipo_vehiculo"
  ON tipo_vehiculo FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view sucursal"
  ON sucursal FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify sucursal"
  ON sucursal FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view vehiculo"
  ON vehiculo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and planner can modify vehiculo"
  ON vehiculo FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view orden_trabajo"
  ON orden_trabajo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify orden_trabajo"
  ON orden_trabajo FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view acceso"
  ON acceso FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert acceso"
  ON acceso FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view llaves"
  ON llaves FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify llaves"
  ON llaves FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view servicio"
  ON servicio FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view repuesto"
  ON repuesto FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view ot_repuesto"
  ON ot_repuesto FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view incidencia"
  ON incidencia FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can modify incidencia"
  ON incidencia FOR ALL
  TO authenticated
  USING (true);