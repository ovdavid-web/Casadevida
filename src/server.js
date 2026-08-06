const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');

// Cargar siempre el archivo de esta instancia. En desarrollo local sus
// valores prevalecen sobre variables antiguas de Windows, salvo el puerto,
// que puede cambiarse para ejecutar pruebas aisladas.
const entornoLocal = dotenv.config({
    path: path.resolve(__dirname, '../.env')
}).parsed;
if (process.env.NODE_ENV !== 'production' && entornoLocal) {
    for (const [clave, valor] of Object.entries(entornoLocal)) {
        if (clave !== 'PORT') process.env[clave] = valor;
    }
}

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_ENABLED = process.env.ADMIN_ENABLED === 'true';
const DONATIONS_ENABLED = process.env.DONATIONS_ENABLED === 'true';
const CONTACT_FORM_ENABLED = process.env.CONTACT_FORM_ENABLED === 'true';
const ALLOWED_ORIGINS = new Set(
    String(process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
);

const intentosLogin = new Map();
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const MAX_INTENTOS_LOGIN = 8;

if (ADMIN_ENABLED && String(process.env.JWT_SECRET || '').length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres antes de habilitar el panel administrativo.');
}

// ============================================================
// MIDDLEWARES
// ============================================================
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(cors({
    origin(origin, callback) {
        if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
        return callback(null, false);
    }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth/login', (req, res, next) => {
    const ahora = Date.now();
    const clave = req.ip || req.socket.remoteAddress || 'desconocida';
    const estado = intentosLogin.get(clave);
    if (estado && ahora - estado.inicio < VENTANA_LOGIN_MS && estado.intentos >= MAX_INTENTOS_LOGIN) {
        return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' });
    }

    const registro = !estado || ahora - estado.inicio >= VENTANA_LOGIN_MS
        ? { inicio: ahora, intentos: 0 }
        : estado;
    intentosLogin.set(clave, registro);
    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            intentosLogin.delete(clave);
        } else if (res.statusCode === 401 || res.statusCode === 403) {
            registro.intentos += 1;
        }
    });
    next();
});

// ============================================================
// RUTAS API
// ============================================================
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/miembros', require('./routes/miembros'));
app.use('/api/personas', require('./routes/personas'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/finanzas', require('./routes/finanzas'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/familias', require('./routes/familias'));
app.use('/api/egresos', require('./routes/egresos'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/cuentas-pagar', require('./routes/cuentas-pagar'));
app.use('/api/secretaria', require('./routes/secretaria'));

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
    console.log(`🔐 Rutas: /api/auth · /api/miembros · /api/finanzas · /api/servicios · /api/familias · /api/egresos · /api/eventos · /api/cuentas-pagar · /api/secretaria`);
});
