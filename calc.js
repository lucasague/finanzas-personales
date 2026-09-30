// Funciones puras de la app: sin DOM ni almacenamiento, para poder probarlas con node.
// Los importes se guardan SIEMPRE en céntimos (enteros) para no arrastrar errores de coma flotante.

export const MONEDAS = {
  MXN: { locale: 'es-MX', nombre: 'Peso mexicano' },
  CRC: { locale: 'es-CR', nombre: 'Colón costarricense' },
  USD: { locale: 'es-MX', nombre: 'Dólar estadounidense' }, // es-MX: "USD 10", que no se confunda con el peso
  EUR: { locale: 'es-ES', nombre: 'Euro' },
};

export const CATEGORIAS_POR_DEFECTO = [
  { id: 'comida', emoji: '🍽️', nombre: 'Comida', tipo: 'gasto' },
  { id: 'casa', emoji: '🏠', nombre: 'Casa', tipo: 'gasto' },
  { id: 'transporte', emoji: '🚌', nombre: 'Transporte', tipo: 'gasto' },
  { id: 'salud', emoji: '💊', nombre: 'Salud', tipo: 'gasto' },
  { id: 'ocio', emoji: '🎉', nombre: 'Ocio', tipo: 'gasto' },
  { id: 'donativos', emoji: '🤝', nombre: 'Donativos', tipo: 'gasto' },
  { id: 'otros', emoji: '🧾', nombre: 'Otros', tipo: 'gasto' },
  { id: 'sueldo', emoji: '💼', nombre: 'Sueldo', tipo: 'ingreso' },
  { id: 'otros-ingresos', emoji: '➕', nombre: 'Otros ingresos', tipo: 'ingreso' },
];

export const TIPOS_CUENTA = {
  efectivo: { emoji: '💵', nombre: 'Efectivo' },
  debito: { emoji: '💳', nombre: 'Débito' },
  credito: { emoji: '🏦', nombre: 'Crédito' },
};

export const CUENTAS_POR_DEFECTO = [
  { id: 'efectivo', nombre: 'Efectivo', tipo: 'efectivo' },
  { id: 'debito', nombre: 'Débito', tipo: 'debito' },
  { id: 'credito', nombre: 'Tarjeta de crédito', tipo: 'credito' },
];

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const VERSION_DATOS = 6;
export const INICIO_AÑO_POR_DEFECTO = 9; // septiembre: el año va de septiembre a agosto

export function datosIniciales() {
  return {
    version: VERSION_DATOS,
    moneda: 'MXN',
    inicioAño: INICIO_AÑO_POR_DEFECTO,
    categorias: CATEGORIAS_POR_DEFECTO.map((c) => ({ ...c, presupuesto: null, padre: null })),
    cuentas: CUENTAS_POR_DEFECTO.map((c) => ({ ...c })),
    movimientos: [],
    sinColocar: [], // categorías con movimientos que no estaban en la lista al organizarlas: le faltan sitio
    esperados: [], // ingreso esperado al mes (ver "Ingreso esperado")
    esperadosMes: [], // lo esperado de un mes concreto, cuando no es lo habitual
    iconosAuto: true, // ya se pusieron los iconos por el nombre (ver ponerIconos)
  };
}

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Convierte lo que escribe la persona en céntimos. Acepta "1500", "1,500", "1.500,50", "12,5", "$ 30".
 * Devuelve null si no es un importe positivo.
 */
export function parseImporte(texto) {
  if (texto == null) return null;
  let s = String(texto).replace(/[^\d.,]/g, '');
  if (!s) return null;
  const ultPunto = s.lastIndexOf('.');
  const ultComa = s.lastIndexOf(',');
  let decimal = null;
  if (ultPunto >= 0 && ultComa >= 0) {
    decimal = ultPunto > ultComa ? '.' : ',';
  } else if (ultPunto >= 0 || ultComa >= 0) {
    const sep = ultPunto >= 0 ? '.' : ',';
    const partes = s.split(sep);
    const tras = partes[partes.length - 1];
    // Un único separador seguido de 1 o 2 cifras es decimal ("12,5", "30.25"); si no, es de miles ("1,500").
    if (partes.length === 2 && tras.length > 0 && tras.length <= 2) decimal = sep;
  }
  let entero = s;
  let frac = '';
  if (decimal) {
    const i = s.lastIndexOf(decimal);
    entero = s.slice(0, i);
    frac = s.slice(i + 1);
  }
  entero = entero.replace(/[.,]/g, '');
  frac = frac.replace(/[.,]/g, '').slice(0, 2).padEnd(2, '0');
  if (!entero && frac === '00') return null;
  const cent = parseInt(entero || '0', 10) * 100 + parseInt(frac, 10);
  if (!Number.isFinite(cent) || cent <= 0) return null;
  return cent;
}

/** Céntimos -> texto con la moneda. Sin decimales si el importe es redondo. */
export function formatoMoneda(centimos, moneda = 'MXN') {
  const m = MONEDAS[moneda] || MONEDAS.MXN;
  const redondo = centimos % 100 === 0;
  return new Intl.NumberFormat(m.locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: redondo ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100);
}

/** Céntimos -> texto editable en el campo de importe ("1500" o "12.50"). */
export function importeEditable(centimos) {
  return centimos % 100 === 0 ? String(centimos / 100) : (centimos / 100).toFixed(2);
}

export function simboloMoneda(moneda = 'MXN') {
  const m = MONEDAS[moneda] || MONEDAS.MXN;
  const parte = new Intl.NumberFormat(m.locale, { style: 'currency', currency: moneda })
    .formatToParts(1)
    .find((p) => p.type === 'currency');
  return parte ? parte.value : moneda;
}

export function hoyISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function esFechaISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
}

