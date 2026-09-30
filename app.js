import * as C from './calc.js';

const BUILD = '6f0cc6488e';
const CLAVE_DATOS = 'finanzas.datos.v1';
const $ = (sel) => document.querySelector(sel);

let datos = cargar();
let mes = C.claveMes(C.hoyISO());
let año = añoDeHoy(); // primer mes del año que se ve en el Historial
let vista = 'resumen';
let editandoMov = null; // id del movimiento en edición, o null si es nuevo
let editandoCat = null; // id de la categoría en edición, o null si es nueva
let editandoCuenta = null; // id de la cuenta en edición, o null si es nueva
let editandoEsperado = null; // grupo del ingreso esperado en edición, o null si es nuevo
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

function añoDeHoy() {
  return C.inicioDelAño(C.claveMes(C.hoyISO()), datos.inicioAño);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (c) => C.formatoMoneda(c, datos.moneda);
const nombreCorto = { MXN: 'pesos', CRC: 'colones', USD: 'dólares', EUR: 'euros' };
// Movimientos pasados a la moneda principal (para sumar), con el original guardado aparte.
const enBase = () => C.enMonedaBase(datos.movimientos, datos.moneda);
const categoria = (id) => datos.categorias.find((c) => c.id === id)
  || { id: null, emoji: '❔', nombre: 'Sin categoría', tipo: 'gasto', presupuesto: null };
// "Comida › Supermercado" (o "Sin categoría" si ya no existe).
const rutaDe = (id) => C.textoRuta(datos.categorias, id) || 'Sin categoría';
// Las subcategorías suelen no tener icono: se usa el de su categoría principal.
const emojiDe = (c) => c.emoji || C.rutaCategoria(datos.categorias, c.id).find((x) => x.emoji)?.emoji || '🏷️';
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

function confirmar({ titulo, texto, si = 'Sí', peligro = true, lista = [], soloAceptar = false }) {
  const dlg = $('#dlg-confirmar');
  $('#conf-titulo').textContent = titulo;
  $('#conf-texto').textContent = texto;
  $('#conf-lista').innerHTML = lista.map((l) => `<li>${esc(l)}</li>`).join('');
  $('#conf-lista').hidden = !lista.length;
  $('#conf-no').hidden = soloAceptar;
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
  // En el Historial, el selector de la cabecera pasa de meses a años.
  const porAño = vista === 'historial';
  $('#nombre-mes').textContent = porAño ? C.nombreAño(año) : C.nombreMes(mes);
  $('#nombre-mes').setAttribute('aria-label', porAño ? 'Volver al año actual' : 'Volver al mes actual');
  $('[data-accion="mes-anterior"]').setAttribute('aria-label', porAño ? 'Año anterior' : 'Mes anterior');
  $('[data-accion="mes-siguiente"]').setAttribute('aria-label', porAño ? 'Año siguiente' : 'Mes siguiente');
  $('#selector-mes').style.visibility = vista === 'ajustes' ? 'hidden' : 'visible';
  $('#selector-mes').classList.toggle('anual', porAño);
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
  const { movs, sinConvertir, tasas } = enBase();
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
  html += tarjetaEsperado(C.esperadoDelMes(datos.esperados, mes, datos.moneda, tasas, datos.esperadosMes), r.ingresos, tasas);

  if (!hayMovs && !filas.length) {
    html += `<div class="tarjeta vacio"><span class="grande" aria-hidden="true">🌱</span>
      Aún no hay nada apuntado en ${esc(C.nombreMes(mes).toLowerCase())}.<br>Dale al <strong>+</strong> para apuntar tu primer gasto.</div>`;
  } else {
    html += `<div class="tarjeta"><h2>¿En qué se va?</h2>`;
    if (!filas.length) html += `<p class="subtitulo">Este mes solo hay ingresos.</p>`;
    html += pistaDesglose(filas) + barrasCategorias(filas);
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

/** Esperado frente a real del mes, en el Resumen. Nada si no hay ingreso esperado ese mes. */
function tarjetaEsperado(e, real, tasas) {
  if (!e.lineas.length) return '';
  const hoy = C.claveMes(C.hoyISO());
  const dif = real - e.total;
  const pct = e.total ? Math.min(100, Math.round((real / e.total) * 100)) : 100;
  const nota = dif >= 0
    ? (dif ? `${dinero(dif)} más de lo esperado` : 'Justo lo esperado')
    : (mes > hoy ? 'Este mes aún no ha llegado' : `Faltan ${dinero(-dif)} para lo esperado`);
  // Cada fuente: lo esperado y, si tiene categoría, lo que entró en ella (en su moneda).
  const lineas = e.lineas.map((l) => {
    let txt = `${l.nombre}: esperado ${C.formatoMoneda(l.importe, l.moneda)}${l.moneda !== datos.moneda && l.enBase != null ? ` (≈ ${dinero(l.enBase)})` : ''}`;
    if (l.categoria) {
      const otras = e.lineas.filter((x) => x.grupo !== l.grupo).map((x) => x.categoria);
      const rl = C.realDeCategoria(datos.movimientos, mes, datos.categorias, l.categoria, l.moneda, tasas, otras);
      txt += ` · real ${C.formatoMoneda(rl.total, l.moneda)}`;
    }
    return txt;
  });
  return `
    <div class="tarjeta">
      <h2>Ingreso esperado (todo)</h2>
      <div class="totales">
        <div><span class="t-etq">Esperado</span><span class="t-val">${esc(dinero(e.total))}</span></div>
        <div><span class="t-etq">Real</span><span class="t-val ingreso">${esc(dinero(real))}</span></div>
      </div>
      <div class="barra-fondo"><div class="barra-relleno ing" style="width:${pct}%"></div></div>
      <p class="nota-esperado ${dif < 0 && mes <= hoy ? 'falta' : ''}">${esc(nota)}</p>
      <p class="explica">${lineas.map(esc).join('<br>')}${e.sinTasa ? '<br>Hay algo en otra moneda que no suma porque aún no sé su tipo de cambio.' : ''}</p>
    </div>`;
}

/**
 * Barras de gasto por categoría (las de gastoPorCategoria), con la nota del presupuesto si lo hay. Las que tienen
 * subcategorías se despliegan al tocarlas y enseñan el desglose (`padre`: la de arriba, en el desglose).
 */
function barrasCategorias(filas, padre = null) {
  let html = '';
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
    const conHijos = f.hijos && f.hijos.length > 0;
    const icono = f.sinSub || (padre && !f.categoria.emoji) ? '' : `${f.categoria.emoji} `;
    const deQue = f.presupuesto != null ? 'del presupuesto' : padre ? `de lo gastado en ${padre.nombre}` : 'del mayor gasto';
    const cuerpo = `
        <div class="cat-linea">
          <span class="cat-nombre">${conHijos ? '<span class="desplegar" aria-hidden="true">›</span>' : ''}${esc(icono)}${esc(f.categoria.nombre)}</span>
          <span class="cat-importe">${esc(dinero(f.gastado))}</span>
        </div>
        <div class="barra-fondo" role="img" aria-label="${esc(`${pct}% ${deQue}`)}">
          <div class="barra-relleno ${clase}" style="width:${pct}%"></div>
        </div>
        ${nota ? `<div class="cat-nota ${clase === 'pasado' ? 'pasado' : ''}">${esc(nota)}</div>` : ''}`;
    html += conHijos
      ? `<details class="cat-fila"><summary>${cuerpo}</summary><div class="desglose">${barrasCategorias(f.hijos, f.categoria)}</div></details>`
      : `<div class="cat-fila">${cuerpo}</div>`;
  }
  return html;
}

const pistaDesglose = (filas) => (filas.some((f) => f.hijos.length)
  ? '<p class="explica">Toca una categoría con › para ver en qué se fue por dentro.</p>' : '');

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
    const ruta = c.id ? rutaDe(c.id) : c.nombre;
    let detalle = m.nota ? ruta : (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto');
    detalle += ` · ${cuenta(m.cuenta).nombre}`;
    if (otraMoneda) detalle += enPrincipal != null ? ` · ${dinero(enPrincipal)}` : ' · sin tipo de cambio';
    html += `<li><button type="button" class="mov" data-accion="editar-mov" data-id="${esc(m.id)}">
      <span class="emoji" aria-hidden="true">${esc(c.id ? emojiDe(c) : c.emoji)}</span>
      <span class="texto">
        <span class="titulo">${esc(m.nota || ruta)}</span>
        <span class="detalle">${esc(detalle)}</span>
      </span>
      <span class="importe ${m.tipo}">${signo}${esc(C.formatoMoneda(m.importe, moneda))}</span>
    </button></li>`;
  }
  html += `</ul>`;
  $('#vista-movimientos').innerHTML = html;
}

function pintarHistorial() {
  const { movs, tasas } = enBase();
  const hoy = C.claveMes(C.hoyISO());
  const r = C.resumenAño(movs, año);
  // Los que no se pudieron pasar a la moneda principal, solo de este año.
  const sinConvertir = datos.movimientos.filter((m) => C.enAño(C.claveMes(m.fecha), año)).length - r.n;
  const desgloseMonedas = (porMoneda) => {
    const monedas = Object.keys(porMoneda);
    return monedas.length > 1 || (monedas.length === 1 && monedas[0] !== datos.moneda)
      ? monedas.map((mo) => C.formatoMoneda(porMoneda[mo], mo)).join(' + ')
      : '';
  };
  if (!r.n && !sinConvertir) {
    $('#vista-historial').innerHTML = `<div class="tarjeta vacio"><span class="grande" aria-hidden="true">📈</span>
      ${datos.movimientos.length
        ? `No hay nada apuntado en ${esc(C.nombreAño(año))}.<br>Usa las flechas de arriba para ver otro año.`
        : 'Cuando apuntes movimientos, aquí verás tus ingresos y gastos del año, mes a mes.'}</div>`
      + (datos.esperados.length ? tablaEsperado(movs, tasas, hoy) : '');
    return;
  }
  const desgloseAño = desgloseMonedas(r.ingresosPorMoneda);
  let html = `
    <div class="tarjeta saldo">
      <div class="etiqueta">${r.saldo >= 0 ? 'Sobró' : 'Faltó'} en el año</div>
      <div class="cifra ${r.saldo < 0 ? 'negativo' : ''}">${esc(dinero(Math.abs(r.saldo)))}</div>
      <div class="totales">
        <div><span class="t-etq">Ingresos</span><span class="t-val ingreso">${esc(dinero(r.ingresos))}</span></div>
        <div><span class="t-etq">Gastos</span><span class="t-val gasto">${esc(dinero(r.gastos))}</span></div>
      </div>
      ${desgloseAño ? `<p class="desglose-anio">Ingresos: ${esc(desgloseAño)}</p>` : ''}
    </div>`;
  if (sinConvertir) {
    html += `<p class="subtitulo">${sinConvertir} movimiento${sinConvertir === 1 ? '' : 's'} en otra moneda no se cuentan porque falta su tipo de cambio.</p>`;
  }
  // Los presupuestos son al mes: en el año, cada barra es relativa al mayor gasto.
  const filas = C.gastoPorCategoria(movs, C.mesesDelAño(año), datos.categorias, { conPresupuesto: false });
  if (filas.length) html += `<div class="tarjeta"><h2>¿En qué se fue en el año?</h2>${pistaDesglose(filas)}${barrasCategorias(filas)}</div>`;

  const maximo = Math.max(1, ...r.meses.map((f) => Math.max(f.ingresos, f.gastos)));
  const pct = (v) => Math.round((v / maximo) * 100);
  html += `<div class="tarjeta"><h2>Mes a mes</h2>
    <div class="leyenda"><span><i style="background:var(--ingreso)"></i>Ingresos</span><span><i style="background:var(--gasto)"></i>Gastos</span></div>`;
  for (const f of r.meses) {
    const desglose = desgloseMonedas(f.ingresosPorMoneda);
    const pieMes = f.n
      ? `${f.saldo >= 0 ? 'Sobró' : 'Faltó'} ${dinero(Math.abs(f.saldo))}`
      : (f.clave > hoy ? 'Todavía no ha llegado' : 'Sin movimientos');
    html += `
      <div class="hist-fila ${f.n ? '' : 'vacia'}">
        <span class="hist-mes">${esc(C.nombreMes(f.clave).slice(0, 3))} ${esc(f.clave.slice(2, 4))}</span>
        <div class="hist-linea"><div class="barra-fondo"><div class="barra-relleno ing" style="width:${pct(f.ingresos)}%"></div></div><span class="cifra-p">${f.n ? esc(dinero(f.ingresos)) : ''}</span></div>
        <div class="hist-linea"><div class="barra-fondo"><div class="barra-relleno gas" style="width:${pct(f.gastos)}%"></div></div><span class="cifra-p">${f.n ? esc(dinero(f.gastos)) : ''}</span></div>
        ${desglose ? `<span class="hist-desglose">Ingresos: ${esc(desglose)}</span>` : ''}
        <span class="hist-saldo">${esc(pieMes)}</span>
      </div>`;
  }
  html += `</div>`;
  html += tablaEsperado(movs, tasas, hoy);
  const tipos = C.tiposDeCambioPorMes(tasas, datos.moneda, C.moverMes(año, 11), 12);
  if (tipos.length) {
    html += `<div class="tarjeta"><h2>Tipo de cambio de cada mes</h2>
      <p class="explica">Sale de lo que de verdad te cobraron en tus movimientos en otra moneda.</p>`;
    for (const t of tipos) {
      html += `<h3 class="grupo-titulo">${esc(C.MONEDAS[t.moneda].nombre)}</h3><table class="tabla-tc"><tbody>`;
      // En el orden del año, como las barras.
      for (const f of [...t.meses].reverse()) html += `<tr><td>${esc(C.nombreMes(f.clave))}</td><td>${esc(C.textoTipoDeCambio(t.moneda, datos.moneda, f.valor))}</td></tr>`;
      html += `</tbody></table>`;
    }
    html += `</div>`;
  }
  $('#vista-historial').innerHTML = html;
}

/**
 * Esperado frente a real de cada mes del año, en el Historial: una tabla con todo y otra por cada fuente que tiene
 * categoría (en su moneda).
 */
function tablaEsperado(movs, tasas, hoy) {
  const r = C.esperadoVsReal(movs, datos.esperados, año, datos.moneda, tasas, datos.esperadosMes);
  if (!r.hayAlguno) {
    return `<div class="tarjeta"><h2>Esperado y real</h2>
      <p class="explica">Pon cuánto esperas ingresar al mes y aquí lo verás junto a lo que de verdad entró, mes a mes.</p>
      <button type="button" class="boton-linea" data-accion="nuevo-esperado">+ Poner ingreso esperado</button></div>`;
  }
  let html = tablaEsperadoReal('Esperado y real: todo', r.meses, hoy, datos.moneda,
    'Todos tus ingresos frente a todo lo que esperabas. Los meses que aún no han llegado solo muestran lo esperado. Para poner otra cantidad en un mes, toca el ingreso en Ajustes.');
  const grupos = [...new Set(C.lineasEsperadas(datos.esperados, hoy).map((e) => e.grupo))];
  for (const g of grupos) {
    const rl = C.esperadoVsRealDeLinea(datos.movimientos, datos.esperados, g, año, tasas, datos.esperadosMes, datos.categorias, hoy);
    if (!rl || !rl.hayAlguno) continue;
    html += tablaEsperadoReal(`Esperado y real: ${rl.nombre}`, rl.meses, hoy, rl.moneda,
      `Solo lo apuntado en ${C.textoRuta(datos.categorias, rl.categoria) || 'su categoría'}, en ${nombreCorto[rl.moneda] || rl.moneda}.`);
  }
  return html;
}

function tablaEsperadoReal(titulo, meses, hoy, moneda, explica) {
  const din = (c) => C.formatoMoneda(c, moneda);
  const mesCorto = (k) => `${esc(C.nombreMes(k).slice(0, 3))} ${esc(k.slice(2, 4))}`;
  const conSigno = (v) => `<span class="${v < 0 ? 'gasto' : 'ingreso'}">${v < 0 ? '−' : '+'}${esc(din(Math.abs(v)))}</span>`;
  const r = { meses };
  let filas = '';
  let tEsp = 0;
  let tReal = 0;
  for (const f of r.meses) {
    if (!f.hayEsperado) {
      filas += `<tr class="vacia"><td>${mesCorto(f.clave)}</td><td>—</td><td>${f.real ? esc(din(f.real)) : '—'}</td><td></td></tr>`;
      continue;
    }
    const futuro = f.clave > hoy;
    if (!futuro) { tEsp += f.esperado; tReal += f.real; }
    filas += `<tr class="${futuro ? 'futuro' : ''}"><td>${mesCorto(f.clave)}</td><td>${esc(din(f.esperado))}${f.sinTasa ? '*' : ''}</td><td>${futuro ? '' : esc(din(f.real))}</td><td>${futuro ? '' : conSigno(f.diferencia)}</td></tr>`;
  }
  const hayTasa = r.meses.some((f) => f.sinTasa);
  return `<div class="tarjeta"><h2>${esc(titulo)}</h2>
    <p class="explica">${esc(explica)}</p>
    <table class="tabla-esperado">
      <thead><tr><th></th><th>Esperado</th><th>Real</th><th>Diferencia</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td>Total</td><td>${esc(din(tEsp))}</td><td>${esc(din(tReal))}</td><td>${conSigno(tReal - tEsp)}</td></tr></tfoot>
    </table>
    <p class="explica">El total cuenta solo los meses que ya pasaron o están en curso y tienen algo esperado.${hayTasa ? ' * Hay algo en otra moneda que no suma porque aún no sé su tipo de cambio.' : ''}</p>
  </div>`;
}

function pintarAjustes() {
  const opciones = Object.entries(C.MONEDAS)
    .map(([cod, m]) => `<option value="${cod}" ${cod === datos.moneda ? 'selected' : ''}>${esc(m.nombre)} (${cod})</option>`)
    .join('');
  const opcionesMes = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}" ${n === datos.inicioAño ? 'selected' : ''}>${esc(C.nombreMes(`2000-${String(n).padStart(2, '0')}`).slice(0, -5))}</option>`)
    .join('');
  // En árbol: las subcategorías, con sangría debajo de la suya. Las "Sin colocar" van aparte (salvo que tengan
  // subcategorías, que entonces se quedan en el árbol para no esconderlas).
  const sinColocar = new Set(datos.sinColocar || []);
  const usos = new Map();
  for (const m of datos.movimientos) usos.set(m.categoria, (usos.get(m.categoria) || 0) + 1);
  const botonCat = (c, nivel, detalle = '') => `
    <button type="button" class="cat-edit nivel-${nivel}" data-accion="editar-cat" data-id="${esc(c.id)}">
      <span class="emoji" aria-hidden="true">${esc(c.emoji || (nivel > 1 ? '·' : ''))}</span>
      <span class="texto">${esc(c.nombre)}${c.presupuesto ? `<br><span class="detalle">Presupuesto: ${esc(dinero(c.presupuesto))} al mes</span>` : ''}${detalle}</span>
      <span class="flecha" aria-hidden="true">›</span>
    </button>`;
  const suelta = (c) => sinColocar.has(c.id) && !C.hijasDe(datos.categorias, c.id).length;
  const grupo = (tipo) => C.ordenArbol(datos.categorias, tipo)
    .filter(({ categoria: c }) => !suelta(c))
    .map(({ categoria: c, nivel }) => botonCat(c, nivel)).join('') || '<p class="subtitulo">Ninguna.</p>';
  const sueltas = datos.categorias.filter(suelta);
  const tarjetaSueltas = sueltas.length ? `
    <div class="tarjeta sin-colocar">
      <h2>Sin colocar (${sueltas.length})</h2>
      <p class="explica">Venían de antes, tienen movimientos y no estaban en tu lista. Toca una para meterla dentro de otra o para pasar sus movimientos a otra. Cuando la guardes, sale de aquí.</p>
      ${sueltas.map((c) => botonCat(c, 1, `<br><span class="detalle">${c.tipo === 'ingreso' ? 'De ingreso' : 'De gasto'} · ${esc(plural(usos.get(c.id) || 0, 'movimiento', 'movimientos'))}</span>`)).join('')}
    </div>` : '';
  const listaCuentas = datos.cuentas.map((c) => `
    <button type="button" class="cat-edit" data-accion="editar-cuenta" data-id="${esc(c.id)}">
      <span class="emoji" aria-hidden="true">${esc(emojiCuenta(c))}</span>
      <span class="texto">${esc(c.nombre)}<br><span class="detalle">${esc(C.TIPOS_CUENTA[c.tipo].nombre)}</span></span>
      <span class="flecha" aria-hidden="true">›</span>
    </button>`).join('') || '<p class="subtitulo">Ninguna.</p>';
  const hoy = C.claveMes(C.hoyISO());
  const listaEsperados = C.lineasEsperadas(datos.esperados, hoy).map((e) => `
    <button type="button" class="cat-edit" data-accion="editar-esperado" data-id="${esc(e.grupo)}">
      <span class="emoji" aria-hidden="true">📥</span>
      <span class="texto">${esc(e.nombre)}<br><span class="detalle">${e.importe ? `${esc(C.formatoMoneda(e.importe, e.moneda))} al mes` : `En ${esc(e.moneda)}, cada mes distinto`}${e.desde > hoy ? ` · desde ${esc(C.nombreMes(e.desde).toLowerCase())}` : ''}</span></span>
      <span class="flecha" aria-hidden="true">›</span>
    </button>`).join('') || '<p class="subtitulo">Ninguno todavía.</p>';

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
      <h2>Año</h2>
      <p class="explica">El historial suma los meses por años que empiezan en este mes (con septiembre, de septiembre a agosto).</p>
      <div class="ajuste">
        <label for="inicio-anio">El año empieza en</label>
        <select id="inicio-anio">${opcionesMes}</select>
      </div>
    </div>
    <div class="tarjeta">
      <h2>Ingreso esperado al mes</h2>
      <p class="explica">Lo que cuentas con recibir cada mes (el sueldo, una renta…). Pones lo habitual y, si algún mes es distinto, esa cantidad en ese mes. En el Resumen y en el Historial lo verás junto a lo que de verdad entró.</p>
      ${listaEsperados}
      <button type="button" class="boton-linea" data-accion="nuevo-esperado">+ Añadir ingreso esperado</button>
    </div>
    ${tarjetaSueltas}
    <div class="tarjeta">
      <h2>Categorías y presupuestos</h2>
      <p class="explica">Toca una para cambiar su nombre, su icono, dentro de cuál va o ponerle un presupuesto al mes. Las que van dentro de otra se ven debajo, un poco hacia la derecha.</p>
      <h3 class="grupo-titulo">Gastos</h3>
      ${grupo('gasto')}
      <h3 class="grupo-titulo">Ingresos</h3>
      ${grupo('ingreso')}
      <button type="button" class="boton-linea" data-accion="nueva-cat">+ Añadir categoría</button>
    </div>
    <div class="tarjeta">
      <h2>Organizar con una lista</h2>
      <p class="explica">Si ya tienes tus categorías escritas (por ejemplo, en un mensaje), pégalas y la app las crea y las ordena. Las que ya tienes con el mismo nombre se reutilizan con sus movimientos. Si una que ya tienes se llama distinto, ponla entre paréntesis detrás de la de tu lista y se junta en ella con sus movimientos, por ejemplo: -Golosinas (Caprichos). Antes de cambiar nada te enseño cómo queda. Ningún movimiento se borra.</p>
      <button type="button" class="boton" data-accion="organizar">Organizar con una lista</button>
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
      <h2>Traer datos de Wallet</h2>
      <p class="explica">Si apuntabas en la app Wallet, exporta tus movimientos a un archivo (CSV) y elígelo aquí. Antes de traer nada te enseño un resumen. Las transferencias entre tus cuentas no se traen.</p>
      <button type="button" class="boton" data-accion="wallet">Traer datos de Wallet</button>
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
  $('#inicio-anio').addEventListener('change', (e) => {
    datos.inicioAño = Number(e.target.value);
    guardar();
    año = añoDeHoy();
    aviso(`Ahora el año va de ${C.nombreAño(año)}`);
    pintar();
  });
}

