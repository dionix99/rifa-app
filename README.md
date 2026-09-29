# Rifa 1-1000 — App de rifas

Vende números de rifa, lleva los vendidos con el nombre del comprador, calcula ganancias
en dólares y sortea al ganador con un número aleatorio seguro. Cada vendedor entra con
su usuario y clave, y sus rifas quedan guardadas en la nube (Supabase).

## Funciones

- **Cuentas**: cada persona crea su usuario y clave (mínimo 6 caracteres) y solo ve sus rifas.
  Tras 5 claves incorrectas la cuenta se bloquea 15 minutos.
- **Mis rifas**: crear, abrir y borrar varias rifas por usuario.
- **Tablero**: vende números con nombre del comprador (número vacío = siguiente libre),
  marca pagado/pendiente, lista de vendidos y cuadrícula.
- **Ticket grande**: buscar un número lo muestra en un boleto para captura de pantalla,
  con botón para copiar el texto.
- **Sorteo**: 1 o 3 premios (dinero u objeto), solo entre números **pagados**, con
  `crypto.getRandomValues`. Guarda historial de ganadores.
- **Caja**: recaudo, ganancia actual, ganancia si vendes todo y cobertura del premio.
- **Ajustes**: cantidad de números, precio del ticket, premios y fecha o sorteo manual.
- **Panel maestro**: el usuario marcado como maestro puede resetear claves y borrar usuarios.
- **Sin conexión**: los cambios se guardan en el celular y se suben cuando vuelve el
  internet (también al reabrir la app), sin que la versión de la nube los pise.

## Archivos

```
index.html        # La app (HTML + CSS + JS, sin dependencias)
api/usuarios.js   # Crear cuenta / entrar
api/rifas.js      # Listar, crear, guardar y borrar rifas del usuario
api/maestro.js    # Panel maestro (listar usuarios, resetear clave, borrar)
api/_lib.js       # Código compartido: Supabase, hash de clave, bloqueo por intentos
supabase.sql      # Tablas que hay que crear en Supabase
manifest.json     # Para que funcione como PWA instalable
iconos/           # Íconos de la PWA
```

## Configuración

1. **Supabase**: crea un proyecto en https://supabase.com, abre **SQL Editor**, pega
   `supabase.sql` y pulsa **Run**. Si ya tenías las tablas, córrelo igual: agrega las
   columnas del bloqueo y hace que borrar un usuario borre también sus rifas.
2. **Vercel** → tu proyecto → Settings → Environment Variables:
   - `SUPABASE_URL` — la URL del proyecto (Supabase → Project Settings → API).
   - `SUPABASE_SERVICE_KEY` — la clave **service_role** (nunca la pongas en `index.html`).
3. Vuelve a desplegar (Deployments → Redeploy) para que tome las variables.
4. **Maestro**: crea la cuenta `maestro` desde la app y en Supabase corre
   `update usuarios set es_maestro = true where id = 'maestro';`

Para probar en tu computador: `npm i -g vercel` y luego `vercel dev`.

## Cómo está hecha

- El frontend es un solo `index.html`; las funciones de `api/` corren en Vercel y hablan
  con Supabase usando la service key, que nunca llega al navegador.
- Cada rifa se guarda como un JSON en la columna `datos` de la tabla `rifas`.
- El celular guarda una copia de cada rifa en `localStorage`. Si hay cambios sin subir,
  al abrir la rifa se suben esos cambios en vez de descargar la versión de la nube.
  Si dos celulares editan la misma rifa a la vez, gana el último que guarda.
