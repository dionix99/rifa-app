import { randomBytes, createHash } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MAX_DATOS = 600 * 1024;

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

function qparam(qs, name) {
  const re = new RegExp('(?:^|&)' + name + '=([^&]+)');
  const m = qs.match(re);
  return m ? decodeURIComponent(m[1]) : '';
}

function limpiarNombre(n) {
  return String(n || '').trim().slice(0, 60);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ ok: false, error: 'falta configurar Supabase' });
    return;
  }

  const uid = await buscarUsuario(req.headers['x-usuario'], req.headers['x-clave']);
  if (!uid) {
    res.status(401).json({ ok: false, error: 'No autorizado: entra con tu nombre y clave' });
    return;
  }

  const qs = req.url.split('?')[1] || '';
  const id = qparam(qs, 'id');

  try {
    // ── LISTAR rifas del usuario ──
    if (req.method === 'GET' && !id) {
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/rifas?usuario_id=eq.' + encodeURIComponent(uid) +
          '&select=id,nombre,creado,actualizado&order=actualizado.desc',
        { headers: sbHeaders() }
      );
      if (!r.ok) throw new Error('lista HTTP ' + r.status);
      const rifas = await r.json();
      res.status(200).json({ ok: true, rifas: Array.isArray(rifas) ? rifas : [] });
      return;
    }

    // ── LEER UNA rifa (con sus datos) ──
    if (req.method === 'GET' && id) {
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/rifas?id=eq.' + encodeURIComponent(id) +
          '&usuario_id=eq.' + encodeURIComponent(uid) + '&select=id,nombre,datos',
        { headers: sbHeaders() }
      );
      if (!r.ok) throw new Error('lectura HTTP ' + r.status);
      const arr = await r.json();
      if (!Array.isArray(arr) || !arr.length) {
        res.status(404).json({ ok: false, error: 'Rifa no encontrada' });
        return;
      }
      const ri = arr[0];
      res.status(200).json({ ok: true, id: ri.id, nombre: ri.nombre, datos: ri.datos || {} });
      return;
    }

    // ── CREAR rifa nueva ──
    if (req.method === 'POST' && !id) {
      const nombre = limpiarNombre(qparam(qs, 'nombre'));
      let cuerpo = {};
      try { cuerpo = await leerCuerpo(req); } catch (e) {}
      const nm = limpiarNombre(nombre || cuerpo.nombre);
      if (!nm) { res.status(400).json({ ok: false, error: 'Escribe un nombre para la rifa' }); return; }

      let datos = {};
      if (cuerpo.datos && typeof cuerpo.datos === 'object') datos = cuerpo.datos;

      const nueva = {
        id: randomBytes(8).toString('hex'),
        usuario_id: uid,
        nombre: nm,
        datos,
        creado: new Date().toISOString(),
        actualizado: new Date().toISOString(),
      };
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/rifas',
        {
          method: 'POST',
          headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify(nueva),
        }
      );
      if (!r.ok) {
        const t = await r.text();
        throw new Error('crear HTTP ' + r.status + ' ' + t.slice(0, 150));
      }
      res.status(200).json({ ok: true, id: nueva.id });
      return;
    }

    // ── GUARDAR estado de una rifa ──
    if (req.method === 'POST' && id) {
      let cuerpo = {};
      try { cuerpo = await leerCuerpo(req); } catch (e) { res.status(400).json({ ok: false, error: 'JSON inválido' }); return; }

      if (!cuerpo.datos || typeof cuerpo.datos !== 'object') {
        res.status(400).json({ ok: false, error: 'datos inválidos' });
        return;
      }
      try {
        if (JSON.stringify(cuerpo.datos).length > MAX_DATOS) {
          res.status(413).json({ ok: false, error: 'La rifa es demasiado grande' });
          return;
        }
      } catch (e) {
        res.status(400).json({ ok: false, error: 'datos inválidos' });
        return;
      }

      const existe = await fetch(
        SUPABASE_URL + '/rest/v1/rifas?id=eq.' + encodeURIComponent(id) +
          '&usuario_id=eq.' + encodeURIComponent(uid) + '&select=id',
        { headers: sbHeaders() }
      );
      const arr = existe.ok ? await existe.json() : [];
      if (!Array.isArray(arr) || !arr.length) {
        res.status(404).json({ ok: false, error: 'Rifa no encontrada' });
        return;
      }

      const patch = { datos: cuerpo.datos, actualizado: new Date().toISOString() };
      if (cuerpo.nombre !== undefined) {
        const nm = limpiarNombre(cuerpo.nombre);
        if (nm) patch.nombre = nm;
      }
      const up = await fetch(
        SUPABASE_URL + '/rest/v1/rifas?id=eq.' + encodeURIComponent(id) +
          '&usuario_id=eq.' + encodeURIComponent(uid),
        { method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(patch) }
      );
      if (!up.ok) {
        const t = await up.text();
        throw new Error('guardar HTTP ' + up.status + ' ' + t.slice(0, 150));
      }
      res.status(200).json({ ok: true });
      return;
    }

    // ── BORRAR una rifa ──
    if (req.method === 'DELETE' && id) {
      const del = await fetch(
        SUPABASE_URL + '/rest/v1/rifas?id=eq.' + encodeURIComponent(id) +
          '&usuario_id=eq.' + encodeURIComponent(uid),
        { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) }
      );
      if (!del.ok) {
        const t = await del.text();
        throw new Error('borrar HTTP ' + del.status + ' ' + t.slice(0, 150));
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'método no permitido' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}