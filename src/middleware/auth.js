const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const PRIORIDAD_ROLES = [
    'superadmin', 'pastor', 'secretaria', 'tesorero', 'oficial',
    'editor_contenido', 'lider', 'voluntario', 'miembro'
];

async function obtenerRolesVigentes(usuario) {
    const roles = new Set([usuario.rol].filter(Boolean));
    if (!usuario.persona_id || usuario.rol === 'superadmin') return [...roles];

    const { data: asignaciones, error: errorAsignaciones } = await supabase
        .from('persona_roles')
        .select('rol_id')
        .eq('persona_id', usuario.persona_id)
        .eq('activo', true);
    if (errorAsignaciones) throw errorAsignaciones;

    const ids = (asignaciones || []).map(item => item.rol_id);
    if (!ids.length) return [...roles];

    const { data: rolesActivos, error: errorRoles } = await supabase
        .from('roles')
        .select('codigo')
        .in('id', ids)
        .eq('activo', true);
    if (errorRoles) throw errorRoles;
    (rolesActivos || []).forEach(item => roles.add(item.codigo));
    return [...roles];
}

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN JWT
// ============================================================
const verificarToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.purpose) {
            return res.status(403).json({ error: 'Token no válido para acceder a la plataforma.' });
        }

        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('id, correo, rol, activo, persona_id, password_actualizado_en')
            .eq('id', decoded.id)
            .single();
        if (error) {
            console.error('Error verificando la sesión en Supabase:', error);
            return res.status(503).json({
                codigo: 'SESSION_CHECK_FAILED',
                error: 'No fue posible verificar la sesión. Intenta nuevamente.'
            });
        }
        if (!usuario || !usuario.activo) {
            return res.status(401).json({
                codigo: 'SESSION_REVOKED',
                error: 'Tu cuenta está desactivada. Contacta al administrador.'
            });
        }

        if (usuario.persona_id) {
            const { data: membresia, error: errorMembresia } = await supabase
                .from('miembros')
                .select('activo')
                .eq('persona_id', usuario.persona_id)
                .maybeSingle();
            if (errorMembresia) throw errorMembresia;
            if (membresia && !membresia.activo) {
                return res.status(401).json({
                    codigo: 'SESSION_REVOKED',
                    error: 'Tu cuenta está desactivada. Contacta al administrador.'
                });
            }
        }

        const passwordActualizadoEn = usuario.password_actualizado_en
            ? new Date(usuario.password_actualizado_en).getTime()
            : 0;
        const tokenEmitidoEn = Number(decoded.iat || 0) * 1000;
        if (passwordActualizadoEn && tokenEmitidoEn + 1000 < passwordActualizadoEn) {
            return res.status(401).json({
                codigo: 'SESSION_REVOKED',
                error: 'Tu contraseña fue restablecida. Ingresa con la clave temporal.'
            });
        }

        const roles = await obtenerRolesVigentes(usuario);
        const rolPrincipal = PRIORIDAD_ROLES.find(rol => roles.includes(rol)) || 'miembro';
        req.usuario = {
            id: usuario.id,
            correo: usuario.correo,
            rol: rolPrincipal,
            roles
        };
        next();
    } catch (err) {
        return res.status(401).json({
            codigo: 'SESSION_INVALID',
            error: 'Token inválido o expirado. Inicia sesión nuevamente.'
        });
    }
};

// ============================================================
// MIDDLEWARE DE ROLES
// Superadmin siempre tiene acceso total
// ============================================================
const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        // Superadmin tiene acceso a todo sin restricción
        const rolesUsuario = new Set([
            req.usuario.rol,
            ...(Array.isArray(req.usuario.roles) ? req.usuario.roles : [])
        ].filter(Boolean));

        if (rolesUsuario.has('superadmin')) {
            return next();
        }

        if (!rolesPermitidos.some(rol => rolesUsuario.has(rol))) {
            return res.status(403).json({
                error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`
            });
        }

        next();
    };
};

module.exports = { verificarToken, verificarRol };
