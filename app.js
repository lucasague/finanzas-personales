import * as C from './calc.js';

const BUILD = 'ae924d581b';
const CLAVE_DATOS = 'finanzas.datos.v1';
const $ = (sel) => document.querySelector(sel);

let datos = cargar();
let mes = C.claveMes(C.hoyISO());
let vista = 'resumen';
let editandoMov = null; // id del movimiento en edición, o null si es nuevo
let editandoCat = null; // id de la categoría en edición, o null si es nueva
let ultimaCategoria = { gasto: null, ingreso: null };

// ---------- Almacenamiento (solo en este dispositivo) ----------

function cargar() {
  try {
    const raw = localStorage.getItem(CLAVE_DATOS);
    if (raw) {
      const r = C.validarCopia(JSON.parse(raw));
      if (r.ok) return r.datos;
    }
  } catch (e) { /* almacenamiento bloqueado o dañado: empezamos de cero */ }
  return C.datosIniciales();
}

function guardar() {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
    return true;
  } catch (e) {
    aviso('No he podido guardar en este móvil. Revisa que no estés en modo privado.');
    return false;
  }
}

// ---------- Utilidades ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (c) => C.formatoMoneda(c, datos.moneda);
const categoria = (id) => datos.categorias.find((c) => c.id === id)
  || { id: null, emoji: '❔', nombre: 'Sin categoría', tipo: 'gasto', presupuesto: null };

let temporizadorAviso;
function aviso(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { t.hidden = true; }, 2600);
}

function confirmar({ titulo, texto, si = 'Sí', peligro = true }) {
  const dlg = $('#dlg-confirmar');
  $('#conf-titulo').textContent = titulo;
  $('#conf-texto').textContent = texto;
  const botonSi = $('#conf-si');
  botonSi.textContent = si;
  botonSi.className = 'boton ' + (peligro ? 'peligro' : 'principal');
  return new Promise((resolver) => {
    let hecho = false;
    const terminar = (si) => {
      if (hecho) return;
      hecho = true;
      dlg.removeEventListener('click', alPulsar);
      dlg.removeEventListener('close', alCerrar);
      if (dlg.open) dlg.close();
      resolver(si);
    };
    const alPulsar = (e) => {
      const r = e.target.closest('[data-respuesta]');
      if (r) terminar(r.dataset.respuesta === 'si');
    };
    const alCerrar = () => terminar(false); // Esc o botón atrás: cuenta como "no"
    dlg.addEventListener('click', alPulsar);
    dlg.addEventListener('close', alCerrar);
    dlg.showModal();
  });
}

// ---------- Pintar ----------

function pintar() {
  $('#nombre-mes').textContent = C.nombreMes(mes);
  $('#selector-mes').style.visibility = vista === 'ajustes' ? 'hidden' : 'visible';
  $('.fab').hidden = vista === 'ajustes';
  for (const v of ['resumen', 'movimientos', 'ajustes']) {
    $(`#vista-${v}`).hidden = v !== vista;
    const boton = document.querySelector(`.barra [data-vista="${v}"]`);
    if (v === vista) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  }
  if (vista === 'resumen') pintarResumen();
  if (vista === 'movimientos') pintarMovimientos();
  if (vista === 'ajustes') pintarAjustes();
}

