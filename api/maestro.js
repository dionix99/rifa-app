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

async function authMaestro(req) {
  const usuario = String(req.headers['x-usuario'] || '').trim().toLowerCase();
  const clave = String(req.headers['x-clave'] || '');
  if (!usuario || !clave) return null;
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(usuario) + '&select=id,clave_hash,es_maestro',
    { headers: sbHeaders() }
  );
  if (!r.ok) return null;
  const arr = await r.json();
  const u = Array.isArray(arr) && arr[0];
  if (!u || !u.es_maestro) return null;
  if (u.clave_hash !== claveHash(usuario, clave)) return null;
  return u.id;
}

async function buscarUsuario(uid, extraCols) {
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(uid) + '&select=id,' + (extraCols || 'id'),
    { headers: sbHeaders() }
  );
  if (!r.ok) return null;
  const arr = await r.json();
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ ok: false, error: 'falta configurar Supabase' });
    return;
  }

  if (req.method === 'GET') {
    const maestroId = await authMaestro(req);
    if (!maestroId) { res.status(401).json({ ok: false, error: 'No autorizado' }); return; }
    try {
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/usuarios?select=id,nombre,es_maestro,creado&order=creado.desc',
        { headers: sbHeaders() }
      );
      if (!r.ok) throw new Error('consulta HTTP ' + r.status);
      const usuarios = await r.json();

      const rR = await fetch(
        SUPABASE_URL + '/rest/v1/rifas?select=usuario_id&limit=10000',
        { headers: sbHeaders() }
      );
      const rifas = rR.ok ? await rR.json() : [];
      const conteo = {};
      (Array.isArray(rifas) ? rifas : []).forEach((x) => {
        conteo[x.usuario_id] = (conteo[x.usuario_id] || 0) + 1;
      });

      const lista = (Array.isArray(usuarios) ? usuarios : []).map((u) => ({
        id: u.id,
        nombre: u.nombre || u.id,
        es_maestro: !!u.es_maestro,
        creado: u.creado || null,
        rifas: conteo[u.id] || 0,
      }));

      res.status(200).json({ ok: true, usuarios: lista });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
    return;
  }

  if (req.method === 'POST') {
    const maestroId = await authMaestro(req);
    if (!maestroId) { res.status(401).json({ ok: false, error: 'No autorizado' }); return; }

    let datos;
    try { datos = await leerCuerpo(req); }
    catch (e) { res.status(400).json({ ok: false, error: 'JSON inválido' }); return; }

    const accion = String(datos.accion || '').trim();
    const nombre = String(datos.nombre || '').trim().toLowerCase();

    if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü ._-]{2,30}$/.test(nombre)) {
      res.status(400).json({ ok: false, error: 'Nombre de usuario inválido' });
      return;
    }

    try {
      if (accion === 'reset') {
        const nuevaClave = String(datos.nuevaClave || '');
        if (nuevaClave.length < 3 || nuevaClave.length > 64) {
          res.status(400).json({ ok: false, error: 'La clave debe tener entre 3 y 64 caracteres' });
          return;
        }
        const u = await buscarUsuario(nombre, 'id,clave_hash,es_maestro');
        if (!u) { res.status(404).json({ ok: false, error: 'Ese usuario no existe' }); return; }
        if (u.es_maestro) { res.status(403).json({ ok: false, error: 'No se puede resetear la clave de un maestro' }); return; }
        if (nombre === maestroId) { res.status(403).json({ ok: false, error: 'Usa el panel para cambiar tu propia clave' }); return; }
        const up = await fetch(
          SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(nombre),
          {
            method: 'PATCH',
            headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            body: JSON.stringify({ clave_hash: claveHash(nombre, nuevaClave) }),
          }
        );
        if (!up.ok) throw new Error('actualizar HTTP ' + up.status);
        res.status(200).json({ ok: true });
        return;
      }

      if (accion === 'borrar') {
        if (nombre === maestroId) { res.status(403).json({ ok: false, error: 'No puedes borrarte a ti mismo' }); return; }
        const u = await buscarUsuario(nombre, 'id,es_maestro');
        if (!u) { res.status(404).json({ ok: false, error: 'Ese usuario no existe' }); return; }
        if (u.es_maestro) { res.status(403).json({ ok: false, error: 'No se puede borrar a un maestro' }); return; }
        const del = await fetch(
          SUPABASE_URL + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(nombre),
          {
            method: 'DELETE',
            headers: sbHeaders({ Prefer: 'return=minimal' }),
          }
        );
        if (!del.ok) throw new Error('borrar HTTP ' + del.status);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ ok: false, error: 'Acción desconocida. Usa "reset" o "borrar"' });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'método no permitido' });
}