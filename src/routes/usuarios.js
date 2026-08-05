const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../supabase');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

function generarPasswordTemporal(longitud = 16) {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let indice = 0; indice < longitud; indice++) {
        password += alfabeto[crypto.randomInt(0, alfabeto.length)];
    }
    return password.match(/.{1,4}/g).join('-');
}

router.post('/crear-para-persona', verificarToken, verificarRol('superadmin'), async (req, res) => {
    try {
        const { persona_id, correo } = req.body;
        if (!persona_id || !correo?.trim()) {
            return res.status(400).json({ error: 'La persona y el correo son requeridos' });
        }

        const passwordTemporal = generarPasswordTemporal();
        const passwordHash = await bcrypt.hash(passwordTemporal, 12);
        const expiraEn = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase.rpc('crear_usuario_para_persona', {
            p_persona_id: persona_id,
            p_correo: correo.trim().toLowerCase(),
            p_password_hash: passwordHash,
            p_expira_en: expiraEn,
            p_actor_id: req.usuario.id
        });

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: error.message });
            }
            if (error.code === '22023') {
                return res.status(400).json({ error: error.message });
            }
            if (error.code === 'P0002') {
                return res.status(404).json({ error: error.message });
            }
            throw error;
        }

        const cuenta = Array.isArray(data) ? data[0] : data;
        res.status(201).json({
            mensaje: 'Cuenta creada correctamente',
            cuenta,
            password_temporal: passwordTemporal,
            advertencia: 'Esta contraseña se muestra una sola vez y expira en 72 horas.'
        });
    } catch (err) {
        console.error('Error creando cuenta para persona:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