function pintarResumen() {
  const r = C.resumenMes(datos.movimientos, mes);
  const filas = C.gastoPorCategoria(datos.movimientos, mes, datos.categorias);
  const hayMovs = datos.movimientos.some((m) => C.claveMes(m.fecha) === mes);

  let html = `
    <div class="tarjeta saldo">
      <div class="etiqueta">Te queda este mes</div>
      <div class="cifra ${r.saldo < 0 ? 'negativo' : ''}">${esc(dinero(r.saldo))}</div>
      <div class="totales">
        <div><span class="t-etq">Ingresos</span><span class="t-val ingreso">${esc(dinero(r.ingresos))}</span></div>
        <div><span class="t-etq">Gastos</span><span class="t-val gasto">${esc(dinero(r.gastos))}</span></div>
      </div>
    </div>`;

  if (!hayMovs && !filas.length) {
    html += `<div class="tarjeta vacio"><span class="grande" aria-hidden="true">🌱</span>
      Aún no hay nada apuntado en ${esc(C.nombreMes(mes).toLowerCase())}.<br>Dale al <strong>+</strong> para apuntar tu primer gasto.</div>`;
  } else {
    html += `<div class="tarjeta"><h2>¿En qué se va?</h2>`;
    if (!filas.length) html += `<p class="subtitulo">Este mes solo hay ingresos.</p>`;
    for (const f of filas) {
      const pct = Math.min(100, Math.round(f.fraccion * 100));
      let clase = '';
      let nota = '';
      if (f.presupuesto != null) {
        if (f.restante < 0) { clase = 'pasado'; nota = `Te has pasado ${dinero(-f.restante)} de ${dinero(f.presupuesto)}`; }
        else {
          if (f.fraccion >= 0.8) clase = 'cerca';
          nota = `Quedan ${dinero(f.restante)} de ${dinero(f.presupuesto)}`;
        }
      }
      html += `
        <div class="cat-fila">
          <div class="cat-linea">
            <span class="cat-nombre">${esc(f.categoria.emoji)} ${esc(f.categoria.nombre)}</span>
            <span class="cat-importe">${esc(dinero(f.gastado))}</span>
          </div>
          <div class="barra-fondo" role="img" aria-label="${esc(f.presupuesto != null ? `${pct}% del presupuesto` : `${pct}% del mayor gasto`)}">
            <div class="barra-relleno ${clase}" style="width:${pct}%"></div>
          </div>
          ${nota ? `<div class="cat-nota ${clase === 'pasado' ? 'pasado' : ''}">${esc(nota)}</div>` : ''}
        </div>`;
    }
    html += `</div>`;
  }
  $('#vista-resumen').innerHTML = html;
}

function pintarMovimientos() {
  const lista = C.movimientosDelMes(datos.movimientos, mes);
  if (!lista.length) {
    $('#vista-movimientos').innerHTML = `<div class="tarjeta vacio"><span class="grande" aria-hidden="true">📭</span>
      No hay movimientos en ${esc(C.nombreMes(mes).toLowerCase())}.</div>`;
    return;
  }
  let html = '';
  let diaActual = '';
  for (const m of lista) {
    if (m.fecha !== diaActual) {
      if (diaActual) html += `</ul>`;
      diaActual = m.fecha;
      html += `<h3 class="dia">${esc(C.fechaDMA(m.fecha))}</h3><ul class="lista">`;
    }
    const c = categoria(m.categoria);
    const signo = m.tipo === 'ingreso' ? '+' : '−';
    html += `<li><button type="button" class="mov" data-accion="editar-mov" data-id="${esc(m.id)}">
      <span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>
      <span class="texto">
        <span class="titulo">${esc(m.nota || c.nombre)}</span>
        <span class="detalle">${esc(m.nota ? c.nombre : (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'))}</span>
      </span>
      <span class="importe ${m.tipo}">${signo}${esc(dinero(m.importe))}</span>
    </button></li>`;
  }
  html += `</ul>`;
  $('#vista-movimientos').innerHTML = html;
}

function pintarAjustes() {
  const opciones = Object.entries(C.MONEDAS)
    .map(([cod, m]) => `<option value="${cod}" ${cod === datos.moneda ? 'selected' : ''}>${esc(m.nombre)} (${cod})</option>`)
    .join('');
  const grupo = (tipo) => datos.categorias.filter((c) => c.tipo === tipo).map((c) => `
    <button type="button" class="cat-edit" data-accion="editar-cat" data-id="${esc(c.id)}">
      <span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>
      <span class="texto">${esc(c.nombre)}${c.presupuesto ? `<br><span class="detalle">Presupuesto: ${esc(dinero(c.presupuesto))} al mes</span>` : ''}</span>
      <span class="flecha" aria-hidden="true">›</span>
    </button>`).join('') || '<p class="subtitulo">Ninguna.</p>';

  $('#vista-ajustes').innerHTML = `
    <div class="tarjeta">
      <h2>Moneda</h2>
      <div class="ajuste">
        <label for="moneda">Mostrar importes en</label>
        <select id="moneda">${opciones}</select>
      </div>
    </div>
    <div class="tarjeta">
      <h2>Categorías y presupuestos</h2>
      <p class="explica">Toca una para cambiar su nombre, su icono o ponerle un presupuesto al mes.</p>
      <h3 class="grupo-titulo">Gastos</h3>
      ${grupo('gasto')}
      <h3 class="grupo-titulo">Ingresos</h3>
      ${grupo('ingreso')}
      <button type="button" class="boton-linea" data-accion="nueva-cat">+ Añadir categoría</button>
    </div>
    <div class="tarjeta">
      <h2>Copia de seguridad</h2>
      <p class="explica">Tus datos solo están en este móvil. Guarda una copia de vez en cuando (por ejemplo, mándatela por correo) para no perderlos si cambias de teléfono.</p>
      <div class="botones-col">
        <button type="button" class="boton" data-accion="exportar">Guardar una copia</button>
        <button type="button" class="boton" data-accion="importar">Recuperar desde una copia</button>
      </div>
    </div>
    <div class="tarjeta">
      <h2>Empezar de cero</h2>
      <p class="explica">Borra todos los movimientos y deja las categorías como al principio.</p>
      <button type="button" class="boton peligro-suave" data-accion="borrar-todo">Borrar todo</button>
    </div>
    <p class="version">Versión ${esc(BUILD)}</p>`;

  $('#moneda').addEventListener('change', (e) => {
    datos.moneda = e.target.value;
    guardar();
    aviso(`Importes en ${C.MONEDAS[datos.moneda].nombre.toLowerCase()}`);
    pintar();
  });
}

