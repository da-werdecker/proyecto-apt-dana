        /*
        Reset and align APT schema with current application domain.
        This migration drops existing objects (if any) and recreates
        the full relational model used by the React application.
        */

        BEGIN;

        -- ============================================================
        -- Cleanup of previous objects (safe when schema is empty)
        -- ============================================================
    DROP TABLE IF EXISTS notificacion CASCADE;
    DROP TABLE IF EXISTS config_agenda CASCADE;
    DROP TABLE IF EXISTS auditoria_usuario CASCADE;
    DROP TABLE IF EXISTS historial_accesos CASCADE;
    DROP TABLE IF EXISTS checklist_diagnostico CASCADE;
    DROP TABLE IF EXISTS driver_history CASCADE;
    DROP TABLE IF EXISTS asignacion_vehiculo CASCADE;
    DROP TABLE IF EXISTS permiso_usuario CASCADE;
    DROP TABLE IF EXISTS rol_permiso CASCADE;
    DROP TABLE IF EXISTS permiso CASCADE;
    DROP TABLE IF EXISTS perfil_usuario CASCADE;
    DROP TABLE IF EXISTS estado_ot_catalogo CASCADE;
    DROP TABLE IF EXISTS prioridad_ot_catalogo CASCADE;
    DROP TABLE IF EXISTS tipo_falla CASCADE;
    DROP TABLE IF EXISTS modelo_categoria CASCADE;
    DROP TABLE IF EXISTS categoria_vehiculo CASCADE;
    DROP TABLE IF EXISTS ot_repuesto CASCADE;
    DROP TABLE IF EXISTS repuesto CASCADE;
    DROP TABLE IF EXISTS servicio CASCADE;
    DROP TABLE IF EXISTS llaves CASCADE;
    DROP TABLE IF EXISTS acceso CASCADE;
    DROP TABLE IF EXISTS incidencia CASCADE;
    DROP TABLE IF EXISTS orden_trabajo CASCADE;
    DROP TABLE IF EXISTS solicitud_diagnostico CASCADE;
    DROP TABLE IF EXISTS vehiculo CASCADE;
    DROP TABLE IF EXISTS sucursal CASCADE;
    DROP TABLE IF EXISTS tipo_vehiculo CASCADE;
    DROP TABLE IF EXISTS modelo_vehiculo CASCADE;
    DROP TABLE IF EXISTS marca_vehiculo CASCADE;
    DROP TABLE IF EXISTS empleado CASCADE;
    DROP TABLE IF EXISTS usuario CASCADE;
    DROP TABLE IF EXISTS cargo CASCADE;

        -- ============================================================
        -- Base catalogues
        -- ============================================================
        CREATE TABLE cargo (
        id_cargo SERIAL PRIMARY KEY,
        nombre_cargo TEXT NOT NULL UNIQUE,
        descripcion_cargo TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE usuario (
        id_usuario SERIAL PRIMARY KEY,
        usuario TEXT NOT NULL UNIQUE,
        clave TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (
            rol IN (
            'admin',
            'planner',
            'supervisor',
            'mechanic',
            'guard',
            'driver',
            'repuestos',
            'jefe_taller'
            )
        ),
        ultima_conexion TIMESTAMPTZ,
        estado_usuario BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE empleado (
        id_empleado SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        apellido_paterno TEXT NOT NULL,
        apellido_materno TEXT,
        rut TEXT NOT NULL UNIQUE,
        email TEXT,
        telefono1 TEXT,
        telefono2 TEXT,
        fecha_nacimiento DATE,
        cargo_id INT NOT NULL REFERENCES cargo(id_cargo),
        usuario_id INT REFERENCES usuario(id_usuario),
        estado_empleado TEXT NOT NULL DEFAULT 'activo' CHECK (estado_empleado IN ('activo', 'inactivo')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE marca_vehiculo (
        id_marca_vehiculo SERIAL PRIMARY KEY,
        nombre_marca TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE tipo_vehiculo (
        id_tipo_vehiculo SERIAL PRIMARY KEY,
        tipo_vehiculo TEXT NOT NULL UNIQUE,
        descripcion_tipo_vehiculo TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE sucursal (
        id_sucursal SERIAL PRIMARY KEY,
        nombre_sucursal TEXT NOT NULL UNIQUE,
        direccion_sucursal TEXT,
        region_sucursal TEXT,
        comuna_sucursal TEXT,
        telefono_sucursal TEXT,
        email_sucursal TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE modelo_vehiculo (
        id_modelo_vehiculo SERIAL PRIMARY KEY,
        nombre_modelo TEXT NOT NULL,
        anio_modelo INT,
        marca_vehiculo_id INT NOT NULL REFERENCES marca_vehiculo(id_marca_vehiculo),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (nombre_modelo, marca_vehiculo_id)
        );

    CREATE TABLE categoria_vehiculo (
    id_categoria_vehiculo SERIAL PRIMARY KEY,
    nombre_categoria TEXT NOT NULL UNIQUE,
    descripcion_categoria TEXT,
    color_hex TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE modelo_categoria (
    id_modelo_categoria SERIAL PRIMARY KEY,
    modelo_vehiculo_id INT NOT NULL REFERENCES modelo_vehiculo(id_modelo_vehiculo) ON DELETE CASCADE,
    categoria_vehiculo_id INT NOT NULL REFERENCES categoria_vehiculo(id_categoria_vehiculo) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (modelo_vehiculo_id, categoria_vehiculo_id)
    );

    CREATE TABLE tipo_falla (
    id_tipo_falla SERIAL PRIMARY KEY,
    nombre_tipo_falla TEXT NOT NULL UNIQUE,
    descripcion_tipo_falla TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE prioridad_ot_catalogo (
    id_prioridad_ot SERIAL PRIMARY KEY,
    valor TEXT NOT NULL UNIQUE,
    etiqueta TEXT NOT NULL,
    color_hex TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE estado_ot_catalogo (
    id_estado_ot SERIAL PRIMARY KEY,
    valor TEXT NOT NULL UNIQUE,
    etiqueta TEXT NOT NULL,
    orden_visual INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE perfil_usuario (
    id_perfil SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    rol TEXT NOT NULL,
    titulo TEXT,
    landing_page TEXT,
    modulos JSONB NOT NULL DEFAULT '[]'::jsonb,
    widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE permiso (
    id_permiso SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    nombre_permiso TEXT NOT NULL,
    descripcion_permiso TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE rol_permiso (
    id_rol_permiso SERIAL PRIMARY KEY,
    rol TEXT NOT NULL,
    permiso_id INT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
    permitido BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rol, permiso_id)
    );

    CREATE TABLE permiso_usuario (
    id_permiso_usuario SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    permiso_id INT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
    permitido BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, permiso_id)
    );

    CREATE TABLE config_agenda (
    id_config_agenda SERIAL PRIMARY KEY,
    hora_inicio TIME NOT NULL DEFAULT '07:30',
    hora_fin TIME NOT NULL DEFAULT '16:30',
    hora_inicio_colacion TIME NOT NULL DEFAULT '12:30',
    hora_fin_colacion TIME NOT NULL DEFAULT '13:15',
    duracion_diagnostico INTEGER NOT NULL DEFAULT 2,
    duracion_reparacion INTEGER NOT NULL DEFAULT 4,
    dias_habiles TEXT[] NOT NULL DEFAULT ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE notificacion (
    id_notificacion SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT,
    leido BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE auditoria_usuario (
    id_auditoria SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    actor_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    accion TEXT NOT NULL,
    detalle TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

        -- ============================================================
        -- Vehículos y operaciones
        -- ============================================================
        CREATE TABLE vehiculo (
        id_vehiculo SERIAL PRIMARY KEY,
        patente_vehiculo TEXT NOT NULL UNIQUE,
        anio_vehiculo INT,
        fecha_adquisicion_vehiculo DATE,
        capacidad_carga_vehiculo DECIMAL(10,2),
        estado_vehiculo TEXT NOT NULL DEFAULT 'disponible'
            CHECK (estado_vehiculo IN ('disponible', 'en ruta', 'mantenimiento')),
        kilometraje_vehiculo DECIMAL(10,2),
        modelo_vehiculo_id INT NOT NULL REFERENCES modelo_vehiculo(id_modelo_vehiculo),
        tipo_vehiculo_id INT NOT NULL REFERENCES tipo_vehiculo(id_tipo_vehiculo),
        sucursal_id INT NOT NULL REFERENCES sucursal(id_sucursal),
    categoria_vehiculo_id INT REFERENCES categoria_vehiculo(id_categoria_vehiculo),
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE solicitud_diagnostico (
        id_solicitud_diagnostico SERIAL PRIMARY KEY,
        vehiculo_id INT REFERENCES vehiculo(id_vehiculo),
        empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
        patente_vehiculo TEXT, -- almacenamos texto incluso cuando no existe el vehículo
        tipo_problema TEXT NOT NULL,
    tipo_falla_id INT REFERENCES tipo_falla(id_tipo_falla),
        prioridad TEXT NOT NULL DEFAULT 'normal'
            CHECK (prioridad IN ('normal', 'urgente')),
        fecha_solicitada DATE NOT NULL,
        bloque_horario TEXT NOT NULL,
        comentarios TEXT,
        fotos TEXT[],
        estado_solicitud TEXT NOT NULL DEFAULT 'pendiente_confirmacion'
            CHECK (
            estado_solicitud IN (
                'pendiente_confirmacion',
                'confirmada',
                'rechazada',
                'completada'
            )
            ),
        tipo_trabajo TEXT,
        fecha_confirmada DATE,
        bloque_horario_confirmado TEXT,
        orden_trabajo_id INT,
        box_id INT,
        mecanico_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE orden_trabajo (
        id_orden_trabajo SERIAL PRIMARY KEY,
        codigo_ot TEXT UNIQUE,
        descripcion_ot TEXT,
        estado_ot TEXT NOT NULL DEFAULT 'pendiente'
            CHECK (
            estado_ot IN (
                'pendiente',
                'en curso',
                'en_reparacion',
                'finalizada',
                'cancelada'
            )
            ),
        prioridad_ot TEXT DEFAULT 'normal'
            CHECK (prioridad_ot IN ('normal', 'alta', 'critica')),
    prioridad_id INT REFERENCES prioridad_ot_catalogo(id_prioridad_ot),
        fecha_inicio_ot TIMESTAMPTZ NOT NULL DEFAULT now(),
        fecha_cierre_ot TIMESTAMPTZ,
        hora_confirmada TEXT,
        empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
        vehiculo_id INT NOT NULL REFERENCES vehiculo(id_vehiculo),
        sucursal_id INT REFERENCES sucursal(id_sucursal),
        solicitud_diagnostico_id INT REFERENCES solicitud_diagnostico(id_solicitud_diagnostico),
        detalle_reparacion TEXT,
        checklist_id INT,
        mecanico_apoyo_ids INT[],
        estado_cierre TEXT DEFAULT 'pendiente'
            CHECK (estado_cierre IN ('pendiente', 'cerrada')),
        fecha_cierre_tecnico TIMESTAMPTZ,
        confirmado_ingreso BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

    CREATE TABLE checklist_diagnostico (
    id_checklist SERIAL PRIMARY KEY,
    orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo) ON DELETE CASCADE,
    empleado_id INT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
    datos JSONB NOT NULL,
    clasificacion_prioridad TEXT,
    estado TEXT DEFAULT 'completado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (orden_trabajo_id)
    );

        CREATE TABLE servicio (
        id_servicio SERIAL PRIMARY KEY,
        nombre_servicio TEXT NOT NULL,
        descripcion_servicio TEXT,
        orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE repuesto (
        id_repuesto SERIAL PRIMARY KEY,
        nombre_repuesto TEXT NOT NULL,
        descripcion_repuesto TEXT,
        stock_repuesto INT NOT NULL DEFAULT 0,
        unidad_medida TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE ot_repuesto (
        id_ot_repuesto SERIAL PRIMARY KEY,
        cantidad_ot_repuesto INT NOT NULL,
        orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo) ON DELETE CASCADE,
        repuesto_id INT NOT NULL REFERENCES repuesto(id_repuesto),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE incidencia (
        id_incidencia SERIAL PRIMARY KEY,
        fecha_incidencia TIMESTAMPTZ NOT NULL DEFAULT now(),
        descripcion_incidencia TEXT,
        estado_incidencia TEXT NOT NULL DEFAULT 'pendiente'
            CHECK (estado_incidencia IN ('pendiente', 'en revision', 'resuelta')),
        gravedad_incidencia TEXT
            CHECK (gravedad_incidencia IN ('baja', 'media', 'alta', 'critica')),
        observaciones_incidencia TEXT,
        orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo),
        empleado_id INT REFERENCES empleado(id_empleado),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE acceso (
        id_acceso SERIAL PRIMARY KEY,
        empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
        vehiculo_id INT REFERENCES vehiculo(id_vehiculo),
        fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT now(),
        fecha_salida TIMESTAMPTZ,
        observaciones TEXT,
        imagen_url TEXT,
        estado_acceso TEXT DEFAULT 'en_progreso'
            CHECK (estado_acceso IN ('en_progreso', 'completado', 'rechazado')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

    CREATE TABLE historial_accesos (
    id_historial_accesos SERIAL PRIMARY KEY,
    acceso_id INT NOT NULL REFERENCES acceso(id_acceso) ON DELETE CASCADE,
    evento TEXT NOT NULL,
    descripcion TEXT,
    actor_id INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

        CREATE TABLE llaves (
        id_llaves SERIAL PRIMARY KEY,
        vehiculo_id INT NOT NULL REFERENCES vehiculo(id_vehiculo),
        empleado_id INT NOT NULL REFERENCES empleado(id_empleado),
        fecha_prestamo_llaves TIMESTAMPTZ NOT NULL DEFAULT now(),
        fecha_devolucion_llaves TIMESTAMPTZ,
        observaciones_llaves TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

    CREATE TABLE asignacion_vehiculo (
    id_asignacion SERIAL PRIMARY KEY,
    empleado_id INT NOT NULL REFERENCES empleado(id_empleado) ON DELETE CASCADE,
    vehiculo_id INT NOT NULL REFERENCES vehiculo(id_vehiculo) ON DELETE CASCADE,
    sucursal_id INT REFERENCES sucursal(id_sucursal),
    estado_asignacion TEXT NOT NULL DEFAULT 'activo' CHECK (estado_asignacion IN ('activo','finalizado')),
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_fin TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT asignacion_unica_activa UNIQUE (empleado_id, estado_asignacion)
        DEFERRABLE INITIALLY IMMEDIATE
    );

    CREATE TABLE driver_history (
    id_driver_history SERIAL PRIMARY KEY,
    empleado_id INT NOT NULL REFERENCES empleado(id_empleado) ON DELETE CASCADE,
    solicitud_diagnostico_id INT REFERENCES solicitud_diagnostico(id_solicitud_diagnostico) ON DELETE SET NULL,
    vehiculo_id INT REFERENCES vehiculo(id_vehiculo) ON DELETE SET NULL,
    descripcion TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE TABLE aprobacion_asignacion_ot (
id_aprobacion SERIAL PRIMARY KEY,
orden_trabajo_id INT NOT NULL REFERENCES orden_trabajo(id_orden_trabajo) ON DELETE CASCADE,
mecanico_id INT NOT NULL REFERENCES empleado(id_empleado) ON DELETE CASCADE,
estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'revocada')),
comentarios TEXT,
aprobado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
aprobado_en TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
UNIQUE (orden_trabajo_id, mecanico_id)
);

        -- ============================================================
        -- Row Level Security
        -- ============================================================
        ALTER TABLE cargo ENABLE ROW LEVEL SECURITY;
        ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
        ALTER TABLE empleado ENABLE ROW LEVEL SECURITY;
        ALTER TABLE marca_vehiculo ENABLE ROW LEVEL SECURITY;
        ALTER TABLE modelo_vehiculo ENABLE ROW LEVEL SECURITY;
        ALTER TABLE tipo_vehiculo ENABLE ROW LEVEL SECURITY;
        ALTER TABLE sucursal ENABLE ROW LEVEL SECURITY;
        ALTER TABLE vehiculo ENABLE ROW LEVEL SECURITY;
        ALTER TABLE solicitud_diagnostico ENABLE ROW LEVEL SECURITY;
        ALTER TABLE orden_trabajo ENABLE ROW LEVEL SECURITY;
        ALTER TABLE servicio ENABLE ROW LEVEL SECURITY;
        ALTER TABLE repuesto ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ot_repuesto ENABLE ROW LEVEL SECURITY;
        ALTER TABLE incidencia ENABLE ROW LEVEL SECURITY;
        ALTER TABLE acceso ENABLE ROW LEVEL SECURITY;
        ALTER TABLE llaves ENABLE ROW LEVEL SECURITY;
    ALTER TABLE categoria_vehiculo ENABLE ROW LEVEL SECURITY;
    ALTER TABLE modelo_categoria ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tipo_falla ENABLE ROW LEVEL SECURITY;
    ALTER TABLE prioridad_ot_catalogo ENABLE ROW LEVEL SECURITY;
    ALTER TABLE estado_ot_catalogo ENABLE ROW LEVEL SECURITY;
    ALTER TABLE perfil_usuario ENABLE ROW LEVEL SECURITY;
    ALTER TABLE permiso ENABLE ROW LEVEL SECURITY;
    ALTER TABLE rol_permiso ENABLE ROW LEVEL SECURITY;
    ALTER TABLE permiso_usuario ENABLE ROW LEVEL SECURITY;
    ALTER TABLE config_agenda ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notificacion ENABLE ROW LEVEL SECURITY;
    ALTER TABLE auditoria_usuario ENABLE ROW LEVEL SECURITY;
    ALTER TABLE historial_accesos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE asignacion_vehiculo ENABLE ROW LEVEL SECURITY;
    ALTER TABLE driver_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE checklist_diagnostico ENABLE ROW LEVEL SECURITY;
ALTER TABLE aprobacion_asignacion_ot ENABLE ROW LEVEL SECURITY;

        -- Policies (baseline, refine as needed)
        CREATE POLICY "Public read usuarios" ON usuario
        FOR SELECT
        TO public
        USING (true);

    CREATE POLICY "Public manage usuario" ON usuario
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Anon insert usuario" ON usuario
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

        CREATE POLICY "Authenticated read cargo" ON cargo
        FOR SELECT
        TO authenticated
        USING (true);

    CREATE POLICY "Anon manage cargo" ON cargo
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

        CREATE POLICY "Authenticated read empleado" ON empleado
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Authenticated modify empleado" ON empleado
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Anon manage empleado" ON empleado
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

        CREATE POLICY "Authenticated read catálogos" ON marca_vehiculo
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Authenticated read modelos" ON modelo_vehiculo
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Authenticated read tipos" ON tipo_vehiculo
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Authenticated read sucursal" ON sucursal
        FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Authenticated manage vehiculos" ON vehiculo
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage solicitudes" ON solicitud_diagnostico
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage OTs" ON orden_trabajo
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage servicios" ON servicio
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage repuestos" ON repuesto
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage ot_repuesto" ON ot_repuesto
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage incidencias" ON incidencia
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage accesos" ON acceso
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "Authenticated manage llaves" ON llaves
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

    CREATE POLICY "Authenticated read categorias vehiculo" ON categoria_vehiculo
    FOR SELECT
    TO authenticated
    USING (true);

    CREATE POLICY "Authenticated manage categorias vehiculo" ON categoria_vehiculo
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage modelo_categoria" ON modelo_categoria
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated read tipo_falla" ON tipo_falla
    FOR SELECT
    TO authenticated
    USING (true);

    CREATE POLICY "Authenticated manage tipo_falla" ON tipo_falla
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated read prioridad catalogo" ON prioridad_ot_catalogo
    FOR SELECT
    TO authenticated
    USING (true);

    CREATE POLICY "Authenticated manage prioridad catalogo" ON prioridad_ot_catalogo
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated read estado ot catalogo" ON estado_ot_catalogo
    FOR SELECT
    TO authenticated
    USING (true);

    CREATE POLICY "Authenticated manage estado ot catalogo" ON estado_ot_catalogo
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage perfil usuario" ON perfil_usuario
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage permisos" ON permiso
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage rol_permiso" ON rol_permiso
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage permiso_usuario" ON permiso_usuario
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage config agenda" ON config_agenda
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage notificaciones" ON notificacion
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage auditoria" ON auditoria_usuario
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage historial accesos" ON historial_accesos
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage asignaciones" ON asignacion_vehiculo
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Authenticated manage driver history" ON driver_history
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

    CREATE POLICY "Anon manage checklist diagnostico" ON checklist_diagnostico
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon read aprobacion asignacion" ON aprobacion_asignacion_ot
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anon insert aprobacion asignacion" ON aprobacion_asignacion_ot
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anon update aprobacion asignacion" ON aprobacion_asignacion_ot
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

        -- ============================================================
        -- Seed data
        -- ============================================================
        INSERT INTO cargo (nombre_cargo, descripcion_cargo)
        VALUES
        ('Jefe de Taller', 'Responsable del taller'),
        ('Supervisor', 'Supervisor general'),
        ('Coordinador', 'Planificación de diagnósticos'),
        ('Mecánico', 'Mecánico de mantenimiento'),
        ('Guardia', 'Control de accesos'),
        ('Chofer', 'Conductor de flota')
        ON CONFLICT (nombre_cargo) DO NOTHING;

    INSERT INTO permiso (codigo, nombre_permiso, descripcion_permiso) VALUES
    ('ver_reportes', 'Ver reportes', 'Accede a reportes generales'),
    ('crear_ot', 'Crear OT', 'Puede crear órdenes de trabajo'),
    ('cerrar_ot', 'Cerrar OT', 'Cierra órdenes de trabajo'),
    ('editar_catalogos', 'Editar catálogos', 'Gestiona catálogos del taller'),
    ('ver_agenda', 'Ver agenda', 'Accede a agenda general'),
    ('ver_vehiculos', 'Ver vehículos', 'Consulta listado de vehículos'),
    ('asignar_mecanicos', 'Asignar mecánicos', 'Asigna personal a las OT'),
    ('aprobar_diagnosticos', 'Aprobar diagnósticos', 'Aprueba diagnósticos solicitados'),
    ('gestionar_usuarios', 'Gestionar usuarios', 'Puede crear y editar usuarios'),
    ('registrar_avances', 'Registrar avances', 'Carga avances de reparación'),
    ('agendar_diagnostico', 'Agendar diagnóstico', 'Genera solicitudes de diagnóstico'),
    ('registrar_entradas_salidas', 'Registrar entradas/salidas', 'Controla accesos')
    ON CONFLICT (codigo) DO NOTHING;

    -- Permisos por rol según UI
    INSERT INTO rol_permiso (rol, permiso_id, permitido)
    SELECT mapa.rol, p.id_permiso, true
    FROM permiso p
    JOIN (
    VALUES
        ('admin','ver_reportes'),
        ('admin','crear_ot'),
        ('admin','cerrar_ot'),
        ('admin','editar_catalogos'),
        ('admin','ver_agenda'),
        ('admin','ver_vehiculos'),
        ('admin','asignar_mecanicos'),
        ('admin','aprobar_diagnosticos'),
        ('admin','gestionar_usuarios'),
        ('planner','ver_reportes'),
        ('planner','crear_ot'),
        ('planner','ver_agenda'),
        ('planner','ver_vehiculos'),
        ('supervisor','ver_reportes'),
        ('supervisor','ver_vehiculos'),
        ('supervisor','crear_ot'),
        ('supervisor','cerrar_ot'),
        ('supervisor','ver_agenda'),
        ('supervisor','asignar_mecanicos'),
        ('supervisor','aprobar_diagnosticos'),
        ('jefe_taller','ver_reportes'),
        ('jefe_taller','ver_vehiculos'),
        ('jefe_taller','cerrar_ot'),
        ('jefe_taller','ver_agenda'),
        ('jefe_taller','asignar_mecanicos'),
        ('mechanic','registrar_avances'),
        ('guard','registrar_entradas_salidas'),
        ('driver','agendar_diagnostico')
) AS mapa(rol,codigo)
ON mapa.codigo = p.codigo
ON CONFLICT DO NOTHING;

        INSERT INTO usuario (usuario, clave, rol)
        VALUES
        ('admin', 'admin123', 'admin'),
        ('coordinador', 'planner123', 'planner'),
        ('supervisor', 'supervisor123', 'supervisor'),
        ('mecanico', 'mecanico123', 'mechanic'),
        ('guardia', 'guardia123', 'guard'),
        ('chofer', 'chofer123', 'driver')
        ON CONFLICT (usuario) DO NOTHING;

        -- Vincular usuarios con empleados base
        INSERT INTO empleado (
        nombre,
        apellido_paterno,
        apellido_materno,
        rut,
        email,
        telefono1,
        fecha_nacimiento,
        cargo_id,
        usuario_id
        )
        SELECT
        base.nombre,
        base.apellido_paterno,
        base.apellido_materno,
        base.rut,
        base.email,
        base.telefono,
        base.fecha_nacimiento::DATE,
        c.id_cargo,
        u.id_usuario
        FROM (
        VALUES
            ('Daniel', 'Werdecker', 'Admin', '11.111.111-1', 'admin@example.com', '+56911111111', '1985-01-15', 'Jefe de Taller', 'admin'),
            ('Carla', 'García', 'Coordinadora', '22.222.222-2', 'coordinador@example.com', '+56922222222', '1990-03-20', 'Coordinador', 'coordinador'),
            ('Sofía', 'Pérez', 'Supervisora', '33.333.333-3', 'supervisor@example.com', '+56933333333', '1988-07-11', 'Supervisor', 'supervisor'),
            ('Mario', 'López', 'Mecánico', '44.444.444-4', 'mecanico@example.com', '+56944444444', '1992-05-05', 'Mecánico', 'mecanico'),
            ('Gabriel', 'Rojas', 'Guardia', '55.555.555-5', 'guardia@example.com', '+56955555555', '1980-09-18', 'Guardia', 'guardia'),
            ('Dana', 'Gómez', 'Chofer', '21.313.407-8', 'dana@example.com', '+56966666666', '1990-05-10', 'Chofer', 'chofer')
        ) AS base (nombre, apellido_paterno, apellido_materno, rut, email, telefono, fecha_nacimiento, cargo_nombre, usuario_nombre)
        JOIN cargo c ON c.nombre_cargo = base.cargo_nombre
        JOIN usuario u ON u.usuario = base.usuario_nombre
        ON CONFLICT (rut) DO NOTHING;

    INSERT INTO perfil_usuario (usuario_id, rol, titulo, landing_page, modulos, widgets)
    SELECT
    u.id_usuario,
    u.rol,
    INITCAP(u.rol),
    CASE u.rol
        WHEN 'admin' THEN 'admin-usuarios'
        WHEN 'planner' THEN 'coordinator-agenda'
        WHEN 'supervisor' THEN 'supervisor-tablero'
        WHEN 'mechanic' THEN 'mechanic-assigned'
        WHEN 'jefe_taller' THEN 'workshop-agenda'
        WHEN 'guard' THEN 'gate-ingreso'
        WHEN 'driver' THEN 'schedule-diagnostic'
        ELSE 'dashboard'
    END,
    '[]'::jsonb,
    '[]'::jsonb
    FROM usuario u
    ON CONFLICT (usuario_id) DO NOTHING;

        -- Catálogos de vehículos
        INSERT INTO marca_vehiculo (nombre_marca)
        VALUES ('Mercedes-Benz'), ('Volvo')
        ON CONFLICT (nombre_marca) DO NOTHING;

        INSERT INTO tipo_vehiculo (tipo_vehiculo, descripcion_tipo_vehiculo)
        VALUES
        ('Camión', 'Camión de transporte de carga'),
        ('Camioneta', 'Vehículo liviano de soporte')
        ON CONFLICT (tipo_vehiculo) DO NOTHING;

    INSERT INTO categoria_vehiculo (nombre_categoria, descripcion_categoria, color_hex) VALUES
    ('Eléctricos', 'Vehículos eléctricos de reparto', '#DCFCE7'),
    ('Diésel', 'Vehículos diésel de carga', '#DBEAFE'),
    ('Vehículos de Ventas', 'Vehículos orientados a ventas', '#FEF3C7'),
    ('Flota de Respaldo', 'Unidades de respaldo', '#E5E7EB')
    ON CONFLICT (nombre_categoria) DO NOTHING;

    INSERT INTO modelo_categoria (modelo_vehiculo_id, categoria_vehiculo_id)
    SELECT m.id_modelo_vehiculo, c.id_categoria_vehiculo
    FROM modelo_vehiculo m
    JOIN marca_vehiculo ma ON ma.id_marca_vehiculo = m.marca_vehiculo_id
    JOIN categoria_vehiculo c ON c.nombre_categoria =
    CASE
        WHEN ma.nombre_marca = 'Mercedes-Benz' THEN 'Eléctricos'
        WHEN ma.nombre_marca = 'Volvo' THEN 'Diésel'
        ELSE 'Flota de Respaldo'
    END
    ON CONFLICT (modelo_vehiculo_id, categoria_vehiculo_id) DO NOTHING;

    INSERT INTO tipo_falla (nombre_tipo_falla, descripcion_tipo_falla) VALUES
    ('Ruido', 'Reportes de ruido en operación'),
    ('Frenos', 'Problemas en frenos'),
    ('Eléctrico', 'Fallos eléctricos generales'),
    ('Motor', 'Anomalías en motor'),
    ('Suspensión', 'Problemas de suspensión'),
    ('Transmisión', 'Fallos en transmisión'),
    ('Neumáticos', 'Desgaste o pinchazo'),
    ('Otro', 'Categoría abierta')
    ON CONFLICT (nombre_tipo_falla) DO NOTHING;

    INSERT INTO prioridad_ot_catalogo (valor, etiqueta, color_hex) VALUES
    ('normal', 'Normal', '#DBEAFE'),
    ('alta', 'Alta', '#FDE68A'),
    ('critica', 'Crítica', '#FCA5A5')
    ON CONFLICT (valor) DO NOTHING;

    INSERT INTO estado_ot_catalogo (valor, etiqueta, orden_visual) VALUES
    ('pendiente', 'Pendiente', 1),
    ('en_diagnostico_programado', 'En diagnóstico programado', 2),
    ('en curso', 'En curso', 3),
    ('en_reparacion', 'En reparación', 4),
    ('finalizada', 'Finalizada', 5),
    ('cancelada', 'Cancelada', 6)
    ON CONFLICT (valor) DO NOTHING;

        INSERT INTO sucursal (
        nombre_sucursal,
        direccion_sucursal,
        region_sucursal,
        comuna_sucursal,
        telefono_sucursal,
        email_sucursal
        ) VALUES (
        'Taller Central',
        'Av. Principal 123',
        'Región Metropolitana',
        'Santiago',
        '+56 2 23456789',
        'taller@sucursal.cl'
        ) ON CONFLICT (nombre_sucursal) DO NOTHING;

        -- asociar modelos con IDs existentes
        INSERT INTO modelo_vehiculo (nombre_modelo, anio_modelo, marca_vehiculo_id)
        SELECT 'Actros 2545', 2023, id_marca_vehiculo
        FROM marca_vehiculo
        WHERE nombre_marca = 'Mercedes-Benz'
        ON CONFLICT (nombre_modelo, marca_vehiculo_id) DO NOTHING;

        INSERT INTO modelo_vehiculo (nombre_modelo, anio_modelo, marca_vehiculo_id)
        SELECT 'FH 460', 2022, id_marca_vehiculo
        FROM marca_vehiculo
        WHERE nombre_marca = 'Volvo'
        ON CONFLICT (nombre_modelo, marca_vehiculo_id) DO NOTHING;

        -- Vehículo de demostración
        INSERT INTO vehiculo (
        patente_vehiculo,
        anio_vehiculo,
        estado_vehiculo,
        kilometraje_vehiculo,
        modelo_vehiculo_id,
        tipo_vehiculo_id,
        sucursal_id,
    categoria_vehiculo_id,
        observaciones
        )
        SELECT
        'KT-ZR-21',
        2023,
        'disponible',
        45000,
        m.id_modelo_vehiculo,
        t.id_tipo_vehiculo,
        s.id_sucursal,
    c.id_categoria_vehiculo,
        'Vehículo demo cargado por semilla'
        FROM modelo_vehiculo m
        JOIN marca_vehiculo ma ON ma.id_marca_vehiculo = m.marca_vehiculo_id AND ma.nombre_marca = 'Mercedes-Benz'
        JOIN tipo_vehiculo t ON t.tipo_vehiculo = 'Camión'
        JOIN sucursal s ON s.nombre_sucursal = 'Taller Central'
    LEFT JOIN modelo_categoria mc ON mc.modelo_vehiculo_id = m.id_modelo_vehiculo
    LEFT JOIN categoria_vehiculo c ON c.id_categoria_vehiculo = mc.categoria_vehiculo_id
        ON CONFLICT (patente_vehiculo) DO NOTHING;

    INSERT INTO config_agenda (id_config_agenda) VALUES (1)
    ON CONFLICT (id_config_agenda) DO NOTHING;

        COMMIT;

