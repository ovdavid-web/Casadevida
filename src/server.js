const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');

// Cargar variables de entorno
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_ENABLED = process.env.ADMIN_ENABLED !== 'false';
const DONATIONS_ENABLED = process.env.DONATIONS_ENABLED === 'true';
const CONTACT_FORM_ENABLED = process.env.CONTACT_FORM_ENABLED === 'true';

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// RUTAS API
// ============================================================
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/miembros', require('./routes/miembros'));
app.use('/api/finanzas', require('./routes/finanzas'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/familias', require('./routes/familias'));
app.use('/api/egresos', require('./routes/egresos'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/cuentas-pagar', require('./routes/cuentas-pagar'));

// Configuración pública segura para habilitar módulos según el entorno.
app.get('/api/config', (req, res) => {
    res.json({
        adminEnabled: ADMIN_ENABLED,
        donationsEnabled: DONATIONS_ENABLED,
        contactFormEnabled: CONTACT_FORM_ENABLED
    });
});

// ============================================================
// RUTA DE SALUD
// ============================================================
app.get('/api/salud', (req, res) => {
    res.json({
        estado:  'ok',
        mensaje: 'Servidor Casa de Vida funcionando correctamente',
        fecha:   new Date().toLocaleDateString('es-CL'),
        version: '1.0.0'
    });
});

// ============================================================
// RUTA PRINCIPAL — Sirve el sitio web
// ============================================================
app.get('/*path', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📁 Sirviendo archivos desde /public`);
    console.log(`🔐 Rutas: /api/auth · /api/miembros · /api/finanzas · /api/servicios · /api/familias · /api/egresos · /api/eventos · /api/cuentas-pagar`);
});
