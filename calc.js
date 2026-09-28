// Funciones puras de la app: sin DOM ni almacenamiento, para poder probarlas con node.
// Los importes se guardan SIEMPRE en céntimos (enteros) para no arrastrar errores de coma flotante.

export const MONEDAS = {
  MXN: { locale: 'es-MX', nombre: 'Peso mexicano' },
  CRC: { locale: 'es-CR', nombre: 'Colón costarricense' },
  USD: { locale: 'es-US', nombre: 'Dólar estadounidense' },
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

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const VERSION_DATOS = 1;

export function datosIniciales() {
  return {
    version: VERSION_DATOS,
    moneda: 'MXN',
    categorias: CATEGORIAS_POR_DEFECTO.map((c) => ({ ...c, presupuesto: null })),
    movimientos: [],
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
 * Gasto del mes por categoría, de mayor a menor. Incluye las categorías con presupuesto aunque no
 * tengan gasto (para ver cuánto queda). Los gastos de categorías borradas van a "Sin categoría".
 * fraccion: gastado/presupuesto si hay presupuesto; si no, gastado/mayor gasto (para dibujar la barra).
 */
export function gastoPorCategoria(movimientos, clave, categorias) {
  const porId = new Map();
  for (const c of categorias) {
    if (c.tipo !== 'gasto') continue;
    porId.set(c.id, { categoria: c, gastado: 0 });
  }
  const huerfana = { categoria: { id: null, emoji: '❔', nombre: 'Sin categoría', tipo: 'gasto', presupuesto: null }, gastado: 0 };
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || claveMes(m.fecha) !== clave) continue;
    const fila = porId.get(m.categoria) || huerfana;
    fila.gastado += m.importe;
  }
  const filas = [...porId.values()];
  if (huerfana.gastado > 0) filas.push(huerfana);
  const visibles = filas.filter((f) => f.gastado > 0 || f.categoria.presupuesto > 0);
  const maximo = Math.max(1, ...visibles.map((f) => f.gastado));
  return visibles
    .map((f) => {
      const p = f.categoria.presupuesto > 0 ? f.categoria.presupuesto : null;
      return {
        categoria: f.categoria,
        gastado: f.gastado,
        presupuesto: p,
        restante: p != null ? p - f.gastado : null,
        fraccion: p != null ? f.gastado / p : f.gastado / maximo,
      };
    })
    .sort((a, b) => b.gastado - a.gastado || (b.presupuesto || 0) - (a.presupuesto || 0));
}

/** Comprueba una copia importada (o lo guardado) y la normaliza. Nunca lanza. */
export function validarCopia(obj) {
  try {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'El archivo no es una copia de esta app.' };
    if (!Array.isArray(obj.movimientos) || !Array.isArray(obj.categorias)) {
      return { ok: false, error: 'Al archivo le faltan los movimientos o las categorías.' };
    }
    const moneda = MONEDAS[obj.moneda] ? obj.moneda : 'MXN';
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
      });
    }
    const movimientos = [];
    let descartados = 0;
    for (const m of obj.movimientos) {
      if (!m || !Number.isInteger(m.importe) || m.importe <= 0 || !esFechaISO(m.fecha)) {
        descartados++;
        continue;
      }
      movimientos.push({
        id: typeof m.id === 'string' && m.id ? m.id : nuevoId(),
        tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto',
        importe: m.importe,
        categoria: typeof m.categoria === 'string' ? m.categoria : null,
        nota: typeof m.nota === 'string' ? m.nota.slice(0, 200) : '',
        fecha: m.fecha,
        creado: Number.isFinite(m.creado) ? m.creado : 0,
      });
    }
    return {
      ok: true,
      datos: { version: VERSION_DATOS, moneda, categorias, movimientos },
      descartados,
    };
  } catch (e) {
    return { ok: false, error: 'No he podido leer el archivo.' };
  }
}
