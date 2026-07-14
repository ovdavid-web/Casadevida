document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // UTILIDADES
    // ============================================================
    const $ = id => document.getElementById(id);
    const show = el => el && el.classList.remove('hidden');
    const hide = el => el && el.classList.add('hidden');

    const getToken   = () => sessionStorage.getItem('cdv_token');
    const getUsuario = () => JSON.parse(sessionStorage.getItem('cdv_usuario') || '{}');

    const authHeaders = () => ({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${getToken()}`
    });

    async function apiFetch(url, options = {}) {
        const res  = await fetch(url, { headers: authHeaders(), ...options });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error del servidor');
        return data;
    }

    const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // ============================================================
    // ELEMENTOS DEL DOM
    // ============================================================
    const vistaHome      = $('vista-home');
    const vistaLogin     = $('vista-login');
    const vistaDashboard = $('vista-dashboard');
    const navPublica     = $('nav-publica');
    const btnIrLogin     = $('btn-ir-login');
    const btnVolverHome  = $('btn-volver-home');
    const btnIngresar    = $('btn-ingresar');
    const btnCerrar      = $('btn-cerrar-sesion');
    const menuAdmin      = $('menu-admin');
    const menuMiembro    = $('menu-miembro');
    const nombreUsuario  = $('nombre-usuario-activo');
    const rolUsuario     = $('rol-usuario-activo');
    const userAvatar     = $('user-avatar-inicial');

    // ============================================================
    // NAV
    // ============================================================
    btnIrLogin.addEventListener('click', () => {
        show(vistaLogin); hide(vistaHome);
        show(btnVolverHome); hide(btnIrLogin);
    });

    btnVolverHome.addEventListener('click', () => {
        show(vistaHome); hide(vistaLogin);
        hide(btnVolverHome); show(btnIrLogin);
    });

    // ============================================================
    // LOGIN
    // ============================================================
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

            sessionStorage.setItem('cdv_token',   data.token);
            sessionStorage.setItem('cdv_usuario', JSON.stringify(data.usuario));

            const u = data.usuario;
            hide(vistaLogin); hide(navPublica); show(vistaDashboard);
            nombreUsuario.textContent = u.nombre;
            rolUsuario.textContent    = u.rol;
            userAvatar.textContent    = u.nombre.charAt(0).toUpperCase();

            const esAdmin = ['superadmin', 'pastor', 'oficial'].includes(u.rol);
            if (esAdmin) { show(menuAdmin); hide(menuMiembro); cambiarVista('vista-inicio-admin'); }
            else         { hide(menuAdmin); show(menuMiembro); cambiarVista('vista-perfil-miembro'); }

            toast(`Bienvenido, ${u.nombre} 👋`, 'success');

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
    btnCerrar.addEventListener('click', () => {
        sessionStorage.clear();
        hide(vistaDashboard); show(navPublica); show(vistaHome);
        show(btnIrLogin); hide(btnVolverHome);
    });

    // ============================================================
    // ROUTER
    // ============================================================
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => cambiarVista(btn.getAttribute('data-target')));
    });

    function cambiarVista(id) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const t = $(id); if (t) t.classList.remove('hidden');
        const b = document.querySelector(`.nav-btn[data-target="${id}"]`);
        if (b) b.classList.add('active');

        if (id === 'vista-miembros')         cargarMiembros();
        if (id === 'vista-finanzas')         cargarFinanzas();
        if (id === 'vista-finanzas-reporte') cargarReporte();
        if (id === 'vista-egresos')          cargarEgresos();
    }

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

    async function cargarMiembros() {
        try {
            const data = await apiFetch('/api/miembros');
            todosMiembros = data.miembros || [];
            const tbody   = document.querySelector('#vista-miembros .data-table tbody');
            if (!tbody) return;

            const contador = document.querySelector('#vista-miembros .table-count');
            if (contador) contador.textContent = `${data.total} miembros`;

            if (data.total === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No hay miembros registrados aún</td></tr>`;
                return;
            }

            tbody.innerHTML = data.miembros.map(m => `
                <tr>
                    <td><div class="td-name"><div class="mini-av">${m.nombre.substring(0,2).toUpperCase()}</div>${m.nombre}</div></td>
                    <td>${m.area_servicio || '—'}</td>
                    <td><span class="badge ${m.activo ? 'active' : 'inactive'}">${m.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>${m.fecha_ingreso ? m.fecha_ingreso.split('-').reverse().join('/') : '—'}</td>
                    <td><button class="btn-table">Ver</button></td>
                </tr>`).join('');

        } catch (err) { toast('Error cargando miembros', 'error'); }
    }

    window.toggleForm = id => { const f = $(id); if (f) f.classList.toggle('hidden'); };

    window.abrirFormNuevoMiembro = () => {
        cambiarTabDirectorio('miembros');
        const f = $('form-nuevo-miembro');
        if (f) f.classList.remove('hidden');
    };

    window.registrarMiembro = async e => {
        e.preventDefault();
        const inputs  = e.target.querySelectorAll('input, select');
        const payload = {
            nombre:         inputs[0].value.trim(),
            rut:            inputs[1].value.trim(),
            correo:         inputs[2].value.trim(),
            telefono:       inputs[3].value.trim(),
            fecha_bautismo: inputs[4].value || null,
            area_servicio:  inputs[5].value,
        };
        if (!payload.nombre) { toast('El nombre es requerido', 'error'); return; }
        try {
            await apiFetch('/api/miembros', { method: 'POST', body: JSON.stringify(payload) });
            toast(`${payload.nombre} registrado ✓`, 'success');
            e.target.closest('.form-card').classList.add('hidden');
            e.target.reset();
            cargarMiembros();
        } catch (err) { toast(err.message || 'Error al registrar', 'error'); }
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
                    <button class="btn-table" onclick="mostrarAgregarIntegrante('${f.id}', '${f.nombre}')">+ Agregar</button>
                </div>
                ${integrantes.length === 0
                    ? `<div style="padding:12px 20px;color:var(--muted);font-size:13px;">Sin integrantes aún</div>`
                    : integrantes.map(m => `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-top:1px solid var(--border);">
                            <div class="mini-av">${m.nombre.substring(0,2).toUpperCase()}</div>
                            <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${m.nombre}</div><div style="font-size:12px;color:var(--muted);">${m.area_servicio || 'Sin área'}</div></div>
                            <button class="btn-table" style="color:#ef4444;border-color:#ef4444;" onclick="quitarDeFamily('${m.id}', '${f.id}')">Quitar</button>
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
                <div style="flex:1;"><div style="font-size:14px;font-weight:600;">${m.nombre}</div><div style="font-size:12px;color:var(--muted);">${m.area_servicio || 'Sin área'}</div></div>
                <button class="btn-table" onclick="mostrarAsignarFamilia('${m.id}', '${m.nombre}')">Asignar familia</button>
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
                <td>${r.tipo}</td>
                <td class="monto-cell">$${Number(r.monto).toLocaleString('es-CL')}</td>
                <td>${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                <td>${r.nombre_servicio || '—'}</td>
                <td><button class="btn-table" onclick="verDetalleIngreso(${JSON.stringify(r).replace(/"/g, '&quot;')})">Ver</button></td>
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
        const dia    = new Date(fecha + 'T12:00:00').getDay();
        const fechaF = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
        const nombres = { 3: `Reunión Mitad de Semana ${fechaF}`, 0: `Servicio General ${fechaF}`, 5: `Evento Especial ${fechaF}`, 6: `Evento Especial ${fechaF}` };
        const input  = $('nombre-servicio-detectado');
        if (input) input.value = nombres[dia] || `Fuera de Servicio ${fechaF}`;
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
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">TIPO</div><div style="font-weight:700;font-size:14px;">${r.tipo}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">MONTO</div><div style="font-weight:700;font-size:14px;color:#10b981;">$${Number(r.monto).toLocaleString('es-CL')}</div></div>
                </div>
                <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">SERVICIO</div><div style="font-weight:600;font-size:14px;">${r.nombre_servicio || '—'}</div></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA</div><div style="font-weight:600;font-size:14px;">${fecha}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">REGISTRADO</div><div style="font-weight:600;font-size:13px;">${creado}</div></div>
                </div>
                ${r.tipo === 'Diezmo de Miembro' ? `<div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">CORRESPONDE A</div><div style="font-weight:600;font-size:14px;">${r.asociado_nombre || 'Anónimo'}</div></div>` : ''}
                <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;">OBSERVACIONES</div><div style="font-size:14px;line-height:1.5;color:${r.observaciones ? 'var(--text)' : 'var(--muted)'};">${r.observaciones || 'Sin observaciones'}</div></div>
            </div>`;
        $('modal-detalle').classList.remove('hidden');
    };

    // ============================================================
    // MÓDULO EGRESOS
    // ============================================================
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

            const contador = $('egresos-contador');
            if (contador) contador.textContent = `${egresos.length} registros`;

            const mesActual  = String(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getMonth() + 1).padStart(2, '0');
            const anioActual = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).getFullYear().toString();
            const delMes     = egresos.filter(r => r.fecha && r.fecha.startsWith(anioActual) && r.fecha.substring(5,7) === mesActual);

            const totalMes = delMes.reduce((s,r) => s + Number(r.monto), 0);
            const infra    = delMes.filter(r => r.categoria === 'Infraestructura').reduce((s,r) => s + Number(r.monto), 0);
            const pastoral = delMes.filter(r => r.categoria === 'Pastoral').reduce((s,r) => s + Number(r.monto), 0);
            const tech     = delMes.filter(r => r.categoria === 'Tecnología').reduce((s,r) => s + Number(r.monto), 0);

            const eTotal = $('egreso-total');
            const eInfra = $('egreso-infraestructura');
            const ePast  = $('egreso-pastoral');
            const eTech  = $('egreso-tecnologia');

            if (eTotal) eTotal.textContent = `-$${totalMes.toLocaleString('es-CL')}`;
            if (eInfra) eInfra.textContent = `-$${infra.toLocaleString('es-CL')}`;
            if (ePast)  ePast.textContent  = `-$${pastoral.toLocaleString('es-CL')}`;
            if (eTech)  eTech.textContent  = `-$${tech.toLocaleString('es-CL')}`;

            const tbody = $('tabla-egresos');
            if (!tbody) return;

            if (egresos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No hay egresos registrados aún</td></tr>`;
                return;
            }

            tbody.innerHTML = egresos.map(r => `
                <tr>
                    <td>${r.proveedor ? `${r.item} <span style="font-size:11px;color:var(--muted);">(${r.proveedor})</span>` : r.item}</td>
                    <td><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${BADGE_COLOR[r.categoria] || '#6b7280'}22;color:${BADGE_COLOR[r.categoria] || '#6b7280'};font-weight:600;">${r.categoria}</span></td>
                    <td style="color:#ef4444;font-weight:600;">-$${Number(r.monto).toLocaleString('es-CL')}</td>
                    <td>${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                    <td><button class="btn-table" onclick="verDetalleEgreso(${JSON.stringify(r).replace(/"/g, '&quot;')})">Ver</button></td>
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
            <div style="display:grid;gap:12px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">ÍTEM</div><div style="font-weight:700;font-size:14px;">${r.item}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">MONTO</div><div style="font-weight:700;font-size:14px;color:#ef4444;">-$${Number(r.monto).toLocaleString('es-CL')}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">CATEGORÍA</div><div style="font-weight:600;font-size:14px;">${r.categoria}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">PROVEEDOR</div><div style="font-weight:600;font-size:14px;">${r.proveedor || '—'}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">FECHA</div><div style="font-weight:600;font-size:14px;">${fecha}</div></div>
                    <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:4px;">REGISTRADO</div><div style="font-weight:600;font-size:13px;">${creado}</div></div>
                </div>
                <div style="background:var(--paper);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--muted);margin-bottom:6px;">OBSERVACIONES</div><div style="font-size:14px;line-height:1.5;color:${r.observaciones ? 'var(--text)' : 'var(--muted)'};">${r.observaciones || 'Sin observaciones'}</div></div>
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
                        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
                        scales: {
                            y: { ticks: { callback: v => `$${(v/1000).toFixed(0)}k`, font: { size: 10 } } },
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
                            <tr>
                                <td><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#d1fae5;color:#065f46;font-weight:600;">Ingreso</span></td>
                                <td>${r.tipo || '—'} ${r.asociado_nombre ? `<span style="font-size:11px;color:var(--muted);">(${r.asociado_nombre})</span>` : ''}</td>
                                <td style="font-weight:600;color:#10b981;">+$${Number(r.monto).toLocaleString('es-CL')}</td>
                                <td>${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                                <td>${r.nombre_servicio || '—'}</td>
                            </tr>`).join('')
                    }
                    <tr><td colspan="5" style="background:var(--paper);font-size:11px;font-weight:700;color:var(--muted);padding:8px 16px;letter-spacing:0.05em;">EGRESOS</td></tr>
                    ${egrOrdenados.length === 0
                        ? `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:12px 16px;font-size:13px;">Sin egresos en este período</td></tr>`
                        : egrOrdenados.map(r => `
                            <tr>
                                <td><span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#fee2e2;color:#991b1b;font-weight:600;">Egreso</span></td>
                                <td>${r.proveedor ? `${r.item} <span style="font-size:11px;color:var(--muted);">(${r.proveedor})</span>` : (r.item || '—')}</td>
                                <td style="font-weight:600;color:#ef4444;">-$${Number(r.monto).toLocaleString('es-CL')}</td>
                                <td>${r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                                <td>${r.categoria || '—'}</td>
                            </tr>`).join('')
                    }`;
            }

        } catch (err) {
            console.error('Error cargando reporte:', err);
            toast('Error cargando dashboard', 'error');
        }
    }

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
    window.scrollToSection = id => { const el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

    // ============================================================
    // TOASTS
    // ============================================================
    function toast(msg, tipo = 'success') {
        let c = $('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            c.style.cssText = 'position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:10px;z-index:9999;';
            const s = document.createElement('style');
            s.textContent = `.toast{display:flex;align-items:center;gap:10px;background:#0f172a;color:white;padding:12px 18px;border-radius:10px;font-size:13.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s;max-width:320px;font-family:'Montserrat',sans-serif;}.toast.show{opacity:1;transform:translateY(0);}.toast.success{border-left:3px solid #10b981;}.toast.error{border-left:3px solid #ef4444;}`;
            document.head.appendChild(s);
            document.body.appendChild(c);
        }
        const t = document.createElement('div');
        t.className = `toast ${tipo}`;
        t.innerHTML = `<span>${tipo === 'success' ? '✓' : '⚠'}</span><span>${msg}</span>`;
        c.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
    }

    // ============================================================
    // INIT
    // ============================================================
    const hoyChile = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })).toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(el => { if (!el.value) el.value = hoyChile; });

});