// ---------- Apuntar / editar movimiento ----------

function tipoMov() {
  return document.querySelector('#form-mov input[name="tipo"]:checked').value;
}

let catElegida = null; // categoría elegida al apuntar (en cualquier nivel)

/**
 * Botones de categoría: primero las principales del tipo; al elegir una que tiene subcategorías, aparecen debajo
 * (y luego las del tercer nivel). Se guarda la más concreta que esté marcada.
 */
function pintarChips(seleccion) {
  const tipo = tipoMov();
  const ruta = C.rutaCategoria(datos.categorias, seleccion);
  catElegida = ruta.length && ruta[0].tipo === tipo ? seleccion : null;
  if (!catElegida) ruta.length = 0;
  const chip = (c, marcada) => `
    <button type="button" class="chip" role="radio" aria-checked="${marcada}" data-cat="${esc(c.id)}">
      ${c.emoji ? `<span aria-hidden="true">${esc(c.emoji)}</span>` : ''}${esc(c.nombre)}
    </button>`;
  let html = '';
  let padre = null;
  for (let nivel = 0; nivel < C.NIVELES_MAX; nivel++) {
    const opciones = C.hijasDe(datos.categorias, padre).filter((c) => c.tipo === tipo);
    if (!opciones.length) break;
    const arriba = ruta[nivel - 1];
    html += `<div class="chips${nivel ? ' sub' : ''}" role="radiogroup" aria-label="${esc(nivel ? `Dentro de ${arriba.nombre}` : 'Categoría')}">
      ${nivel ? `<span class="chips-etq">Dentro de ${esc(arriba.nombre)} (si quieres):</span>` : ''}
      ${opciones.map((c) => chip(c, c.id === ruta[nivel]?.id)).join('')}
    </div>`;
    if (!ruta[nivel]) break;
    padre = ruta[nivel].id;
  }
  if (ruta.length > 1) html += `<p class="se-guarda">Se guarda en: ${esc(ruta.map((c) => c.nombre).join(' › '))}</p>`;
  $('#mov-categorias').innerHTML = html;
}

