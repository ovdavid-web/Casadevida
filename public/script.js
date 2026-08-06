document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // UTILIDADES
    // ============================================================
    const $ = id => document.getElementById(id);
    const show = el => el && el.classList.remove('hidden');
    const hide = el => el && el.classList.add('hidden');
    const sanitizar = valor => String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const getToken   = () => sessionStorage.getItem('cdv_token');
    const getUsuario = () => JSON.parse(sessionStorage.getItem('cdv_usuario') || '{}');

    const authHeaders = () => ({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getToken()}`
    });

    async function apiFetch(url, options = {}) {
        const res = await fetch(url, { headers: authHeaders(), ...options });
        const tipoContenido = res.headers.get('content-type') || '';
        if (!tipoContenido.includes('application/json')) {
            throw new Error(res.status === 404
                ? 'La función solicitada no está disponible. Reinicia el servidor e intenta nuevamente.'
                : 'El servidor entregó una respuesta no válida.');
        }
        const data = await res.json();
        if (res.status === 401) {
            sessionStorage.clear();
            hide(vistaDashboard);
            hide(vistaHome);
            hide(vistaCreemos);
            show(navPublica);
            show(vistaLogin);
            show(btnVolverHome);
            hide(btnIrLogin);
            toast(data.error || 'Tu cuenta está desactivada. Contacta al administrador.', 'error');
            throw new Error(data.error || 'Acceso denegado');
        }
        if (!res.ok) throw new Error(data.error || 'Error del servidor');
        return data;
    }

    const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // ============================================================
    // ELEMENTOS DEL DOM
    // ============================================================
    const vistaHome      = $('vista-home');
    const vistaLogin     = $('vista-login');
    const vistaCreemos   = $('vista-creemos');
    const vistaDashboard = $('vista-dashboard');
    const navPublica     = $('nav-publica');
    const btnIrLogin     = $('btn-ir-login');
    const btnVolverHome  = $('btn-volver-home');
    const btnVerCreencias = $('btn-ver-creencias');
    const btnVolverDesdeCreemos = $('btn-volver-desde-creemos');
    const btnIngresar    = $('btn-ingresar');
    const btnMenuPublico = $('btn-menu-publico');
    const navMenuPublico = $('nav-menu-publico');
    const btnCerrar      = $('btn-cerrar-sesion');
    const btnCerrarMovil = $('btn-cerrar-sesion-movil');
    const btnMenuMovil   = $('btn-menu-movil');
    const sidebar        = $('sidebar-dashboard');
    const sidebarBackdrop = $('sidebar-backdrop');
    const menuAdmin      = $('menu-admin');
    const menuMiembro    = $('menu-miembro');
    const nombreUsuario  = $('nombre-usuario-activo');
    const rolUsuario     = $('rol-usuario-activo');
    const userAvatar     = $('user-avatar-inicial');
    let adminPublicoHabilitado = true;

    // ============================================================
    // CONFIGURACIÓN PÚBLICA
    // ============================================================
    async function cargarConfiguracionPublica() {
        try {
            const res = await fetch('/api/config');
            if (!res.ok) throw new Error('No fue posible cargar la configuración');
            const config = await res.json();
            adminPublicoHabilitado = Boolean(config.adminEnabled);

            if (adminPublicoHabilitado) {
                show(btnIrLogin);
                show($('footer-acceso-plataforma'));
            } else {
                hide(btnIrLogin);
                hide($('footer-acceso-plataforma'));
            }

            if (config.donationsEnabled) {
                show($('nav-donaciones'));
                show($('seccion-donaciones'));
            } else {
                hide($('nav-donaciones'));
                hide($('seccion-donaciones'));
            }

            config.contactFormEnabled
                ? show($('form-contacto-publico'))
                : hide($('form-contacto-publico'));
        } catch (err) {
            // Ante un error se mantienen ocultos los módulos públicos provisionales.
            hide($('nav-donaciones'));
            hide($('seccion-donaciones'));
            hide($('form-contacto-publico'));
        }
    }

    cargarConfiguracionPublica();

    // ============================================================
    // NAV
    // ============================================================
    const cerrarMenuPublico = () => {
        navMenuPublico?.classList.remove('open');
        btnMenuPublico?.classList.remove('open');
        btnMenuPublico?.setAttribute('aria-expanded', 'false');
    };

    btnMenuPublico?.addEventListener('click', () => {
        const abierto = navMenuPublico?.classList.toggle('open');
        btnMenuPublico.classList.toggle('open', Boolean(abierto));
        btnMenuPublico.setAttribute('aria-expanded', String(Boolean(abierto)));
    });

    navMenuPublico?.querySelectorAll('a').forEach(enlace => {
        enlace.addEventListener('click', cerrarMenuPublico);
    });

    const heroPublico = document.querySelector('.hero');
    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const heroCreemos = document.querySelector('.creemos-hero');

    if (!movimientoReducido) {
        const capasParallax = [
            {
                seccion: heroPublico,
                elemento: heroPublico?.querySelector('.hero-visual'),
                propiedad: '--hero-fondo-y',
                velocidad: -0.10
            },
            {
                seccion: heroCreemos,
                elemento: heroCreemos,
                propiedad: '--creemos-fondo-y',
                velocidad: -0.10
            }
        ].filter(capa => capa.seccion && capa.elemento);

        const medirParallax = () => {
            capasParallax.forEach(capa => {
                const posicion = capa.seccion.getBoundingClientRect();
                if (posicion.bottom > 0 && posicion.top < window.innerHeight) {
                    const recorrido = `${Math.max(0, -posicion.top) * capa.velocidad}px`;
                    capa.elemento.style.setProperty(capa.propiedad, recorrido);
                }
            });
        };

        let parallaxPendiente = false;
        const solicitarParallax = () => {
            if (!parallaxPendiente) {
                parallaxPendiente = true;
                window.requestAnimationFrame(() => {
                    medirParallax();
                    parallaxPendiente = false;
                });
            }
        };

        window.addEventListener('scroll', solicitarParallax, { passive: true });
        window.addEventListener('resize', solicitarParallax, { passive: true });
        medirParallax();
    }

    btnIrLogin.addEventListener('click', () => {
        cerrarMenuPublico();
        show(vistaLogin); hide(vistaHome); hide(vistaCreemos);
        show(btnVolverHome); hide(btnIrLogin);
    });

    const volverAlHomePublico = (actualizarHistorial = true) => {
        cerrarMenuPublico();
        show(vistaHome);
        hide(vistaLogin);
        hide(vistaCreemos);
        hide(btnVolverHome);
        adminPublicoHabilitado ? show(btnIrLogin) : hide(btnIrLogin);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (actualizarHistorial && window.location.hash === '#creemos') {
            history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
        }
    };

    const abrirVistaCreemos = (actualizarHistorial = true) => {
        cerrarMenuPublico();
        hide(vistaHome);
        hide(vistaLogin);
        show(vistaCreemos);
        show(btnVolverHome);
        hide(btnIrLogin);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (actualizarHistorial && window.location.hash !== '#creemos') {
            history.pushState(null, '', '#creemos');
        }
    };

    btnVerCreencias?.addEventListener('click', () => abrirVistaCreemos());
    btnVolverDesdeCreemos?.addEventListener('click', () => volverAlHomePublico());
    btnVolverHome.addEventListener('click', () => volverAlHomePublico());

    window.irAlInicioPublico = () => volverAlHomePublico();

    window.addEventListener('popstate', () => {
        window.location.hash === '#creemos'
            ? abrirVistaCreemos(false)
            : volverAlHomePublico(false);
    });

    if (window.location.hash === '#creemos' && !getToken()) {
        abrirVistaCreemos(false);
    }

    // ============================================================
    // LOGIN
    // ============================================================
    let tokenCambioPasswordInicial = null;

    const esOficialConsulta = () => getUsuario().rol === 'oficial';
    const esTesorero = () => getUsuario().rol === 'tesorero';
    const esSecretaria = () => getUsuario().rol === 'secretaria';
    const puedeGestionarCuentas = () => ['superadmin', 'tesorero'].includes(getUsuario().rol);
    const tieneDirectorioLimitado = () => esOficialConsulta() || esTesorero();
    const puedeEditarDirectorio = () => !esOficialConsulta() && !esTesorero() && !esSecretaria();
    const puedeGestionarEventos = () => ['superadmin', 'pastor', 'secretaria'].includes(getUsuario().rol);

    // Cada herramienta vive visualmente en su módulo, aunque se conserva su
    // implementación original para no duplicar lógica ni alterar datos.
    $('secretaria-agenda-formulario')?.appendChild($('form-evento'));
    $('secretaria-agenda-listado')?.appendChild($('agenda-lista')?.closest('.agenda-card'));
    $('tesoreria-cuentas-contenido')?.appendChild($('panel-cuentas-pagar'));

    const configurarInterfazPorRol = usuario => {
        const esOficial = usuario.rol === 'oficial';
        const esPerfilTesorero = usuario.rol === 'tesorero';
        const esPerfilSecretaria = usuario.rol === 'secretaria';
        const vistasOficial = new Set([
            'vista-inicio-admin',
            'vista-miembros',
            'vista-mis-aportes'
        ]);
        const vistasTesorero = new Set([
            'vista-inicio-admin',
            'vista-miembros',
            'vista-mis-aportes',
            'vista-finanzas',
            'vista-egresos',
            'vista-cuentas-pagar',
            'vista-finanzas-reporte'
        ]);
        const vistasSecretaria = new Set([
            'vista-inicio-admin',
            'vista-miembros',
            'vista-secretaria'
        ]);

        document.querySelectorAll('#menu-admin .nav-btn').forEach(boton => {
            const visible = esPerfilSecretaria
                ? vistasSecretaria.has(boton.dataset.target)
                : esOficial
                    ? vistasOficial.has(boton.dataset.target)
                    : esPerfilTesorero
                        ? vistasTesorero.has(boton.dataset.target)
                        : true;
            boton.parentElement?.classList.toggle('hidden', !visible);
        });

        ['menu-separador-finanzas', 'menu-titulo-finanzas'].forEach(id => {
            $(id)?.classList.toggle('hidden', esOficial);
        });
        $('menu-oficial-aportes')?.classList.toggle('hidden', !esOficial && !esPerfilTesorero);

        $('btn-nuevo-evento')?.classList.toggle('hidden', !puedeGestionarEventos());
        $('btn-nueva-cuenta')?.classList.toggle('hidden', esOficial);
        ['resumen-cuentas-por-vencer', 'resumen-cuentas-vencidas', 'panel-cuentas-pagar'].forEach(id => {
            $(id)?.classList.toggle('hidden', esOficial || esPerfilSecretaria);
        });
        ['btn-nueva-persona', 'btn-nueva-familia'].forEach(id => {
            $(id)?.classList.toggle('hidden', esOficial || esPerfilTesorero || esPerfilSecretaria);
        });

        if (esOficial || esPerfilTesorero || esPerfilSecretaria) {
            hide($('form-evento'));
            hide($('form-nuevo-miembro'));
            hide($('form-nueva-familia'));
        }
        if (esOficial) hide($('form-cuenta-pagar'));

        const mesActual = String(
            new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getMonth() + 1
        ).padStart(2, '0');
        ['filtro-mes', 'dash-mes'].forEach(id => {
            const selector = $(id);
            const opcionTodos = selector?.querySelector('option[value=""]');
            if (opcionTodos) opcionTodos.hidden = esPerfilTesorero;
            if (esPerfilTesorero && selector && !selector.value) selector.value = mesActual;
        });
    };

    const sincronizarSesionViva = async () => {
        if (!getToken()) return;
        try {
            const { usuario } = await apiFetch('/api/auth/sesion');
            if (!usuario) return;
            const usuarioSincronizado = { ...getUsuario(), ...usuario };
            sessionStorage.setItem('cdv_usuario', JSON.stringify(usuarioSincronizado));
            rolUsuario.textContent = usuarioSincronizado.rol;
            configurarInterfazPorRol(usuarioSincronizado);
        } catch (err) {
            // apiFetch limpia y revoca automáticamente las sesiones inválidas.
        }
    };

    window.setInterval(sincronizarSesionViva, 15000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sincronizarSesionViva();
    });

    const abrirSesionEnInterfaz = data => {
        sessionStorage.setItem('cdv_token', data.token);
        sessionStorage.setItem('cdv_usuario', JSON.stringify(data.usuario));

        const u = data.usuario;
        hide(vistaLogin); hide(navPublica); show(vistaDashboard);
        nombreUsuario.textContent = u.nombre;
        rolUsuario.textContent = u.rol;
        userAvatar.textContent = u.nombre.charAt(0).toUpperCase();
        configurarInterfazPorRol(u);

        const esAdmin = ['superadmin', 'pastor', 'secretaria', 'tesorero', 'oficial'].includes(u.rol);
        if (esAdmin) { show(menuAdmin); hide(menuMiembro); cambiarVista('vista-inicio-admin'); }
        else         { hide(menuAdmin); show(menuMiembro); cambiarVista('vista-perfil-miembro'); }

        toast(`Bienvenido, ${u.nombre} 👋`, 'success');
    };

    btnIngresar.addEventListener('click', async () => {
        const correo   = document.querySelector('.lf-input[type="text"]').value.trim();
        const password = document.querySelector('.lf-input[type="password"]').value;

        if (!correo || !password) { toast('Ingresa tu correo y contraseña', 'error'); return; }

        try {
            btnIngresar.textContent = 'Ingresando...';
            btnIngresar.disabled    = true;

            const res  = await fetch('/api/auth/login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ correo, password })
            });
            const data = await res.json();

            if (!res.ok) { toast(data.error || 'Credenciales incorrectas', 'error'); return; }
            if (data.requiereCambioPassword) {
                tokenCambioPasswordInicial = data.tokenCambio;
                $('form-cambio-password-inicial').reset();
                $('modal-cambio-password-inicial').classList.remove('hidden');
                $('password-inicial-nueva').focus();
                return;
            }
            abrirSesionEnInterfaz(data);

        } catch (err) {
            toast('Error de conexión. Intenta nuevamente.', 'error');
        } finally {
            btnIngresar.textContent = 'Ingresar →';
            btnIngresar.disabled    = false;
        }
    });

    // ============================================================
    // CERRAR SESIÓN
    // ============================================================
    const cerrarMenuMovil = () => {
        sidebar?.classList.remove('open');
        sidebarBackdrop?.classList.remove('open');
        document.body.classList.remove('menu-movil-abierto');
        btnMenuMovil?.setAttribute('aria-expanded', 'false');
    };

    const cerrarSesion = () => {
        sessionStorage.clear();
        cerrarMenuMovil();
        hide(vistaDashboard); hide(vistaCreemos); show(navPublica); show(vistaHome);
        adminPublicoHabilitado ? show(btnIrLogin) : hide(btnIrLogin);
        hide(btnVolverHome);
    };

    btnCerrar.addEventListener('click', cerrarSesion);
    btnCerrarMovil?.addEventListener('click', cerrarSesion);
    btnMenuMovil?.addEventListener('click', () => {
        const abrir = !sidebar?.classList.contains('open');
        sidebar?.classList.toggle('open', abrir);
        sidebarBackdrop?.classList.toggle('open', abrir);
        document.body.classList.toggle('menu-movil-abierto', abrir);
        btnMenuMovil.setAttribute('aria-expanded', String(abrir));
    });
    sidebarBackdrop?.addEventListener('click', cerrarMenuMovil);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            cerrarMenuMovil();
            if (!$('modal-suspender-evento')?.classList.contains('hidden')) {
                window.cerrarModalSuspensionEvento?.();
            }
        }
    });

    $('form-cambio-password-inicial')?.addEventListener('submit', async evento => {
        evento.preventDefault();
        const password = $('password-inicial-nueva').value;
        const confirmarPassword = $('password-inicial-confirmar').value;
        const boton = $('btn-cambiar-password-inicial');
        if (!tokenCambioPasswordInicial) {
            toast('La activación ya no es válida. Inicia sesión nuevamente.', 'error');
            return;
        }

        try {
            boton.disabled = true;
            boton.textContent = 'Guardando...';
            const respuesta = await fetch('/api/auth/cambiar-password-inicial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenCambioPasswordInicial}`
                },
                body: JSON.stringify({
                    password,
                    confirmar_password: confirmarPassword
                })
            });
            const data = await respuesta.json();
            if (!respuesta.ok) throw new Error(data.error || 'No fue posible crear la contraseña');

            tokenCambioPasswordInicial = null;
            $('form-cambio-password-inicial').reset();
            $('modal-cambio-password-inicial').classList.add('hidden');
            abrirSesionEnInterfaz(data);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = 'Crear contraseña e ingresar';
        }
    });

    // ============================================================
    // ROUTER
    // ============================================================
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            cambiarVista(btn.getAttribute('data-target'));
            cerrarMenuMovil();
        });
    });

    function cambiarVista(id) {
        const vistasPermitidas = esOficialConsulta()
            ? ['vista-inicio-admin', 'vista-miembros', 'vista-mis-aportes']
            : esSecretaria()
                ? ['vista-inicio-admin', 'vista-miembros', 'vista-secretaria']
            : esTesorero()
                ? ['vista-inicio-admin', 'vista-miembros', 'vista-mis-aportes', 'vista-finanzas', 'vista-egresos', 'vista-cuentas-pagar', 'vista-finanzas-reporte']
                : null;
        if (vistasPermitidas && !vistasPermitidas.includes(id)) {
            id = 'vista-inicio-admin';
        }
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const t = $(id); if (t) t.classList.remove('hidden');
        const b = document.querySelector(`.nav-btn[data-target="${id}"]`);
        if (b) b.classList.add('active');

        if (id === 'vista-miembros')         cargarMiembros();
        if (id === 'vista-finanzas')         cargarFinanzas();
        if (id === 'vista-finanzas-reporte') cargarReporte();
        if (id === 'vista-egresos')          cargarEgresos();
        if (id === 'vista-cuentas-pagar')    cargarAgenda();
        if (id === 'vista-inicio-admin')      cargarAgenda();
        if (id === 'vista-secretaria')        cargarSecretaria();
        if (id === 'vista-perfil-miembro')    cargarMiPerfil();
        if (id === 'vista-mis-aportes')        cargarMisAportes();
    }

    let secretariaActas = [];
    let secretariaAcuerdos = [];
    let secretariaPersonas = [];

    async function cargarSecretaria() {
        try {
            const [actasData, acuerdosData, personasData] = await Promise.all([
                apiFetch('/api/secretaria/actas'),
                apiFetch('/api/secretaria/acuerdos'),
                apiFetch('/api/personas')
            ]);
            secretariaActas = actasData.actas || [];
            secretariaAcuerdos = acuerdosData.acuerdos || [];
            secretariaPersonas = personasData.personas || [];
            renderActasSecretaria();
            renderAcuerdosSecretaria();
            llenarSelectoresSecretaria();
        } catch (err) {
            ['secretaria-lista-actas', 'secretaria-lista-acuerdos'].forEach(id => {
                if ($(id)) $(id).innerHTML = `<div class="secretaria-estado error">${sanitizar(err.message)}</div>`;
            });
        }
    }

    window.cambiarSeccionSecretaria = (seccion, boton) => {
        document.querySelectorAll('.secretaria-seccion').forEach(item => item.classList.add('hidden'));
        $(`secretaria-seccion-${seccion}`)?.classList.remove('hidden');
        document.querySelectorAll('.secretaria-tabs button').forEach(item => item.classList.remove('activo'));
        boton?.classList.add('activo');
        if (seccion === 'agenda') cargarAgenda();
        if (seccion === 'estructura') cargarEstructuraSecretaria();
    };

    const fechaSecretaria = valor => valor
        ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${valor}T00:00:00Z`))
        : 'Sin fecha';

    function renderActasSecretaria() {
        const contenedor = $('secretaria-lista-actas');
        if (!contenedor) return;
        if (!secretariaActas.length) {
            contenedor.innerHTML = '<div class="secretaria-estado"><strong>Aún no hay actas registradas.</strong><p>Las actas quedarán ordenadas por fecha y conservarán su historial.</p></div>';
            return;
        }
        contenedor.innerHTML = secretariaActas.map(acta => `
            <article class="secretaria-registro">
                <div class="secretaria-registro-numero">ACTA<br><strong>${String(acta.numero).padStart(3, '0')}</strong></div>
                <div class="secretaria-registro-cuerpo"><div><h4>${sanitizar(acta.titulo)}</h4><p>${fechaSecretaria(acta.fecha)}${acta.lugar ? ` · ${sanitizar(acta.lugar)}` : ''}</p></div>${acta.objetivo ? `<p class="secretaria-registro-resumen">${sanitizar(acta.objetivo)}</p>` : ''}</div>
                <span class="secretaria-estado-badge ${acta.estado}">${sanitizar(acta.estado)}</span>
            </article>`).join('');
    }

    function renderAcuerdosSecretaria() {
        const contenedor = $('secretaria-lista-acuerdos');
        if (!contenedor) return;
        if (!secretariaAcuerdos.length) {
            contenedor.innerHTML = '<div class="secretaria-estado"><strong>Aún no hay acuerdos registrados.</strong><p>Podrás vincular cada acuerdo con su acta y responsable.</p></div>';
            return;
        }
        contenedor.innerHTML = secretariaAcuerdos.map(acuerdo => {
            const persona = Array.isArray(acuerdo.personas) ? acuerdo.personas[0] : acuerdo.personas;
            const responsable = [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ') || 'Sin responsable';
            const acta = Array.isArray(acuerdo.actas) ? acuerdo.actas[0] : acuerdo.actas;
            return `<article class="secretaria-registro acuerdo">
                <div class="secretaria-registro-cuerpo"><h4>${sanitizar(acuerdo.descripcion)}</h4><p>${sanitizar(responsable)}${acta ? ` · Acta ${String(acta.numero).padStart(3, '0')}` : ''}${acuerdo.fecha_compromiso ? ` · ${fechaSecretaria(acuerdo.fecha_compromiso)}` : ''}</p></div>
                <select aria-label="Estado del acuerdo" onchange="actualizarEstadoAcuerdo('${acuerdo.id}', this.value)"><option value="pendiente" ${acuerdo.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="en_proceso" ${acuerdo.estado === 'en_proceso' ? 'selected' : ''}>En proceso</option><option value="cumplido" ${acuerdo.estado === 'cumplido' ? 'selected' : ''}>Cumplido</option><option value="cancelado" ${acuerdo.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option></select>
            </article>`;
        }).join('');
    }

    function llenarSelectoresSecretaria() {
        const selectActa = $('acuerdo-acta');
        const selectPersona = $('acuerdo-responsable');
        const selectParticipantes = $('acta-participantes');
        if (selectActa) selectActa.innerHTML = '<option value="">Sin acta relacionada</option>' + secretariaActas.map(acta => `<option value="${acta.id}">Acta ${String(acta.numero).padStart(3, '0')} · ${sanitizar(acta.titulo)}</option>`).join('');
        if (selectPersona) selectPersona.innerHTML = '<option value="">Sin responsable asignado</option>' + secretariaPersonas.filter(persona => persona.estado === 'activo').map(persona => `<option value="${persona.id}">${sanitizar(persona.nombre)}</option>`).join('');
        if (selectParticipantes) selectParticipantes.innerHTML = secretariaPersonas.filter(persona => persona.estado === 'activo').map(persona => `<option value="${persona.id}">${sanitizar(persona.nombre)}</option>`).join('');
    }

    window.guardarActa = async event => {
        event.preventDefault();
        try {
            const participantes = [...$('acta-participantes').selectedOptions].map(opcion => opcion.value);
            const data = await apiFetch('/api/secretaria/actas', { method: 'POST', body: JSON.stringify({ titulo: $('acta-titulo').value, tipo: $('acta-tipo').value, fecha: $('acta-fecha').value, lugar: $('acta-lugar').value, objetivo: $('acta-objetivo').value, desarrollo: $('acta-desarrollo').value, participantes, estado: 'borrador' }) });
            toast(data.mensaje, 'success');
            event.target.reset();
            event.target.classList.add('hidden');
            await cargarSecretaria();
        } catch (err) { toast(err.message, 'error'); }
    };

    window.abrirFormularioAcuerdo = () => {
        llenarSelectoresSecretaria();
        $('form-nuevo-acuerdo')?.classList.remove('hidden');
    };

    window.guardarAcuerdo = async event => {
        event.preventDefault();
        try {
            const data = await apiFetch('/api/secretaria/acuerdos', { method: 'POST', body: JSON.stringify({ descripcion: $('acuerdo-descripcion').value, acta_id: $('acuerdo-acta').value || null, responsable_persona_id: $('acuerdo-responsable').value || null, fecha_compromiso: $('acuerdo-fecha').value || null, estado: $('acuerdo-estado').value }) });
            toast(data.mensaje, 'success');
            event.target.reset();
            event.target.classList.add('hidden');
            await cargarSecretaria();
        } catch (err) { toast(err.message, 'error'); }
    };

    window.actualizarEstadoAcuerdo = async (id, estado) => {
        const acuerdo = secretariaAcuerdos.find(item => item.id === id);
        if (!acuerdo) return;
        try {
            const data = await apiFetch(`/api/secretaria/acuerdos/${id}`, { method: 'PUT', body: JSON.stringify({ descripcion: acuerdo.descripcion, responsable_persona_id: acuerdo.responsable_persona_id, fecha_compromiso: acuerdo.fecha_compromiso, observaciones: acuerdo.observaciones, estado }) });
            toast(data.mensaje, 'success');
            await cargarSecretaria();
        } catch (err) { toast(err.message, 'error'); await cargarSecretaria(); }
    };

    async function cargarEstructuraSecretaria() {
        const contenedor = $('secretaria-estructura-contenido');
        if (!contenedor) return;
        contenedor.className = 'secretaria-estado';
        contenedor.textContent = 'Cargando estructura…';

        try {
            const { departamentos = [], responsables = [] } = await apiFetch('/api/secretaria/estructura');
            const vigentes = departamentos.filter(item => item.activo);
            if (!vigentes.length) {
                contenedor.innerHTML = '<strong>Aún no hay áreas registradas.</strong><p>La estructura se construirá vinculando áreas y responsables del directorio, conservando sus períodos históricos.</p>';
                return;
            }

            const responsablesPorArea = responsables.reduce((indice, item) => {
                if (item.estado !== 'activo') return indice;
                (indice[item.departamento_id] ||= []).push(item);
                return indice;
            }, {});
            const hijosPorPadre = vigentes.reduce((indice, area) => {
                const padre = area.departamento_padre_id || 'raiz';
                (indice[padre] ||= []).push(area);
                return indice;
            }, {});
            const textoSeguro = valor => String(valor || '').replace(/[&<>"']/g, caracter => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            })[caracter]);
            const renderArea = area => {
                const encargados = (responsablesPorArea[area.id] || []).map(item => {
                    const persona = Array.isArray(item.personas) ? item.personas[0] : item.personas;
                    const nombre = [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ') || 'Responsable sin persona vinculada';
                    return `<span>${textoSeguro(item.cargo || 'Responsable')}: <strong>${textoSeguro(nombre)}</strong></span>`;
                }).join('');
                const hijos = (hijosPorPadre[area.id] || []).map(renderArea).join('');
                return `<article class="estructura-area"><div><small>${textoSeguro(area.tipo || 'ministerio')}</small><h4>${textoSeguro(area.nombre)}</h4>${area.descripcion ? `<p>${textoSeguro(area.descripcion)}</p>` : ''}<div class="estructura-responsables">${encargados || '<span>Sin responsable vigente</span>'}</div></div>${hijos ? `<div class="estructura-hijos">${hijos}</div>` : ''}</article>`;
            };
            contenedor.className = 'estructura-arbol';
            contenedor.innerHTML = (hijosPorPadre.raiz || []).map(renderArea).join('');
        } catch (err) {
            contenedor.className = 'secretaria-estado error';
            contenedor.textContent = err.message;
        }
    }

    async function cargarMiPerfil() {
        const formatearFechaPerfil = valor => {
            if (!valor) return '—';
            const [anio, mes, dia] = valor.split('-').map(Number);
            return new Intl.DateTimeFormat('es-CL', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            }).format(new Date(anio, mes - 1, dia));
        };

        try {
            const { perfil } = await apiFetch('/api/personas/mi-perfil');
            const palabras = perfil.nombre.trim().split(/\s+/).filter(Boolean);
            const iniciales = palabras.length > 1
                ? `${palabras[0][0]}${palabras[1][0]}`.toUpperCase()
                : palabras[0]?.slice(0, 2).toUpperCase() || '—';
            const activo = perfil.miembro?.activo !== false && perfil.estado !== 'inactivo';

            $('mi-perfil-avatar').textContent = iniciales;
            $('mi-perfil-nombre').textContent = perfil.nombre || 'Sin nombre';
            $('mi-perfil-correo').textContent = perfil.correo || '—';
            $('mi-perfil-telefono').textContent = perfil.telefono || '—';
            $('mi-perfil-familia').textContent = perfil.miembro?.familia?.nombre || 'Sin familia asignada';
            $('mi-perfil-roles').innerHTML = perfil.roles.length
                ? `<span class="mi-perfil-role-chips">${perfil.roles
                    .map(rol => `<span>${sanitizar(rol.nombre)}</span>`)
                    .join('')}</span>`
                : 'Sin roles asignados';
            $('mi-perfil-nacimiento').textContent = formatearFechaPerfil(perfil.fecha_nacimiento);
            $('mi-perfil-bautismo').textContent = formatearFechaPerfil(perfil.miembro?.fecha_bautismo);
            $('mi-perfil-estado').textContent = perfil.tipo_vinculo === 'miembro'
                ? `Miembro ${activo ? 'Activo' : 'Inactivo'}`
                : 'Invitado';
            $('mi-perfil-estado').classList.toggle('active', activo);
            $('mi-perfil-estado').classList.toggle('inactive', !activo);

            const actividades = perfil.actividades || [];
            $('mi-perfil-actividades').innerHTML = actividades.length
                ? actividades.map(evento => {
                    const fecha = new Date(evento.fecha_inicio);
                    const fechaTexto = new Intl.DateTimeFormat('es-CL', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).format(fecha);
                    return `
                        <article class="mi-actividad-item">
                            <div class="mi-actividad-fecha">
                                <span>${sanitizar(fechaTexto.split(',')[0])}</span>
                                <strong>${sanitizar(String(fecha.getDate()).padStart(2, '0'))}</strong>
                            </div>
                            <div>
                                <strong>${sanitizar(evento.titulo)}</strong>
                                <span>${sanitizar(fechaTexto)}${evento.ubicacion ? ` · ${sanitizar(evento.ubicacion)}` : ''}</span>
                            </div>
                        </article>`;
                }).join('')
                : '<p class="mi-panel-vacio">No tienes actividades próximas por ahora.</p>';
        } catch (err) {
            $('mi-perfil-nombre').textContent = 'Perfil no disponible';
            toast(err.message || 'No fue posible cargar tu perfil', 'error');
        }
    }

    async function cargarMisAportes() {
        const moneda = valor => `$${Number(valor || 0).toLocaleString('es-CL')}`;
        const fecha = valor => {
            if (!valor) return '—';
            const [anio, mes, dia] = valor.split('-').map(Number);
            return new Intl.DateTimeFormat('es-CL', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            }).format(new Date(anio, mes - 1, dia));
        };

        try {
            const data = await apiFetch('/api/finanzas/mi-resumen');
            const nombreMes = data.periodo.nombre.charAt(0).toUpperCase() + data.periodo.nombre.slice(1);
            $('aporte-personal-periodo').textContent = data.aporte?.es_mes_actual
                ? `APORTE DE ${nombreMes.toUpperCase()}`
                : 'ÚLTIMO APORTE REGISTRADO';
            $('aporte-personal-monto').textContent = data.aporte ? moneda(data.aporte.monto) : 'Sin registro';
            $('aporte-personal-tipo').textContent = data.aporte?.tipo || 'No hay aportes asociados';
            $('aporte-personal-fecha').textContent = data.aporte
                ? `Fecha: ${fecha(data.aporte.fecha)}`
                : 'Cuando exista un aporte asociado, aparecerá aquí.';

            $('transparencia-periodo').textContent = `${nombreMes} ${data.periodo.anio}`;
            $('transparencia-total-ingresos').textContent = moneda(data.transparencia.total_ingresos);
            $('transparencia-total-egresos').textContent = moneda(data.transparencia.total_egresos);

            const categorias = Object.entries(data.transparencia.egresos_por_categoria || {})
                .sort(([, montoA], [, montoB]) => montoB - montoA);
            $('transparencia-categorias').innerHTML = categorias.length
                ? categorias.map(([categoria, monto]) => `
                    <div class="transparencia-fila">
                        <span>${sanitizar(categoria)}</span>
                        <strong>${moneda(monto)}</strong>
                    </div>`).join('')
                : '<p class="mi-panel-vacio">No hay egresos registrados durante este mes.</p>';
        } catch (err) {
            $('aporte-personal-tipo').textContent = 'Información no disponible';
            $('transparencia-categorias').innerHTML =
                `<p class="mi-panel-vacio">${sanitizar(err.message || 'No fue posible cargar el resumen')}</p>`;
            toast(err.message || 'No fue posible cargar los aportes', 'error');
        }
    }

    // ============================================================
    // PANEL GENERAL — AGENDA
    // ============================================================
    let eventosAgenda = [];
    let cuentasPorPagar = [];
    let miniaturaPreviewLocal = null;
    let eventoPendienteSuspension = null;
    let cuentaPendientePago = null;
    let cuentaPendienteFinalizar = null;

    const mostrarPreviewMiniatura = url => {
        const imagen = $('evento-miniatura-preview');
        const placeholder = $('evento-miniatura-placeholder');
        if (url) {
            imagen.src = url;
            show(imagen);
            hide(placeholder);
        } else {
            imagen.removeAttribute('src');
            hide(imagen);
            show(placeholder);
        }
    };

    $('evento-miniatura')?.addEventListener('change', event => {
        const archivo = event.target.files?.[0];
        if (!archivo) return;
        const tiposValidos = ['image/jpeg', 'image/png', 'image/webp'];
        if (!tiposValidos.includes(archivo.type) || archivo.size > 307200) {
            event.target.value = '';
            toast('La miniatura debe ser JPG, PNG o WebP y pesar máximo 300 KB', 'error');
            return;
        }
        if (miniaturaPreviewLocal) URL.revokeObjectURL(miniaturaPreviewLocal);
        miniaturaPreviewLocal = URL.createObjectURL(archivo);
        mostrarPreviewMiniatura(miniaturaPreviewLocal);
    });

    async function subirMiniaturaEvento(id, archivo) {
        const respuesta = await fetch(`/api/eventos/${id}/miniatura`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': archivo.type
            },
            body: archivo
        });
        const data = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) throw new Error(data.error || 'No fue posible guardar la miniatura');
        return data;
    }

    const dosDigitos = numero => String(numero).padStart(2, '0');

    const asignarFechaHoraEvento = (prefijo, valor) => {
        const fecha = valor ? new Date(valor) : null;
        $(`evento-fecha-${prefijo}`).value = fecha
            ? `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
            : '';
        $(`evento-hora-${prefijo}`).value = fecha ? dosDigitos(fecha.getHours()) : (prefijo === 'inicio' ? '12' : '13');
        $(`evento-minuto-${prefijo}`).value = fecha ? dosDigitos(fecha.getMinutes()) : '00';
    };

    const obtenerFechaHoraEvento = prefijo => {
        const fecha = $(`evento-fecha-${prefijo}`)?.value;
        if (!fecha) return null;
        const hora = Math.min(23, Math.max(0, Number($(`evento-hora-${prefijo}`).value) || 0));
        const minuto = Math.min(59, Math.max(0, Number($(`evento-minuto-${prefijo}`).value) || 0));
        return new Date(`${fecha}T${dosDigitos(hora)}:${dosDigitos(minuto)}:00`);
    };

    window.normalizarTiempoEvento = prefijo => {
        const hora = $(`evento-hora-${prefijo}`);
        const minuto = $(`evento-minuto-${prefijo}`);
        hora.value = dosDigitos(Math.min(23, Math.max(0, Number(hora.value) || 0)));
        minuto.value = dosDigitos(Math.min(59, Math.max(0, Number(minuto.value) || 0)));
        if (prefijo === 'inicio') sincronizarTerminoEvento();
    };

    window.ajustarTiempoEvento = (prefijo, unidad, cantidad) => {
        const hora = $(`evento-hora-${prefijo}`);
        const minuto = $(`evento-minuto-${prefijo}`);
        let total = (Number(hora.value) || 0) * 60 + (Number(minuto.value) || 0);
        total += unidad === 'hora' ? cantidad * 60 : cantidad;
        total = ((total % 1440) + 1440) % 1440;
        hora.value = dosDigitos(Math.floor(total / 60));
        minuto.value = dosDigitos(total % 60);
        if (prefijo === 'inicio') sincronizarTerminoEvento();
    };

    const sincronizarTerminoEvento = () => {
        const inicio = obtenerFechaHoraEvento('inicio');
        const fechaInicio = $('evento-fecha-inicio');
        const fechaTermino = $('evento-fecha-fin');
        if (!inicio || !fechaTermino) return;

        fechaTermino.min = fechaInicio.value;
        const termino = obtenerFechaHoraEvento('fin');
        if (!termino || termino <= inicio) {
            asignarFechaHoraEvento('fin', new Date(inicio.getTime() + 60 * 60 * 1000));
        }
    };

    $('evento-fecha-inicio')?.addEventListener('change', sincronizarTerminoEvento);

    const fechaEvento = valor => new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago', weekday: 'short', day: '2-digit',
        month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(valor));

    const esEventoProximo = (evento, ahora = new Date()) => {
        const referenciaFin = evento.fecha_fin
            ? new Date(evento.fecha_fin)
            : new Date(new Date(evento.fecha_inicio).getTime() + 24 * 60 * 60 * 1000);
        return referenciaFin >= ahora && !['suspendido', 'realizado'].includes(evento.estado);
    };

    const renderizarAgendaInformativa = () => {
        const lista = $('panel-agenda-lista');
        if (!lista) return;
        const proximos = eventosAgenda
            .filter(evento => esEventoProximo(evento))
            .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
            .slice(0, 5);
        if (!proximos.length) {
            lista.innerHTML = '<p class="agenda-vacia">No hay próximas actividades registradas.</p>';
            return;
        }
        lista.innerHTML = proximos.map(evento => {
            const fecha = new Date(evento.fecha_inicio);
            const dia = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit' }).format(fecha);
            const mes = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', month: 'short' }).format(fecha).replace('.', '').toUpperCase();
            return `<article class="agenda-evento panel-agenda-evento"><div class="agenda-fecha"><span>${mes}</span><strong>${dia}</strong></div><div class="agenda-evento-info"><h4>${sanitizar(evento.titulo)}</h4><p>${sanitizar(fechaEvento(evento.fecha_inicio))}${evento.ubicacion ? ` · ${sanitizar(evento.ubicacion)}` : ''}</p><span>${sanitizar(evento.tipo)}</span></div></article>`;
        }).join('');
    };

    async function cargarAgenda() {
        const lista = $('agenda-lista');
        if (!lista) return;
        lista.innerHTML = '<p class="agenda-vacia">Cargando agenda...</p>';

        const [resultadoEventos, resultadoCuentas] = await Promise.allSettled([
            apiFetch('/api/eventos'),
            ['superadmin', 'pastor', 'tesorero'].includes(getUsuario().rol)
                ? apiFetch('/api/cuentas-pagar')
                : Promise.resolve({ cuentas: [] })
        ]);

        if (resultadoEventos.status === 'fulfilled') {
            eventosAgenda = resultadoEventos.value.eventos || [];
            $('panel-actividades-futuras').textContent = eventosAgenda.filter(evento => esEventoProximo(evento)).length;
            window.renderizarAgenda();
            renderizarAgendaInformativa();
        } else {
            $('panel-actividades-futuras').textContent = '—';
            lista.innerHTML = `<p class="agenda-vacia">${sanitizar(resultadoEventos.reason.message)}</p>`;
            if ($('panel-agenda-lista')) $('panel-agenda-lista').innerHTML = `<p class="agenda-vacia">${sanitizar(resultadoEventos.reason.message)}</p>`;
            toast('No fue posible cargar la agenda', 'error');
        }

        if (resultadoCuentas.status === 'fulfilled') {
            cuentasPorPagar = resultadoCuentas.value.cuentas || [];
            renderizarCuentasPorPagar();
        } else {
            cuentasPorPagar = [];
            $('panel-cuentas-por-vencer').textContent = '—';
            $('panel-cuentas-vencidas').textContent = '—';
            if ($('cuentas-pagar-lista')) $('cuentas-pagar-lista').innerHTML = '<p class="agenda-vacia">No fue posible cargar las cuentas por pagar.</p>';
        }
    }

    const hoyChileTexto = () => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

    const diasHastaVencimiento = fecha => {
        const hoy = new Date(`${hoyChileTexto()}T12:00:00`);
        const vencimiento = new Date(`${fecha}T12:00:00`);
        return Math.round((vencimiento - hoy) / (24 * 60 * 60 * 1000));
    };

    const renderizarCuentasPorPagar = () => {
        const pendientes = cuentasPorPagar.filter(cuenta => cuenta.estado === 'pendiente');
        const pagosSinEgreso = cuentasPorPagar.filter(cuenta =>
            cuenta.estado === 'pagada' && !cuenta.egreso_id
        );
        const cuentasAccionables = [...pagosSinEgreso, ...pendientes];
        const vencidas = pendientes.filter(cuenta => diasHastaVencimiento(cuenta.fecha_vencimiento) < 0);
        const porVencer = pendientes.filter(cuenta => {
            const dias = diasHastaVencimiento(cuenta.fecha_vencimiento);
            return dias >= 0 && dias <= 7;
        });

        $('panel-cuentas-por-vencer').textContent = porVencer.length;
        $('panel-cuentas-vencidas').textContent = vencidas.length;
        $('cuentas-pagar-contador').textContent = pagosSinEgreso.length
            ? `${pagosSinEgreso.length} ${pagosSinEgreso.length === 1 ? 'pago requiere egreso' : 'pagos requieren egreso'}`
            : pendientes.length
                ? `${pendientes.length} ${pendientes.length === 1 ? 'cuenta pendiente' : 'cuentas pendientes'}`
                : 'Sin cuentas pendientes';

        const lista = $('cuentas-pagar-lista');
        if (!cuentasAccionables.length) {
            lista.innerHTML = '<p class="agenda-vacia">No hay cuentas pendientes.</p>';
            return;
        }

        lista.innerHTML = cuentasAccionables.slice(0, 6).map(cuenta => {
            const requiereEgreso = cuenta.estado === 'pagada' && !cuenta.egreso_id;
            const dias = diasHastaVencimiento(cuenta.fecha_vencimiento);
            const clase = requiereEgreso ? 'proxima' : (dias < 0 ? 'vencida' : (dias <= 7 ? 'proxima' : ''));
            const estadoFecha = requiereEgreso
                ? 'Pago sin egreso asociado'
                : dias < 0
                    ? `Vencida hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
                    : dias === 0
                        ? 'Vence hoy'
                        : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
            const montoReferencia = cuenta.moneda === 'USD' ? cuenta.monto_moneda_origen : cuenta.monto;
            const monto = montoReferencia
                ? ` · ${cuenta.moneda === 'USD' ? 'USD ' : '$'}${Number(montoReferencia).toLocaleString('es-CL')}`
                : '';
            const diasRevision = cuenta.fecha_revision ? diasHastaVencimiento(cuenta.fecha_revision) : null;
            const requiereRevision = diasRevision !== null && diasRevision <= Number(cuenta.aviso_revision_dias || 30);

            return `
                <article class="cuenta-pagar-item">
                    <div class="cuenta-pagar-info">
                        <strong>${sanitizar(cuenta.nombre)}</strong>
                        <span>${sanitizar(cuenta.categoria)}${cuenta.proveedor ? ` · ${sanitizar(cuenta.proveedor)}` : ''}${monto}</span>
                        ${requiereRevision ? `<span class="cuenta-revision-alerta">Revisar ${sanitizar(cuenta.nota_revision || 'condiciones del servicio')} · ${cuenta.fecha_revision.split('-').reverse().join('/')}</span>` : ''}
                    </div>
                    <div class="cuenta-pagar-vence ${clase}">
                        <strong>${cuenta.fecha_vencimiento.split('-').reverse().join('/')}</strong>
                        <span>${estadoFecha}</span>
                    </div>
                    ${puedeGestionarCuentas() ? `
                        <div class="cuenta-pagar-acciones">
                            <button type="button" class="btn-table" onclick="abrirModalConfirmarPago('${cuenta.id}')">${requiereEgreso ? 'Registrar egreso' : 'Marcar pagada'}</button>
                            <button type="button" class="btn-table" onclick="editarCuentaPagar('${cuenta.id}')">Editar</button>
                            <button type="button" class="btn-table cuenta-finalizar" onclick="abrirModalFinalizarCuenta('${cuenta.id}')">Finalizar</button>
                        </div>
                    ` : ''}
                </article>`;
        }).join('');
    };

    window.toggleFormCuentaPagar = (abrir) => {
        const formulario = $('form-cuenta-pagar');
        const debeAbrir = typeof abrir === 'boolean'
            ? abrir
            : formulario.classList.contains('hidden');
        formulario.classList.toggle('hidden', !debeAbrir);
        if (debeAbrir) {
            if (!$('cuenta-pagar-vencimiento').value) {
                $('cuenta-pagar-vencimiento').value = hoyChileTexto();
            }
            $('cuenta-pagar-nombre').focus();
        }
    };

    window.abrirNuevaCuentaPagar = () => {
        $('form-cuenta-pagar').reset();
        $('cuenta-pagar-id').value = '';
        $('btn-guardar-cuenta-pagar').textContent = 'Guardar cuenta';
        window.actualizarMonedaCuenta();
        window.toggleFormCuentaPagar(true);
    };

    window.cerrarFormularioCuentaPagar = () => {
        $('form-cuenta-pagar').reset();
        $('cuenta-pagar-id').value = '';
        $('btn-guardar-cuenta-pagar').textContent = 'Guardar cuenta';
        window.toggleFormCuentaPagar(false);
    };

    window.editarCuentaPagar = id => {
        const cuenta = cuentasPorPagar.find(item => item.id === id);
        if (!cuenta || cuenta.estado !== 'pendiente') return;
        $('cuenta-pagar-id').value = cuenta.id;
        $('cuenta-pagar-nombre').value = cuenta.nombre || '';
        $('cuenta-pagar-proveedor').value = cuenta.proveedor || '';
        $('cuenta-pagar-categoria').value = cuenta.categoria;
        $('cuenta-pagar-moneda').value = cuenta.moneda || 'CLP';
        $('cuenta-pagar-monto').value = cuenta.moneda === 'USD' ? (cuenta.monto_moneda_origen || '') : (cuenta.monto || '');
        $('cuenta-pagar-vencimiento').value = cuenta.fecha_vencimiento;
        $('cuenta-pagar-frecuencia').value = cuenta.frecuencia;
        $('cuenta-pagar-inicio').value = cuenta.fecha_inicio_servicio || '';
        $('cuenta-pagar-revision').value = cuenta.fecha_revision || '';
        $('cuenta-pagar-aviso').value = String(cuenta.aviso_revision_dias || 30);
        $('cuenta-pagar-nota-revision').value = cuenta.nota_revision || '';
        $('cuenta-pagar-observaciones').value = cuenta.observaciones || '';
        $('btn-guardar-cuenta-pagar').textContent = 'Guardar cambios';
        window.actualizarMonedaCuenta();
        window.toggleFormCuentaPagar(true);
        $('form-cuenta-pagar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.actualizarMonedaCuenta = () => {
        const moneda = $('cuenta-pagar-moneda')?.value || 'CLP';
        $('cuenta-pagar-monto-label').textContent = moneda === 'USD' ? 'Monto estimado (USD)' : 'Monto estimado (CLP)';
        $('cuenta-pagar-monto').step = moneda === 'USD' ? '0.01' : '1';
    };

    window.guardarCuentaPagar = async event => {
        event.preventDefault();
        const boton = $('btn-guardar-cuenta-pagar');
        const monto = $('cuenta-pagar-monto').value;
        const moneda = $('cuenta-pagar-moneda').value;
        const cuentaId = $('cuenta-pagar-id').value;
        const body = {
            nombre: $('cuenta-pagar-nombre').value.trim(),
            proveedor: $('cuenta-pagar-proveedor').value.trim() || null,
            categoria: $('cuenta-pagar-categoria').value,
            monto: moneda === 'CLP' && monto ? Number(monto) : null,
            moneda,
            monto_moneda_origen: moneda === 'USD' && monto ? Number(monto) : null,
            fecha_vencimiento: $('cuenta-pagar-vencimiento').value,
            frecuencia: $('cuenta-pagar-frecuencia').value,
            observaciones: $('cuenta-pagar-observaciones').value.trim() || null,
            fecha_inicio_servicio: $('cuenta-pagar-inicio').value || null,
            fecha_revision: $('cuenta-pagar-revision').value || null,
            aviso_revision_dias: Number($('cuenta-pagar-aviso').value),
            nota_revision: $('cuenta-pagar-nota-revision').value.trim() || null
        };

        try {
            boton.disabled = true;
            boton.textContent = 'Guardando...';
            const bodyEnvio = cuentaId ? { ...body, monto_referencia: monto ? Number(monto) : null } : body;
            await apiFetch(cuentaId ? `/api/cuentas-pagar/${cuentaId}` : '/api/cuentas-pagar', {
                method: cuentaId ? 'PUT' : 'POST',
                body: JSON.stringify(bodyEnvio)
            });
            window.cerrarFormularioCuentaPagar();
            toast(cuentaId ? 'Cuenta actualizada correctamente' : 'Cuenta registrada correctamente');
            await cargarAgenda();
        } catch (err) {
            toast(err.message || 'No fue posible registrar la cuenta', 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = cuentaId ? 'Guardar cambios' : 'Guardar cuenta';
        }
    };

    window.abrirModalConfirmarPago = id => {
        cuentaPendientePago = cuentasPorPagar.find(cuenta => cuenta.id === id) || null;
        if (!cuentaPendientePago) return;
        $('modal-pago-nombre').textContent = cuentaPendientePago.nombre;
        $('modal-pago-monto').value = cuentaPendientePago.monto
            ? Math.round(Number(cuentaPendientePago.monto))
            : '';
        $('modal-pago-fecha').value = hoyChileTexto();
        $('modal-pago-moneda').value = cuentaPendientePago.moneda || 'CLP';
        $('modal-pago-monto-origen').value = cuentaPendientePago.monto_moneda_origen || '';
        $('modal-pago-tipo-cambio').value = '';
        $('modal-pago-comision').value = '0';
        window.actualizarCamposPagoMoneda();
        $('modal-pago-ayuda').textContent = cuentaPendientePago.estado === 'pagada'
            ? 'Este pago fue confirmado anteriormente sin generar un egreso. Al continuar se completará el registro financiero.'
            : 'Al confirmar se registrará inmediatamente el egreso financiero.';
        show($('modal-confirmar-pago'));
        setTimeout(() => $('modal-pago-monto').focus(), 0);
    };

    window.cerrarModalConfirmarPago = () => {
        cuentaPendientePago = null;
        hide($('modal-confirmar-pago'));
    };

    window.abrirModalFinalizarCuenta = id => {
        cuentaPendienteFinalizar = cuentasPorPagar.find(cuenta => cuenta.id === id) || null;
        if (!cuentaPendienteFinalizar) return;
        $('modal-finalizar-cuenta-nombre').textContent = cuentaPendienteFinalizar.nombre;
        $('modal-finalizar-cuenta-motivo').value = '';
        show($('modal-finalizar-cuenta'));
        setTimeout(() => $('modal-finalizar-cuenta-motivo').focus(), 0);
    };

    window.cerrarModalFinalizarCuenta = () => {
        cuentaPendienteFinalizar = null;
        hide($('modal-finalizar-cuenta'));
    };

    window.confirmarFinalizarCuenta = async () => {
        if (!cuentaPendienteFinalizar) return;
        const motivo = $('modal-finalizar-cuenta-motivo').value.trim();
        if (motivo.length < 5) { toast('Indica brevemente el motivo', 'error'); return; }
        const boton = $('btn-finalizar-cuenta');
        try {
            boton.disabled = true;
            boton.textContent = 'Finalizando...';
            const resultado = await apiFetch(`/api/cuentas-pagar/${cuentaPendienteFinalizar.id}/finalizar`, { method: 'PATCH', body: JSON.stringify({ motivo }) });
            toast(resultado.mensaje, 'success');
            window.cerrarModalFinalizarCuenta();
            await cargarAgenda();
        } catch (err) { toast(err.message || 'No fue posible finalizar la recurrencia', 'error'); }
        finally { boton.disabled = false; boton.textContent = 'Finalizar recurrencia'; }
    };

    window.actualizarCamposPagoMoneda = () => {
        $('modal-pago-usd')?.classList.toggle('hidden', $('modal-pago-moneda')?.value !== 'USD');
    };

    window.confirmarPagoCuenta = async () => {
        if (!cuentaPendientePago) return;
        const monto = Number($('modal-pago-monto').value);
        const moneda = $('modal-pago-moneda').value;
        const montoOrigen = $('modal-pago-monto-origen').value ? Number($('modal-pago-monto-origen').value) : null;
        const tipoCambio = $('modal-pago-tipo-cambio').value ? Number($('modal-pago-tipo-cambio').value) : null;
        const comisionClp = $('modal-pago-comision').value ? Number($('modal-pago-comision').value) : 0;
        if (!Number.isFinite(monto) || monto <= 0) {
            toast('Confirma un monto mayor a 0', 'error');
            $('modal-pago-monto').focus();
            return;
        }
        if (moneda === 'USD' && (!montoOrigen || !tipoCambio)) {
            toast('Confirma el monto en USD y el tipo de cambio', 'error');
            return;
        }
        const boton = $('btn-confirmar-pago');
        try {
            boton.disabled = true;
            boton.textContent = 'Guardando...';
            await apiFetch(`/api/cuentas-pagar/${cuentaPendientePago.id}/pagar`, {
                method: 'PATCH',
                body: JSON.stringify({ monto, moneda, monto_origen: montoOrigen, tipo_cambio: tipoCambio, comision_clp: comisionClp, fecha_pago: $('modal-pago-fecha').value })
            });
            toast('Pago confirmado; se actualizó el historial y la recurrencia');
            window.cerrarModalConfirmarPago();
            await cargarAgenda();
        } catch (err) {
            toast(err.message || 'No fue posible actualizar la cuenta', 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = 'Confirmar pago';
        }
    };

    $('modal-confirmar-pago')?.addEventListener('click', event => {
        if (event.target === $('modal-confirmar-pago')) window.cerrarModalConfirmarPago();
    });

    window.renderizarAgenda = () => {
        const lista = $('agenda-lista');
        if (!lista) return;

        const filtro = $('agenda-filtro')?.value || 'proximos';
        const ahora = new Date();
        const eventos = eventosAgenda.filter(evento => {
            if (filtro === 'todos') return true;
            if (filtro !== 'proximos') return evento.estado === filtro;
            return esEventoProximo(evento, ahora);
        });

        $('agenda-contador').textContent = `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`;

        if (!eventos.length) {
            lista.innerHTML = '<p class="agenda-vacia">No hay actividades para este filtro.</p>';
            return;
        }

        lista.innerHTML = eventos.map(evento => {
            const fecha = new Date(evento.fecha_inicio);
            const dia = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit' }).format(fecha);
            const mes = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', month: 'short' }).format(fecha).replace('.', '').toUpperCase();
            const claseEstado = `estado-${evento.estado}`;
            return `
                <article class="agenda-evento">
                    <div class="agenda-evento-visual">
                        ${evento.miniatura_url ? `<img class="agenda-evento-miniatura" src="${sanitizar(evento.miniatura_url)}" alt="" loading="lazy" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')">` : ''}
                        <div class="agenda-fecha ${evento.miniatura_url ? 'hidden' : ''}"><span>${mes}</span><strong>${dia}</strong></div>
                    </div>
                    <div class="agenda-evento-info">
                        <div class="agenda-evento-titulo">
                            <h4>${sanitizar(evento.titulo)}</h4>
                            <div class="agenda-badges">
                                <span class="agenda-badge ${claseEstado}">${sanitizar(evento.estado)}</span>
                                <span class="agenda-badge visibilidad">${sanitizar(evento.visibilidad)}</span>
                                ${evento.publicar_home ? '<span class="agenda-badge home">Home</span>' : ''}
                            </div>
                        </div>
                        <p>${sanitizar(fechaEvento(evento.fecha_inicio))}${evento.ubicacion ? ` · ${sanitizar(evento.ubicacion)}` : ''}</p>
                        <span>${sanitizar(evento.tipo)}${evento.organizador ? ` · ${sanitizar(evento.organizador)}` : ''}</span>
                        ${evento.estado === 'suspendido' && evento.motivo_suspension ? `<p class="agenda-motivo-suspension"><strong>Motivo:</strong> ${sanitizar(evento.motivo_suspension)}</p>` : ''}
                    </div>
                    ${puedeGestionarEventos() ? `
                        <div class="agenda-acciones">
                            <button type="button" onclick="editarEvento('${evento.id}')">Editar</button>
                            ${evento.estado !== 'suspendido' ? `<button type="button" class="suspender" onclick="suspenderEvento('${evento.id}')">Suspender</button>` : ''}
                        </div>
                    ` : ''}
                </article>`;
        }).join('');
    };

    window.abrirFormularioEvento = () => {
        $('evento-id').value = '';
        $('form-evento-titulo').textContent = 'Nuevo evento';
        $('btn-guardar-evento').textContent = 'Guardar evento';
        $('form-evento').querySelector('form').reset();
        $('evento-fecha-fin').min = '';
        if (miniaturaPreviewLocal) URL.revokeObjectURL(miniaturaPreviewLocal);
        miniaturaPreviewLocal = null;
        mostrarPreviewMiniatura(null);
        $('evento-tipo').value = 'Actividad general';
        $('evento-estado').value = 'borrador';
        $('evento-visibilidad').value = 'interna';
        show($('form-evento'));
        $('evento-titulo').focus();
    };

    window.cerrarFormularioEvento = () => hide($('form-evento'));

    window.editarEvento = id => {
        const evento = eventosAgenda.find(item => item.id === id);
        if (!evento) return;

        $('evento-id').value = evento.id;
        $('evento-titulo').value = evento.titulo || '';
        $('evento-tipo').value = evento.tipo || 'Otro';
        $('evento-organizador').value = evento.organizador || '';
        asignarFechaHoraEvento('inicio', evento.fecha_inicio);
        asignarFechaHoraEvento('fin', evento.fecha_fin);
        sincronizarTerminoEvento();
        $('evento-ubicacion').value = evento.ubicacion || '';
        $('evento-responsable').value = evento.responsable || '';
        $('evento-estado').value = evento.estado;
        $('evento-visibilidad').value = evento.visibilidad;
        $('evento-descripcion').value = evento.descripcion || '';
        $('evento-descripcion-publica').value = evento.descripcion_publica || '';
        $('evento-miniatura').value = '';
        if (miniaturaPreviewLocal) URL.revokeObjectURL(miniaturaPreviewLocal);
        miniaturaPreviewLocal = null;
        mostrarPreviewMiniatura(evento.miniatura_url || null);
        $('evento-publicar-home').checked = evento.publicar_home;
        $('evento-destacado').checked = evento.destacado;
        $('evento-incluir-avisos').checked = evento.incluir_avisos;
        $('evento-publicar-rrss').checked = evento.publicar_rrss;
        $('form-evento-titulo').textContent = 'Editar evento';
        $('btn-guardar-evento').textContent = 'Guardar cambios';
        show($('form-evento'));
        $('form-evento').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.guardarEvento = async event => {
        event.preventDefault();
        const id = $('evento-id').value;
        const visibilidad = $('evento-visibilidad').value;
        const publicarHome = $('evento-publicar-home').checked;
        const archivoMiniatura = $('evento-miniatura').files?.[0] || null;

        if (publicarHome && visibilidad !== 'publica') {
            toast('Para publicar en el home, la visibilidad debe ser pública', 'error');
            return;
        }

        const inicio = obtenerFechaHoraEvento('inicio');
        const fin = obtenerFechaHoraEvento('fin');
        const body = {
            titulo: $('evento-titulo').value.trim(),
            tipo: $('evento-tipo').value,
            organizador: $('evento-organizador').value.trim(),
            fecha_inicio: inicio ? inicio.toISOString() : '',
            fecha_fin: fin ? fin.toISOString() : null,
            ubicacion: $('evento-ubicacion').value.trim(),
            responsable: $('evento-responsable').value.trim(),
            estado: $('evento-estado').value,
            visibilidad,
            descripcion: $('evento-descripcion').value.trim(),
            descripcion_publica: $('evento-descripcion-publica').value.trim(),
            publicar_home: publicarHome,
            destacado: $('evento-destacado').checked,
            incluir_avisos: $('evento-incluir-avisos').checked,
            publicar_rrss: $('evento-publicar-rrss').checked
        };

        const boton = $('btn-guardar-evento');
        try {
            boton.disabled = true;
            boton.textContent = 'Guardando...';
            const resultado = await apiFetch(id ? `/api/eventos/${id}` : '/api/eventos', {
                method: id ? 'PUT' : 'POST', body: JSON.stringify(body)
            });
            let miniaturaConError = false;
            if (archivoMiniatura) {
                try {
                    await subirMiniaturaEvento(resultado.evento.id, archivoMiniatura);
                } catch (err) {
                    miniaturaConError = true;
                    toast(`Evento guardado, pero la miniatura falló: ${err.message}`, 'error');
                }
            }
            if (!miniaturaConError) toast(id ? 'Evento actualizado correctamente' : 'Evento creado correctamente');
            cerrarFormularioEvento();
            await cargarAgenda();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = id ? 'Guardar cambios' : 'Guardar evento';
        }
    };

    window.suspenderEvento = async id => {
        const evento = eventosAgenda.find(item => item.id === id);
        if (!evento) return;
        eventoPendienteSuspension = evento;
        $('modal-suspender-nombre').textContent = evento.titulo;
        $('motivo-suspension-evento').value = '';
        show($('modal-suspender-evento'));
        setTimeout(() => $('motivo-suspension-evento').focus(), 0);
    };

    window.cerrarModalSuspensionEvento = () => {
        eventoPendienteSuspension = null;
        hide($('modal-suspender-evento'));
    };

    window.confirmarSuspensionEvento = async () => {
        if (!eventoPendienteSuspension) return;
        const motivo = $('motivo-suspension-evento').value.trim();
        if (!motivo) {
            toast('Debes indicar el motivo de suspensión', 'error');
            $('motivo-suspension-evento').focus();
            return;
        }
        const boton = $('btn-confirmar-suspension');
        try {
            boton.disabled = true;
            boton.textContent = 'Suspendiendo...';
            await apiFetch(`/api/eventos/${eventoPendienteSuspension.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ motivo_suspension: motivo })
            });
            toast('Evento suspendido correctamente');
            cerrarModalSuspensionEvento();
            await cargarAgenda();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = 'Suspender evento';
        }
    };

    $('modal-suspender-evento')?.addEventListener('click', event => {
        if (event.target === $('modal-suspender-evento')) cerrarModalSuspensionEvento();
    });

    // ============================================================
    // TABS DIRECTORIO
    // ============================================================
    window.cambiarTabDirectorio = tab => {
        const tabMiembros  = $('tab-miembros');
        const tabFamilias  = $('tab-familias');
        const contMiembros = $('contenido-tab-miembros');
        const contFamilias = $('contenido-tab-familias');

        const activo   = 'padding:10px 20px;font-size:13px;cursor:pointer;background:none;border:none;border-bottom:2px solid var(--text);font-weight:600;color:var(--text);';
        const inactivo = 'padding:10px 20px;font-size:13px;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);';

        if (tab === 'miembros') {
            tabMiembros.style.cssText = activo;   tabFamilias.style.cssText = inactivo;
            show(contMiembros); hide(contFamilias);
        } else {
            tabMiembros.style.cssText = inactivo; tabFamilias.style.cssText = activo;
            hide(contMiembros); show(contFamilias);
            cargarFamilias();
        }
    };

    // ============================================================
    // MÓDULO MIEMBROS
    // ============================================================
    let todosMiembros = [];
    let todasPersonas = [];

    async function cargarMiembros() {
        try {
            const data = await apiFetch('/api/personas');
            todasPersonas = data.personas || [];
            const tbody = document.querySelector('#vista-miembros .data-table tbody');
            if (!tbody) return;

            const contador = document.querySelector('#vista-miembros .table-count');
            if (contador) contador.textContent = `${data.total} personas`;

            if (data.total === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No hay personas registradas aún</td></tr>`;
                return;
            }

            tbody.innerHTML = todasPersonas.map(persona => {
                const esMiembro = persona.tipo_vinculo === 'miembro';
                const estaActivo = persona.estado === 'activo';
                return `
                    <tr>
                        <td><div class="td-name"><div class="mini-av">${sanitizar(persona.nombre.substring(0,2).toUpperCase())}</div>${sanitizar(persona.nombre)}</div></td>
                        <td><span class="badge ${esMiembro ? 'active' : 'new'}">${esMiembro ? 'Miembro' : 'Invitado'}</span></td>
                        <td><span class="badge ${estaActivo ? 'active' : 'inactive'}">${estaActivo ? 'Activo' : 'Inactivo'}</span></td>
                        <td>${persona.fecha_inicio ? persona.fecha_inicio.split('-').reverse().join('/') : '—'}</td>
                        <td>${tieneDirectorioLimitado() ? '' : `<button class="btn-table" onclick="verDetallePersona('${persona.id}')">Ver</button>`}</td>
                    </tr>`;
            }).join('');
        } catch (err) {
            toast('Error cargando personas', 'error');
        }
    }

    $('buscar-miembro')?.addEventListener('input', e => {
        const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const busqueda = normalizar(e.target.value.trim());
        const filas = document.querySelectorAll('#vista-miembros .data-table tbody tr');
        let visibles = 0;

        todasPersonas.forEach((persona, indice) => {
            const coincide = normalizar(persona.nombre).includes(busqueda) ||
                normalizar(persona.rut).includes(busqueda) ||
                normalizar(persona.tipo_vinculo).includes(busqueda);
            if (filas[indice]) filas[indice].style.display = coincide ? '' : 'none';
            if (coincide) visibles++;
        });

        const contador = document.querySelector('#vista-miembros .table-count');
        if (contador) contador.textContent = `${visibles} personas`;
    });

    window.verDetallePersona = async personaId => {
        try {
            let persona = todasPersonas.find(item => item.id === personaId);
            if (!persona) {
                const data = await apiFetch('/api/personas');
                todasPersonas = data.personas || [];
                persona = todasPersonas.find(item => item.id === personaId);
            }
            if (!persona) throw new Error('Persona no encontrada');

            const esMiembro = persona.tipo_vinculo === 'miembro' && persona.miembro;
            let familia = null;
            let rolesPersona = [];
            if (esMiembro) {
                const [dataFamilias, dataRoles] = await Promise.all([
                    apiFetch('/api/familias'),
                    apiFetch(`/api/personas/${persona.id}/roles`)
                ]);
                familia = (dataFamilias.familias || []).find(grupo =>
                    (grupo.miembros || []).some(integrante => integrante.id === persona.miembro.id)
                );
                rolesPersona = dataRoles.roles || [];
            }

            const fecha = valor => valor ? valor.split('-').reverse().join('/') : '—';
            const dato = valor => valor ? sanitizar(valor) : '—';
            const estaActivo = persona.estado === 'activo';
            const contenido = $('modal-detalle-contenido');
            if (!contenido) return;

            contenido.innerHTML = `
                <div class="detalle-miembro" style="display:grid;gap:12px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div>
                            <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${esMiembro ? 'MIEMBRO' : 'INVITADO'}</div>
                            <div style="font-size:18px;font-weight:800;">${dato(persona.nombre)}</div>
                        </div>
                        <span class="badge ${estaActivo ? 'active' : 'inactive'}">${estaActivo ? 'Activo' : 'Inactivo'}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">RUT</div><div style="font-weight:600;font-size:14px;">${dato(persona.rut)}</div></div>
                        <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">TELÉFONO</div><div style="font-weight:600;font-size:14px;">${dato(persona.telefono)}</div></div>
                    </div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">CORREO</div><div style="font-weight:600;font-size:14px;">${dato(persona.correo)}</div></div>
                    ${!esMiembro ? `<div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA DE NACIMIENTO</div><div style="font-weight:600;font-size:14px;">${fecha(persona.fecha_nacimiento)}</div></div>` : ''}
                    ${esMiembro ? `
                        <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FAMILIA</div><div style="font-weight:600;font-size:14px;">${familia ? dato(familia.nombre) : 'Sin grupo familiar'}</div></div>
                        <div style="background:var(--paper);border-radius:10px;padding:14px;">
                            <div style="font-size:11px;color:var(--muted);margin-bottom:7px;">ROLES</div>
                            <div class="detalle-roles">
                                ${rolesPersona.length
                                    ? rolesPersona.map(rol => `<span class="detalle-rol-chip">${dato(rol.nombre)}</span>`).join('')
                                    : '<span style="font-size:13px;color:var(--muted);">Sin roles asignados</span>'}
                            </div>
                        </div>
                        <div style="background:var(--paper);border-radius:10px;padding:14px;">
                            <div style="font-size:11px;color:var(--muted);margin-bottom:7px;">CUENTA DE ACCESO</div>
                            <div class="detalle-cuenta">
                                <div class="detalle-cuenta-info">
                                    <strong>${persona.cuenta ? dato(persona.cuenta.correo) : 'Sin cuenta vinculada'}</strong>
                                    <span>${persona.cuenta
                                        ? (persona.cuenta.activo ? 'Cuenta activa' : 'Cuenta bloqueada')
                                        : 'Este miembro todavía no puede iniciar sesión'}</span>
                                </div>
                                <span class="badge ${persona.cuenta?.activo ? 'active' : 'inactive'}">${persona.cuenta
                                    ? (persona.cuenta.activo ? 'Activa' : 'Bloqueada')
                                    : 'Sin cuenta'}</span>
                            </div>
                        </div>
                        ${!estaActivo && persona.motivo_inactividad ? `<div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">MOTIVO DE INACTIVIDAD</div><div style="font-weight:600;font-size:14px;">${dato(persona.motivo_inactividad)}</div></div>` : ''}
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA DE NACIMIENTO</div><div style="font-weight:600;font-size:14px;">${fecha(persona.fecha_nacimiento)}</div></div>
                            <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA DE BAUTISMO</div><div style="font-weight:600;font-size:14px;">${fecha(persona.miembro.fecha_bautismo)}</div></div>
                        </div>
                        ${puedeEditarDirectorio() ? `<button type="button" class="btn-action" style="width:100%;margin-top:4px;" onclick="editarMiembro('${persona.miembro.id}')">Editar persona</button>` : ''}
                    ` : `
                        <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">VÍNCULO DESDE</div><div style="font-weight:600;font-size:14px;">${fecha(persona.fecha_inicio)}</div></div>
                    `}
                </div>`;
            $('modal-detalle').classList.remove('hidden');
        } catch (err) {
            toast(err.message || 'Error cargando persona', 'error');
        }
    };

    window.toggleForm = id => { const f = $(id); if (f) f.classList.toggle('hidden'); };

    window.toggleCamposMembresia = tipo => {
        $('campos-membresia')?.classList.toggle('hidden', tipo !== 'miembro');
        $('configuracion-miembro')?.classList.toggle('hidden', tipo !== 'miembro');
        if (tipo !== 'miembro') $('crear-cuenta-acceso').checked = false;
    };

    const limpiarConfiguracionPersona = () => {
        $('persona-id-edicion').value = '';
        document.querySelectorAll('#editor-roles-lista input').forEach(input => { input.checked = false; });
        $('crear-cuenta-acceso').checked = false;
        $('crear-cuenta-acceso').disabled = false;
        $('btn-restablecer-password')?.classList.add('hidden');
        $('editor-cuenta-estado').classList.remove('cuenta-existente');
        $('editor-cuenta-estado').querySelector('p').textContent =
            'Usuario: correo personal · clave temporal válida por 72 horas.';
    };

    const rolesSeleccionadosEditor = () =>
        [...document.querySelectorAll('#editor-roles-lista input:checked')].map(input => input.value);

    let motivoInactividadPendiente = '';
    $('miembro-activo')?.addEventListener('change', () => {
        if ($('miembro-activo').value === 'true') {
            motivoInactividadPendiente = '';
            return;
        }
        if (!motivoInactividadPendiente) {
            $('miembro-motivo-inactividad').value = '';
            $('miembro-motivo-inactividad-otro').value = '';
            $('grupo-motivo-inactividad-otro').classList.add('hidden');
            $('modal-motivo-inactividad').classList.remove('hidden');
        }
    });
    $('miembro-motivo-inactividad')?.addEventListener('change', () => {
        const esOtro = $('miembro-motivo-inactividad').value === 'Otro';
        $('grupo-motivo-inactividad-otro').classList.toggle('hidden', !esOtro);
        if (esOtro) $('miembro-motivo-inactividad-otro').focus();
    });

    window.abrirFormNuevoMiembro = () => {
        cambiarTabDirectorio('miembros');
        const f = $('form-nuevo-miembro');
        f?.querySelector('form')?.reset();
        $('miembro-id').value = '';
        limpiarConfiguracionPersona();
        $('form-miembro-titulo').textContent = 'Registrar Nueva Persona';
        $('btn-guardar-miembro').textContent = 'Guardar';
        $('persona-tipo-vinculo').disabled = false;
        $('persona-tipo-vinculo').value = 'invitado';
        $('miembro-activo').value = 'true';
        $('miembro-motivo-inactividad').value = '';
        $('miembro-motivo-inactividad-otro').value = '';
        motivoInactividadPendiente = '';
        toggleCamposMembresia('invitado');
        if (f) {
            f.classList.remove('hidden');
            document.body.classList.add('modal-abierto');
            $('miembro-nombre').focus();
        }
    };

    window.cerrarFormMiembro = () => {
        $('form-nuevo-miembro')?.classList.add('hidden');
        document.body.classList.remove('modal-abierto');
        $('form-nuevo-miembro')?.querySelector('form')?.reset();
        $('miembro-id').value = '';
        limpiarConfiguracionPersona();
        $('persona-tipo-vinculo').disabled = false;
        toggleCamposMembresia('invitado');
    };

    window.editarMiembro = async miembroId => {
        try {
            const miembroLocal = todosMiembros.find(miembro => miembro.id === miembroId);
            const m = miembroLocal || (await apiFetch(`/api/miembros/${miembroId}`)).miembro;
            const persona = todasPersonas.find(item => item.miembro?.id === m.id);
            if (!persona) throw new Error('No fue posible localizar la persona asociada');
            const dataRoles = await apiFetch(`/api/personas/${persona.id}/roles`);
            const rolesAsignados = new Set((dataRoles.roles || []).map(rol => rol.codigo));
            $('miembro-id').value = m.id;
            $('persona-id-edicion').value = persona.id;
            $('miembro-nombre').value = m.nombre || '';
            $('miembro-rut').value = m.rut || '';
            $('miembro-correo').value = m.correo || '';
            $('miembro-telefono').value = m.telefono || '';
            $('miembro-fecha-bautismo').value = m.fecha_bautismo || '';
            $('persona-fecha-nacimiento').value = persona.fecha_nacimiento || '';
            $('miembro-activo').value = String(Boolean(m.activo));
            const motivoGuardado = persona.motivo_inactividad === 'Miembro desactivado administrativamente'
                ? ''
                : (persona.motivo_inactividad || '');
            motivoInactividadPendiente = motivoGuardado;
            $('persona-tipo-vinculo').value = 'miembro';
            $('persona-tipo-vinculo').disabled = true;
            toggleCamposMembresia('miembro');
            document.querySelectorAll('#editor-roles-lista input').forEach(input => {
                input.checked = rolesAsignados.has(input.value);
            });
            $('crear-cuenta-acceso').checked = false;
            $('crear-cuenta-acceso').disabled = Boolean(persona.cuenta);
            $('editor-cuenta-estado').classList.toggle('cuenta-existente', Boolean(persona.cuenta));
            $('editor-cuenta-estado').querySelector('p').textContent = persona.cuenta
                ? `Cuenta ${persona.cuenta.activo ? 'activa' : 'bloqueada'}: ${persona.cuenta.correo}`
                : 'Usuario: correo personal · clave temporal válida por 72 horas.';
            const puedeRestablecer = Boolean(persona.cuenta) && getUsuario().rol === 'superadmin';
            $('btn-restablecer-password')?.classList.toggle('hidden', !puedeRestablecer);
            $('form-miembro-titulo').textContent = 'Editar Persona';
            $('btn-guardar-miembro').textContent = 'Guardar cambios';
            $('modal-detalle').classList.add('hidden');
            $('form-nuevo-miembro').classList.remove('hidden');
            document.body.classList.add('modal-abierto');
            $('miembro-nombre').focus();
        } catch (err) {
            toast(err.message || 'No fue posible cargar el miembro', 'error');
        }
    };

    window.registrarMiembro = async e => {
        e.preventDefault();
        const miembroId = $('miembro-id').value;
        let personaId = $('persona-id-edicion').value;
        const tipoVinculo = miembroId ? 'miembro' : $('persona-tipo-vinculo').value;
        const crearCuenta = tipoVinculo === 'miembro'
            && !$('crear-cuenta-acceso').disabled
            && $('crear-cuenta-acceso').checked;
        const payload = {
            nombre:         $('miembro-nombre').value.trim(),
            rut:            $('miembro-rut').value.trim() || null,
            correo:         $('miembro-correo').value.trim() || null,
            telefono:       $('miembro-telefono').value.trim() || null,
            fecha_bautismo: tipoVinculo === 'miembro' ? ($('miembro-fecha-bautismo').value || null) : null,
            fecha_nacimiento: $('persona-fecha-nacimiento').value || null,
            activo:         $('miembro-activo').value === 'true'
        };
        if (!payload.activo) {
            if (!motivoInactividadPendiente) {
                $('miembro-motivo-inactividad').value = '';
                $('miembro-motivo-inactividad-otro').value = '';
                $('grupo-motivo-inactividad-otro').classList.add('hidden');
                $('modal-motivo-inactividad').classList.remove('hidden');
                return;
            }
            payload.motivo_inactividad = motivoInactividadPendiente;
        }
        if (!miembroId) payload.tipo_vinculo = tipoVinculo;
        if (!payload.nombre) { toast('El nombre es requerido', 'error'); return; }
        if (crearCuenta && !payload.correo) {
            toast('Debes ingresar el correo que se usará para iniciar sesión', 'error');
            $('miembro-correo').focus();
            return;
        }
        const boton = $('btn-guardar-miembro');
        try {
            boton.disabled = true;
            boton.textContent = 'Guardando...';
            const resultadoPersona = await apiFetch(miembroId ? `/api/miembros/${miembroId}` : '/api/personas', {
                method: miembroId ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            if (!personaId) {
                personaId = resultadoPersona.persona?.id
                    || resultadoPersona.registro?.persona_id
                    || resultadoPersona.registro?.id;
            }
            if (tipoVinculo === 'miembro' && personaId) {
                await apiFetch(`/api/personas/${personaId}/roles`, {
                    method: 'PUT',
                    body: JSON.stringify({ roles: rolesSeleccionadosEditor() })
                });
            }
            let credencial = null;
            if (crearCuenta && personaId) {
                credencial = await apiFetch('/api/usuarios/crear-para-persona', {
                    method: 'POST',
                    body: JSON.stringify({ persona_id: personaId, correo: payload.correo })
                });
            }
            const mensajeAlta = tipoVinculo === 'miembro'
                ? `${payload.nombre} registrado como miembro ✓`
                : `${payload.nombre} registrado como invitado ✓`;
            toast(miembroId ? 'Persona actualizada correctamente' : mensajeAlta, 'success');
            cerrarFormMiembro();
            await cargarMiembros();
            if (credencial) mostrarCredencialTemporal(credencial);
        } catch (err) { toast(err.message || 'Error al registrar', 'error'); }
        finally {
            boton.disabled = false;
            boton.textContent = miembroId ? 'Guardar cambios' : 'Guardar';
        }
    };

    window.mostrarCredencialTemporal = data => {
        $('credencial-temporal-titulo').textContent = data.mensaje?.includes('temporal generada')
            ? 'Contraseña restablecida'
            : 'Acceso creado';
        $('credencial-temporal-correo').textContent = data.cuenta?.correo || '';
        $('credencial-temporal-password').textContent = data.password_temporal || '';
        $('modal-credencial-temporal').classList.remove('hidden');
    };

    window.cerrarMotivoInactividad = (cancelar = true) => {
        $('modal-motivo-inactividad').classList.add('hidden');
        if (cancelar && !motivoInactividadPendiente) $('miembro-activo').value = 'true';
    };

    window.confirmarMotivoInactividad = () => {
        const seleccionado = $('miembro-motivo-inactividad').value;
        const motivo = seleccionado === 'Otro'
            ? $('miembro-motivo-inactividad-otro').value.trim()
            : seleccionado;
        if (!motivo) {
            toast('Selecciona o escribe el motivo de inactividad', 'error');
            return;
        }
        motivoInactividadPendiente = motivo;
        cerrarMotivoInactividad(false);
        $('form-nuevo-miembro').querySelector('form').requestSubmit();
    };

    window.restablecerPasswordPersona = async () => {
        const personaId = $('persona-id-edicion').value;
        if (!personaId) return;
        if (!window.confirm('La contraseña actual dejará de funcionar. ¿Generar una clave temporal nueva?')) return;

        const boton = $('btn-restablecer-password');
        try {
            boton.disabled = true;
            boton.textContent = 'Generando...';
            const credencial = await apiFetch('/api/usuarios/restablecer-password', {
                method: 'POST',
                body: JSON.stringify({ persona_id: personaId })
            });
            mostrarCredencialTemporal(credencial);
        } catch (err) {
            toast(err.message || 'No fue posible restablecer la contraseña', 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = 'Generar nueva clave temporal';
        }
    };

    window.cerrarCredencialTemporal = () => {
        $('modal-credencial-temporal').classList.add('hidden');
        $('credencial-temporal-correo').textContent = '';
        $('credencial-temporal-password').textContent = '';
        $('credencial-temporal-titulo').textContent = 'Acceso creado';
    };

    window.copiarCredencialTemporal = async () => {
        const correo = $('credencial-temporal-correo').textContent;
        const password = $('credencial-temporal-password').textContent;
        const instrucciones = `Casa de Vida\nUsuario: ${correo}\nContraseña temporal: ${password}\n\nIngresa a la plataforma y crea tu contraseña personal. Esta clave temporal vence en 72 horas y solo puede usarse para el primer acceso.`;
        try {
            await navigator.clipboard.writeText(instrucciones);
            toast('Instrucciones copiadas', 'success');
        } catch {
            toast('No fue posible copiar automáticamente', 'error');
        }
    };

    // ============================================================
    // MÓDULO FAMILIAS
    // ============================================================
    async function cargarFamilias() {
        try {
            const [dataFamilias, dataMiembros] = await Promise.all([apiFetch('/api/familias'), apiFetch('/api/miembros')]);
            todosMiembros = dataMiembros.miembros || [];
            const familias = dataFamilias.familias || [];
            const contador = $('familias-contador');
            if (contador) contador.textContent = `${familias.length} grupos familiares`;
            renderFamilias(familias);
            renderSinFamilia(todosMiembros);
        } catch (err) { toast('Error cargando familias', 'error'); }
    }

    function renderFamilias(familias) {
        const lista = $('lista-familias');
        if (!lista) return;
        if (familias.length === 0) { lista.innerHTML = `<div style="text-align:center;color:var(--muted);padding:24px;">No hay grupos familiares creados aún</div>`; return; }
        lista.innerHTML = familias.map(f => {
            const integrantes = f.miembros || [];
            return `
            <div class="table-card" style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 10px;">
                    <div>
                        <span style="font-weight:700;font-size:15px;">${f.nombre}</span>
                        <span style="font-size:12px;color:var(--muted);margin-left:10px;">${integrantes.length} integrante${integrantes.length !== 1 ? 's' : ''}</span>
                    </div>
                    ${puedeEditarDirectorio() ? `<button class="btn-table" onclick="mostrarAgregarIntegrante('${f.id}', '${f.nombre}')">+ Agregar</button>` : ''}
                </div>
                ${integrantes.length === 0
                    ? `<div style="padding:12px 20px;color:var(--muted);font-size:13px;">Sin integrantes aún</div>`
                    : integrantes.map(m => `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-top:1px solid var(--border);">
                            <div class="mini-av">${m.nombre.substring(0,2).toUpperCase()}</div>
                            <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${m.nombre}</div></div>
                            ${puedeEditarDirectorio() ? `<button class="btn-table" style="color:#ef4444;border-color:#ef4444;" onclick="quitarDeFamily('${m.id}', '${f.id}')">Quitar</button>` : ''}
                        </div>`).join('')
                }
            </div>`;
        }).join('');
    }

    function renderSinFamilia(miembros) {
        const lista = $('lista-sin-familia');
        if (!lista) return;
        const sinFamilia = miembros.filter(m => !m.familia_id && m.activo);
        if (sinFamilia.length === 0) { lista.innerHTML = `<div style="padding:16px 20px;color:var(--muted);font-size:13px;">Todos los miembros están asignados a una familia</div>`; return; }
        lista.innerHTML = sinFamilia.map(m => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--border);">
                <div class="mini-av" style="background:var(--border);">${m.nombre.substring(0,2).toUpperCase()}</div>
                <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${m.nombre}</div></div>
                ${puedeEditarDirectorio() ? `<button class="btn-table" onclick="mostrarAsignarFamilia('${m.id}', '${m.nombre}')">Asignar familia</button>` : ''}
            </div>`).join('');
    }

    window.crearFamilia = async e => {
        e.preventDefault();
        const nombre = $('nombre-nueva-familia')?.value.trim();
        if (!nombre) return toast('El nombre es requerido', 'error');
        try {
            await apiFetch('/api/familias', { method: 'POST', body: JSON.stringify({ nombre }) });
            toast(`${nombre} creada ✓`, 'success');
            toggleForm('form-nueva-familia');
            e.target.reset();
            cargarFamilias();
        } catch (err) { toast(err.message || 'Error al crear familia', 'error'); }
    };

    window.mostrarAgregarIntegrante = (familiaId, familiaNombre) => {
        const sinFamilia = todosMiembros.filter(m => !m.familia_id && m.activo);
        if (sinFamilia.length === 0) { toast('No hay miembros disponibles sin familia asignada', 'error'); return; }
        const contenido = $('modal-detalle-contenido');
        if (!contenido) return;
        contenido.innerHTML = `
            <div style="display:grid;gap:16px;">
                <p style="font-size:14px;color:var(--muted);">Agregar integrante a <strong>${familiaNombre}</strong></p>
                <select id="select-miembro-familia" style="padding:10px;border-radius:8px;border:1px solid var(--border);font-size:14px;width:100%;">
                    <option value="">Selecciona un miembro...</option>
                    ${sinFamilia.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
                </select>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <button onclick="document.getElementById('modal-detalle').classList.add('hidden')" style="padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--paper);cursor:pointer;font-weight:600;font-size:14px;">Cancelar</button>
                    <button onclick="confirmarAgregarIntegrante('${familiaId}')" style="padding:12px;border-radius:10px;border:none;background:#0f172a;color:white;cursor:pointer;font-weight:600;font-size:14px;">Agregar</button>
                </div>
            </div>`;
        $('modal-detalle').classList.remove('hidden');
    };

    window.confirmarAgregarIntegrante = async familiaId => {
        const miembroId = $('select-miembro-familia')?.value;
        if (!miembroId) return toast('Selecciona un miembro', 'error');
        try {
            await apiFetch(`/api/familias/${familiaId}/miembro`, { method: 'PUT', body: JSON.stringify({ miembro_id: miembroId }) });
            $('modal-detalle').classList.add('hidden');
            toast('Integrante agregado ✓', 'success');
            cargarFamilias();
        } catch (err) { toast(err.message || 'Error al agregar', 'error'); }
    };

    window.mostrarAsignarFamilia = async (miembroId, miembroNombre) => {
        try {
            const data    = await apiFetch('/api/familias');
            const familias = data.familias || [];
            if (familias.length === 0) { toast('No hay familias creadas aún', 'error'); return; }
            const contenido = $('modal-detalle-contenido');
            if (!contenido) return;
            contenido.innerHTML = `
                <div style="display:grid;gap:16px;">
                    <p style="font-size:14px;color:var(--muted);">Asignar <strong>${miembroNombre}</strong> a una familia</p>
                    <select id="select-familia-miembro" style="padding:10px;border-radius:8px;border:1px solid var(--border);font-size:14px;width:100%;">
                        <option value="">Selecciona una familia...</option>
                        ${familias.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')}
                    </select>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <button onclick="document.getElementById('modal-detalle').classList.add('hidden')" style="padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--paper);cursor:pointer;font-weight:600;font-size:14px;">Cancelar</button>
                        <button onclick="confirmarAsignarFamilia('${miembroId}')" style="padding:12px;border-radius:10px;border:none;background:#0f172a;color:white;cursor:pointer;font-weight:600;font-size:14px;">Asignar</button>
                    </div>
                </div>`;
            $('modal-detalle').classList.remove('hidden');
        } catch (err) { toast('Error cargando familias', 'error'); }
    };

    window.confirmarAsignarFamilia = async miembroId => {
        const familiaId = $('select-familia-miembro')?.value;
        if (!familiaId) return toast('Selecciona una familia', 'error');
        try {
            await apiFetch(`/api/familias/${familiaId}/miembro`, { method: 'PUT', body: JSON.stringify({ miembro_id: miembroId }) });
            $('modal-detalle').classList.add('hidden');
            toast('Miembro asignado ✓', 'success');
            cargarFamilias();
        } catch (err) { toast(err.message || 'Error al asignar', 'error'); }
    };

    window.quitarDeFamily = async (miembroId, familiaId) => {
        try {
            await apiFetch(`/api/familias/${familiaId}/miembro`, { method: 'PUT', body: JSON.stringify({ miembro_id: miembroId, quitar: true }) });
            toast('Integrante removido ✓', 'success');
            cargarFamilias();
        } catch (err) { toast(err.message || 'Error al quitar', 'error'); }
    };

    // ============================================================
    // MÓDULO FINANZAS
    // ============================================================
    let finanzasTodos  = [];
    let finanzasPagina = 1;
    const filasPorPagina = () => parseInt($('filtro-filas')?.value || '10');

    async function cargarFinanzas() {
        try {
            const data    = await apiFetch('/api/finanzas');
            finanzasTodos = data.registros || [];
            finanzasPagina = 1;
            inicializarFiltroAnio();
            aplicarFiltros();
        } catch (err) { toast('Error cargando finanzas', 'error'); }
    }

    function inicializarFiltroAnio() {
        const sel = $('filtro-anio');
        if (!sel) return;
        const anios      = [...new Set(finanzasTodos.map(r => r.fecha?.substring(0,4)).filter(Boolean))];
        const anioActual = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getFullYear().toString();
        if (!anios.includes(anioActual)) anios.unshift(anioActual);
        anios.sort((a,b) => b - a);
        sel.innerHTML = anios.map(a => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');
        const mesActual = String(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getMonth() + 1).padStart(2, '0');
        const selMes = $('filtro-mes');
        if (selMes) selMes.value = mesActual;
    }

    window.aplicarFiltros = () => { finanzasPagina = 1; renderTablaFinanzas(); };
    window.cambiarPagina  = dir => { finanzasPagina += dir; renderTablaFinanzas(); };

    function renderTablaFinanzas() {
        const anio  = $('filtro-anio')?.value || '';
        const mes   = $('filtro-mes')?.value  || '';
        const tipo  = $('filtro-tipo')?.value || '';
        const filas = filasPorPagina();
        const tbody = $('tabla-ingresos');
        if (!tbody) return;

        const filtrados = finanzasTodos.filter(r => {
            if (!r.fecha) return false;
            if (anio && !r.fecha.startsWith(anio))      return false;
            if (mes  && r.fecha.substring(5,7) !== mes) return false;
            if (tipo && r.tipo !== tipo)                return false;
            return true;
        });

        const total     = filtrados.length;
        const totalPags = Math.max(1, Math.ceil(total / filas));
        if (finanzasPagina > totalPags) finanzasPagina = totalPags;

        const inicio = (finanzasPagina - 1) * filas;
        const fin    = Math.min(inicio + filas, total);
        const slice  = filtrados.slice(inicio, fin);

        const contador = $('filtro-contador');
        if (contador) contador.textContent = `${total} registros`;

        const pagInfo = $('pag-info');
        if (pagInfo) pagInfo.textContent = total === 0 ? '' : `${inicio + 1}–${fin} de ${total}`;

        const btnPrev = $('btn-prev');
        const btnNext = $('btn-next');
        if (btnPrev) btnPrev.disabled = finanzasPagina === 1;
        if (btnNext) btnNext.disabled = finanzasPagina === totalPags || total === 0;

        const paginacionDiv = btnPrev?.parentElement?.parentElement;
        if (paginacionDiv) paginacionDiv.style.display = filas >= 9999 ? 'none' : 'flex';

        const mesActual   = String(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getMonth() + 1).padStart(2, '0');
        const mesMostrado = mes || mesActual;

        const paraResumen = finanzasTodos.filter(r => {
            if (!r.fecha) return false;
            if (anio && !r.fecha.startsWith(anio)) return false;
            return r.fecha.substring(5,7) === mesMostrado;
        });

        const totales = {
            total:      paraResumen.reduce((s,r) => s + Number(r.monto), 0),
            diezmos:    paraResumen.filter(r => r.tipo === 'Diezmo de Miembro').reduce((s,r) => s + Number(r.monto), 0),
            ofrendas:   paraResumen.filter(r => r.tipo.includes('Ofrenda')).reduce((s,r) => s + Number(r.monto), 0),
            donaciones: paraResumen.filter(r => r.tipo === 'Donación Especial').reduce((s,r) => s + Number(r.monto), 0),
        };

        const cards = document.querySelectorAll('#vista-finanzas .resumen-monto');
        if (cards.length >= 4) {
            cards[0].textContent = `$${totales.total.toLocaleString('es-CL')}`;
            cards[1].textContent = `$${totales.diezmos.toLocaleString('es-CL')}`;
            cards[2].textContent = `$${totales.ofrendas.toLocaleString('es-CL')}`;
            cards[3].textContent = `$${totales.donaciones.toLocaleString('es-CL')}`;
        }

        const label = document.querySelector('#vista-finanzas .resumen-label');
        if (label) label.textContent = mes ? MESES[parseInt(mes)] : 'Este Mes';

        if (total === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No hay registros para este período</td></tr>`;
            return;
        }

        tbody.innerHTML = slice.map(r => `
            <tr>
                        <td>${sanitizar(r.tipo)}</td>
                <td class="monto-cell">$${Number(r.monto).toLocaleString('es-CL')}</td>
                <td>${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                        <td>${sanitizar(r.nombre_servicio || '—')}</td>
                        <td><button class="btn-table" onclick="verDetalleIngresoPorId('${sanitizar(r.id)}')">Ver</button></td>
            </tr>`).join('');
    }

    window.toggleAsociacion = async valor => {
        const bloque = $('bloque-asociacion');
        if (!bloque) return;
        if (valor === 'Diezmo de Miembro') {
            bloque.classList.remove('hidden');
            $('tipo-asociacion').value = 'individual';
            await cargarOpcionesAsociacion('individual');
        } else {
            bloque.classList.add('hidden');
            $('select-asociacion').innerHTML = '<option value="">Selecciona...</option>';
        }
        const fechaServicio = $('fecha-servicio')?.value;
        if (fechaServicio) window.detectarServicio(fechaServicio);
    };

    window.cargarOpcionesAsociacion = async tipo => {
        const select = $('select-asociacion');
        const label  = $('label-asociacion');
        if (!select) return;
        select.innerHTML = '<option value="">Cargando...</option>';
        try {
            if (tipo === 'individual') {
                if (label) label.textContent = 'Miembro';
                const data   = await apiFetch('/api/miembros');
                const activos = (data.miembros || []).filter(m => m.activo);
                select.innerHTML = '<option value="">Sin asociar (anónimo)</option>' +
                    activos.map(m => `<option value="miembro:${m.id}">${m.nombre}</option>`).join('');
            } else {
                if (label) label.textContent = 'Grupo Familiar';
                const data    = await apiFetch('/api/familias');
                const familias = data.familias || [];
                select.innerHTML = '<option value="">Sin asociar</option>' +
                    familias.map(f => `<option value="familia:${f.id}">${f.nombre}</option>`).join('');
            }
        } catch (err) { select.innerHTML = '<option value="">Error cargando opciones</option>'; }
    };

    window.detectarServicio = fecha => {
        if (!fecha) return;
        const fechaLocal = new Date(fecha + 'T12:00:00');
        const dia    = fechaLocal.getDay();
        const fechaF = fechaLocal.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
        const esPrimerDomingo = dia === 0 && fechaLocal.getDate() <= 7;
        const esDiezmo = $('tipo-ingreso')?.value === 'Diezmo de Miembro';
        const mesActual = MESES[fechaLocal.getMonth() + 1];
        const nombres = { 3: `Reunión Mitad de Semana ${fechaF}`, 0: `Servicio General ${fechaF}`, 5: `Evento Especial ${fechaF}`, 6: `Evento Especial ${fechaF}` };
        const input  = $('nombre-servicio-detectado');
        if (input) {
            input.value = esPrimerDomingo && esDiezmo
                ? `Diezmo de Santa Cena · ${mesActual} ${fechaLocal.getFullYear()}`
                : nombres[dia] || `Fuera de Servicio ${fechaF}`;
        }
    };

    window.registrarIngreso = async e => {
        e.preventDefault();
        const monto          = parseInt($('monto-ingreso')?.value ?? '0');
        const tipo           = $('tipo-ingreso')?.value ?? '';
        const fechaServicio  = $('fecha-servicio')?.value ?? '';
        const nombreServicio = $('nombre-servicio-detectado')?.value ?? '';
        const observaciones  = $('observaciones-ingreso')?.value ?? '';

        if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'error');
        if (!fechaServicio)       return toast('Selecciona la fecha del servicio', 'error');

        const hoyChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).toISOString().split('T')[0];
        if (fechaServicio > hoyChile) {
            const continuar = await new Promise(resolve => {
                const modal = $('modal-fecha-futura');
                const btnOk = $('modal-fecha-confirmar');
                const btnCx = $('modal-fecha-cancelar');
                modal.classList.remove('hidden');
                btnOk.onclick = () => { modal.classList.add('hidden'); resolve(true);  };
                btnCx.onclick = () => { modal.classList.add('hidden'); resolve(false); };
            });
            if (!continuar) return;
        }

        try {
            const u           = getUsuario();
            const asociacion  = $('select-asociacion')?.value || '';
            const miembro_id  = asociacion.startsWith('miembro:') ? asociacion.split(':')[1] : null;
            const familia_id  = asociacion.startsWith('familia:') ? asociacion.split(':')[1] : null;
            const sel         = $('select-asociacion');
            const asoc_nombre = sel?.options[sel.selectedIndex]?.text || null;

            await apiFetch('/api/finanzas', {
                method: 'POST',
                body:   JSON.stringify({
                    tipo, monto,
                    fecha:           fechaServicio,
                    nombre_servicio: nombreServicio || 'Fuera de Servicio',
                    observaciones:   observaciones || null,
                    registrado_por:  u.id,
                    miembro_id:      miembro_id || null,
                    familia_id:      familia_id || null,
                    asociado_nombre: asoc_nombre !== 'Sin asociar (anónimo)' && asoc_nombre !== 'Sin asociar' ? asoc_nombre : null
                })
            });

            toast(`$${monto.toLocaleString('es-CL')} registrado ✓`, 'success');
            e.target.reset();
            $('bloque-asociacion').classList.add('hidden');
            $('tipo-asociacion').value = 'individual';
            $('select-asociacion').innerHTML = '<option value="">Selecciona...</option>';
            cargarFinanzas();

        } catch (err) { toast(err.message || 'Error al registrar', 'error'); }
    };

    window.verDetalleIngreso = r => {
        const fecha  = r.fecha      ? r.fecha.split('-').reverse().join('/') : '—';
        const creado = r.created_at ? (() => { const d = new Date(r.created_at); d.setHours(d.getHours() - 3); return d.toLocaleString('es-CL'); })() : '—';
        const contenido = $('modal-detalle-contenido');
        if (!contenido) return;
        contenido.innerHTML = `
            <div style="display:grid;gap:12px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">TIPO</div><div style="font-weight:700;font-size:14px;">${sanitizar(r.tipo)}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">MONTO</div><div style="font-weight:700;font-size:14px;color:#10b981;">$${Number(r.monto).toLocaleString('es-CL')}</div></div>
                </div>
                <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">SERVICIO</div><div style="font-weight:600;font-size:14px;">${sanitizar(r.nombre_servicio || '—')}</div></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA</div><div style="font-weight:600;font-size:14px;">${fecha}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">REGISTRADO</div><div style="font-weight:600;font-size:13px;">${creado}</div></div>
                </div>
                ${r.tipo === 'Diezmo de Miembro' ? `<div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">CORRESPONDE A</div><div style="font-weight:600;font-size:14px;">${sanitizar(r.asociado_nombre || 'Anónimo')}</div></div>` : ''}
                <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;">OBSERVACIONES</div><div style="font-size:14px;line-height:1.5;color:${r.observaciones ? 'var(--text)' : 'var(--muted)'};">${sanitizar(r.observaciones || 'Sin observaciones')}</div></div>
            </div>`;
        $('modal-detalle').classList.remove('hidden');
    };

    // ============================================================
    // MÓDULO EGRESOS
    // ============================================================
    let egresosTodos = [];
    const ITEMS_CATEGORIA = {
        'Arriendo local':'Infraestructura','Electricidad':'Infraestructura','Agua':'Infraestructura',
        'Internet':'Infraestructura','Gas':'Infraestructura','Aporte pastoral':'Pastoral',
        'Transporte pastoral':'Pastoral','Materiales de oficina':'Operacional','Insumos café / té':'Operacional',
        'Impresiones':'Operacional','Ministerio de niños':'Ministerial','Ministerio de jóvenes':'Ministerial',
        'Escuela bíblica':'Ministerial','Software de Presentación':'Tecnología','Música y Pistas':'Tecnología',
        'Hosting / Dominio':'Tecnología','Plataformas digitales':'Tecnología','Otro':'Otro',
    };

    const BADGE_COLOR = {
        'Infraestructura':'#3b82f6','Pastoral':'#8b5cf6','Operacional':'#f59e0b',
        'Ministerial':'#10b981','Tecnología':'#06b6d4','Otro':'#6b7280',
    };

    let egresosMesActual = [];

    window.actualizarResumenCategoriaEgreso = () => {
        const categoria = $('egreso-categoria-resumen')?.value || '';
        const total = categoria
            ? egresosMesActual.filter(r => r.categoria === categoria).reduce((s, r) => s + Number(r.monto), 0)
            : null;
        const salida = $('egreso-categoria-total');
        if (salida) salida.textContent = total === null ? '—' : `-$${total.toLocaleString('es-CL')}`;
    };

    window.verDetalleIngresoPorId = id => {
        const registro = finanzasTodos.find(item => String(item.id) === String(id));
        if (!registro) return toast('No fue posible encontrar el registro', 'error');
        window.verDetalleIngreso(registro);
    };

    window.detectarCategoriaEgreso = valor => {
        const cat = ITEMS_CATEGORIA[valor] || 'Otro';
        const input = $('categoria-egreso');
        if (input) input.value = cat;
        const bloqueOtro = $('bloque-otro-egreso');
        if (bloqueOtro) bloqueOtro.style.display = valor === 'Otro' ? 'block' : 'none';
    };

    async function cargarEgresos() {
        try {
            const data    = await apiFetch('/api/egresos');
            const egresos = data.egresos || [];
            egresosTodos = egresos;

            const contador = $('egresos-contador');
            if (contador) contador.textContent = `${egresos.length} registros`;

            const mesActual  = String(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getMonth() + 1).padStart(2, '0');
            const anioActual = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getFullYear().toString();
            const delMes     = egresos.filter(r => r.fecha && r.fecha.startsWith(anioActual) && r.fecha.substring(5,7) === mesActual);

            egresosMesActual = delMes;

            const totalMes = delMes.reduce((s,r) => s + Number(r.monto), 0);
            const infra    = delMes.filter(r => r.categoria === 'Infraestructura').reduce((s,r) => s + Number(r.monto), 0);
            const tech     = delMes.filter(r => r.categoria === 'Tecnología').reduce((s,r) => s + Number(r.monto), 0);

            const eTotal = $('egreso-total');
            const eInfra = $('egreso-infraestructura');
            const eTech  = $('egreso-tecnologia');

            if (eTotal) eTotal.textContent = `-$${totalMes.toLocaleString('es-CL')}`;
            if (eInfra) eInfra.textContent = `-$${infra.toLocaleString('es-CL')}`;
            if (eTech)  eTech.textContent  = `-$${tech.toLocaleString('es-CL')}`;
            const selectorCategoria = $('egreso-categoria-resumen');
            if (selectorCategoria) selectorCategoria.value = '';
            window.actualizarResumenCategoriaEgreso();

            const tbody = $('tabla-egresos');
            if (!tbody) return;

            if (egresos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No hay egresos registrados aún</td></tr>`;
                return;
            }

            tbody.innerHTML = egresos.map(r => `
                <tr>
                    <td>${r.proveedor ? `${sanitizar(r.item)} <span style="font-size:11px;color:var(--muted);">(${sanitizar(r.proveedor)})</span>` : sanitizar(r.item)}</td>
                    <td><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${BADGE_COLOR[r.categoria] || '#6b7280'}22;color:${BADGE_COLOR[r.categoria] || '#6b7280'};font-weight:600;">${sanitizar(r.categoria)}</span></td>
                    <td style="color:#ef4444;font-weight:600;">-$${Number(r.monto).toLocaleString('es-CL')}</td>
                    <td>${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                    <td><button class="btn-table" onclick="verDetalleEgresoPorId('${sanitizar(r.id)}')">Ver</button></td>
                </tr>`).join('');

        } catch (err) { toast('Error cargando egresos', 'error'); }
    }

    window.registrarEgreso = async e => {
        e.preventDefault();
        const itemSelect = $('item-egreso')?.value;
        const itemOtro   = $('item-otro-egreso')?.value.trim();
        const item       = itemSelect === 'Otro' ? (itemOtro || 'Otro') : itemSelect;
        const categoria  = $('categoria-egreso')?.value || ITEMS_CATEGORIA[item] || 'Otro';
        const proveedor  = $('proveedor-egreso')?.value.trim();
        const monto      = parseInt($('monto-egreso')?.value ?? '0');
        const fecha      = $('fecha-egreso')?.value;
        const obs        = $('observaciones-egreso')?.value;

        if (!monto || monto <= 0) return toast('Ingresa un monto válido', 'error');
        if (!fecha)               return toast('Selecciona la fecha', 'error');

        try {
            const u = getUsuario();
            await apiFetch('/api/egresos', {
                method: 'POST',
                body:   JSON.stringify({ item, categoria, proveedor: proveedor || null, monto, fecha, observaciones: obs || null, registrado_por: u.id })
            });
            toast('Egreso registrado ✓', 'success');
            e.target.reset();
            $('categoria-egreso').value = '';
            $('bloque-otro-egreso').style.display = 'none';
            cargarEgresos();
        } catch (err) { toast(err.message || 'Error al registrar', 'error'); }
    };

    window.verDetalleEgreso = r => {
        const fecha  = r.fecha      ? r.fecha.split('-').reverse().join('/') : '—';
        const creado = r.created_at ? (() => { const d = new Date(r.created_at); d.setHours(d.getHours() - 3); return d.toLocaleString('es-CL'); })() : '—';
        const contenido = $('modal-detalle-contenido');
        if (!contenido) return;
        contenido.innerHTML = `
            <div class="detalle-egreso" style="display:grid;gap:12px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">ÍTEM</div><div style="font-weight:700;font-size:14px;">${sanitizar(r.item)}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">MONTO</div><div style="font-weight:700;font-size:14px;color:#ef4444;">-$${Number(r.monto).toLocaleString('es-CL')}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">CATEGORÍA</div><div style="font-weight:600;font-size:14px;">${sanitizar(r.categoria)}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">PROVEEDOR</div><div style="font-weight:600;font-size:14px;">${sanitizar(r.proveedor || '—')}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA</div><div style="font-weight:600;font-size:14px;">${fecha}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">REGISTRADO</div><div style="font-weight:600;font-size:13px;">${creado}</div></div>
                </div>
                <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;">OBSERVACIONES</div><div style="font-size:14px;line-height:1.5;color:${r.observaciones ? 'var(--text)' : 'var(--muted)'};">${sanitizar(r.observaciones || 'Sin observaciones')}</div></div>
            </div>`;
        $('modal-detalle').classList.remove('hidden');
    };

    // ============================================================
    // DASHBOARD / REPORTES
    // ============================================================
    let chartBarras     = null;
    let chartCategorias = null;

    async function cargarReporte() {
        try {
            const anioActual = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getFullYear().toString();
            const mesActual  = String(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getMonth() + 1).padStart(2, '0');

            const selAnio = $('dash-anio');
            const selMes  = $('dash-mes');

            if (selAnio && !selAnio.innerHTML) {
                const anios = [];
                for (let a = parseInt(anioActual); a >= parseInt(anioActual) - 3; a--) anios.push(a.toString());
                selAnio.innerHTML = anios.map(a => `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`).join('');
            }
            if (selMes && !selMes.value) selMes.value = mesActual;

            const anio = selAnio?.value || anioActual;
            const mes  = selMes?.value  || '';

            const [dataFinanzas, dataEgresos] = await Promise.all([apiFetch('/api/finanzas'), apiFetch('/api/egresos')]);
            const ingresos = dataFinanzas.registros || [];
            const egresos  = dataEgresos.egresos    || [];

            const filtrarPeriodo = arr => arr.filter(r => {
                if (!r.fecha) return false;
                if (!r.fecha.startsWith(anio)) return false;
                if (mes && r.fecha.substring(5,7) !== mes) return false;
                return true;
            });

            const ingFiltrados = filtrarPeriodo(ingresos);
            const egrFiltrados = filtrarPeriodo(egresos);

            const totalIng  = ingFiltrados.reduce((s,r) => s + Number(r.monto), 0);
            const totalEgr  = egrFiltrados.reduce((s,r) => s + Number(r.monto), 0);
            const saldo     = totalIng - totalEgr;
            const saldoAcum = ingresos.reduce((s,r) => s + Number(r.monto), 0) - egresos.reduce((s,r) => s + Number(r.monto), 0);

            // Comparativa mes anterior
            const mesNum = mes ? parseInt(mes) : null;
            const mesAnt = mesNum && mesNum > 1 ? String(mesNum - 1).padStart(2, '0') : null;
            const ingMesAnt = mesAnt ? ingresos.filter(r => r.fecha?.startsWith(anio) && r.fecha?.substring(5,7) === mesAnt).reduce((s,r) => s + Number(r.monto), 0) : 0;
            const egrMesAnt = mesAnt ? egresos.filter(r => r.fecha?.startsWith(anio) && r.fecha?.substring(5,7) === mesAnt).reduce((s,r) => s + Number(r.monto), 0) : 0;
            const compIng = ingMesAnt > 0 ? ((totalIng - ingMesAnt) / ingMesAnt * 100).toFixed(0) : null;
            const compEgr = egrMesAnt > 0 ? ((totalEgr - egrMesAnt) / egrMesAnt * 100).toFixed(0) : null;

            // Métricas
            $('dash-total-ingresos').textContent = `$${totalIng.toLocaleString('es-CL')}`;
            $('dash-total-egresos').textContent  = `-$${totalEgr.toLocaleString('es-CL')}`;
            $('dash-saldo').textContent          = `${saldo >= 0 ? '' : '-'}$${Math.abs(saldo).toLocaleString('es-CL')}`;
            $('dash-saldo').style.color          = saldo >= 0 ? '#10b981' : '#ef4444';
            $('dash-saldo-acumulado').textContent = `${saldoAcum >= 0 ? '' : '-'}$${Math.abs(saldoAcum).toLocaleString('es-CL')}`;
            $('dash-saldo-acumulado').style.color = saldoAcum >= 0 ? '#10b981' : '#ef4444';

            const compIngEl = $('dash-comp-ingresos');
            const compEgrEl = $('dash-comp-egresos');
            if (compIngEl) compIngEl.textContent = compIng !== null ? `${compIng >= 0 ? '↑' : '↓'} ${Math.abs(compIng)}% vs mes anterior` : '';
            if (compEgrEl) compEgrEl.textContent = compEgr !== null ? `${compEgr >= 0 ? '↑' : '↓'} ${Math.abs(compEgr)}% vs mes anterior` : '';

            // Alerta déficit
            const alerta = $('dash-alerta');
            if (saldo < 0) {
                $('dash-alerta-texto').textContent = `Los egresos superan los ingresos en $${Math.abs(saldo).toLocaleString('es-CL')} este período`;
                alerta.classList.remove('hidden');
            } else {
                alerta.classList.add('hidden');
            }

            // Gráfico barras por mes
            const mesesLabels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            const ingPorMes   = Array(12).fill(0);
            const egrPorMes   = Array(12).fill(0);
            ingresos.filter(r => r.fecha?.startsWith(anio)).forEach(r => { ingPorMes[parseInt(r.fecha.substring(5,7)) - 1] += Number(r.monto); });
            egresos.filter(r => r.fecha?.startsWith(anio)).forEach(r => { egrPorMes[parseInt(r.fecha.substring(5,7)) - 1] += Number(r.monto); });

            if (chartBarras) chartBarras.destroy();
            const ctxB = $('chart-barras')?.getContext('2d');
            if (ctxB) {
                chartBarras = new Chart(ctxB, {
                    type: 'bar',
                    data: {
                        labels: mesesLabels,
                        datasets: [
                            { label: 'Ingresos', data: ingPorMes, backgroundColor: '#10b981', borderRadius: 4 },
                            { label: 'Egresos',  data: egrPorMes, backgroundColor: '#ef4444', borderRadius: 4 }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
                        scales: {
                            y: { ticks: { display: !window.matchMedia('(max-width: 640px)').matches, callback: v => `$${(v/1000).toFixed(0)}k`, font: { size: 10 } } },
                            x: { ticks: { font: { size: 10 } } }
                        }
                    }
                });
            }

            // Gráfico torta ingresos vs egresos
            if (chartCategorias) chartCategorias.destroy();
            const ctxC = $('chart-categorias')?.getContext('2d');
            if (ctxC) {
                chartCategorias = new Chart(ctxC, {
                    type: 'doughnut',
                    data: {
                        labels: ['Ingresos', 'Egresos'],
                        datasets: [{ data: [totalIng, totalEgr], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }
                    }
                });
            }

            // Tabla separada ingresos / egresos
            const tbody = $('tabla-movimientos');
            const ingOrdenados = [...ingFiltrados].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));
            const egrOrdenados = [...egrFiltrados].sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''));

            $('dash-movimientos-total').textContent = `${ingFiltrados.length + egrFiltrados.length} movimientos`;

            if (ingFiltrados.length === 0 && egrFiltrados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No hay movimientos para este período</td></tr>`;
            } else {
                tbody.innerHTML = `
                    <tr><td colspan="5" style="background:var(--paper);font-size:11px;font-weight:700;color:var(--muted);padding:8px 16px;letter-spacing:0.05em;">INGRESOS</td></tr>
                    ${ingOrdenados.length === 0
                        ? `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:12px 16px;font-size:13px;">Sin ingresos en este período</td></tr>`
                        : ingOrdenados.map(r => `
                            <tr class="movimiento-fila">
                                <td class="movimiento-tipo"><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#d1fae5;color:#065f46;font-weight:600;">Ingreso</span></td>
                                <td class="movimiento-descripcion">${r.tipo || '—'} ${r.asociado_nombre ? `<span class="movimiento-desktop-detalle" style="font-size:11px;color:var(--muted);">(${r.asociado_nombre})</span>` : ''}<span class="movimiento-mobile-meta">${r.asociado_nombre || r.nombre_servicio || 'Sin asociación'} · ${r.fecha ? r.fecha.split('-').reverse().join('/') : 'Sin fecha'}</span></td>
                                <td class="movimiento-monto" style="font-weight:600;color:#10b981;">+$${Number(r.monto).toLocaleString('es-CL')}</td>
                                <td class="movimiento-fecha">${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                                <td class="movimiento-categoria">${r.nombre_servicio || '—'}</td>
                            </tr>`).join('')
                    }
                    <tr><td colspan="5" style="background:var(--paper);font-size:11px;font-weight:700;color:var(--muted);padding:8px 16px;letter-spacing:0.05em;">EGRESOS</td></tr>
                    ${egrOrdenados.length === 0
                        ? `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:12px 16px;font-size:13px;">Sin egresos en este período</td></tr>`
                        : egrOrdenados.map(r => `
                            <tr class="movimiento-fila">
                                <td class="movimiento-tipo"><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#fee2e2;color:#991b1b;font-weight:600;">Egreso</span></td>
                                <td class="movimiento-descripcion">${r.item || '—'} ${r.proveedor ? `<span class="movimiento-desktop-detalle" style="font-size:11px;color:var(--muted);">(${r.proveedor})</span>` : ''}<span class="movimiento-mobile-meta">${r.proveedor || r.categoria || 'Sin detalle'} · ${r.fecha ? r.fecha.split('-').reverse().join('/') : 'Sin fecha'}</span></td>
                                <td class="movimiento-monto" style="font-weight:600;color:#ef4444;">-$${Number(r.monto).toLocaleString('es-CL')}</td>
                                <td class="movimiento-fecha">${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                                <td class="movimiento-categoria">${r.categoria || '—'}</td>
                            </tr>`).join('')
                    }`;
            }

        } catch (err) {
            console.error('Error cargando reporte:', err);
            toast('Error cargando dashboard', 'error');
        }
    }

    $('dash-anio')?.addEventListener('change', cargarReporte);
    $('dash-mes')?.addEventListener('change', cargarReporte);

    // ============================================================
    // EXPORTAR EXCEL
    // ============================================================
    window.exportarExcel = async () => {
        try {
            if (typeof XLSX === 'undefined') { toast('Cargando librería Excel...', 'success'); return; }

            const [dataFinanzas, dataEgresos] = await Promise.all([apiFetch('/api/finanzas'), apiFetch('/api/egresos')]);
            const ingresos = dataFinanzas.registros || [];
            const egresos  = dataEgresos.egresos    || [];

            const anio = $('dash-anio')?.value || '';
            const mes  = $('dash-mes')?.value  || '';

            const filtrar = arr => arr.filter(r => {
                if (!r.fecha) return false;
                if (anio && !r.fecha.startsWith(anio)) return false;
                if (mes  && r.fecha.substring(5,7) !== mes) return false;
                return true;
            });

            const ingFilt = filtrar(ingresos);
            const egrFilt = filtrar(egresos);

            const wb = XLSX.utils.book_new();

            // Hoja 1 — Ingresos
            const wsIng = XLSX.utils.json_to_sheet(ingFilt.map(r => ({
                'Fecha':         r.fecha ? r.fecha.split('-').reverse().join('/') : '',
                'Tipo':          r.tipo || '',
                'Monto ($)':     Number(r.monto),
                'Servicio':      r.nombre_servicio || '',
                'Aportante':     r.asociado_nombre || 'Anónimo',
                'Observaciones': r.observaciones || ''
            })));
            XLSX.utils.book_append_sheet(wb, wsIng, 'Ingresos');

            // Hoja 2 — Egresos
            const wsEgr = XLSX.utils.json_to_sheet(egrFilt.map(r => ({
                'Fecha':         r.fecha ? r.fecha.split('-').reverse().join('/') : '',
                'Ítem':          r.item || '',
                'Categoría':     r.categoria || '',
                'Proveedor':     r.proveedor || '',
                'Monto ($)':     Number(r.monto),
                'Observaciones': r.observaciones || ''
            })));
            XLSX.utils.book_append_sheet(wb, wsEgr, 'Egresos');

            // Hoja 3 — Resumen
            const totalIng = ingFilt.reduce((s,r) => s + Number(r.monto), 0);
            const totalEgr = egrFilt.reduce((s,r) => s + Number(r.monto), 0);
            const catTotales = {};
            egrFilt.forEach(r => { catTotales[r.categoria] = (catTotales[r.categoria] || 0) + Number(r.monto); });

            const resumenData = [
                { 'Concepto': 'INGRESOS TOTALES', 'Monto ($)': totalIng },
                { 'Concepto': 'EGRESOS TOTALES',  'Monto ($)': totalEgr },
                { 'Concepto': 'SALDO',             'Monto ($)': totalIng - totalEgr },
                { 'Concepto': '', 'Monto ($)': '' },
                { 'Concepto': 'DETALLE EGRESOS POR CATEGORÍA', 'Monto ($)': '' },
                ...Object.entries(catTotales).map(([cat, monto]) => ({ 'Concepto': cat, 'Monto ($)': monto }))
            ];
            const wsRes = XLSX.utils.json_to_sheet(resumenData);
            XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

            const periodo = mes ? `${MESES[parseInt(mes)]}_${anio}` : anio;
            XLSX.writeFile(wb, `CasaDeVida_${periodo}.xlsx`);
            toast('Excel descargado ✓', 'success');

        } catch (err) {
            console.error(err);
            toast('Error al exportar Excel', 'error');
        }
    };

    // ============================================================
    // CONTACTO
    // ============================================================
    window.enviarContacto = e => { e.preventDefault(); toast('Mensaje enviado ✓ Te responderemos pronto', 'success'); e.target.reset(); };

    // ============================================================
    // SCROLL
    // ============================================================
    window.scrollToSection = id => {
        const mostrarSeccion = () => {
            const el = $(id);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        if (!vistaCreemos?.classList.contains('hidden')) {
            volverAlHomePublico(false);
            history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            window.requestAnimationFrame(mostrarSeccion);
            return;
        }

        mostrarSeccion();
    };

    window.verDetalleEgresoPorId = id => {
        const registro = egresosTodos.find(item => String(item.id) === String(id));
        if (!registro) return toast('No fue posible encontrar el egreso', 'error');
        window.verDetalleEgreso(registro);
    };

    // ============================================================
    // TOASTS
    // ============================================================
    function toast(msg, tipo = 'success') {
        let c = $('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.style.cssText = 'position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:10px;z-index:12000;';
            const s = document.createElement('style');
            s.textContent = `.toast{display:flex;align-items:center;gap:10px;background:#0f172a;color:white;padding:12px 18px;border-radius:10px;font-size:13.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s;max-width:320px;font-family:'Montserrat',sans-serif;}.toast.show{opacity:1;transform:translateY(0);}.toast.success{border-left:3px solid #10b981;}.toast.error{border-left:3px solid #ef4444;}`;
            document.head.appendChild(s);
            document.body.appendChild(c);
        }
        const t = document.createElement('div');
        t.className = `toast ${tipo}`;
        t.innerHTML = `<span>${tipo === 'success' ? '✓' : '⚠'}</span><span>${sanitizar(msg)}</span>`;
        c.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
    }

    // ============================================================
    // INIT
    // ============================================================
    const hoyChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(el => {
        if (el.id === 'persona-fecha-nacimiento') {
            el.max = hoyChile;
            return;
        }
        if (el.id === 'acuerdo-fecha') return;
        if (!el.value) el.value = hoyChile;
    });

});