/** "2026-09-28" -> "28/09/2026" */
export function fechaDMA(iso) {
  if (!esFechaISO(iso)) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "2026-09-28" -> "2026-09" */
export function claveMes(iso) {
  return iso.slice(0, 7);
}

/** Mueve una clave de mes ("2026-09") n meses. */
export function moverMes(clave, n) {
  const [a, m] = clave.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${na}-${String(nm).padStart(2, '0')}`;
}

export function nombreMes(clave) {
  const [a, m] = clave.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

// ---------- Años que no empiezan en enero ----------
// Un "año" se identifica por la clave de su primer mes: con inicio 9, "2026-09" es septiembre 2026 – agosto 2027.

/** Primer mes del año (que empieza en el mes `inicio`, 1-12) al que pertenece el mes `clave`. */
export function inicioDelAño(clave, inicio = INICIO_AÑO_POR_DEFECTO) {
  const [a, m] = clave.split('-').map(Number);
  const año = m >= inicio ? a : a - 1;
  return `${año}-${String(inicio).padStart(2, '0')}`;
}

/** Las 12 claves de mes del año que empieza en `desde`, en orden. */
export function mesesDelAño(desde) {
  return Array.from({ length: 12 }, (_, i) => moverMes(desde, i));
}

/** "Sep 2026 – Ago 2027"; si el año empieza en enero, "Ene – Dic 2026". */
export function nombreAño(desde) {
  const hasta = moverMes(desde, 11);
  const corto = (c) => MESES[Number(c.slice(5, 7)) - 1].slice(0, 3);
  if (desde.slice(0, 4) === hasta.slice(0, 4)) return `${corto(desde)} – ${corto(hasta)} ${desde.slice(0, 4)}`;
  return `${corto(desde)} ${desde.slice(0, 4)} – ${corto(hasta)} ${hasta.slice(0, 4)}`;
}

/** true si el mes `clave` cae en el año que empieza en `desde`. */
export function enAño(clave, desde) {
  const d = distanciaMeses(clave, desde);
  return d >= 0 && d < 12;
}

/** Movimientos del mes, más recientes primero. */
export function movimientosDelMes(movimientos, clave) {
  return movimientos
    .filter((m) => claveMes(m.fecha) === clave)
    .sort((x, y) => (y.fecha.localeCompare(x.fecha)) || ((y.creado || 0) - (x.creado || 0)));
}

export function resumenMes(movimientos, clave) {
  let ingresos = 0;
  let gastos = 0;
  for (const m of movimientos) {
    if (claveMes(m.fecha) !== clave) continue;
    if (m.tipo === 'ingreso') ingresos += m.importe;
    else gastos += m.importe;
  }
  return { ingresos, gastos, saldo: ingresos - gastos };
}

/**
 * Gasto del mes por categoría principal, de mayor a menor: cada una suma lo suyo y lo de todas sus
 * subcategorías. Incluye las categorías con presupuesto aunque no tengan gasto (para ver cuánto queda). Los
 * gastos de categorías borradas van a "Sin categoría".
 * Cada fila trae `hijos` con el desglose (filas iguales, una por subcategoría, más "(sin subcategoría)" si hay
 * gastos apuntados directamente en la de arriba). Un presupuesto puede estar en cualquier nivel y se compara con
 * lo de esa categoría más lo de sus subcategorías.
 * fraccion: gastado/presupuesto si hay presupuesto; si no, en las principales gastado/mayor gasto y en las
 * subcategorías gastado/gasto de la de arriba (para dibujar la barra).
 * `clave` puede ser un mes o una lista de meses (un año); con conPresupuesto: false no se miran los
 * presupuestos, que son al mes.
 */
export function gastoPorCategoria(movimientos, clave, categorias, { conPresupuesto = true } = {}) {
  const claves = new Set(Array.isArray(clave) ? clave : [clave]);
  const cats = normalizarArbol(categorias.filter((c) => c.tipo === 'gasto'));
  const original = new Map(categorias.map((c) => [c.id, c])); // en las filas van las de verdad, no las copias
  const directo = new Map();
  let huerfano = 0;
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || !claves.has(claveMes(m.fecha))) continue;
    if (original.has(m.categoria) && original.get(m.categoria).tipo === 'gasto') {
      directo.set(m.categoria, (directo.get(m.categoria) || 0) + m.importe);
    } else huerfano += m.importe;
  }
  const hijas = new Map();
  for (const c of cats) {
    if (!hijas.has(c.padre)) hijas.set(c.padre, []);
    hijas.get(c.padre).push(c);
  }
  const conPres = (c) => conPresupuesto && c.presupuesto > 0;
  const ordenar = (filas) => filas.sort((a, b) => b.gastado - a.gastado || (b.presupuesto || 0) - (a.presupuesto || 0));
  const acabar = (f, total) => {
    const p = conPres(f.categoria) ? f.categoria.presupuesto : null;
    const fila = {
      categoria: f.categoria,
      gastado: f.gastado,
      presupuesto: p,
      restante: p != null ? p - f.gastado : null,
      fraccion: p != null ? f.gastado / p : f.gastado / Math.max(1, total),
      hijos: [],
    };
    fila.hijos = f.hijos.map((h) => acabar(h, f.gastado));
    if (f.sinSub) fila.sinSub = true;
    return fila;
  };
  const fila = (c) => {
    const subs = (hijas.get(c.id) || []).map(fila).filter((f) => f.visible);
    const propio = directo.get(c.id) || 0;
    const gastado = propio + subs.reduce((t, f) => t + f.gastado, 0);
    const hijos = ordenar(subs);
    if (hijos.length && propio > 0) {
      hijos.push({ categoria: { id: c.id, emoji: '', nombre: '(sin subcategoría)', tipo: 'gasto', presupuesto: null }, gastado: propio, hijos: [], sinSub: true });
      ordenar(hijos);
    }
    return { categoria: original.get(c.id), gastado, hijos, visible: gastado > 0 || conPres(c) || hijos.length > 0 };
  };
  const filas = (hijas.get(null) || []).map(fila).filter((f) => f.visible);
  if (huerfano > 0) filas.push({ categoria: { id: null, emoji: '❔', nombre: 'Sin categoría', tipo: 'gasto', presupuesto: null }, gastado: huerfano, hijos: [] });
  const maximo = Math.max(1, ...filas.map((f) => f.gastado));
  return ordenar(filas.map((f) => acabar(f, maximo)));
}

/**
 * Lo que se movió en cada cuenta en el mes (ingresos − gastos), solo las cuentas con movimientos.
 * Recibe movimientos ya pasados por enMonedaBase. Los de cuentas borradas o sin cuenta van a "Sin cuenta".
 */
export function netoPorCuenta(movs, clave, cuentas) {
  const porId = new Map(cuentas.map((c) => [c.id, { cuenta: c, ingresos: 0, gastos: 0, n: 0 }]));
  const huerfana = { cuenta: { id: null, nombre: 'Sin cuenta', tipo: null }, ingresos: 0, gastos: 0, n: 0 };
  for (const m of movs) {
    if (claveMes(m.fecha) !== clave) continue;
    const fila = porId.get(m.cuenta) || huerfana;
    if (m.tipo === 'ingreso') fila.ingresos += m.importe;
    else fila.gastos += m.importe;
    fila.n++;
  }
  return [...porId.values(), huerfana]
    .filter((f) => f.n > 0)
    .map((f) => ({ cuenta: f.cuenta, ingresos: f.ingresos, gastos: f.gastos, neto: f.ingresos - f.gastos }));
}

/** Comprueba una copia importada (o lo guardado) y la normaliza. Nunca lanza. */
export function validarCopia(obj) {
  try {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no es una copia de esta app.' };
    if (!Array.isArray(obj.movimientos) || !Array.isArray(obj.categorias)) {
      return { ok: false, error: 'Al archivo le faltan los movimientos o las categorías.' };
    }
    const moneda = MONEDAS[obj.moneda] ? obj.moneda : 'MXN';
    // Hasta la versión 3 no se elegía en qué mes empieza el año: septiembre.
    const inicioAño = Number.isInteger(obj.inicioAño) && obj.inicioAño >= 1 && obj.inicioAño <= 12
      ? obj.inicioAño : INICIO_AÑO_POR_DEFECTO;
    const categorias = [];
    const ids = new Set();
    for (const c of obj.categorias) {
      if (!c || typeof c.id !== 'string' || !c.id || ids.has(c.id)) continue;
      ids.add(c.id);
      const pres = Number.isInteger(c.presupuesto) && c.presupuesto > 0 ? c.presupuesto : null;
      categorias.push({
        id: c.id,
        emoji: typeof c.emoji === 'string' ? c.emoji.slice(0, 8) : '',
        nombre: typeof c.nombre === 'string' && c.nombre.trim() ? c.nombre.trim().slice(0, 40) : 'Sin nombre',
        tipo: c.tipo === 'ingreso' ? 'ingreso' : 'gasto',
        presupuesto: c.tipo === 'ingreso' ? null : pres,
        // Hasta la versión 4 no había subcategorías: todas son principales.
        padre: typeof c.padre === 'string' && c.padre ? c.padre : null,
        ...(Array.isArray(c.otrosNombres) && c.otrosNombres.some((x) => typeof x === 'string' && x.trim())
          ? { otrosNombres: c.otrosNombres.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)).slice(0, 30) } : {}),
      });
    }
    // Hasta la versión 2 no había cuentas: se ponen las de partida.
    let cuentas = [];
    if (Array.isArray(obj.cuentas)) {
      const idsC = new Set();
      for (const c of obj.cuentas) {
        if (!c || typeof c.id !== 'string' || !c.id || idsC.has(c.id)) continue;
        idsC.add(c.id);
        cuentas.push({
          id: c.id,
          nombre: typeof c.nombre === 'string' && c.nombre.trim() ? c.nombre.trim().slice(0, 40) : 'Sin nombre',
          tipo: TIPOS_CUENTA[c.tipo] ? c.tipo : 'efectivo',
        });
      }
    } else {
      cuentas = CUENTAS_POR_DEFECTO.map((c) => ({ ...c }));
    }
    const movimientos = [];
    let descartados = 0;
    for (const m of obj.movimientos) {
      if (!m || !Number.isInteger(m.importe) || m.importe <= 0 || !esFechaISO(m.fecha)) {
        descartados++;
        continue;
      }
      // Versión 1 no guardaba moneda: todo estaba en la moneda de la app.
      const monedaMov = MONEDAS[m.moneda] ? m.moneda : moneda;
      const importeBase = Number.isInteger(m.importeBase) && m.importeBase > 0 && MONEDAS[m.monedaBase]
        && m.monedaBase !== monedaMov ? m.importeBase : null;
      movimientos.push({
        id: typeof m.id === 'string' && m.id ? m.id : nuevoId(),
        tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto',
        importe: m.importe,
        moneda: monedaMov,
        importeBase,
        monedaBase: importeBase ? m.monedaBase : null,
        categoria: typeof m.categoria === 'string' ? m.categoria : null,
        cuenta: typeof m.cuenta === 'string' && m.cuenta ? m.cuenta : null,
        nota: typeof m.nota === 'string' ? m.nota.slice(0, 200) : '',
        fecha: m.fecha,
        creado: Number.isFinite(m.creado) ? m.creado : 0,
        // Los traídos de otra app (Wallet) guardan de dónde vienen, para no traerlos dos veces.
        ...(typeof m.origen === 'string' && m.origen && typeof m.claveOrigen === 'string' && m.claveOrigen
          ? { origen: m.origen.slice(0, 20), claveOrigen: m.claveOrigen.slice(0, 40) } : {}),
      });
    }
    return {
      ok: true,
      datos: {
        version: VERSION_DATOS, moneda, inicioAño, categorias: normalizarArbol(categorias), cuentas, movimientos,
        sinColocar: Array.isArray(obj.sinColocar) ? [...new Set(obj.sinColocar.filter((x) => ids.has(x)))] : [],
        // Hasta la versión 5 no había ingreso esperado.
        esperados: validarEsperados(obj.esperados),
        esperadosMes: validarEsperadosMes(obj.esperadosMes),
        // Hasta la versión 6 no se ponían iconos por el nombre: se ponen una vez al abrir.
        iconosAuto: obj.iconosAuto === true,
      },
      descartados,
    };
  } catch (e) {
    return { ok: false, error: 'No he podido leer el archivo.' };
  }
}

// ---------- Varias monedas ----------
// Cada movimiento guarda su importe en la moneda en que se pagó (moneda). Si esa no es la moneda principal,
// guarda también lo que costó en la principal (importeBase, monedaBase): de ahí sale el tipo de cambio real
// de ese día, que es el que se usa para los totales y para estimar los movimientos que no lo traen.

/** Tipos de cambio que salen de los propios movimientos: "USD>MXN" -> Map(mes -> { de, a }) en céntimos. */
export function tasasImplicitas(movimientos) {
  const tasas = new Map();
  for (const m of movimientos) {
    if (!m.importeBase || !m.monedaBase || m.monedaBase === m.moneda) continue;
    const clave = `${m.moneda}>${m.monedaBase}`;
    if (!tasas.has(clave)) tasas.set(clave, new Map());
    const porMes = tasas.get(clave);
    const mes = claveMes(m.fecha);
    const t = porMes.get(mes) || { de: 0, a: 0 };
    t.de += m.importe;
    t.a += m.importeBase;
    porMes.set(mes, t);
  }
  return tasas;
}

function distanciaMeses(a, b) {
  const [aa, am] = a.split('-').map(Number);
  const [ba, bm] = b.split('-').map(Number);
  return (aa * 12 + am) - (ba * 12 + bm);
}

function tasaDirecta(tasas, de, a, mes) {
  const porMes = tasas.get(`${de}>${a}`);
  if (!porMes || !porMes.size) return null;
  let mejor = null;
  let mejorDist = Infinity;
  for (const [k, t] of porMes) {
    const d = distanciaMeses(mes, k);
    // El mes más cercano; a igual distancia, el anterior (lo ya ocurrido).
    const dist = Math.abs(d) * 2 + (d < 0 ? 1 : 0);
    if (dist < mejorDist) { mejorDist = dist; mejor = t; }
  }
  return mejor.a / mejor.de;
}

/** Cuántas unidades de `a` vale una de `de` en ese mes (el mes con dato más cercano). null si no se sabe. */
export function tasa(tasas, de, a, mes) {
  if (de === a) return 1;
  const directa = tasaDirecta(tasas, de, a, mes);
  if (directa != null) return directa;
  const inversa = tasaDirecta(tasas, a, de, mes);
  return inversa != null ? 1 / inversa : null;
}

/** Importe del movimiento en la moneda `base`, en céntimos. null si falta el tipo de cambio. */
export function valorEn(m, base, tasas) {
  const moneda = m.moneda || base;
  if (moneda === base) return m.importe;
  if (m.importeBase && m.monedaBase === base) return m.importeBase;
  const mes = claveMes(m.fecha);
  let t = tasa(tasas, moneda, base, mes);
  if (t != null) return Math.round(m.importe * t);
  if (m.importeBase && m.monedaBase) {
    t = tasa(tasas, m.monedaBase, base, mes);
    if (t != null) return Math.round(m.importeBase * t);
  }
  return null;
}

/**
 * Pasa los movimientos a la moneda principal para sumarlos: `importe` queda en la principal y el original
 * se conserva en `importeOriginal`/`monedaOriginal`. Los que no se pueden convertir se cuentan aparte.
 */
export function enMonedaBase(movimientos, base) {
  const tasas = tasasImplicitas(movimientos);
  const movs = [];
  let sinConvertir = 0;
  for (const m of movimientos) {
    const v = valorEn(m, base, tasas);
    if (v == null) { sinConvertir++; continue; }
    movs.push({ ...m, importe: v, importeOriginal: m.importe, monedaOriginal: m.moneda || base });
  }
  return { movs, sinConvertir, tasas };
}

/**
 * Ingresos, gastos y saldo de cada mes, del más reciente (hasta) hacia atrás, como mucho `n` meses y sin
 * pasar del primer mes con movimientos. Recibe movimientos ya pasados por enMonedaBase.
 */
export function historial(movs, hasta, n = 12) {
  if (!movs.length) return [];
  const primero = movs.reduce((min, m) => (m.fecha < min ? m.fecha : min), movs[0].fecha);
  const desde = claveMes(primero);
  const claves = [];
  for (let i = 0; i < n; i++) {
    const clave = moverMes(hasta, -i);
    if (distanciaMeses(clave, desde) < 0) break;
    claves.push(clave);
  }
  return totalesPorMes(movs, claves);
}

/** Ingresos, gastos, saldo, ingresos por moneda original y nº de movimientos de cada mes de `claves`. */
function totalesPorMes(movs, claves) {
  const meses = claves.map((clave) => ({ clave, ingresos: 0, gastos: 0, saldo: 0, ingresosPorMoneda: {}, n: 0 }));
  const porClave = new Map(meses.map((f) => [f.clave, f]));
  for (const m of movs) {
    const f = porClave.get(claveMes(m.fecha));
    if (!f) continue;
    f.n++;
    if (m.tipo === 'ingreso') {
      f.ingresos += m.importe;
      const mo = m.monedaOriginal || 'MXN';
      f.ingresosPorMoneda[mo] = (f.ingresosPorMoneda[mo] || 0) + (m.importeOriginal ?? m.importe);
    } else f.gastos += m.importe;
  }
  for (const f of meses) f.saldo = f.ingresos - f.gastos;
  return meses;
}

/**
 * Los 12 meses del año que empieza en `desde` (en orden, los que no tienen movimientos a cero) y los totales
 * del año. Recibe movimientos ya pasados por enMonedaBase.
 */
export function resumenAño(movs, desde) {
  const meses = totalesPorMes(movs, mesesDelAño(desde));
  const total = { ingresos: 0, gastos: 0, saldo: 0, ingresosPorMoneda: {}, n: 0 };
  for (const f of meses) {
    total.ingresos += f.ingresos;
    total.gastos += f.gastos;
    total.n += f.n;
    for (const [mo, v] of Object.entries(f.ingresosPorMoneda)) total.ingresosPorMoneda[mo] = (total.ingresosPorMoneda[mo] || 0) + v;
  }
  total.saldo = total.ingresos - total.gastos;
  return { meses, ...total };
}

/**
 * Tipo de cambio de cada moneda extranjera frente a la principal, por mes, solo en los meses con movimientos
 * que lo traen. Devuelve [{ moneda, meses: [{ clave, valor }] }] con valor = unidades de principal por 1.
 */
export function tiposDeCambioPorMes(tasas, base, hasta, n = 12) {
  const res = new Map();
  for (const [clave, porMes] of tasas) {
    const [de, a] = clave.split('>');
    if (de !== base && a !== base) continue;
    const otra = de === base ? a : de;
    if (!res.has(otra)) res.set(otra, new Map());
    const filas = res.get(otra);
    for (const [mes, t] of porMes) {
      const d = distanciaMeses(hasta, mes);
      if (d < 0 || d >= n) continue;
      const f = filas.get(mes) || { de: 0, a: 0 };
      // Todo expresado como "otra -> base".
      if (de === otra) { f.de += t.de; f.a += t.a; } else { f.de += t.a; f.a += t.de; }
      filas.set(mes, f);
    }
  }
  return [...res.entries()]
    .map(([moneda, filas]) => ({
      moneda,
      meses: [...filas.entries()].sort((x, y) => y[0].localeCompare(x[0])).map(([clave, f]) => ({ clave, valor: f.a / f.de })),
    }))
    .filter((x) => x.meses.length);
}

/** "1 USD = 18.2 MXN" o, si la moneda vale menos que la principal, "1 MXN = 27.8 CRC". */
export function textoTipoDeCambio(moneda, base, valor) {
  const num = (v) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: v >= 100 ? 1 : v >= 10 ? 2 : 4 }).format(v);
  if (valor >= 1) return `1 ${moneda} = ${num(valor)} ${base}`;
  return `1 ${base} = ${num(1 / valor)} ${moneda}`;
}

// ---------- Ingreso esperado ----------
// Cada ingreso que se espera al mes (el sueldo, una renta...) es una línea con nombre, importe y moneda. Para que
// cambiar el importe no reescriba los meses pasados, cada línea se guarda por tramos: { id, grupo, nombre,
// importe, moneda, desde, hasta } (meses "AAAA-MM"; hasta null = sigue). Los tramos de una misma línea comparten
// `grupo` y no se solapan.

const esClaveMes = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

function validarEsperados(lista) {
  if (!Array.isArray(lista)) return [];
  const res = [];
  for (const e of lista) {
    if (!e || !Number.isInteger(e.importe) || e.importe < 0 || !esClaveMes(e.desde)) continue;
    const hasta = esClaveMes(e.hasta) && e.hasta >= e.desde ? e.hasta : null;
    res.push({
      id: typeof e.id === 'string' && e.id ? e.id : nuevoId(),
      grupo: typeof e.grupo === 'string' && e.grupo ? e.grupo : (typeof e.id === 'string' && e.id ? e.id : nuevoId()),
      nombre: typeof e.nombre === 'string' && e.nombre.trim() ? e.nombre.trim().slice(0, 40) : 'Ingreso',
      importe: e.importe,
      moneda: MONEDAS[e.moneda] ? e.moneda : 'MXN',
      desde: e.desde,
      hasta,
      // La categoría de ingreso con la que se apunta, para compararlo por separado (null: solo cuenta en el total).
      categoria: typeof e.categoria === 'string' && e.categoria ? e.categoria : null,
    });
  }
  return res;
}

// Lo esperado cambia de un mes a otro: cada mes puede tener su propio importe, { grupo, mes, importe, moneda },
// que sustituye a lo habitual de esa línea ese mes.
function validarEsperadosMes(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const res = [];
  for (const a of lista) {
    if (!a || typeof a.grupo !== 'string' || !a.grupo || !esClaveMes(a.mes) || !Number.isInteger(a.importe) || a.importe < 0) continue;
    const k = `${a.grupo}|${a.mes}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    res.push({ grupo: a.grupo, mes: a.mes, importe: a.importe, moneda: MONEDAS[a.moneda] ? a.moneda : 'MXN' });
  }
  return res;
}

