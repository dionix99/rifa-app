# Rifa 1-1000 — App de rifas

Vende números de rifa, lleva los vendidos con el nombre del comprador, calcula ganancias
en dólares y sortea al ganador con un número aleatorio seguro.

## Funciones

- **Tablero**: vende números con nombre del comprador (número vacío = siguiente libre),
  lista de vendidos con botón para quitar, y cuadrícula opcional.
- **Ticket grande**: buscar un número lo muestra en un boleto grande para captura de
  pantalla / enviar al comprador, con botón para copiar el texto.
- **Sorteo**: botón que anima los números y elige aleatoriamente entre los vendidos
  (usa `crypto.getRandomValues`). Guarda historial de ganadores.
- **Caja**: calculadora de recaudo, ganancia actual, ganancia si vendes todo y cobertura del premio.
- **Ajustes**: cambiar cantidad de números (ej. 50, 100, 1000…), precio del ticket,
  valor del premio y fecha del sorteo (editables y se guardan en el celular).

## Archivos

```
index.html        # La app completa (HTML + CSS + JS, sin dependencias)
manifest.json     # Para que funcione como PWA instalable
iconos/           # Íconos de la PWA
package.json      # (opcional, para Vercel no necesita build)
```

## Cómo está hecha

- 100% autocontenida: un solo archivo `index.html`, sin servidor ni dependencias.
- Los datos (vendidos, ganadores, ajustes) se guardan en `localStorage` del navegador.
- No necesita proxy ni API: funciona abriendo el archivo o en cualquier hosting estático.