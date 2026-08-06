const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const supabase  = require('../supabase');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

const PRIORIDAD_ROLES = [
    'superadmin',
    'pastor',
    'secretaria',
    'tesorero',
    'oficial',
    'editor_contenido',
    'lider',
    'voluntario',
    'miembro'
];

router.get('/sesion', verificarToken, (req, res) => {
    res.json({ usuario: req.usuario });
});

async function enriquecerRolesUsuario(usuario) {
    if (usuario.rol === 'superadmin' || !usuario.persona_id) {
        return { ...usuario, roles: [usuario.rol] };
    }

    const { data: asignaciones, error: errorAsignaciones } = await supabase
        .from('persona_roles')
        .select('rol_id')
        .eq('persona_id', usuario.persona_id)
        .eq('activo', true);
    if (errorAsignaciones) throw errorAsignaciones;

    const ids = (asignaciones || []).map(item => item.rol_id);
    let roles = [];
    if (ids.length) {
        const { data, error } = await supabase
            .from('roles')
            .select('codigo')
            .in('id', ids)
            .eq('activo', true);
        if (error) throw error;
        roles = (data || []).map(item => item.codigo);
    }

    const rolesUnicos = [...new Set([...roles, usuario.rol || 'miembro'])];
    const rolPrincipal = PRIORIDAD_ROLES.find(rol => rolesUnicos.includes(rol)) || 'miembro';
    return { ...usuario, rol: rolPrincipal, roles: rolesUnicos };
}

function crearTokenSesion(usuario) {
    return jwt.sign(
        {
            id: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol,
            roles: usuario.roles
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
}

function datosPublicosUsuario(usuario) {
    return {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        roles: usuario.roles
    };
}

// ============================================================
// POST /api/auth/login
// Inicia sesión y devuelve un token JWT
// ============================================================
router.post('/login', async (req, res) => {
    try {
        if (process.env.ADMIN_ENABLED !== 'true') {
            return res.status(503).json({
                error: 'El acceso a la plataforma aún no está habilitado.'
            });
        }

        const { correo, password } = req.body;

        // Validar que vengan los datos
        if (!correo || !password) {
            return res.status(400).json({
                error: 'Correo y contraseña son requeridos'
            });
        }

        // Buscar usuario en Supabase
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('correo', correo)
            .eq('activo', true)
            .single();

        if (error || !usuario) {
            return res.status(401).json({
                error: 'Credenciales incorrectas'
            });
        }

        // Verificar contraseña
        const passwordValida = await bcrypt.compare(password, usuario.password_hash);
        if (!passwordValida) {
            return res.status(401).json({
                error: 'Credenciales incorrectas'
            });
        }

        const usuarioSesion = await enriquecerRolesUsuario(usuario);

        if (usuario.debe_cambiar_password) {
            const expiraEn = usuario.password_temporal_expira_en
                ? new Date(usuario.password_temporal_expira_en)
                : null;
            if (!expiraEn || Number.isNaN(expiraEn.getTime()) || expiraEn <= new Date()) {
                return res.status(403).json({
                    error: 'La contraseña temporal expiró. Solicita una nueva al administrador.'
                });
            }

            const tokenCambio = jwt.sign(
                {
                    id: usuario.id,
                    correo: usuario.correo,
                    purpose: 'password_change'
                },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            return res.json({
                requiereCambioPassword: true,
                tokenCambio,
                usuario: datosPublicosUsuario(usuarioSesion)
            });
        }

        // Generar token JWT
        const token = crearTokenSesion(usuarioSesion);

        // Registrar en auditoría
        await supabase.from('auditoria').insert({
            usuario_id: usuario.id,
            accion:     'LOGIN',
            tabla:      'usuarios',
            registro_id: usuario.id
        });

        res.json({
            token,
            usuario: datosPublicosUsuario(usuarioSesion)
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/auth/cambiar-password-inicial
// Acepta únicamente un token limitado de configuración inicial.
// ============================================================
router.post('/cambiar-password-inicial', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const tokenCambio = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;
        if (!tokenCambio) {
            return res.status(401).json({ error: 'Token de activación requerido' });
        }

        let credencial;
        try {
            credencial = jwt.verify(tokenCambio, process.env.JWT_SECRET);
        } catch {
            return res.status(403).json({ error: 'La activación expiró. Inicia sesión nuevamente.' });
        }

        if (credencial.purpose !== 'password_change') {
            return res.status(403).json({ error: 'Token no válido para cambiar contraseña' });
        }

        const { password, confirmar_password } = req.body;
        if (!password || password !== confirmar_password) {
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });
        }
        if (
            password.length < 10
            || !/[a-z]/.test(password)
            || !/[A-Z]/.test(password)
            || !/[0-9]/.test(password)
        ) {
            return res.status(400).json({
                error: 'Usa al menos 10 caracteres, una mayúscula, una minúscula y un número'
            });
        }

        const { data: usuario, error: errorUsuario } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', credencial.id)
            .eq('activo', true)
            .single();

        if (errorUsuario || !usuario || !usuario.debe_cambiar_password) {
            return res.status(403).json({ error: 'La credencial temporal ya fue utilizada o no es válida' });
        }
        if (
            !usuario.password_temporal_expira_en
            || new Date(usuario.password_temporal_expira_en) <= new Date()
        ) {
            return res.status(403).json({ error: 'La contraseña temporal expiró' });
        }
        if (await bcrypt.compare(password, usuario.password_hash)) {
            return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la temporal' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const { data: usuarioActualizado, error: errorActualizar } = await supabase
            .from('usuarios')
            .update({
                password_hash: passwordHash,
                debe_cambiar_password: false,
                password_temporal_expira_en: null,
                password_actualizado_en: new Date().toISOString()
            })
            .eq('id', usuario.id)
            .eq('debe_cambiar_password', true)
            .select('id')
            .maybeSingle();

        if (errorActualizar) throw errorActualizar;
        if (!usuarioActualizado) {
            return res.status(409).json({ error: 'La credencial temporal ya fue utilizada' });
        }

        await supabase.from('auditoria').insert({
            usuario_id: usuario.id,
            accion: 'CAMBIAR_PASSWORD_INICIAL',
            tabla: 'usuarios',
            registro_id: usuario.id
        });

        const usuarioSesion = await enriquecerRolesUsuario(usuario);
        const token = crearTokenSesion(usuarioSesion);
        res.json({
            mensaje: 'Contraseña creada correctamente',
            token,
            usuario: datosPublicosUsuario(usuarioSesion)
        });
    } catch (err) {
        console.error('Error cambiando contraseña inicial:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
