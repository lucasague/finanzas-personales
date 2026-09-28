import * as C from './calc.js';

const BUILD = '4fb472b256';
const CLAVE_DATOS = 'finanzas.datos.v1';
const $ = (sel) => document.querySelector(sel);

let datos = cargar();
let mes = C.claveMes(C.hoyISO());
let vista = 'resumen';
let editandoMov = null; // id del movimiento en edición, o null si es nuevo
let editandoCat = null; // id de la categoría en edición, o null si es nueva
let editandoCuenta = null; // id de la cuenta en edición, o null si es nueva
let ultimaCategoria = { gasto: null, ingreso: null };
let ultimaMoneda = null;
let ultimaCuenta = null;
let baseTocada = false; // si la persona ha escrito a mano lo que le costó en la moneda principal

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
const nombreCorto = { MXN: 'pesos', CRC: 'colones', USD: 'dólares', EUR: 'euros' };
// Movimientos pasados a la moneda principal (para sumar), con el original guardado aparte.
const enBase = () => C.enMonedaBase(datos.movimientos, datos.moneda);
const categoria = (id) => datos.categorias.find((c) => c.id === id)
  || { id: null, emoji: '❔', nombre: 'Sin categoría', tipo: 'gasto', presupuesto: null };
const cuenta = (id) => datos.cuentas.find((c) => c.id === id) || { id: null, nombre: 'Sin cuenta', tipo: null };
const emojiCuenta = (c) => (C.TIPOS_CUENTA[c.tipo] || { emoji: '❔' }).emoji;

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
  $('#selector-mes').style.visibility = vista === 'ajustes' || vista === 'historial' ? 'hidden' : 'visible';
  $('.fab').hidden = vista === 'ajustes';
  for (const v of ['resumen', 'movimientos', 'historial', 'ajustes']) {
    $(`#vista-${v}`).hidden = v !== vista;
    const boton = document.querySelector(`.barra [data-vista="${v}"]`);
    if (v === vista) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  }
  if (vista === 'resumen') pintarResumen();
  if (vista === 'movimientos') pintarMovimientos();
  if (vista === 'historial') pintarHistorial();
  if (vista === 'ajustes') pintarAjustes();
}