// ---------- Apuntar / editar movimiento ----------

function tipoMov() {
  return document.querySelector('#form-mov input[name="tipo"]:checked').value;
}

function pintarChips(seleccion) {
  const tipo = tipoMov();
  const cats = datos.categorias.filter((c) => c.tipo === tipo);
  $('#mov-categorias').innerHTML = cats.map((c) => `
    <button type="button" class="chip" role="radio" aria-checked="${c.id === seleccion}" data-cat="${esc(c.id)}">
      <span aria-hidden="true">${esc(c.emoji)}</span>${esc(c.nombre)}
    </button>`).join('');
}

function catSeleccionada() {
  const b = document.querySelector('#mov-categorias [aria-checked="true"]');
  return b ? b.dataset.cat : null;
}

function abrirMovimiento(id = null) {
  editandoMov = id;
  const m = id ? datos.movimientos.find((x) => x.id === id) : null;
  $('#dlg-mov-titulo').textContent = m ? 'Editar movimiento' : 'Nuevo movimiento';
  $('#mov-borrar').hidden = !m;
  $('#mov-error').hidden = true;
  $('#mov-simbolo').textContent = C.simboloMoneda(datos.moneda);
  const tipo = m ? m.tipo : 'gasto';
  document.querySelector(`#form-mov input[name="tipo"][value="${tipo}"]`).checked = true;
  $('#mov-importe').value = m ? C.importeEditable(m.importe) : '';
  $('#mov-nota').value = m ? m.nota : '';
  // Si se está viendo otro mes, la fecha por defecto cae en ese mes (día 1), no en hoy.
  const hoy = C.hoyISO();
  $('#mov-fecha').value = m ? m.fecha : (C.claveMes(hoy) === mes ? hoy : `${mes}-01`);
  const porDefecto = datos.categorias.find((c) => c.tipo === tipo && c.id === ultimaCategoria[tipo])
    || datos.categorias.find((c) => c.tipo === tipo);
  pintarChips(m ? m.categoria : porDefecto?.id);
  $('#dlg-mov').showModal();
  if (!m) setTimeout(() => $('#mov-importe').focus(), 50);
}

function guardarMovimiento() {
  const importe = C.parseImporte($('#mov-importe').value);
  const fecha = $('#mov-fecha').value;
  const err = $('#mov-error');
  if (importe == null) { err.textContent = 'Escribe un importe mayor que cero.'; err.hidden = false; $('#mov-importe').focus(); return; }
  if (!C.esFechaISO(fecha)) { err.textContent = 'Elige una fecha.'; err.hidden = false; return; }
  const tipo = tipoMov();
  const cat = catSeleccionada();
  const campos = { tipo, importe, categoria: cat, nota: $('#mov-nota').value.trim().slice(0, 200), fecha };
  if (editandoMov) {
    const m = datos.movimientos.find((x) => x.id === editandoMov);
    if (m) Object.assign(m, campos);
  } else {
    datos.movimientos.push({ id: C.nuevoId(), creado: Date.now(), ...campos });
  }
  if (cat) ultimaCategoria[tipo] = cat;
  if (!guardar()) return;
  $('#dlg-mov').close();
  mes = C.claveMes(fecha);
  aviso(editandoMov ? 'Cambios guardados' : `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} apuntado`);
  pintar();
}