/** Como parseImporte, pero acepta el cero ("0", "$0"): lo esperado en un mes puede ser nada. */
export function parseImporteOCero(texto) {
  const v = parseImporte(texto);
  if (v != null) return v;
  return /^[^\d]*0+([.,]0*)?[^\d]*$/.test(String(texto ?? '').trim()) && /\d/.test(String(texto)) ? 0 : null;
}

const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Lee una lista pegada de importes por mes, una línea por mes: "septiembre 2026   $1,308", "oct 26: 3228",
 * "Enero 2027 $0". Lo que va entre paréntesis se ignora ("(el real fue ...)"). Devuelve { porMes: { mes: importe },
 * noLeidas: [líneas que no se entienden] }. Una línea sin año toma el de la anterior (o `añoPorDefecto`).
 */
export function leerListaMeses(texto, añoPorDefecto) {
  const porMes = {};
  const noLeidas = [];
  let año = añoPorDefecto;
  for (const cruda of String(texto || '').split(/\r?\n/)) {
    const linea = cruda.replace(/\([^)]*\)/g, ' ').trim();
    if (!linea) continue;
    const m = linea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .match(/^[^a-z]*([a-z]{3,})\.?\s*(?:de\s+|del\s+)?(\d{4}|\d{2}(?!\d))?\s*[:\-–]?\s*(.*)$/);
    const n = m ? NOMBRES_MES.indexOf(m[1].slice(0, 3)) : -1;
    const importe = m ? parseImporteOCero(m[3]) : null;
    if (n < 0 || importe == null) { noLeidas.push(cruda.trim()); continue; }
    if (m[2]) año = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    if (!año) { noLeidas.push(cruda.trim()); continue; }
    porMes[`${año}-${String(n + 1).padStart(2, '0')}`] = importe;
  }
  return { porMes, noLeidas };
}

