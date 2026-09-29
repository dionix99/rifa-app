-- Tablas de la app de Rifa en Supabase.
-- Pégalo en Supabase → SQL Editor → Run. Se puede correr varias veces sin romper nada:
-- crea lo que falte y actualiza una base que ya existía.

create table if not exists usuarios (
  id                text primary key,            -- nombre de usuario en minúsculas
  clave_hash        text not null,
  nombre            text,
  es_maestro        boolean not null default false,
  creado            timestamptz not null default now(),
  intentos_fallidos integer not null default 0,  -- para bloquear tras 5 claves malas
  bloqueado_hasta   timestamptz
);

-- Si la tabla ya existía sin las columnas de bloqueo:
alter table usuarios add column if not exists intentos_fallidos integer not null default 0;
alter table usuarios add column if not exists bloqueado_hasta timestamptz;

create table if not exists rifas (
  id          text primary key,
  usuario_id  text not null references usuarios(id) on delete cascade,
  nombre      text not null,
  datos       jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Si la tabla ya existía, asegura que borrar un usuario también borre sus rifas:
alter table rifas drop constraint if exists rifas_usuario_id_fkey;
alter table rifas add constraint rifas_usuario_id_fkey
  foreign key (usuario_id) references usuarios(id) on delete cascade;

create index if not exists rifas_usuario_idx on rifas (usuario_id, actualizado desc);

-- Solo las funciones de api/ (con la service key) pueden leer y escribir.
-- Con RLS activo y sin políticas, la clave pública "anon" no ve nada.
alter table usuarios enable row level security;
alter table rifas enable row level security;

-- Para crear el maestro: crea la cuenta desde la app ("Crear cuenta") y luego corre:
--   update usuarios set es_maestro = true where id = 'maestro';
