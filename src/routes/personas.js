const express = require('express');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');
const { esRutValido, formatearRut } = require('../utils/rut');

const router = express.Router();
const ROLES_DIRECTORIO = [
    'pastor',
    'secretaria',
    'tesorero',
    'oficial',
    'lider',
    'editor_contenido',
    'voluntario'
];
const ROLES_CRITICOS = ['pastor', 'secretaria', 'tesorero', 'editor_contenido'];

async function obtenerRolesPersona(personaId) {
    const { data: asignaciones, error: errorAsignaciones } = await supabase
        .from('persona_roles')
        .select('rol_id')
        .eq('persona_id', personaId)
        .eq('activo', true);

    if (errorAsignaciones) throw errorAsignaciones;

    const ids = (asignaciones || []).map(item => item.rol_id);
    if (!ids.length) return [];

    const { data: roles, error: errorRoles } = await supabase
        .from('roles')
        .select('id, codigo, nombre, descripcion, es_critico')
        .in('id', ids)
        .order('nombre', { ascending: true });

    if (errorRoles) throw errorRoles;
    return roles || [];
}

router.get('/', verificarToken, verificarRol('pastor', 'secretaria', 'tesorero', 'oficial'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('personas')
            .select(`
                id,
                tipo_documento,
                documento_normalizado,
                nombres,
                apellidos,
                correo,
                telefono,
                direccion,
                fecha_nacimiento,
                estado,
                vinculos_iglesia (
                    id,
                    tipo,
                    estado,
                    fecha_inicio,
                    fecha_fin,
                    motivo_fin,
                    creado_en,
                    actualizado_en
                ),
                miembros (
                    id,
                    rut,
                    fecha_bautismo,
                    fecha_ingreso,
                    familia_id,
                    activo
                ),
                usuarios (
                    id,
                    nombre,
                    correo,
                    rol,
                    activo
                )
            `)
            .order('nombres', { ascending: true });

        if (error) throw error;

        const rolesLimitados = new Set(['oficial', 'tesorero']);
        const rolesUsuario = new Set([
            req.usuario.rol,
            ...(Array.isArray(req.usuario.roles) ? req.usuario.roles : [])
        ].filter(Boolean));
        const tieneDirectorioLimitado = !rolesUsuario.has('superadmin')
            && !rolesUsuario.has('pastor')
            && [...rolesLimitados].some(rol => rolesUsuario.has(rol));
        const personas = (data || []).map(persona => {
            const vinculos = persona.vinculos_iglesia || [];
            const vinculo = vinculos.find(item => item.estado === 'activo')
                || [...vinculos].sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))[0]
                || null;
            const miembro = (persona.miembros || [])[0] || null;
            const cuenta = Array.isArray(persona.usuarios)
                ? (persona.usuarios[0] || null)
                : (persona.usuarios || null);
            const nombre = [persona.nombres, persona.apellidos].filter(Boolean).join(' ').trim();

            const registro = {
                id: persona.id,
                nombre,
                rut: formatearRut(persona.documento_normalizado),
                correo: persona.correo,
                telefono: persona.telefono,
                direccion: persona.direccion,
                fecha_nacimiento: persona.fecha_nacimiento,
                estado: vinculo?.estado || persona.estado,
                tipo_vinculo: vinculo?.tipo || 'sin vínculo',
                fecha_inicio: vinculo?.fecha_inicio || null,
                motivo_inactividad: vinculo?.estado === 'inactivo' ? vinculo.motivo_fin : null,
                miembro,
                cuenta: cuenta ? {
                    id: cuenta.id,
                    nombre: cuenta.nombre,
                    correo: cuenta.correo,
                    rol_legacy: cuenta.rol,
                    activo: Boolean(cuenta.activo)
                } : null
            };

            if (!tieneDirectorioLimitado) return registro;
            return {
                id: registro.id,
                nombre: registro.nombre,
                estado: registro.estado,
                tipo_vinculo: registro.tipo_vinculo,
                fecha_inicio: registro.fecha_inicio,
                miembro: miembro ? {
                    id: miembro.id,
                    fecha_ingreso: miembro.fecha_ingreso,
                    familia_id: miembro.familia_id,
                    activo: miembro.activo
                } : null
            };
        });

        res.json({ personas, total: personas.length });
    } catch (err) {
        console.error('Error obteniendo personas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/mi-perfil', verificarToken, async (req, res) => {
    try {
        const { data: usuario, error: errorUsuario } = await supabase
            .from('usuarios')
            .select('id, correo, persona_id')
            .eq('id', req.usuario.id)
            .single();

        if (errorUsuario || !usuario?.persona_id) {
            return res.status(404).json({ error: 'La cuenta no tiene una persona asociada' });
        }

        const { data: persona, error: errorPersona } = await supabase
            .from('personas')
            .select(`
                id,
                nombres,
                apellidos,
                correo,
                telefono,
                fecha_nacimiento,
                estado,
                miembros (
                    id,
                    fecha_bautismo,
                    fecha_ingreso,
                    activo,
                    familias (id, nombre)
                )
            `)
            .eq('id', usuario.persona_id)
            .single();

        if (errorPersona || !persona) {
            return res.status(404).json({ error: 'No fue posible encontrar el perfil asociado' });
        }

        const miembro = (persona.miembros || [])[0] || null;
        const roles = miembro ? await obtenerRolesPersona(persona.id) : [];
        let actividades = [];

        if (miembro) {
            const ahoraIso = new Date().toISOString();
            const { data: eventos, error: errorEventos } = await supabase
                .from('eventos')
                .select('id, titulo, tipo, fecha_inicio, fecha_fin, ubicacion, visibilidad, departamento_id')
                .eq('estado', 'confirmado')
                .gte('fecha_inicio', ahoraIso)
                .order('fecha_inicio', { ascending: true })
                .limit(20);
            if (errorEventos) throw errorEventos;

            const idsEventos = (eventos || []).map(evento => evento.id);
            let audiencias = [];
            if (idsEventos.length) {
                const { data, error } = await supabase
                    .from('evento_audiencias')
                    .select('evento_id, tipo, rol_id, departamento_id')
                    .in('evento_id', idsEventos);
                if (error) throw error;
                audiencias = data || [];
            }

            const { data: liderazgos, error: errorLiderazgos } = await supabase
                .from('departamento_lideres')
                .select('departamento_id')
                .eq('persona_id', persona.id)
                .eq('estado', 'activo');
            if (errorLiderazgos) throw errorLiderazgos;

            const idsRoles = new Set(roles.map(rol => rol.id));
            const idsDepartamentos = new Set((liderazgos || []).map(item => item.departamento_id));

            actividades = (eventos || []).filter(evento => {
                const destinos = audiencias.filter(item => item.evento_id === evento.id);
                if (!destinos.length) {
                    return ['publica', 'congregacion'].includes(evento.visibilidad);
                }
                return destinos.some(destino =>
                    destino.tipo === 'publica'
                    || destino.tipo === 'miembros'
                    || (destino.tipo === 'rol' && idsRoles.has(destino.rol_id))
                    || (destino.tipo === 'departamento' && idsDepartamentos.has(destino.departamento_id))
                );
            }).slice(0, 6);
        }

        res.json({
            perfil: {
                id: persona.id,
                nombre: [persona.nombres, persona.apellidos].filter(Boolean).join(' ').trim(),
                correo: persona.correo || usuario.correo,
                telefono: persona.telefono,
                fecha_nacimiento: persona.fecha_nacimiento,
                estado: persona.estado,
                tipo_vinculo: miembro ? 'miembro' : 'invitado',
                miembro: miembro ? {
                    fecha_bautismo: miembro.fecha_bautismo,
                    fecha_ingreso: miembro.fecha_ingreso,
                    activo: Boolean(miembro.activo),
                    familia: miembro.familias || null
                } : null,
                roles: roles.map(rol => ({
                    codigo: rol.codigo,
                    nombre: rol.nombre
                })),
                actividades
            }
        });
    } catch (err) {
        console.error('Error obteniendo perfil propio:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/roles/catalogo', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('roles')
            .select('id, codigo, nombre, descripcion, es_critico')
            .in('codigo', ROLES_DIRECTORIO)
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (error) throw error;

        const esSuperadmin = req.usuario.rol === 'superadmin';
        const roles = (data || []).map(rol => ({
            ...rol,
            asignable: esSuperadmin || !ROLES_CRITICOS.includes(rol.codigo)
        }));

        res.json({ roles });
    } catch (err) {
        console.error('Error obteniendo catálogo de roles:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/:id/roles', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const { data: persona, error: errorPersona } = await supabase
            .from('personas')
            .select('id, nombres, apellidos, miembros(id)')
            .eq('id', req.params.id)
            .single();

        if (errorPersona || !persona) {
            return res.status(404).json({ error: 'Persona no encontrada' });
        }

        const esMiembro = (persona.miembros || []).length > 0;
        const roles = esMiembro ? await obtenerRolesPersona(persona.id) : [];

        res.json({
            persona_id: persona.id,
            es_miembro: esMiembro,
            roles
        });
    } catch (err) {
        console.error('Error obteniendo roles de la persona:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.put('/:id/roles', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        if (!Array.isArray(req.body.roles)) {
            return res.status(400).json({ error: 'La lista de roles no es válida' });
        }

        const rolesSolicitados = [...new Set(req.body.roles)];
        const rolesInvalidos = rolesSolicitados.filter(codigo => !ROLES_DIRECTORIO.includes(codigo));
        if (rolesInvalidos.length) {
            return res.status(400).json({ error: 'Uno o más roles no pueden asignarse' });
        }

        let rolesFinales = rolesSolicitados;
        if (req.usuario.rol !== 'superadmin') {
            if (rolesSolicitados.some(codigo => ROLES_CRITICOS.includes(codigo))) {
                return res.status(403).json({
                    error: 'Solo el superadministrador puede modificar roles críticos'
                });
            }

            const actuales = await obtenerRolesPersona(req.params.id);
            const criticosActuales = actuales
                .map(rol => rol.codigo)
                .filter(codigo => ROLES_CRITICOS.includes(codigo));
            rolesFinales = [...new Set([...rolesSolicitados, ...criticosActuales])];
        }

        const { data, error } = await supabase.rpc('asignar_roles_persona', {
            p_persona_id: req.params.id,
            p_roles: rolesFinales,
            p_actor_id: req.usuario.id
        });

        if (error) {
            if (error.code === '22023') {
                return res.status(400).json({ error: error.message });
            }
            throw error;
        }

        res.json({
            mensaje: 'Roles actualizados correctamente',
            roles: Array.isArray(data) ? data : []
        });
    } catch (err) {
        console.error('Error asignando roles:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/', verificarToken, verificarRol('pastor'), async (req, res) => {
    try {
        const {
            tipo_vinculo,
            nombre,
            rut,
            correo,
            telefono,
            direccion,
            fecha_nacimiento,
            fecha_bautismo,
            fecha_ingreso,
            activo
        } = req.body;

        if (!['invitado', 'miembro'].includes(tipo_vinculo)) {
            return res.status(400).json({ error: 'Selecciona Invitado o Miembro' });
        }
        if (!nombre?.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        if (!esRutValido(rut)) {
            return res.status(400).json({ error: 'Ingresa un RUT chileno válido' });
        }
        if (fecha_nacimiento && fecha_nacimiento > new Date().toISOString().split('T')[0]) {
            return res.status(400).json({ error: 'La fecha de nacimiento no puede ser futura' });
        }

        const esMiembro = tipo_vinculo === 'miembro';
        const rpc = esMiembro ? 'crear_miembro_con_persona' : 'crear_persona_invitada';
        const parametros = esMiembro
            ? {
                p_nombre: nombre.trim(),
                p_rut: formatearRut(rut),
                p_correo: correo || null,
                p_telefono: telefono || null,
                p_fecha_bautismo: fecha_bautismo || null,
                p_direccion: direccion || null,
                p_fecha_ingreso: fecha_ingreso || new Date().toISOString().split('T')[0],
                p_activo: activo !== false,
                p_actor_id: req.usuario.id
            }
            : {
                p_nombre: nombre.trim(),
                p_rut: formatearRut(rut),
                p_correo: correo || null,
                p_telefono: telefono || null,
                p_direccion: direccion || null,
                p_fecha_inicio: fecha_ingreso || new Date().toISOString().split('T')[0],
                p_activo: activo !== false,
                p_actor_id: req.usuario.id
            };

        const { data, error } = await supabase.rpc(rpc, parametros);
        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: error.message });
            }
            if (error.code === '22023') {
                return res.status(400).json({ error: error.message });
            }
            throw error;
        }

        const registro = Array.isArray(data) ? data[0] : data;
        const personaId = esMiembro ? registro?.persona_id : registro?.id;
        if (personaId) {
            const { error: errorNacimiento } = await supabase
                .from('personas')
                .update({ fecha_nacimiento: fecha_nacimiento || null, actualizado_en: new Date().toISOString() })
                .eq('id', personaId);
            if (errorNacimiento) throw errorNacimiento;
        }
        res.status(201).json({
            mensaje: esMiembro ? 'Miembro registrado correctamente' : 'Invitado registrado correctamente',
            tipo_vinculo,
            registro
        });
    } catch (err) {
        console.error('Error registrando persona:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