/** Importe y moneda de una línea en un mes: el propio de ese mes si lo tiene, si no lo habitual. */
export function importeDelMes(e, clave, esperadosMes) {
  const a = (esperadosMes || []).find((x) => x.grupo === e.grupo && x.mes === clave);
  return a ? { importe: a.importe, moneda: a.moneda, propio: true } : { importe: e.importe, moneda: e.moneda, propio: false };
}

/**
 * Pone los importes propios de una línea: `porMes` es { mes: importe | null }; null (o igual a lo habitual)
 * quita el propio de ese mes. Devuelve la lista nueva.
 */
export function ponerEsperadosMes(esperadosMes, grupo, porMes, habitual, moneda) {
  const res = (esperadosMes || []).filter((a) => !(a.grupo === grupo && a.mes in porMes));
  for (const [mes, importe] of Object.entries(porMes)) {
    if (importe != null && importe !== habitual) res.push({ grupo, mes, importe, moneda });
  }
  return res;
}

const cubre = (e, clave) => e.desde <= clave && (!e.hasta || clave <= e.hasta);

/** Los tramos que cuentan en ese mes. */
export function esperadosDelMes(esperados, clave) {
  return (esperados || []).filter((e) => cubre(e, clave));
}

/**
 * Las líneas para ver y editar en Ajustes: por cada grupo, el tramo que cubre `hoy` o, si no, el siguiente que
 * empieza (los que ya terminaron no salen).
 */
export function lineasEsperadas(esperados, hoy) {
  const porGrupo = new Map();
  for (const e of esperados || []) {
    if (e.hasta && e.hasta < hoy) continue;
    const otro = porGrupo.get(e.grupo);
    if (!otro || (cubre(e, hoy) && !cubre(otro, hoy)) || (!cubre(otro, hoy) && e.desde < otro.desde)) porGrupo.set(e.grupo, e);
  }
  return [...porGrupo.values()].sort((a, b) => a.desde.localeCompare(b.desde) || a.nombre.localeCompare(b.nombre));
}

/**
 * Pone una línea con { nombre, importe, moneda } a partir del mes `desde`. Si `grupo` ya existe, lo de antes de
 * `desde` se queda como estaba (para no cambiar la comparación de los meses pasados) y lo de después se sustituye.
 * Devuelve la lista nueva.
 */
export function ponerEsperado(esperados, grupo, campos, desde) {
  const g = grupo || nuevoId();
  const res = quitarEsperado(esperados, g, desde);
  res.push({ id: nuevoId(), grupo: g, nombre: campos.nombre, importe: campos.importe, moneda: campos.moneda, desde, hasta: null, categoria: campos.categoria || null });
  return res;
}

/** Deja de contar una línea a partir de `desde` (los meses anteriores la siguen teniendo). */
export function quitarEsperado(esperados, grupo, desde) {
  const res = [];
  for (const e of esperados || []) {
    if (e.grupo !== grupo) { res.push(e); continue; }
    if (e.desde >= desde) continue; // empieza en o después del corte: fuera
    const hasta = moverMes(desde, -1);
    res.push(e.hasta && e.hasta <= hasta ? e : { ...e, hasta });
  }
  return res;
}

/**
 * Ingreso esperado de un mes en la moneda principal: { total, porMoneda, lineas, sinTasa }. Lo esperado en otra
 * moneda se pasa con el tipo de cambio de ese mes (o el más cercano que se conozca); si no hay ninguno, esa línea
 * cuenta en sinTasa y no suma.
 */
export function esperadoDelMes(esperados, clave, base, tasas, esperadosMes = []) {
  const r = { total: 0, porMoneda: {}, lineas: [], sinTasa: 0 };
  for (const tramo of esperadosDelMes(esperados, clave)) {
    const e = { ...tramo, ...importeDelMes(tramo, clave, esperadosMes) };
    const t = tasa(tasas, e.moneda, base, clave);
    const enBase = t == null ? null : Math.round(e.importe * t);
    r.lineas.push({ ...e, enBase });
    r.porMoneda[e.moneda] = (r.porMoneda[e.moneda] || 0) + e.importe;
    if (enBase == null) r.sinTasa++;
    else r.total += enBase;
  }
  return r;
}