/** Categoría con la que se abre el formulario: la última usada de ese tipo o la primera principal. */
function categoriaPorDefecto(tipo) {
  return datos.categorias.find((c) => c.tipo === tipo && c.id === ultimaCategoria[tipo])
    || datos.categorias.find((c) => c.tipo === tipo && !c.padre);
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
  return catElegida;
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
  pintarChips(m ? m.categoria : categoriaPorDefecto(tipo)?.id);
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
  año = C.inicioDelAño(mes, datos.inicioAño);
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

/** Opciones de "Dentro de": ninguna (principal) o las del mismo tipo donde cabe sin pasar de tres niveles. */
function pintarPadres(seleccion) {
  const opciones = C.padresPosibles(datos.categorias, editandoCat, tipoCat());
  $('#cat-padre').innerHTML = '<option value="">Ninguna (es una categoría principal)</option>'
    + opciones.map((f) => `<option value="${esc(f.categoria.id)}" ${f.categoria.id === seleccion ? 'selected' : ''}>${esc(C.textoRuta(datos.categorias, f.categoria.id))}</option>`).join('');
}

function abrirCategoria(id = null) {
  editandoCat = id;
  const c = id ? datos.categorias.find((x) => x.id === id) : null;
  $('#dlg-cat-titulo').textContent = c ? 'Editar categoría' : 'Nueva categoría';
  $('#cat-emoji').value = c ? c.emoji : '🏷️';
  $('#cat-nombre').value = c ? c.nombre : '';
  document.querySelector(`#form-cat input[name="cat-tipo"][value="${c ? c.tipo : 'gasto'}"]`).checked = true;
  pintarPadres(c ? c.padre : null);
  $('#cat-presupuesto').value = c && c.presupuesto ? C.importeEditable(c.presupuesto) : '';
  $('#cat-presupuesto-campo').hidden = tipoCat() === 'ingreso';
  $('#cat-borrar').hidden = !c;
  $('#cat-pasar').hidden = true;
  $('[data-accion="pasar-cat"]').hidden = !c || !datos.categorias.some((x) => x.tipo === c.tipo && x.id !== c.id);
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
  // "Dentro de" solo ofrece sitios válidos; se comprueba igual por si acaso (sin ciclos ni más de tres niveles).
  const elegido = $('#cat-padre').value || null;
  const padre = elegido && C.padresPosibles(datos.categorias, editandoCat, tipo).some((f) => f.categoria.id === elegido) ? elegido : null;
  const campos = { emoji: $('#cat-emoji').value.trim().slice(0, 8), nombre, tipo, presupuesto, padre };
  const antes = JSON.stringify(datos.categorias);
  if (editandoCat) {
    const c = datos.categorias.find((x) => x.id === editandoCat);
    if (c) {
      // Si cambia de gasto a ingreso (o al revés), sus subcategorías cambian con ella.
      if (c.tipo !== tipo) {
        const suyas = C.descendientes(datos.categorias, c.id);
        for (const x of datos.categorias) {
          if (x.id !== c.id && suyas.has(x.id)) Object.assign(x, { tipo, presupuesto: tipo === 'ingreso' ? null : x.presupuesto });
        }
      }
      Object.assign(c, campos);
    }
  } else {
    datos.categorias.push({ id: C.nuevoId(), ...campos });
  }
  datos.categorias = C.normalizarArbol(datos.categorias);
  // Guardarla (dentro de otra o como principal) es decidir su sitio: deja de estar "Sin colocar".
  const sinColocarAntes = datos.sinColocar;
  if (editandoCat) quitarDeSinColocar(editandoCat);
  if (!guardar()) { datos.categorias = JSON.parse(antes); datos.sinColocar = sinColocarAntes; return; }
  $('#dlg-cat').close();
  aviso('Categoría guardada');
  pintar();
}

async function borrarCategoria() {
  const id = editandoCat;
  const c = datos.categorias.find((x) => x.id === id);
  const usos = datos.movimientos.filter((m) => m.categoria === id).length;
  const hijas = C.hijasDe(datos.categorias, id);
  const arriba = c && c.padre ? datos.categorias.find((x) => x.id === c.padre) : null;
  $('#dlg-cat').close();
  let texto = usos
    ? `Tiene ${usos} movimiento${usos === 1 ? '' : 's'}. No se borran: pasarán a «Sin categoría».`
    : 'No tiene movimientos.';
  if (hijas.length) {
    texto += ` Sus ${hijas.length === 1 ? 'subcategoría' : `${hijas.length} subcategorías`} no se borra${hijas.length === 1 ? '' : 'n'}: `
      + (arriba ? `pasa${hijas.length === 1 ? '' : 'n'} a estar dentro de «${arriba.nombre}».` : `pasa${hijas.length === 1 ? '' : 'n'} a ser principal${hijas.length === 1 ? '' : 'es'}.`);
  }
  const ok = await confirmar({ titulo: `¿Borrar «${c ? c.nombre : ''}»?`, texto, si: 'Borrar' });
  if (!ok) { abrirCategoria(id); return; }
  datos.categorias = C.normalizarArbol(C.quitarCategoria(datos.categorias, id));
  olvidarCategoriasQuitadas();
  guardar();
  aviso('Categoría borrada');
  pintar();
}

/** "Pasar sus movimientos a otra…": enseña a cuál (las del mismo tipo, menos ella). */
function mostrarPasar() {
  const c = datos.categorias.find((x) => x.id === editandoCat);
  if (!c) return;
  const opciones = C.ordenArbol(datos.categorias, c.tipo).filter((f) => f.categoria.id !== c.id);
  $('#cat-destino').innerHTML = '<option value="">Elige una…</option>'
    + opciones.map((f) => `<option value="${esc(f.categoria.id)}">${esc(C.textoRuta(datos.categorias, f.categoria.id))}</option>`).join('');
  $('#cat-pasar').hidden = false;
  $('[data-accion="pasar-cat"]').hidden = true;
  $('#cat-destino').focus();
}

async function pasarCategoria() {
  const id = editandoCat;
  const c = datos.categorias.find((x) => x.id === id);
  const destino = $('#cat-destino').value;
  const err = $('#cat-error');
  if (!c) return;
  if (!destino) { err.textContent = 'Elige a qué categoría pasan sus movimientos.'; err.hidden = false; return; }
  const usos = datos.movimientos.filter((m) => m.categoria === id).length;
  const hijas = C.hijasDe(datos.categorias, id).length;
  $('#dlg-cat').close();
  const ok = await confirmar({
    titulo: `¿Pasar ${plural(usos, 'movimiento', 'movimientos')} a «${rutaDe(destino)}»?`,
    texto: `Después se borra «${c.nombre}».${hijas ? ` Sus subcategorías no se borran: suben un nivel.` : ''}`,
    si: 'Pasar y borrar',
    peligro: false,
  });
  if (!ok) { abrirCategoria(id); return; }
  const antes = { categorias: datos.categorias, movimientos: datos.movimientos, sinColocar: datos.sinColocar };
  const r = C.pasarMovimientos(datos.categorias, datos.movimientos, id, destino);
  datos.categorias = C.normalizarArbol(r.categorias);
  datos.movimientos = r.movimientos;
  olvidarCategoriasQuitadas();
  if (!guardar()) { Object.assign(datos, antes); return; }
  aviso(`${plural(r.n, 'movimiento pasado', 'movimientos pasados')} a «${rutaDe(destino)}»`);
  pintar();
}

/** Tras quitar categorías: que "la última usada" y "Sin colocar" no apunten a ninguna que ya no existe. */
function olvidarCategoriasQuitadas() {
  const ids = new Set(datos.categorias.map((c) => c.id));
  for (const t of ['gasto', 'ingreso']) if (!ids.has(ultimaCategoria[t])) ultimaCategoria[t] = null;
  datos.sinColocar = (datos.sinColocar || []).filter((id) => ids.has(id));
}

const quitarDeSinColocar = (id) => { datos.sinColocar = (datos.sinColocar || []).filter((x) => x !== id); };

// ---------- Organizar con una lista ----------

let planLista = null; // lo que se va a hacer, calculado en "Ver cómo queda"

function abrirLista() {
  planLista = null;
  $('#lista-paso1').hidden = false;
  $('#lista-paso2').hidden = true;
  $('#lista-error').hidden = true;
  $('#dlg-lista').showModal();
  setTimeout(() => $('#lista-texto').focus(), 50);
}

function verLista() {
  const { nodos, ignoradas } = C.leerListaCategorias($('#lista-texto').value);
  const err = $('#lista-error');
  if (!nodos.length) {
    err.textContent = 'No encuentro ningún nombre en la lista. Escribe una categoría por línea.';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  const p = C.planOrganizar(nodos, datos.categorias, datos.movimientos);
  planLista = p;
  const usos = new Map();
  for (const m of datos.movimientos) usos.set(m.categoria, (usos.get(m.categoria) || 0) + 1);
  const cambios = [];
  if (p.nuevas) cambios.push(`${plural(p.nuevas, 'categoría nueva', 'categorías nuevas')}.`);
  if (p.movidas) cambios.push(`${p.movidas} que ya tenías ${p.movidas === 1 ? 'se coloca' : 'se colocan'} en su sitio, con sus movimientos.`);
  if (p.iguales) cambios.push(`${p.iguales} que ya tenías ${p.iguales === 1 ? 'ya estaba' : 'ya estaban'} bien.`);
  if (p.fusiones.length) {
    const destino = (id) => p.filas.find((f) => f.id === id)?.nombre || '';
    cambios.push(`${p.fusiones.length} que ya tenías ${p.fusiones.length === 1 ? 'se junta' : 'se juntan'} en otra (por los nombres entre paréntesis): ${plural(p.movimientosCambiados, 'movimiento cambia', 'movimientos cambian')} de categoría.
      <details><summary>Ver cuáles</summary>${p.fusiones.map((f) => `${esc(f.nombre)} → ${esc(destino(f.destino))} (${plural(f.n, 'movimiento', 'movimientos')})`).join('<br>')}</details>`);
  }
  if (p.sinTocar.length) {
    const conMovs = p.sinTocar.filter((c) => usos.get(c.id)).length;
    cambios.push(`${p.sinTocar.length} que ya tenías no ${p.sinTocar.length === 1 ? 'está' : 'están'} en la lista: ${p.sinTocar.length === 1 ? 'se queda' : 'se quedan'} como ${p.sinTocar.length === 1 ? 'está' : 'están'}.${conMovs ? ` Las ${conMovs} que tienen movimientos te las enseño en Ajustes como «Sin colocar».` : ''}
      <details><summary>Ver cuáles</summary>${p.sinTocar.map((c) => esc(C.textoRuta(p.categorias, c.id))).join(', ')}</details>`);
  }
  if (ignoradas.length) {
    cambios.push(`${plural(ignoradas.length, 'línea no se usa', 'líneas no se usan')}: ${ignoradas.length === 1 ? 'es demasiado larga' : 'son demasiado largas'} para ser un nombre.
      <details><summary>Ver cuáles</summary>${ignoradas.map(esc).join('<br>')}</details>`);
  }
  cambios.push(p.fusiones.length
    ? 'No se borra ningún movimiento. Solo desaparecen las categorías que se juntan en otra.'
    : 'No se borra ninguna categoría ni ningún movimiento.');
  const etiqueta = (f) => {
    const junta = f.juntadas.length ? ` · junta ${f.juntadas.map((n) => `«${esc(n)}»`).join(', ')}` : '';
    if (f.estado === 'nueva') return `<span class="etq nueva">nueva${junta}</span>`;
    const n = usos.get(f.id) || 0;
    const como = f.antes ? ` (era «${esc(f.antes)}»)` : '';
    return `<span class="etq">ya la tenías${como}${n ? ` · ${plural(n, 'movimiento', 'movimientos')}` : ''}${junta}</span>`;
  };
  const arbol = (tipo) => p.filas.filter((f) => f.tipo === tipo)
    .map((f) => `<li class="nivel-${f.nivel}"><span>${esc(f.nombre)}</span>${etiqueta(f)}</li>`).join('');
  const gastos = arbol('gasto');
  const ingresos = arbol('ingreso');
  $('#lista-resumen').innerHTML = `
    <p class="explica">Así quedará. Revísalo y dale a <strong>Aplicar</strong>.</p>
    <ul class="lista-cambios">${cambios.map((c) => `<li>${c}</li>`).join('')}</ul>
    ${gastos ? `<h3 class="grupo-titulo">Gastos</h3><ul class="arbol">${gastos}</ul>` : ''}
    ${ingresos ? `<h3 class="grupo-titulo">Ingresos</h3><ul class="arbol">${ingresos}</ul>` : ''}`;
  $('#lista-paso1').hidden = true;
  $('#lista-paso2').hidden = false;
  $('#dlg-lista').scrollTop = 0;
}

function cancelarLista() {
  planLista = null;
  $('#lista-paso2').hidden = true;
  $('#lista-paso1').hidden = false;
}

function aplicarLista() {
  if (!planLista) return;
  const antes = { categorias: datos.categorias, movimientos: datos.movimientos, sinColocar: datos.sinColocar };
  const conMovs = new Set(planLista.movimientos.map((m) => m.categoria));
  datos.categorias = planLista.categorias;
  datos.movimientos = planLista.movimientos;
  // Las que no están en la lista y tienen movimientos: se marcan para que sepa cuáles le falta colocar.
  datos.sinColocar = planLista.sinTocar.filter((c) => conMovs.has(c.id)).map((c) => c.id);
  if (!guardar()) { Object.assign(datos, antes); return; }
  olvidarCategoriasQuitadas();
  planLista = null;
  $('#dlg-lista').close();
  aviso('Categorías organizadas');
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

// ---------- Ingreso esperado ----------

function abrirEsperado(grupo = null) {
  editandoEsperado = grupo;
  const hoy = C.claveMes(C.hoyISO());
  const e = grupo ? C.lineasEsperadas(datos.esperados, hoy).find((x) => x.grupo === grupo) : null;
  $('#dlg-esperado-titulo').textContent = e ? 'Cambiar ingreso esperado' : 'Nuevo ingreso esperado';
  $('#esp-nombre').value = e ? e.nombre : '';
  $('#esp-importe').value = e && e.importe ? C.importeEditable(e.importe) : '';
  $('#esp-pegar-bloque').hidden = true;
  $('#esp-pegar-texto').value = '';
  const catSel = e ? e.categoria : null;
  $('#esp-categoria').innerHTML = '<option value="">Ninguna (solo cuenta en el total)</option>'
    + C.ordenArbol(datos.categorias, 'ingreso').map(({ categoria: c }) => `<option value="${esc(c.id)}" ${c.id === catSel ? 'selected' : ''}>${esc(C.textoRuta(datos.categorias, c.id))}</option>`).join('');
  const moneda = e ? e.moneda : datos.moneda;
  $('#esp-moneda').innerHTML = Object.keys(C.MONEDAS)
    .map((cod) => `<label><input type="radio" name="esp-moneda" value="${cod}" ${cod === moneda ? 'checked' : ''}><span>${cod}</span></label>`).join('');
  // Desde dos años atrás (para compararlo con lo ya apuntado) hasta un año adelante. Nuevo: desde que empezó
  // este año (septiembre), para ver ya cómo va.
  const desde = e ? (e.desde > hoy ? e.desde : hoy) : añoDeHoy();
  const opciones = [];
  for (let i = -24; i <= 12; i++) opciones.push(C.moverMes(hoy, i));
  if (!opciones.includes(desde)) opciones.push(desde);
  opciones.sort();
  $('#esp-desde').innerHTML = opciones.map((k) => `<option value="${k}" ${k === desde ? 'selected' : ''}>${esc(C.nombreMes(k))}</option>`).join('');
  $('#esp-desde-etiqueta').textContent = e ? 'El cambio vale desde' : 'Lo esperas desde';
  $('#esp-explica').textContent = e
    ? 'Los meses de antes se quedan con lo que tenían.'
    : 'Si eliges un mes pasado, verás también cómo te fue esos meses.';
  pintarMesesEsperado(grupo);
  $('#esp-borrar').hidden = !e;
  $('#esp-error').hidden = true;
  $('#dlg-esperado').showModal();
  if (!e) setTimeout(() => $('#esp-nombre').focus(), 50);
}

/** Un campo por mes del año que se ve en el Historial, con el importe propio de ese mes si lo tiene. */
function pintarMesesEsperado(grupo) {
  $('#esp-meses-titulo').textContent = `Mes a mes (${C.nombreAño(año)})`;
  const propios = new Map((datos.esperadosMes || []).filter((a) => a.grupo === grupo).map((a) => [a.mes, a.importe]));
  $('#esp-meses').innerHTML = C.mesesDelAño(año).map((k) => `
    <label class="campo esp-mes">
      <span>${esc(C.nombreMes(k))}</span>
      <input data-mes="${k}" inputmode="decimal" autocomplete="off" placeholder="Lo habitual" value="${propios.has(k) ? esc(propios.get(k) ? C.importeEditable(propios.get(k)) : '0') : ''}">
    </label>`).join('');
}

/** Rellena los campos de cada mes con una lista pegada ("septiembre 2026  $1,308"). */
function rellenarMesesEsperado() {
  const err = $('#esp-error');
  const { porMes, noLeidas } = C.leerListaMeses($('#esp-pegar-texto').value, Number(año.slice(0, 4)));
  let puestos = 0;
  for (const inp of document.querySelectorAll('#esp-meses input')) {
    if (!(inp.dataset.mes in porMes)) continue;
    const v = porMes[inp.dataset.mes];
    inp.value = v ? C.importeEditable(v) : '0';
    puestos++;
  }
  const fuera = Object.keys(porMes).length - puestos;
  if (!puestos) {
    err.textContent = Object.keys(porMes).length
      ? `Esos meses no son de ${C.nombreAño(año)}. Cambia de año con las flechas del Historial y vuelve aquí.`
      : 'No he entendido la lista. Pon una línea por mes, por ejemplo: septiembre 2026 $1,000';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  $('#esp-pegar-bloque').hidden = true;
  const notas = [];
  if (fuera) notas.push(`${fuera} de otro año no se pusieron`);
  if (noLeidas.length) notas.push(`${noLeidas.length} línea${noLeidas.length === 1 ? '' : 's'} sin entender`);
  aviso(`Rellenados ${puestos} meses${notas.length ? ` (${notas.join(', ')})` : ''}. Revisa y dale a Guardar`);
}

function guardarEsperado() {
  const err = $('#esp-error');
  const nombre = $('#esp-nombre').value.trim().slice(0, 40);
  if (!nombre) { err.textContent = 'Ponle un nombre, por ejemplo Sueldo.'; err.hidden = false; return; }
  const txtHabitual = $('#esp-importe').value.trim();
  const importe = txtHabitual ? C.parseImporteOCero(txtHabitual) : 0;
  if (importe == null) { err.textContent = 'Lo habitual tiene que ser un importe, o déjalo vacío.'; err.hidden = false; return; }
  const moneda = document.querySelector('#esp-moneda input:checked')?.value || datos.moneda;
  const porMes = {};
  for (const inp of document.querySelectorAll('#esp-meses input')) {
    const txt = inp.value.trim();
    const v = txt ? C.parseImporteOCero(txt) : null;
    if (txt && v == null) { err.textContent = `En ${C.nombreMes(inp.dataset.mes).toLowerCase()} pon un importe, o déjalo vacío.`; err.hidden = false; return; }
    porMes[inp.dataset.mes] = v;
  }
  if (!importe && !Object.values(porMes).some((v) => v != null)) {
    err.textContent = 'Pon lo habitual al mes o la cantidad de cada mes.'; err.hidden = false; return;
  }
  const categoria = $('#esp-categoria').value || null;
  datos.esperados = C.ponerEsperado(datos.esperados, editandoEsperado, { nombre, importe, moneda, categoria }, $('#esp-desde').value);
  const grupo = editandoEsperado || datos.esperados[datos.esperados.length - 1].grupo;
  datos.esperadosMes = C.ponerEsperadosMes(datos.esperadosMes, grupo, porMes, importe, moneda);
  if (!guardar()) return;
  $('#dlg-esperado').close();
  aviso('Ingreso esperado guardado');
  pintar();
}

async function borrarEsperado() {
  const grupo = editandoEsperado;
  const hoy = C.claveMes(C.hoyISO());
  const e = C.lineasEsperadas(datos.esperados, hoy).find((x) => x.grupo === grupo);
  $('#dlg-esperado').close();
  const ok = await confirmar({
    titulo: `¿Dejar de esperar «${e ? e.nombre : ''}»?`,
    texto: 'Deja de contar desde este mes. En los meses de antes se sigue viendo lo que esperabas.',
    si: 'Sí, ya no lo espero',
  });
  if (!ok) { abrirEsperado(grupo); return; }
  datos.esperados = C.quitarEsperado(datos.esperados, grupo, hoy);
  guardar();
  aviso('Hecho');
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
  año = añoDeHoy();
  guardar();
  aviso(r.descartados ? `Copia recuperada (${r.descartados} movimientos no se pudieron leer)` : 'Copia recuperada');
  pintar();
}

// ---------- Traer datos de Wallet ----------

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

async function traerWallet(archivo) {
  let r;
  try {
    r = C.leerWallet(await archivo.text());
  } catch (e) {
    r = { ok: false, error: 'No he podido leer el archivo.' };
  }
  if (!r.ok) { aviso(r.error); return; }
  const p = C.prepararWallet(r.filas, datos);
  const n = p.movimientos.length;
  const lista = [];
  if (n) {
    lista.push(`Del ${C.fechaDMA(p.desde)} al ${C.fechaDMA(p.hasta)}`);
    if (p.cuentasNuevas.length) lista.push(`${plural(p.cuentasNuevas.length, 'cuenta nueva', 'cuentas nuevas')}: ${p.cuentasNuevas.map((c) => c.nombre).join(', ')}`);
    if (p.categoriasNuevas.length) lista.push(plural(p.categoriasNuevas.length, 'categoría nueva', 'categorías nuevas'));
  }
  if (p.transferencias) lista.push(`${plural(p.transferencias, 'transferencia', 'transferencias')} entre tus cuentas: no se traen`);
  if (p.duplicados) lista.push(`${plural(p.duplicados, 'movimiento ya estaba', 'movimientos ya estaban')}: no se repiten`);
  if (p.otraMoneda) lista.push(`${plural(p.otraMoneda, 'movimiento', 'movimientos')} en una moneda que la app no tiene: no se traen`);
  if (p.rotas) lista.push(`${plural(p.rotas, 'fila no se ha podido leer', 'filas no se han podido leer')}`);
  if (!n) {
    await confirmar({ titulo: 'No hay nada nuevo que traer', texto: 'Todo lo de este archivo ya está en la app o no se trae.', lista, si: 'Vale', peligro: false, soloAceptar: true });
    return;
  }
  const ok = await confirmar({
    titulo: `¿Traer ${plural(n, 'movimiento', 'movimientos')} de Wallet?`,
    texto: 'Se añaden a lo que ya tienes; no se borra nada.',
    lista,
    si: 'Traer',
    peligro: false,
  });
  if (!ok) return;
  datos.cuentas.push(...p.cuentasNuevas);
  datos.categorias.push(...p.categoriasNuevas);
  datos.movimientos.push(...p.movimientos);
  if (!guardar()) {
    // No cabe o no se puede guardar: se deshace para no quedarse a medias.
    const nuevos = new Set(p.movimientos.map((m) => m.id));
    datos.movimientos = datos.movimientos.filter((m) => !nuevos.has(m.id));
    datos.cuentas = datos.cuentas.filter((c) => !p.cuentasNuevas.includes(c));
    datos.categorias = datos.categorias.filter((c) => !p.categoriasNuevas.includes(c));
    return;
  }
  mes = C.claveMes(p.hasta);
  año = C.inicioDelAño(mes, datos.inicioAño);
  aviso(`Listo: ${plural(n, 'movimiento traído', 'movimientos traídos')} de Wallet`);
  pintar();
}

async function borrarTodo() {
  const ok = await confirmar({
    titulo: '¿Borrar todo?',
    texto: 'Se borran todos los movimientos, categorías, cuentas y presupuestos de este móvil. Si no tienes una copia, no se podrá recuperar.',
    si: 'Borrar todo',
  });
  if (!ok) return;
  const { moneda, inicioAño } = datos;
  datos = C.datosIniciales();
  Object.assign(datos, { moneda, inicioAño });
  guardar();
  aviso('Todo borrado');
  pintar();
}

// ---------- Eventos ----------

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-vista]');
  if (nav) { vista = nav.dataset.vista; pintar(); window.scrollTo(0, 0); return; }

  const chip = e.target.closest('#mov-categorias .chip');
  if (chip) { pintarChips(chip.dataset.cat); return; }
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
    case 'pasar-cat': mostrarPasar(); break;
    case 'pasar-cat-ok': pasarCategoria(); break;
    case 'organizar': abrirLista(); break;
    case 'lista-ver': verLista(); break;
    case 'lista-cancelar': cancelarLista(); break;
    case 'lista-aplicar': aplicarLista(); break;
    case 'editar-cuenta': abrirCuenta(el.dataset.id); break;
    case 'nueva-cuenta': abrirCuenta(); break;
    case 'borrar-cuenta': borrarCuenta(); break;
    case 'editar-esperado': abrirEsperado(el.dataset.id); break;
    case 'nuevo-esperado': abrirEsperado(); break;
    case 'borrar-esperado': borrarEsperado(); break;
    case 'esp-pegar': $('#esp-pegar-bloque').hidden = false; $('#esp-pegar-texto').focus(); break;
    case 'esp-rellenar': rellenarMesesEsperado(); break;
    case 'cerrar': el.closest('dialog').close(); break;
    // En el Historial las flechas mueven de año en año.
    case 'mes-anterior': if (vista === 'historial') año = C.moverMes(año, -12); else mes = C.moverMes(mes, -1); pintar(); break;
    case 'mes-siguiente': if (vista === 'historial') año = C.moverMes(año, 12); else mes = C.moverMes(mes, 1); pintar(); break;
    case 'mes-hoy': if (vista === 'historial') año = añoDeHoy(); else mes = C.claveMes(C.hoyISO()); pintar(); break;
    case 'exportar': exportar(); break;
    case 'importar': $('#archivo-importar').value = ''; $('#archivo-importar').click(); break;
    case 'wallet': $('#archivo-wallet').value = ''; $('#archivo-wallet').click(); break;
    case 'borrar-todo': borrarTodo(); break;
    case 'actualizar': actualizarApp(); break;
    default: break;
  }
});