async function borrarMovimiento() {
  const id = editandoMov;
  $('#dlg-mov').close();
  const ok = await confirmar({ titulo: '¿Borrar este movimiento?', texto: 'No se puede deshacer.', si: 'Borrar' });
  if (!ok) { abrirMovimiento(id); return; }
  datos.movimientos = datos.movimientos.filter((m) => m.id !== id);
  guardar();
  aviso('Movimiento borrado');
  pintar();
}

// ---------- Categorías ----------

function tipoCat() {
  return document.querySelector('#form-cat input[name="cat-tipo"]:checked').value;
}

function abrirCategoria(id = null) {
  editandoCat = id;
  const c = id ? datos.categorias.find((x) => x.id === id) : null;
  $('#dlg-cat-titulo').textContent = c ? 'Editar categoría' : 'Nueva categoría';
  $('#cat-emoji').value = c ? c.emoji : '🏷️';
  $('#cat-nombre').value = c ? c.nombre : '';
  document.querySelector(`#form-cat input[name="cat-tipo"][value="${c ? c.tipo : 'gasto'}"]`).checked = true;
  $('#cat-presupuesto').value = c && c.presupuesto ? C.importeEditable(c.presupuesto) : '';
  $('#cat-presupuesto-campo').hidden = tipoCat() === 'ingreso';
  $('#cat-borrar').hidden = !c;
  $('#cat-error').hidden = true;
  $('#dlg-cat').showModal();
  if (!c) setTimeout(() => $('#cat-nombre').focus(), 50);
}

function guardarCategoria() {
  const nombre = $('#cat-nombre').value.trim().slice(0, 40);
  const err = $('#cat-error');
  if (!nombre) { err.textContent = 'Ponle un nombre.'; err.hidden = false; return; }
  const tipo = tipoCat();
  const txtPres = $('#cat-presupuesto').value.trim();
  let presupuesto = null;
  if (tipo === 'gasto' && txtPres) {
    presupuesto = C.parseImporte(txtPres);
    if (presupuesto == null) { err.textContent = 'El presupuesto tiene que ser un importe mayor que cero, o déjalo vacío.'; err.hidden = false; return; }
  }
  const campos = { emoji: $('#cat-emoji').value.trim().slice(0, 8), nombre, tipo, presupuesto };
  if (editandoCat) {
    const c = datos.categorias.find((x) => x.id === editandoCat);
    if (c) Object.assign(c, campos);
  } else {
    datos.categorias.push({ id: C.nuevoId(), ...campos });
  }
  if (!guardar()) return;
  $('#dlg-cat').close();
  aviso('Categoría guardada');
  pintar();
}

async function borrarCategoria() {
  const id = editandoCat;
  const c = datos.categorias.find((x) => x.id === id);
  const usos = datos.movimientos.filter((m) => m.categoria === id).length;
  $('#dlg-cat').close();
  const ok = await confirmar({
    titulo: `¿Borrar «${c ? c.nombre : ''}»?`,
    texto: usos
      ? `Tiene ${usos} movimiento${usos === 1 ? '' : 's'}. No se borran: pasarán a «Sin categoría».`
      : 'No tiene movimientos.',
    si: 'Borrar',
  });
  if (!ok) { abrirCategoria(id); return; }
  datos.categorias = datos.categorias.filter((x) => x.id !== id);
  guardar();
  aviso('Categoría borrada');
  pintar();
}

// ---------- Copia de seguridad ----------