/**
 * Esperado frente a real de cada mes del año que empieza en `desde`: [{ clave, esperado, real, diferencia,
 * sinTasa, hayEsperado }], y los totales del año contando solo los meses que tienen algo esperado. Recibe los
 * movimientos ya pasados por enMonedaBase.
 */
export function esperadoVsReal(movs, esperados, desde, base, tasas, esperadosMes = []) {
  const meses = totalesPorMes(movs, mesesDelAño(desde)).map((f) => {
    const e = esperadoDelMes(esperados, f.clave, base, tasas, esperadosMes);
    return { clave: f.clave, esperado: e.total, real: f.ingresos, diferencia: f.ingresos - e.total, sinTasa: e.sinTasa, hayEsperado: e.lineas.length > 0 };
  });
  return { meses, hayAlguno: meses.some((f) => f.hayEsperado) };
}

/**
 * Lo que de verdad entró en un mes en una categoría de ingreso (con sus subcategorías), en la moneda `moneda`.
 * Recibe los movimientos tal cual (sin pasar a la principal). `otras`: categorías de otras fuentes; si alguna cuelga
 * de esta (Sueldo › Socratic), lo suyo no se cuenta aquí, para no contarlo dos veces.
 */
export function realDeCategoria(movimientos, clave, categorias, catId, moneda, tasas, otras = []) {
  const ids = descendientes(categorias, catId);
  for (const o of otras) if (o && o !== catId && ids.has(o)) for (const x of descendientes(categorias, o)) ids.delete(x);
  let total = 0;
  let sinTasa = 0;
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso' || !ids.has(m.categoria) || claveMes(m.fecha) !== clave) continue;
    const v = valorEn(m, moneda, tasas);
    if (v == null) sinTasa++;
    else total += v;
  }
  return { total, sinTasa };
}

/**
 * Esperado frente a real de una sola línea (una fuente de ingreso con su categoría), mes a mes del año que empieza
 * en `desde`, en la moneda de la línea: así un sueldo en dólares se compara en dólares, sin que el tipo de cambio
 * meta ruido. Recibe los movimientos tal cual. Devuelve null si la línea no tiene categoría.
 */
export function esperadoVsRealDeLinea(movimientos, esperados, grupo, desde, tasas, esperadosMes, categorias, hoy) {
  const linea = lineasEsperadas(esperados, hoy).find((e) => e.grupo === grupo)
    || (esperados || []).filter((e) => e.grupo === grupo).sort((a, b) => b.desde.localeCompare(a.desde))[0];
  if (!linea || !linea.categoria) return null;
  const moneda = linea.moneda;
  const otras = lineasEsperadas(esperados, hoy).filter((e) => e.grupo !== grupo).map((e) => e.categoria);
  const meses = mesesDelAño(desde).map((clave) => {
    const tramo = (esperados || []).find((e) => e.grupo === grupo && cubre(e, clave));
    const real = realDeCategoria(movimientos, clave, categorias, linea.categoria, moneda, tasas, otras);
    if (!tramo) return { clave, esperado: 0, real: real.total, diferencia: 0, sinTasa: real.sinTasa, hayEsperado: false };
    const { importe, moneda: mo } = importeDelMes(tramo, clave, esperadosMes);
    const t = tasa(tasas, mo, moneda, clave);
    const esperado = t == null ? 0 : Math.round(importe * t);
    return { clave, esperado, real: real.total, diferencia: real.total - esperado, sinTasa: real.sinTasa + (t == null ? 1 : 0), hayEsperado: true };
  });
  return { nombre: linea.nombre, moneda, categoria: linea.categoria, meses, hayAlguno: meses.some((f) => f.hayEsperado) };
}

// ---------- Traer datos de Wallet (BudgetBakers) ----------
// El export de Wallet es un CSV (separador ";" o ",") con una fila por movimiento. Las transferencias entre
// cuentas propias no son ni gasto ni ingreso: de momento no se traen. Cada movimiento traído lleva una clave
// sacada de la fila entera, para que traer dos veces el mismo archivo (o uno que se solapa) no duplique nada.

const COLUMNAS_WALLET = ['account', 'category', 'currency', 'amount', 'type', 'date'];
export const EMOJI_CATEGORIA_NUEVA = '🏷️';

// ---------- Icono según el nombre ----------
// Cada regla: icono y palabras (sin tildes, en minúscula). Una palabra vale si alguna del nombre empieza por ella;
// "a b" pide las dos. Van de lo más concreto a lo más general: la primera que encaja gana.
const ICONOS_POR_NOMBRE = [
  ['⛽', ['gasolina', 'combustible', 'diesel']], ['🚕', ['taxi', 'uber', 'didi']],
  ['🚌', ['autobus', 'bus', 'camion', 'transporte']], ['🛣️', ['caseta', 'peaje', 'autopista']],
  ['🅿️', ['estacionamiento', 'parking', 'parquimetro']], ['🚆', ['tren', 'metro']],
  ['🔧', ['taller mecanico', 'mecanico']], ['🚗', ['auto', 'coche', 'carro', 'vehiculo']],
  ['🛒', ['supermercado', 'super', 'despensa', 'mandado', 'mercado']], ['🍴', ['restaurante', 'restaurant', 'cena', 'comida rapida']],
  ['☕', ['cafe', 'cafeteria']], ['🏪', ['tiendita', 'tienda', 'abarrote', 'oxxo']], ['🍬', ['golosina', 'dulce', 'snack', 'capricho', 'antojo']],
  ['🍽️', ['comida', 'alimento', 'alimentacion']],
  ['🎮', ['app entretenimiento', 'videojuego', 'juego']], ['📺', ['streaming', 'netflix', 'spotify', 'suscripcion', 'television']],
  ['📲', ['app', 'aplicacion', 'software']], ['📱', ['telefono', 'celular', 'movil', 'plan de datos']],
  ['🌐', ['internet', 'wifi']], ['💻', ['tecnologia', 'computadora', 'electronico', 'informatica']],
  ['🎁', ['regalo']], ['👕', ['ropa', 'zapato', 'calzado', 'vestido']], ['🛋️', ['hogar', 'mueble', 'decoracion']],
  ['🔧', ['herramienta', 'ferreteria']], ['🛍️', ['compra']],
  ['💊', ['medicamento', 'medicina', 'farmacia']], ['🦷', ['dentista', 'dental']], ['👓', ['optica', 'lente']],
  ['🩺', ['consulta', 'medic', 'doctor', 'hospital', 'salud', 'analisis']],
  ['🙏', ['retiro', 'misa', 'parroquia', 'iglesia']], ['🤝', ['donacion', 'donativo', 'diezmo', 'ofrenda', 'caridad']],
  ['⛪', ['ignis', 'mision']],
  ['✈️', ['vuelo', 'avion', 'viaje']], ['🏨', ['hotel', 'hospedaje', 'airbnb', 'alojamiento']],
  ['🔥', ['gas']], ['💡', ['luz', 'electricidad']], ['💧', ['agua']], ['🧾', ['impuesto', 'predial', 'tramite', 'papeleo']],
  ['🛡️', ['seguro']], ['🔨', ['reparacion', 'mantenimiento', 'arreglo']], ['🧹', ['limpieza']],
  ['💸', ['comision', 'interes', 'recargo']], ['🏦', ['financ', 'banco']], ['💳', ['deuda', 'prestamo', 'credito', 'tarjeta']],
  ['🐷', ['ahorro']], ['📈', ['inversion']], ['💡', ['servicio']],
  ['🏠', ['vivienda', 'casa', 'renta', 'alquiler', 'hipoteca']],
  ['🎟️', ['evento', 'concierto', 'entrada', 'boleto']], ['🏞️', ['paseo', 'excursion', 'salida']], ['🎬', ['cine', 'pelicula']],
  ['🎉', ['entretenimiento', 'ocio', 'diversion', 'fiesta']],
  ['🏊', ['natacion', 'alberca', 'piscina']], ['🎵', ['canto', 'musica', 'piano', 'guitarra']],
  ['🧸', ['cuido', 'guarderia', 'nana', 'ninera']], ['⚽', ['deporte', 'futbol']], ['🏋️', ['gimnasio', 'gym']],
  ['📚', ['curso', 'clase', 'taller', 'libro', 'utiles']], ['🎓', ['educacion', 'escuela', 'colegio', 'colegiatura', 'universidad']],
  ['👨‍👩‍👧', ['familia']], ['🍼', ['bebe', 'panal']], ['💇', ['peluqueria', 'belleza', 'corte de pelo']],
  ['🐕', ['veterinario']], ['🐾', ['mascota', 'perro', 'gato']],
  ['💍', ['joyeria', 'joya']], ['💼', ['sueldo', 'salario', 'nomina', 'trabajo']], ['💰', ['ingreso', 'venta', 'cobro']],
  ['🧾', ['otro']],
];