$('#form-mov').addEventListener('submit', (e) => { e.preventDefault(); guardarMovimiento(); });
$('#form-cat').addEventListener('submit', (e) => { e.preventDefault(); guardarCategoria(); });
$('#form-cuenta').addEventListener('submit', (e) => { e.preventDefault(); guardarCuenta(); });
$('#form-esperado').addEventListener('submit', (e) => { e.preventDefault(); guardarEsperado(); });
for (const r of document.querySelectorAll('#form-mov input[name="tipo"]')) {
  r.addEventListener('change', () => {
    pintarChips(categoriaPorDefecto(tipoMov())?.id);
    actualizarBase();
  });
}
$('#mov-moneda').addEventListener('change', () => { baseTocada = false; actualizarBase(); });
$('#mov-importe').addEventListener('input', actualizarBase);
$('#mov-fecha').addEventListener('change', actualizarBase);
$('#mov-importe-base').addEventListener('input', () => { baseTocada = $('#mov-importe-base').value.trim() !== ''; actualizarBase(); });
for (const r of document.querySelectorAll('#form-cat input[name="cat-tipo"]')) {
  r.addEventListener('change', () => {
    $('#cat-presupuesto-campo').hidden = tipoCat() === 'ingreso';
    pintarPadres($('#cat-padre').value);
  });
}
$('#archivo-importar').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importar(f); });
$('#archivo-wallet').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) traerWallet(f); });
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
