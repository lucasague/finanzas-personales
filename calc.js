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

export const VERSION_DATOS = 3;

export function datosIniciales() {
  return {
    version: VERSION_DATOS,
    moneda: 'MXN',
    categorias: CATEGORIAS_POR_DEFECTO.map((c) => ({ ...c, presupuesto: null })),
    cuentas: CUENTAS_POR_DEFECTO.map((c) => ({ ...c })),
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
      });
    }
    return {
      ok: true,
      datos: { version: VERSION_DATOS, moneda, categorias, cuentas, movimientos },
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
  const meses = [];
  for (let i = 0; i < n; i++) {
    const clave = moverMes(hasta, -i);
    if (distanciaMeses(clave, desde) < 0) break;
    meses.push({ clave, ingresos: 0, gastos: 0, saldo: 0, ingresosPorMoneda: {} });
  }
  const porClave = new Map(meses.map((f) => [f.clave, f]));
  for (const m of movs) {
    const f = porClave.get(claveMes(m.fecha));
    if (!f) continue;
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