const palabrasDe = (texto) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter(Boolean);

/** El icono que le va a una categoría por su nombre ("Gasolina" -> ⛽), o null si no se sabe. */
export function emojiPorNombre(nombre) {
  const palabras = palabrasDe(String(nombre || ''));
  const hay = (clave) => clave.split(' ').every((k) => palabras.some((p) => p.startsWith(k)));
  for (const [emoji, claves] of ICONOS_POR_NOMBRE) if (claves.some(hay)) return emoji;
  return null;
}

// Si el nombre no dice nada (un nombre de persona, de un colegio), se tira de dónde cuelga.
const ICONO_SEGUN_PADRE = { '🎓': '🧑‍🎓', '🧑‍🎓': '🏫', '💰': '💼' };

/**
 * Pone icono por el nombre a las categorías sin icono propio (vacío o la etiqueta genérica); si el nombre no da
 * pista, uno según la de arriba (en Educación, una persona 🧑‍🎓 y lo suyo 🏫). Las que ya tienen icono, igual.
 */
export function ponerIconos(categorias) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const hecho = new Map();
  const icono = (c, prof = 0) => {
    if (hecho.has(c.id)) return hecho.get(c.id);
    let e = c.emoji;
    if (!e || e === EMOJI_CATEGORIA_NUEVA) {
      const padre = c.padre && prof < 10 ? porId.get(c.padre) : null;
      e = emojiPorNombre(c.nombre) || (padre && ICONO_SEGUN_PADRE[icono(padre, prof + 1)]) || c.emoji;
    }
    hecho.set(c.id, e);
    return e;
  };
  return categorias.map((c) => (icono(c) === c.emoji ? c : { ...c, emoji: icono(c) }));
}

/** Texto CSV -> filas (listas de campos). Quita el BOM, detecta ";" o "," por la cabecera y entiende comillas. */
export function parseCSV(texto) {
  let s = String(texto ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const finCabecera = s.search(/\r?\n/);
  const cabecera = finCabecera < 0 ? s : s.slice(0, finCabecera);
  const sep = cabecera.split(';').length >= cabecera.split(',').length ? ';' : ',';
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.length > 1 || f[0] !== '');
}

/** Nombre para comparar: sin mayúsculas, sin tildes y sin espacios de sobra. */
export function nombreComparable(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Huella corta y estable de un texto (cyrb53): la misma fila da siempre la misma clave. */
export function huella(texto) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Lee un export de Wallet. Devuelve { ok, filas } con una fila por movimiento (campos por nombre de columna y
 * `clave`), o { ok: false, error } en lenguaje llano. Nunca lanza.
 */
export function leerWallet(texto) {
  const noEs = { ok: false, error: 'Este archivo no parece un export de Wallet.' };
  try {
    const filas = parseCSV(texto);
    if (!filas.length) return noEs;
    const cab = filas[0].map((c) => c.trim().toLowerCase());
    if (!COLUMNAS_WALLET.every((c) => cab.includes(c))) return noEs;
    const vistas = new Map(); // filas idénticas dentro del archivo: cada una es un movimiento distinto
    const res = [];
    for (const f of filas.slice(1)) {
      const o = {};
      cab.forEach((c, i) => { o[c] = (f[i] ?? '').trim(); });
      const base = huella(f.join('\u0001'));
      const n = (vistas.get(base) || 0) + 1;
      vistas.set(base, n);
      o.clave = n === 1 ? base : `${base}-${n}`;
      res.push(o);
    }
    if (!res.length) return { ok: false, error: 'El archivo de Wallet no tiene movimientos.' };
    return { ok: true, filas: res };
  } catch (e) {
    return noEs;
  }
}

const TIPO_CUENTA_WALLET = { CREDIT_CARD: 'credito', CASH: 'efectivo' };
const mayoritario = (cuenta) => [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0];
const sumarUno = (mapa, k) => mapa.set(k, (mapa.get(k) || 0) + 1);

/**
 * Prepara lo que se va a traer de Wallet sin tocar `datos`: movimientos nuevos, cuentas y categorías que hay que
 * crear, y los recuentos para el resumen (transferencias, duplicados, monedas que la app no tiene, filas rotas).
 * El importe en pesos que da Wallet (ref_currency_amount) se guarda como importeBase en MXN: es el tipo de cambio
 * real de cada movimiento, sea cual sea la moneda principal de la app.
 */
export function prepararWallet(filas, datos) {
  const yaEstan = new Set(datos.movimientos.filter((m) => m.origen === 'wallet' && m.claveOrigen).map((m) => m.claveOrigen));
  const cuentasPorNombre = new Map(datos.cuentas.map((c) => [c.nombre.trim().toLowerCase(), c.id]));
  // Una categoría de Wallet va a la que ya tenga ese nombre, esté en el nivel que esté (la primera si hay varias).
  const catsPorNombre = new Map();
  for (const c of datos.categorias) {
    const k = claveCategoria(c.nombre);
    if (!catsPorNombre.has(k)) catsPorNombre.set(k, c.id);
  }
  // También por los nombres de las que se juntaron en ella (tras organizar con una lista o pasar sus movimientos).
  for (const c of datos.categorias) {
    for (const otro of c.otrosNombres || []) {
      const k = claveCategoria(otro);
      if (!catsPorNombre.has(k)) catsPorNombre.set(k, c.id);
    }
  }
  const cuentasNuevas = new Map(); // nombre en minúsculas -> { cuenta, pagos: Map(tipo -> n) }
  const catsNuevas = new Map(); // nombre comparable -> { categoria, tipos: Map(tipo -> n) }
  const movimientos = [];
  let transferencias = 0;
  let duplicados = 0;
  let otraMoneda = 0;
  let rotas = 0;
  for (const f of filas) {
    if (f.transfer === 'true' || f.category === 'TRANSFER') { transferencias++; continue; }
    const cantidad = Number(f.amount);
    const fecha = (f.date || '').slice(0, 10);
    if (!Number.isFinite(cantidad) || cantidad === 0 || !esFechaISO(fecha)) { rotas++; continue; }
    const moneda = (f.currency || '').toUpperCase();
    if (!MONEDAS[moneda]) { otraMoneda++; continue; }
    if (yaEstan.has(f.clave)) { duplicados++; continue; }
    yaEstan.add(f.clave);
    const tipo = /^(ingresos?|income)$/i.test(f.type) ? 'ingreso'
      : /^(gastos?|expenses?)$/i.test(f.type) ? 'gasto' : (cantidad > 0 ? 'ingreso' : 'gasto');

    let cuenta = null;
    if (f.account) {
      const k = f.account.toLowerCase();
      cuenta = cuentasPorNombre.get(k) || null;
      if (!cuenta) {
        let n = cuentasNuevas.get(k);
        if (!n) {
          n = { cuenta: { id: nuevoId(), nombre: f.account.slice(0, 40), tipo: 'debito' }, pagos: new Map() };
          cuentasNuevas.set(k, n);
        }
        sumarUno(n.pagos, TIPO_CUENTA_WALLET[f.payment_type] || 'debito');
        cuenta = n.cuenta.id;
      }
    }
    let categoria = null;
    if (f.category) {
      const k = claveCategoria(f.category);
      categoria = catsPorNombre.get(k) || null;
      if (!categoria) {
        let n = catsNuevas.get(k);
        if (!n) {
          n = { categoria: { id: nuevoId(), emoji: emojiPorNombre(f.category) || EMOJI_CATEGORIA_NUEVA, nombre: f.category.slice(0, 40), tipo, presupuesto: null, padre: null }, tipos: new Map() };
          catsNuevas.set(k, n);
        }
        sumarUno(n.tipos, tipo);
        categoria = n.categoria.id;
      }
    }

    const ref = Math.round(Math.abs(Number(f.ref_currency_amount)) * 100);
    const importeBase = moneda !== 'MXN' && Number.isFinite(ref) && ref > 0 ? ref : null;
    const etiquetas = (f.labels || '').split('|').map((x) => x.trim()).filter(Boolean);
    const nota = [f.note, ...etiquetas].filter(Boolean).join(' · ').slice(0, 200);
    const creado = new Date((f.date || '').replace(' ', 'T')).getTime();
    movimientos.push({
      id: nuevoId() + movimientos.length.toString(36),
      tipo,
      importe: Math.round(Math.abs(cantidad) * 100),
      moneda,
      importeBase,
      monedaBase: importeBase ? 'MXN' : null,
      categoria,
      cuenta,
      nota,
      fecha,
      creado: Number.isFinite(creado) ? creado : 0,
      origen: 'wallet',
      claveOrigen: f.clave,
    });
  }
  for (const n of cuentasNuevas.values()) n.cuenta.tipo = mayoritario(n.pagos);
  for (const n of catsNuevas.values()) n.categoria.tipo = mayoritario(n.tipos);
  let desde = null;
  let hasta = null;
  for (const m of movimientos) {
    if (!desde || m.fecha < desde) desde = m.fecha;
    if (!hasta || m.fecha > hasta) hasta = m.fecha;
  }
  return {
    movimientos,
    cuentasNuevas: [...cuentasNuevas.values()].map((n) => n.cuenta),
    categoriasNuevas: [...catsNuevas.values()].map((n) => n.categoria),
    transferencias,
    duplicados,
    otraMoneda,
    rotas,
    desde,
    hasta,
  };
}

// ---------- Categorías con subcategorías ----------
// Cada categoría tiene `padre`: el id de otra del mismo tipo, o null si es principal. Como mucho tres niveles
// (Casa › Servicios › Luz). Los movimientos se pueden apuntar en cualquier nivel.

export const NIVELES_MAX = 3;

/**
 * Deja el árbol sano (devuelve copias, no toca las originales): el padre tiene que existir, ser del mismo tipo y
 * no formar un ciclo; lo que quede más hondo del tercer nivel sube hasta el tercero.
 */
export function normalizarArbol(categorias) {
  const cats = categorias.map((c) => ({ ...c, padre: typeof c.padre === 'string' && c.padre ? c.padre : null }));
  const porId = new Map(cats.map((c) => [c.id, c]));
  for (const c of cats) {
    const p = porId.get(c.padre);
    if (!p || p === c || p.tipo !== c.tipo) c.padre = null;
  }
  // Ciclos: si subiendo desde una se vuelve a ella, pasa a principal (y el ciclo se rompe ahí).
  for (const c of cats) {
    const vistos = new Set();
    for (let p = porId.get(c.padre); p && !vistos.has(p.id); p = porId.get(p.padre)) {
      if (p === c) { c.padre = null; break; }
      vistos.add(p.id);
    }
  }
  const nivel = (c) => { let n = 1; for (let p = porId.get(c.padre); p; p = porId.get(p.padre)) n++; return n; };
  for (const c of cats) while (nivel(c) > NIVELES_MAX) c.padre = porId.get(c.padre).padre;
  return cats;
}

/** Del principal a la categoría: [Casa, Servicios, Luz]. Vacío si no existe. */
export function rutaCategoria(categorias, id) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const ruta = [];
  for (let c = porId.get(id); c && ruta.length < 10 && !ruta.includes(c); c = porId.get(c.padre)) ruta.unshift(c);
  return ruta;
}

