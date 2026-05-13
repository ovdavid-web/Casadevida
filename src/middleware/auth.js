const jwt = require('jsonwebtoken');

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN JWT
// ============================================================
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario   = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado. Inicia sesión nuevamente.' });
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
        if (req.usuario.rol === 'superadmin') {
            return next();
        }

        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`
            });
        }

        next();
    };
};

module.exports = { verificarToken, verificarRol };