async function exportar() {
  const texto = JSON.stringify({ app: 'finanzas-personales', exportado: new Date().toISOString(), ...datos }, null, 2);
  const nombre = `mis-cuentas-copia-${C.hoyISO()}.json`;
  const blob = new Blob([texto], { type: 'application/json' });
  try {
    const archivo = new File([blob], nombre, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Copia de Mis cuentas' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // la persona canceló el menú de compartir
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  aviso('Copia guardada en Descargas');
}

async function importar(archivo) {
  let r;
  try {
    r = C.validarCopia(JSON.parse(await archivo.text()));
  } catch (e) {
    r = { ok: false, error: 'Ese archivo no es una copia de esta app.' };
  }
  if (!r.ok) { aviso(r.error); return; }
  const n = r.datos.movimientos.length;
  const ok = await confirmar({
    titulo: '¿Recuperar esta copia?',
    texto: `Tiene ${n} movimiento${n === 1 ? '' : 's'}. Sustituye todo lo que hay ahora en este móvil.`,
    si: 'Recuperar',
    peligro: false,
  });
  if (!ok) return;
  datos = r.datos;
  guardar();
  aviso(r.descartados ? `Copia recuperada (${r.descartados} movimientos no se pudieron leer)` : 'Copia recuperada');
  pintar();
}

async function borrarTodo() {
  const ok = await confirmar({
    titulo: '¿Borrar todo?',
    texto: 'Se borran todos los movimientos, categorías y presupuestos de este móvil. Si no tienes una copia, no se podrá recuperar.',
    si: 'Borrar todo',
  });
  if (!ok) return;
  const moneda = datos.moneda;
  datos = C.datosIniciales();
  datos.moneda = moneda;
  guardar();
  aviso('Todo borrado');
  pintar();
}

// ---------- Eventos ----------

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-vista]');
  if (nav) { vista = nav.dataset.vista; pintar(); window.scrollTo(0, 0); return; }

  const chip = e.target.closest('#mov-categorias .chip');
  if (chip) {
    for (const b of document.querySelectorAll('#mov-categorias .chip')) b.setAttribute('aria-checked', String(b === chip));
    return;
  }

  const el = e.target.closest('[data-accion]');
  if (!el) return;
  switch (el.dataset.accion) {
    case 'nuevo': abrirMovimiento(); break;
    case 'editar-mov': abrirMovimiento(el.dataset.id); break;
    case 'borrar-mov': borrarMovimiento(); break;
    case 'editar-cat': abrirCategoria(el.dataset.id); break;
    case 'nueva-cat': abrirCategoria(); break;
    case 'borrar-cat': borrarCategoria(); break;
    case 'cerrar': el.closest('dialog').close(); break;
    case 'mes-anterior': mes = C.moverMes(mes, -1); pintar(); break;
    case 'mes-siguiente': mes = C.moverMes(mes, 1); pintar(); break;
    case 'mes-hoy': mes = C.claveMes(C.hoyISO()); pintar(); break;
    case 'exportar': exportar(); break;
    case 'importar': $('#archivo-importar').value = ''; $('#archivo-importar').click(); break;
    case 'borrar-todo': borrarTodo(); break;
    case 'actualizar': actualizarApp(); break;
    default: break;
  }
});

$('#form-mov').addEventListener('submit', (e) => { e.preventDefault(); guardarMovimiento(); });
$('#form-cat').addEventListener('submit', (e) => { e.preventDefault(); guardarCategoria(); });
for (const r of document.querySelectorAll('#form-mov input[name="tipo"]')) {
  r.addEventListener('change', () => {
    const tipo = tipoMov();
    const def = datos.categorias.find((c) => c.tipo === tipo && c.id === ultimaCategoria[tipo])
      || datos.categorias.find((c) => c.tipo === tipo);
    pintarChips(def?.id);
  });
}
for (const r of document.querySelectorAll('#form-cat input[name="cat-tipo"]')) {
  r.addEventListener('change', () => { $('#cat-presupuesto-campo').hidden = tipoCat() === 'ingreso'; });
}
$('#archivo-importar').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importar(f); });
// Tocar fuera de una hoja la cierra.
for (const d of document.querySelectorAll('dialog.hoja')) {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}

// ---------- Instalación y versiones nuevas ----------

let trabajadorEnEspera = null;

function mostrarAvisoVersion(sw) {
  trabajadorEnEspera = sw;
  $('#aviso-version').hidden = false;
}

function actualizarApp() {
  if (trabajadorEnEspera) trabajadorEnEspera.postMessage({ tipo: 'SKIP_WAITING' });
  else location.reload();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      if (reg.waiting && navigator.serviceWorker.controller) mostrarAvisoVersion(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) mostrarAvisoVersion(nuevo);
        });
      });
      // Al volver a la app, mira si hay versión nueva.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch (e) { /* sin service worker la app funciona igual, solo que no sin conexión */ }
  });
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando || !trabajadorEnEspera) return;
    recargando = true;
    location.reload();
  });
}

// Pide al navegador que no borre los datos por falta de espacio (si lo permite).
try { navigator.storage?.persist?.().catch(() => {}); } catch (e) { /* nada */ }

pintar();
