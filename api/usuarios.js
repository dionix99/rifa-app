import { createHash } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(extra) {
  return Object.assign(
    { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
    extra || {}
  );
}

function leerCuerpo(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function claveHash(usuario, clave) {
  return createHash('sha256')
    .update(String(usuario).trim().toLowerCase() + '|' + String(clave))
    .digest('hex');
}

const modos = ['crear', 'entrar'];

async function buscarUsuario(usuario, clave) {
  const uid = String(usuario || '').trim().toLowerCase();
  if (!uid) return null;
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(uid) + '&select=id,clave_hash',
    { headers: sbHeaders() }
  );
  if (!r.ok) return null;
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  if (arr[0].clave_hash !== claveHash(uid, clave)) return null;
  return uid;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'método no permitido' }); return; }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ ok: false, error: 'falta configurar Supabase' });
    return;
  }

  let datos;
  try { datos = await leerCuerpo(req); }
  catch (e) { res.status(400).json({ ok: false, error: 'JSON inválido' }); return; }

  const usuario = String(datos.usuario || '').trim();
  const clave = String(datos.clave || '');
  const nombre = String(datos.nombre || '').trim() || usuario;
  const modoRaw = String(datos.modo || '').trim();
  const modo = modos.includes(modoRaw) ? modoRaw : 'auto';

  if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü ._-]{2,30}$/.test(usuario)) {
    res.status(400).json({ ok: false, error: 'Nombre de usuario: entre 2 y 30 letras o números' });
    return;
  }
  if (clave.length < 3 || clave.length > 64) {
    res.status(400).json({ ok: false, error: 'La clave debe tener entre 3 y 64 caracteres' });
    return;
  }

  const uid = usuario.toLowerCase();
  const hash = claveHash(uid, clave);

  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(uid) + '&select=id,clave_hash,nombre,es_maestro',
      { headers: sbHeaders() }
    );
    if (!r.ok) throw new Error('consulta HTTP ' + r.status);
    const arr = await r.json();

    if (Array.isArray(arr) && arr.length) {
      const u = arr[0];
      if (modo === 'crear') {
        res.status(409).json({ ok: false, error: 'Ese nombre ya existe. Entra con su clave o pídele al maestro que la resetee' });
        return;
      }
      if (u.clave_hash !== hash) {
        res.status(401).json({ ok: false, error: 'Clave incorrecta. Si es tu cuenta y la olvidaste, pídele al maestro que la resetee' });
        return;
      }
      res.status(200).json({ ok: true, usuario: uid, nombre: u.nombre || uid, nuevo: false, es_maestro: !!u.es_maestro });
      return;
    }

    if (modo === 'entrar') {
      res.status(404).json({ ok: false, error: 'Ese nombre no existe todavía. Créalo en "Crear cuenta"' });
      return;
    }

    const ins = await fetch(
      SUPABASE_URL + '/rest/v1/usuarios',
      {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ id: uid, clave_hash: hash, nombre }),
      }
    );
    if (!ins.ok) {
      const t = await ins.text();
      if (ins.status === 409) {
        const r2 = await fetch(
          SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(uid) + '&select=id,clave_hash,nombre,es_maestro',
          { headers: sbHeaders() }
        );
        const arr2 = r2.ok ? await r2.json() : [];
        if (Array.isArray(arr2) && arr2.length) {
          if (arr2[0].clave_hash === hash) {
            res.status(200).json({ ok: true, usuario: uid, nombre: arr2[0].nombre || uid, nuevo: false, es_maestro: !!arr2[0].es_maestro });
            return;
          }
          res.status(401).json({ ok: false, error: 'Clave incorrecta' });
          return;
        }
      }
      throw new Error('crear HTTP ' + ins.status + ' ' + t.slice(0, 150));
    }

    res.status(200).json({ ok: true, usuario: uid, nombre, nuevo: true, es_maestro: false });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}