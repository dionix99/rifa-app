import { SUPABASE_URL, SERVICE_KEY, CLAVE_MIN, CLAVE_MAX, sbHeaders, claveHash, verificarClave, mensajeBloqueo } from './_lib.js';

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

const modos = ['crear', 'entrar'];

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
  const nombre = (String(datos.nombre || '').trim() || usuario).slice(0, 60);
  const modoRaw = String(datos.modo || '').trim();
  const modo = modos.includes(modoRaw) ? modoRaw : 'auto';

  if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü ._-]{2,30}$/.test(usuario)) {
    res.status(400).json({ ok: false, error: 'Nombre de usuario: entre 2 y 30 letras o números' });
    return;
  }
  if (!clave || clave.length > CLAVE_MAX) {
    res.status(400).json({ ok: false, error: 'Escribe tu clave' });
    return;
  }

  const uid = usuario.toLowerCase();
  const hash = claveHash(uid, clave);

  try {
    const v = await verificarClave(uid, clave);
    if (v.estado === 'error') throw new Error('consulta a Supabase falló');

    if (v.estado !== 'noexiste') {
      const u = v.u;
      if (modo === 'crear') {
        res.status(409).json({ ok: false, error: 'Ese nombre ya existe. Entra con su clave o pídele al maestro que la resetee' });
        return;
      }
      if (v.estado === 'bloqueado') {
        res.status(429).json({ ok: false, error: mensajeBloqueo(v.minutos) });
        return;
      }
      if (v.estado === 'clave') {
        res.status(401).json({ ok: false, error: 'Clave incorrecta. Si es tu cuenta y la olvidaste, pídele al maestro que la resetee' });
        return;
      }
      res.status(200).json({ ok: true, usuario: uid, nombre: u.nombre || uid, nuevo: false, es_maestro: !!u.es_maestro });
      return;
    }

    // Solo las cuentas nuevas exigen el mínimo: las existentes con clave corta siguen entrando.
    if (clave.length < CLAVE_MIN) {
      res.status(400).json({ ok: false, error: 'La clave debe tener entre ' + CLAVE_MIN + ' y ' + CLAVE_MAX + ' caracteres' });
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
        const v2 = await verificarClave(uid, clave);
        if (v2.estado === 'ok') {
          res.status(200).json({ ok: true, usuario: uid, nombre: v2.u.nombre || uid, nuevo: false, es_maestro: !!v2.u.es_maestro });
          return;
        }
        if (v2.estado === 'bloqueado') {
          res.status(429).json({ ok: false, error: mensajeBloqueo(v2.minutos) });
          return;
        }
        if (v2.estado === 'clave') {
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