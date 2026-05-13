const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');

// Cargar variables de entorno
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

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
    console.log(`🔐 Rutas: /api/auth · /api/miembros · /api/finanzas · /api/servicios · /api/familias`);
});