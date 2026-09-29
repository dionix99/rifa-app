// Helpers compartidos por las funciones de api/ (Vercel no publica archivos que empiezan con "_").
import { createHash, timingSafeEqual } from 'node:crypto';

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const CLAVE_MIN = 6;
export const CLAVE_MAX = 64;
const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

export function sbHeaders(extra) {
  return Object.assign(
    { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    extra || {}
  );
}

export function claveHash(usuario, clave) {
  return createHash('sha256')
    .update(String(usuario).trim().toLowerCase() + '|' + String(clave))
    .digest('hex');
}

function mismoHash(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

async function guardarIntentos(uid, patch) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(uid), {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    });
  } catch (e) {}
}

// Verifica usuario + clave con bloqueo tras varios intentos fallidos.
// Devuelve { estado: 'ok' | 'noexiste' | 'clave' | 'bloqueado' | 'error', u, minutos }.
// El bloqueo solo funciona si la tabla tiene las columnas intentos_fallidos y
// bloqueado_hasta (ver supabase.sql); sin ellas la verificación sigue funcionando.
export async function verificarClave(usuario, clave) {
  const uid = String(usuario || '').trim().toLowerCase();
  if (!uid) return { estado: 'noexiste' };
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(uid) + '&select=*',
    { headers: sbHeaders() }
  );
  if (!r.ok) return { estado: 'error' };
  const arr = await r.json();
  const u = Array.isArray(arr) && arr[0];
  if (!u) return { estado: 'noexiste' };

  const conBloqueo = 'intentos_fallidos' in u && 'bloqueado_hasta' in u;
  if (conBloqueo && u.bloqueado_hasta && new Date(u.bloqueado_hasta).getTime() > Date.now()) {
    const minutos = Math.ceil((new Date(u.bloqueado_hasta).getTime() - Date.now()) / 60000);
    return { estado: 'bloqueado', u, minutos };
  }

  if (!mismoHash(u.clave_hash, claveHash(uid, clave))) {
    if (conBloqueo) {
      const intentos = (Number(u.intentos_fallidos) || 0) + 1;
      if (intentos >= MAX_INTENTOS) {
        await guardarIntentos(uid, {
          intentos_fallidos: 0,
          bloqueado_hasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60000).toISOString(),
        });
        return { estado: 'bloqueado', u, minutos: MINUTOS_BLOQUEO };
      }
      await guardarIntentos(uid, { intentos_fallidos: intentos });
    }
    return { estado: 'clave', u };
  }

  if (conBloqueo && (u.intentos_fallidos || u.bloqueado_hasta)) {
    await guardarIntentos(uid, { intentos_fallidos: 0, bloqueado_hasta: null });
  }
  return { estado: 'ok', u };
}

export function mensajeBloqueo(minutos) {
  return 'Demasiados intentos fallidos. Espera ' + minutos + ' minuto' + (minutos === 1 ? '' : 's') + ' e intenta de nuevo';
}
