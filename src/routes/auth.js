const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const supabase  = require('../supabase');

const router = express.Router();

// ============================================================
// POST /api/auth/login
// Inicia sesión y devuelve un token JWT
// ============================================================
router.post('/login', async (req, res) => {
    try {
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

        // Generar token JWT
        const token = jwt.sign(
            {
                id:     usuario.id,
                correo: usuario.correo,
                rol:    usuario.rol
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Registrar en auditoría
        await supabase.from('auditoria').insert({
            usuario_id: usuario.id,
            accion:     'LOGIN',
            tabla:      'usuarios',
            registro_id: usuario.id
        });

        res.json({
            token,
            usuario: {
                id:     usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol:    usuario.rol
            }
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// POST /api/auth/crear-usuario
// Crea un nuevo usuario (solo admin)
// ============================================================
router.post('/crear-usuario', async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;

        if (!nombre || !correo || !password || !rol) {
            return res.status(400).json({
                error: 'Todos los campos son requeridos'
            });
        }

        // Encriptar contraseña
        const password_hash = await bcrypt.hash(password, 12);

        // Insertar en Supabase
        const { data, error } = await supabase
            .from('usuarios')
            .insert({ nombre, correo, password_hash, rol })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'El correo ya está registrado' });
            }
            throw error;
        }

        res.status(201).json({
            mensaje: 'Usuario creado correctamente',
            usuario: { id: data.id, nombre: data.nombre, correo: data.correo, rol: data.rol }
        });

    } catch (err) {
        console.error('Error creando usuario:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;