/** "Casa › Servicios › Luz" */
export function textoRuta(categorias, id) {
  return rutaCategoria(categorias, id).map((c) => c.nombre).join(' › ');
}

export function nivelCategoria(categorias, id) {
  return rutaCategoria(categorias, id).length;
}

/** Subcategorías directas, en su orden. */
export function hijasDe(categorias, id) {
  return categorias.filter((c) => c.padre === id && c.id !== id);
}

/** Ids de la categoría y de todo lo que cuelga de ella. */
export function descendientes(categorias, id) {
  const res = new Set([id]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const c of categorias) if (c.padre && res.has(c.padre) && !res.has(c.id)) { res.add(c.id); cambio = true; }
  }
  return res;
}

/** Cuántos niveles ocupa la categoría con lo que cuelga de ella (1 si no tiene subcategorías). */
function altura(categorias, id, prof = 0) {
  const hijas = hijasDe(categorias, id);
  if (!hijas.length || prof > 10) return 1;
  return 1 + Math.max(...hijas.map((h) => altura(categorias, h.id, prof + 1)));
}

/** Las de un tipo en orden de árbol, cada una con su nivel: [{ categoria, nivel }]. */
export function ordenArbol(categorias, tipo) {
  const cats = normalizarArbol(categorias.filter((c) => c.tipo === tipo));
  const original = new Map(categorias.map((c) => [c.id, c]));
  const res = [];
  const bajar = (padre, nivel) => {
    for (const c of cats) {
      if (c.padre !== padre) continue;
      res.push({ categoria: original.get(c.id), nivel });
      bajar(c.id, nivel + 1);
    }
  };
  bajar(null, 1);
  return res;
}

/**
 * Dónde se puede meter la categoría `id` (null si es nueva) siendo del tipo `tipo`: en otra del mismo tipo que no
 * sea ella ni una de las suyas, y sin pasar de tres niveles contando lo que cuelga de ella.
 */
export function padresPosibles(categorias, id, tipo) {
  const suyas = id ? descendientes(categorias, id) : new Set();
  const alto = id ? altura(categorias, id) : 1;
  return ordenArbol(categorias, tipo).filter((f) => !suyas.has(f.categoria.id) && f.nivel + alto <= NIVELES_MAX);
}

/** Quita una categoría; sus subcategorías suben un nivel (a la de arriba, o a principales). */
export function quitarCategoria(categorias, id) {
  const c = categorias.find((x) => x.id === id);
  if (!c) return categorias;
  return categorias.filter((x) => x.id !== id).map((x) => (x.padre === id ? { ...x, padre: c.padre || null } : x));
}

/** Nombre para buscar coincidencias: como nombreComparable y, además, sin la "s" final de cada palabra. */
export function claveCategoria(s) {
  return nombreComparable(s).split(' ').map((p) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p)).join(' ');
}

/** "Golosinas (Caprichos, Dulces)" -> { antes: 'Golosinas ', dentro: 'Caprichos, Dulces' }; admite paréntesis dentro. */
function parentesisFinal(s) {
  const t = s.replace(/[\s:.]+$/, '');
  if (!t.endsWith(')')) return null;
  let prof = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ')') prof++;
    else if (t[i] === '(' && --prof === 0) return { antes: t.slice(0, i), dentro: t.slice(i + 1, -1) };
  }
  return null;
}

/**
 * Claves con las que se reconoce una categoría por sus otros nombres. Como hay categorías con comas en el nombre
 * ("Música, radio"), cada trozo vale solo y también unido a los de al lado.
 */
function clavesSinonimos(sinonimos) {
  const claves = new Set();
  for (let i = 0; i < sinonimos.length; i++) {
    for (let j = i; j < sinonimos.length; j++) claves.add(claveCategoria(sinonimos.slice(i, j + 1).join(', ')));
  }
  return claves;
}

/** Claves de una categoría que ya existe: su nombre y, si acaba en paréntesis, también sin él. */
function clavesNombre(nombre) {
  const p = parentesisFinal(nombre);
  return p && p.antes.trim() ? [claveCategoria(nombre), claveCategoria(p.antes)] : [claveCategoria(nombre)];
}

/**
 * Lee una lista de categorías escrita a mano: un nombre por línea; las subcategorías con un guion delante ("-",
 * "–", "•"…) y las del tercer nivel con más sangría o con dos guiones ("--"). Las líneas vacías no cuentan. Un
 * grupo "Ingresos" quiere decir que lo que va dentro son categorías de ingreso; todo lo demás es gasto.
 * Entre paréntesis al final, otros nombres que se juntan en esa: "-Golosinas (Caprichos, Dulces)" quiere decir que
 * las categorías que ya haya con esos nombres pasan sus movimientos a Golosinas y desaparecen.
 * Las erratas no se corrigen. Devuelve { nodos: [{ nombre, tipo, hijos, sinonimos }], ignoradas: [líneas
 * demasiado largas para ser un nombre] }. Nunca lanza.
 */