function pintarResumen() {
  const { movs, sinConvertir } = enBase();
  const r = C.resumenMes(movs, mes);
  const filas = C.gastoPorCategoria(movs, mes, datos.categorias);
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
  if (sinConvertir) {
    html += `<p class="subtitulo">${sinConvertir} movimiento${sinConvertir === 1 ? '' : 's'} en otra moneda no entra${sinConvertir === 1 ? '' : 'n'} en los totales porque falta su tipo de cambio.</p>`;
  }

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
  const cuentas = C.netoPorCuenta(movs, mes, datos.cuentas);
  if (cuentas.length) {
    html += `<div class="tarjeta"><h2>Por cuenta</h2>
      <p class="explica">Lo que se movió este mes en cada una (ingresos − gastos).</p>`;
    for (const f of cuentas) {
      html += `
        <div class="cat-fila">
          <div class="cat-linea">
            <span class="cat-nombre">${esc(emojiCuenta(f.cuenta))} ${esc(f.cuenta.nombre)}</span>
            <span class="cuenta-neto ${f.neto < 0 ? 'gasto' : 'ingreso'}">${f.neto < 0 ? '−' : '+'}${esc(dinero(Math.abs(f.neto)))}</span>
          </div>
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
  const tasas = C.tasasImplicitas(datos.movimientos);
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
    const moneda = m.moneda || datos.moneda;
    const otraMoneda = moneda !== datos.moneda;
    const enPrincipal = otraMoneda ? C.valorEn(m, datos.moneda, tasas) : null;
    let detalle = m.nota ? c.nombre : (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto');
    detalle += ` · ${cuenta(m.cuenta).nombre}`;
    if (otraMoneda) detalle += enPrincipal != null ? ` · ${dinero(enPrincipal)}` : ' · sin tipo de cambio';
    html += `<li><button type="button" class="mov" data-accion="editar-mov" data-id="${esc(m.id)}">
      <span class="emoji" aria-hidden="true">${esc(c.emoji)}</span>
      <span class="texto">
        <span class="titulo">${esc(m.nota || c.nombre)}</span>
        <span class="detalle">${esc(detalle)}</span>
      </span>
      <span class="importe ${m.tipo}">${signo}${esc(C.formatoMoneda(m.importe, moneda))}</span>
    </button></li>`;
  }
  html += `</ul>`;
  $('#vista-movimientos').innerHTML = html;
}

function pintarHistorial() {
  const { movs, sinConvertir, tasas } = enBase();
  const hoy = C.claveMes(C.hoyISO());
  const meses = C.historial(movs, hoy, 12);
  if (!meses.length) {
    $('#vista-historial').innerHTML = `<div class="tarjeta vacio"><span class="grande" aria-hidden="true">📈</span>
      Cuando apuntes movimientos, aquí verás tus ingresos y gastos mes a mes.</div>`;
    return;
  }
  const maximo = Math.max(1, ...meses.map((f) => Math.max(f.ingresos, f.gastos)));
  const pct = (v) => Math.round((v / maximo) * 100);
  let html = `<div class="tarjeta"><h2>Mes a mes</h2>
    <div class="leyenda"><span><i style="background:var(--ingreso)"></i>Ingresos</span><span><i style="background:var(--gasto)"></i>Gastos</span></div>`;
  for (const f of meses) {
    const monedas = Object.keys(f.ingresosPorMoneda);
    const desglose = monedas.length > 1 || (monedas.length === 1 && monedas[0] !== datos.moneda)
      ? monedas.map((mo) => C.formatoMoneda(f.ingresosPorMoneda[mo], mo)).join(' + ')
      : '';
    html += `
      <div class="hist-fila">
        <span class="hist-mes">${esc(C.nombreMes(f.clave).slice(0, 3))} ${esc(f.clave.slice(2, 4))}</span>
        <div class="hist-linea"><div class="barra-fondo"><div class="barra-relleno ing" style="width:${pct(f.ingresos)}%"></div></div><span class="cifra-p">${esc(dinero(f.ingresos))}</span></div>
        <div class="hist-linea"><div class="barra-fondo"><div class="barra-relleno gas" style="width:${pct(f.gastos)}%"></div></div><span class="cifra-p">${esc(dinero(f.gastos))}</span></div>
        ${desglose ? `<span class="hist-desglose">Ingresos: ${esc(desglose)}</span>` : ''}
        <span class="hist-saldo">${f.saldo >= 0 ? 'Sobró' : 'Faltó'} ${esc(dinero(Math.abs(f.saldo)))}</span>
      </div>`;
  }
  html += `</div>`;
  if (sinConvertir) {
    html += `<p class="subtitulo">${sinConvertir} movimiento${sinConvertir === 1 ? '' : 's'} en otra moneda no se cuentan porque falta su tipo de cambio.</p>`;
  }
  const tipos = C.tiposDeCambioPorMes(tasas, datos.moneda, hoy, 12);
  if (tipos.length) {
    html += `<div class="tarjeta"><h2>Tipo de cambio de cada mes</h2>
      <p class="explica">Sale de lo que de verdad te cobraron en tus movimientos en otra moneda.</p>`;
    for (const t of tipos) {
      html += `<h3 class="grupo-titulo">${esc(C.MONEDAS[t.moneda].nombre)}</h3><table class="tabla-tc"><tbody>`;
      for (const f of t.meses) html += `<tr><td>${esc(C.nombreMes(f.clave))}</td><td>${esc(C.textoTipoDeCambio(t.moneda, datos.moneda, f.valor))}</td></tr>`;
      html += `</tbody></table>`;
    }
    html += `</div>`;
  }
  $('#vista-historial').innerHTML = html;
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
  const listaCuentas = datos.cuentas.map((c) => `
    <button type="button" class="cat-edit" data-accion="editar-cuenta" data-id="${esc(c.id)}">
      <span class="emoji" aria-hidden="true">${esc(emojiCuenta(c))}</span>
      <span class="texto">${esc(c.nombre)}<br><span class="detalle">${esc(C.TIPOS_CUENTA[c.tipo].nombre)}</span></span>
      <span class="flecha" aria-hidden="true">›</span>
    </button>`).join('') || '<p class="subtitulo">Ninguna.</p>';

  $('#vista-ajustes').innerHTML = `
    <div class="tarjeta">
      <h2>Moneda principal</h2>
      <p class="explica">Los totales, los presupuestos y el historial se ven en esta moneda. Cada movimiento se apunta en la moneda en que se pagó.</p>
      <div class="ajuste">
        <label for="moneda">Ver totales en</label>
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
      <h2>Cuentas</h2>
      <p class="explica">Dónde está el dinero: efectivo, tarjeta de débito, tarjeta de crédito… Toca una para cambiarla.</p>
      ${listaCuentas}
      <button type="button" class="boton-linea" data-accion="nueva-cuenta">+ Añadir cuenta</button>
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
    aviso(`Totales en ${nombreCorto[datos.moneda] || datos.moneda}`);
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

function pintarCuentas(seleccion) {
  $('#mov-cuenta-bloque').hidden = !datos.cuentas.length;
  $('#mov-cuentas').innerHTML = datos.cuentas.map((c) => `
    <button type="button" class="chip" role="radio" aria-checked="${c.id === seleccion}" data-cuenta="${esc(c.id)}">
      <span aria-hidden="true">${esc(emojiCuenta(c))}</span>${esc(c.nombre)}
    </button>`).join('');
}

function cuentaSeleccionada() {
  const b = document.querySelector('#mov-cuentas [aria-checked="true"]');
  return b ? b.dataset.cuenta : null;
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
  const moneda = m ? (m.moneda || datos.moneda) : (ultimaMoneda || datos.moneda);
  $('#mov-moneda').innerHTML = Object.keys(C.MONEDAS)
    .map((cod) => `<label><input type="radio" name="moneda" value="${cod}" ${cod === moneda ? 'checked' : ''}><span>${cod}</span></label>`).join('');
  baseTocada = !!(m && m.importeBase && m.monedaBase === datos.moneda);
  $('#mov-importe-base').value = baseTocada ? C.importeEditable(m.importeBase) : '';
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
  const cuentaDef = datos.cuentas.find((c) => c.id === ultimaCuenta) || datos.cuentas[0];
  pintarCuentas(m ? m.cuenta : cuentaDef?.id);
  actualizarBase();
  $('#dlg-mov').showModal();
  if (!m) setTimeout(() => $('#mov-importe').focus(), 50);
}

// Si el movimiento va en otra moneda, pide lo que costó en la principal y lo propone con el último tipo de cambio.
const monedaMov = () => document.querySelector('#mov-moneda input:checked')?.value || datos.moneda;

function actualizarBase() {
  const moneda = monedaMov();
  const otra = moneda !== datos.moneda;
  $('#mov-base').hidden = !otra;
  if (!otra) return;
  $('#mov-base-etiqueta').textContent = `${tipoMov() === 'ingreso' ? 'Lo que recibiste' : 'Lo que te costó'} en ${nombreCorto[datos.moneda] || datos.moneda}`;
  const importe = C.parseImporte($('#mov-importe').value);
  const fecha = C.esFechaISO($('#mov-fecha').value) ? $('#mov-fecha').value : C.hoyISO();
  const otros = datos.movimientos.filter((x) => x.id !== editandoMov);
  const t = C.tasa(C.tasasImplicitas(otros), moneda, datos.moneda, C.claveMes(fecha));
  if (!baseTocada) $('#mov-importe-base').value = importe != null && t != null ? C.importeEditable(Math.round(importe * t)) : '';
  const base = C.parseImporte($('#mov-importe-base').value);
  const nota = $('#mov-tasa');
  if (importe != null && base != null) nota.textContent = `Tipo de cambio: ${C.textoTipoDeCambio(moneda, datos.moneda, base / importe)}`;
  else if (t == null) nota.textContent = 'Mira en tu estado de cuenta cuánto te cobraron y escríbelo aquí.';
  else nota.textContent = '';
}

function guardarMovimiento() {
  const importe = C.parseImporte($('#mov-importe').value);
  const fecha = $('#mov-fecha').value;
  const moneda = monedaMov();
  const err = $('#mov-error');
  if (importe == null) { err.textContent = 'Escribe un importe mayor que cero.'; err.hidden = false; $('#mov-importe').focus(); return; }
  if (!C.esFechaISO(fecha)) { err.textContent = 'Elige una fecha.'; err.hidden = false; return; }
  let importeBase = null;
  if (moneda !== datos.moneda) {
    importeBase = C.parseImporte($('#mov-importe-base').value);
    if (importeBase == null) {
      err.textContent = `Escribe también cuánto fue en ${nombreCorto[datos.moneda] || datos.moneda}.`;
      err.hidden = false; $('#mov-importe-base').focus(); return;
    }
  }
  const tipo = tipoMov();
  const cat = catSeleccionada();
  const cta = cuentaSeleccionada();
  const campos = {
    tipo, importe, moneda, importeBase, monedaBase: importeBase ? datos.moneda : null,
    categoria: cat, cuenta: cta, nota: $('#mov-nota').value.trim().slice(0, 200), fecha,
  };
  if (editandoMov) {
    const m = datos.movimientos.find((x) => x.id === editandoMov);
    if (m) Object.assign(m, campos);
  } else {
    datos.movimientos.push({ id: C.nuevoId(), creado: Date.now(), ...campos });
  }
  if (cat) ultimaCategoria[tipo] = cat;
  ultimaMoneda = moneda;
  if (cta) ultimaCuenta = cta;
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

// ---------- Cuentas ----------

function abrirCuenta(id = null) {
  editandoCuenta = id;
  const c = id ? datos.cuentas.find((x) => x.id === id) : null;
  $('#dlg-cuenta-titulo').textContent = c ? 'Editar cuenta' : 'Nueva cuenta';
  $('#cuenta-nombre').value = c ? c.nombre : '';
  document.querySelector(`#form-cuenta input[name="cuenta-tipo"][value="${c ? c.tipo : 'efectivo'}"]`).checked = true;
  $('#cuenta-borrar').hidden = !c;
  $('#cuenta-error').hidden = true;
  $('#dlg-cuenta').showModal();
  if (!c) setTimeout(() => $('#cuenta-nombre').focus(), 50);
}

function guardarCuenta() {
  const nombre = $('#cuenta-nombre').value.trim().slice(0, 40);
  const err = $('#cuenta-error');
  if (!nombre) { err.textContent = 'Ponle un nombre.'; err.hidden = false; return; }
  const tipo = document.querySelector('#form-cuenta input[name="cuenta-tipo"]:checked').value;
  if (editandoCuenta) {
    const c = datos.cuentas.find((x) => x.id === editandoCuenta);
    if (c) Object.assign(c, { nombre, tipo });
  } else {
    datos.cuentas.push({ id: C.nuevoId(), nombre, tipo });
  }
  if (!guardar()) return;
  $('#dlg-cuenta').close();
  aviso('Cuenta guardada');
  pintar();
}

async function borrarCuenta() {
  const id = editandoCuenta;
  const c = datos.cuentas.find((x) => x.id === id);
  const usos = datos.movimientos.filter((m) => m.cuenta === id).length;
  $('#dlg-cuenta').close();
  const ok = await confirmar({
    titulo: `¿Borrar «${c ? c.nombre : ''}»?`,
    texto: usos
      ? `Tiene ${usos} movimiento${usos === 1 ? '' : 's'}. No se borran: quedarán «Sin cuenta».`
      : 'No tiene movimientos.',
    si: 'Borrar',
  });
  if (!ok) { abrirCuenta(id); return; }
  datos.cuentas = datos.cuentas.filter((x) => x.id !== id);
  for (const m of datos.movimientos) if (m.cuenta === id) m.cuenta = null;
  if (ultimaCuenta === id) ultimaCuenta = null;
  guardar();
  aviso('Cuenta borrada');
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
    texto: 'Se borran todos los movimientos, categorías, cuentas y presupuestos de este móvil. Si no tienes una copia, no se podrá recuperar.',
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
  const chipCuenta = e.target.closest('#mov-cuentas .chip');
  if (chipCuenta) {
    for (const b of document.querySelectorAll('#mov-cuentas .chip')) b.setAttribute('aria-checked', String(b === chipCuenta));
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
    case 'editar-cuenta': abrirCuenta(el.dataset.id); break;
    case 'nueva-cuenta': abrirCuenta(); break;
    case 'borrar-cuenta': borrarCuenta(); break;
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
$('#form-cuenta').addEventListener('submit', (e) => { e.preventDefault(); guardarCuenta(); });
for (const r of document.querySelectorAll('#form-mov input[name="tipo"]')) {
  r.addEventListener('change', () => {
    const tipo = tipoMov();
    const def = datos.categorias.find((c) => c.tipo === tipo && c.id === ultimaCategoria[tipo])
      || datos.categorias.find((c) => c.tipo === tipo);
    pintarChips(def?.id);
    actualizarBase();
  });
}
$('#mov-moneda').addEventListener('change', () => { baseTocada = false; actualizarBase(); });
$('#mov-importe').addEventListener('input', actualizarBase);
$('#mov-fecha').addEventListener('change', actualizarBase);
$('#mov-importe-base').addEventListener('input', () => { baseTocada = $('#mov-importe-base').value.trim() !== ''; actualizarBase(); });
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