export function leerListaCategorias(texto) {
  const MARCA = /^(?:[-–—•*·]\s*)+/;
  const raices = [];
  const ignoradas = [];
  // Un nombre repetido dentro de la misma categoría es el mismo (se juntan sus subcategorías y sus otros nombres).
  const agregar = (hermanas, nombre, sinonimos = []) => {
    const k = claveCategoria(nombre);
    let n = hermanas.find((x) => claveCategoria(x.nombre) === k);
    if (!n) { n = { nombre, hijos: [], sinonimos: [] }; hermanas.push(n); }
    for (const s of sinonimos) {
      if (!n.sinonimos.some((x) => claveCategoria(x) === claveCategoria(s))) n.sinonimos.push(s);
    }
    return n;
  };
  let n1 = null;
  let n2 = null;
  let sangria1 = 0;
  let sangria2 = 0;
  for (const bruta of String(texto ?? '').replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
    const linea = bruta.replace(/\u00a0/g, ' ');
    if (!linea.trim()) continue;
    const sangria = linea.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
    let resto = linea.trim();
    const marca = resto.match(MARCA);
    const guiones = marca ? marca[0].replace(/\s/g, '').length : 0;
    if (marca) resto = resto.slice(marca[0].length);
    let sinonimos = [];
    const parentesis = parentesisFinal(resto);
    if (parentesis) {
      sinonimos = parentesis.dentro.split(/[,;/]/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
      resto = parentesis.antes;
    }
    const nombre = resto.replace(/[:.]+$/, '').replace(/\s+/g, ' ').trim();
    if (!nombre) continue;
    if (nombre.length > 40) { ignoradas.push(linea.trim()); continue; }
    let nivel;
    if (guiones >= 2) nivel = 3;
    else if (guiones === 1 || (n1 && sangria > sangria1)) nivel = n2 && sangria > sangria2 ? 3 : 2;
    else nivel = 1;
    if (nivel >= 2 && !n1) nivel = 1;
    if (nivel === 3 && !n2) nivel = 2;
    if (nivel === 1) { n1 = agregar(raices, nombre, sinonimos); n2 = null; sangria1 = sangria; }
    else if (nivel === 2) { n2 = agregar(n1.hijos, nombre, sinonimos); sangria2 = sangria; }
    else agregar(n2.hijos, nombre, sinonimos);
  }
  const gastos = [];
  const ingresos = [];
  const juntar = (destino, nodos) => {
    for (const n of nodos) juntar(agregar(destino, n.nombre, n.sinonimos).hijos, n.hijos);
  };
  for (const r of raices) {
    if (claveCategoria(r.nombre) === 'ingreso') juntar(ingresos, r.hijos);
    else juntar(gastos, [r]);
  }
  const conTipo = (nodos, tipo) => nodos.map((n) => ({ nombre: n.nombre, tipo, sinonimos: n.sinonimos, hijos: conTipo(n.hijos, tipo) }));
  return { nodos: [...conTipo(gastos, 'gasto'), ...conTipo(ingresos, 'ingreso')], ignoradas };
}

/**
 * Qué pasa si se organizan las categorías con la lista (los nodos de leerListaCategorias), sin tocar `categorias`.
 * Nunca se duplica ni se borra nada: si ya hay una del mismo tipo con ese nombre (sin mirar mayúsculas, tildes,
 * espacios ni la "s" final), se reutiliza y se pone en su sitio, con el nombre como está en la lista. Primero se
 * busca por ruta completa ("Casa › Servicios"); luego solo por nombre, si ese nombre sale una sola vez en la lista
 * (un nombre repetido en sitios distintos son categorías distintas).
 * Los otros nombres entre paréntesis (sinonimos) juntan en esa las categorías del mismo tipo que se llamen así y
 * que no estén ya en la lista: sus movimientos pasan a la de la lista y ellas desaparecen (única excepción al "no
 * se borra nada": sus movimientos se conservan todos).
 * Devuelve { filas: [{ nombre, tipo, nivel, estado: 'nueva'|'movida'|'igual', id, antes, juntadas }], categorias
 * y movimientos (el resultado, para guardar), nuevas, movidas, iguales, fusiones: [{ id, nombre, destino, n }],
 * movimientosCambiados, sinTocar: [las que ya había y no están en la lista] }.
 */
export function planOrganizar(nodos, categorias, movimientos = []) {
  const cats = normalizarArbol(categorias);
  const planos = [];
  const aplanar = (lista, padre, ruta) => {
    for (const n of lista) {
      const i = planos.length;
      const r = [...ruta, claveCategoria(n.nombre)];
      planos.push({ nombre: n.nombre, tipo: n.tipo, nivel: r.length, ruta: r.join('›'), clave: r[r.length - 1], padre, sinonimos: n.sinonimos || [] });
      aplanar(n.hijos, i, r);
    }
  };
  aplanar(nodos, null, []);
  const veces = new Map();
  for (const p of planos) sumarUno(veces, `${p.tipo}|${p.clave}`);
  const porRuta = new Map();
  for (const c of cats) {
    const k = `${c.tipo}|${rutaCategoria(cats, c.id).map((x) => claveCategoria(x.nombre)).join('›')}`;
    if (!porRuta.has(k)) porRuta.set(k, c);
  }
  const usadas = new Set();
  for (const p of planos) {
    const c = porRuta.get(`${p.tipo}|${p.ruta}`);
    if (c && !usadas.has(c.id)) { p.cat = c; usadas.add(c.id); }
  }
  for (const p of planos) {
    if (p.cat || veces.get(`${p.tipo}|${p.clave}`) !== 1) continue;
    const c = cats.find((x) => !usadas.has(x.id) && x.tipo === p.tipo && claveCategoria(x.nombre) === p.clave);
    if (c) { p.cat = c; usadas.add(c.id); }
  }
  // Otros nombres: las que se llamen así (y no se hayan usado ya) se juntan en la de la lista.
  const juntar = new Map(); // id de la que desaparece -> índice en planos
  for (const [i, p] of planos.entries()) {
    if (!p.sinonimos.length) continue;
    const claves = clavesSinonimos(p.sinonimos);
    for (const c of cats) {
      if (usadas.has(c.id) || juntar.has(c.id) || c.tipo !== p.tipo || !clavesNombre(c.nombre).some((k) => claves.has(k))) continue;
      juntar.set(c.id, i);
    }
  }
  let nuevas = 0;
  let movidas = 0;
  let iguales = 0;
  const filas = planos.map((p, i) => {
    const padre = p.padre == null ? null : planos[p.padre].cat.id;
    let estado = 'nueva';
    let antes = null;
    if (p.cat) {
      estado = p.cat.padre === padre ? 'igual' : 'movida';
      if (p.cat.nombre !== p.nombre) antes = p.cat.nombre;
      p.cat.padre = padre;
      p.cat.nombre = p.nombre;
    } else {
      p.cat = { id: nuevoId() + i.toString(36), emoji: emojiPorNombre(p.nombre) || (p.nivel === 1 ? EMOJI_CATEGORIA_NUEVA : ''), nombre: p.nombre, tipo: p.tipo, presupuesto: null, padre };
    }
    if (estado === 'nueva') nuevas++; else if (estado === 'movida') movidas++; else iguales++;
    return { nombre: p.nombre, tipo: p.tipo, nivel: p.nivel, estado, id: p.cat.id, antes, juntadas: [] };
  });
  const enLista = new Set(planos.map((p) => p.cat.id));
  let final = [...planos.map((p) => p.cat), ...cats.filter((c) => !enLista.has(c.id))];
  let movs = movimientos;
  let movimientosCambiados = 0;
  const fusiones = [];
  for (const [id, i] of juntar) {
    const c = cats.find((x) => x.id === id);
    const r = pasarMovimientos(final, movs, id, planos[i].cat.id);
    final = r.categorias;
    movs = r.movimientos;
    movimientosCambiados += r.n;
    fusiones.push({ id, nombre: c.nombre, destino: planos[i].cat.id, n: r.n });
    filas[i].juntadas.push(c.nombre);
  }
  final = normalizarArbol(final);
  return {
    filas, categorias: final, movimientos: movs, nuevas, movidas, iguales, fusiones, movimientosCambiados,
    sinTocar: final.filter((c) => !enLista.has(c.id)),
  };
}

/**
 * Pasa los movimientos de la categoría `origen` a `destino` y quita `origen` (sus subcategorías suben un nivel).
 * No toca lo que recibe: devuelve { categorias, movimientos, n } con n = movimientos que cambian.
 */
export function pasarMovimientos(categorias, movimientos, origen, destino) {
  if (origen === destino || !categorias.some((c) => c.id === destino)) return { categorias, movimientos, n: 0 };
  let n = 0;
  const movs = movimientos.map((m) => {
    if (m.categoria !== origen) return m;
    n++;
    return { ...m, categoria: destino };
  });
  // La de destino recuerda el nombre de la que se junta, para que al traer más de Wallet vayan a ella.
  const o = categorias.find((c) => c.id === origen);
  const cats = quitarCategoria(categorias, origen).map((c) => (c.id === destino && o
    ? { ...c, otrosNombres: [...new Set([...(c.otrosNombres || []), o.nombre, ...(o.otrosNombres || [])])].slice(0, 30) } : c));
  return { categorias: cats, movimientos: movs, n };
}
