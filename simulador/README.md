# Gallinero Industrial

Proyecto local con simulador Arduino/Wokwi, API REST Express y app React.

## Estructura

```text
.
├── apps
│   ├── api        # Express, casos de uso y adaptadores del simulador
│   ├── front      # React/Vite, dashboard industrial
│   └── simulator  # contrato serial y notas de Wokwi
├── gallinero      # firmware Arduino Mega
├── diagram.json   # circuito Wokwi
└── wokwi.toml     # firmware y RFC2217
```

## Arquitectura

La API sigue una separacion hexagonal simple:

- `domain`: normaliza el estado del gallinero.
- `application`: orquesta comandos y telemetria.
- `adapters/in/http`: REST y SSE.
- `adapters/out/simulator`: adaptador Wokwi RFC2217 y fallback local.

El front React consume solo el API. No habla directo con Wokwi.

## Instalacion

Desde la raiz:

```bash
npm install
```

Opcionalmente copia `.env.example` como referencia para configurar ubicacion y umbrales en tu terminal.

## Compilar firmware

```bash
npm run build:firmware
```

Esto genera:

```text
build/gallinero.ino.hex
build/gallinero.ino.elf
```

## Simular con Wokwi

1. Abre el proyecto en VS Code.
2. Instala/activa la extension Wokwi.
3. Ejecuta `F1 -> Wokwi: Start Simulator`.
4. Mantén visible la pestaña del simulador.

`wokwi.toml` expone el serial en:

```text
localhost:4000
```

## Ejecutar API y front

En una terminal:

```bash
npm run dev
```

Esto levanta:

```text
API:   http://localhost:3000
Front: http://localhost:5173
```

El front usa el proxy de Vite para llamar a `/api`.

## Meteorologia exterior

El API consulta Open-Meteo para obtener clima real sin API key. La ubicacion activa se obtiene desde el servicio de localizacion:

```text
WEATHER_LOCATION="Santiago, CL"
WEATHER_LATITUDE=-33.4489
WEATHER_LONGITUDE=-70.6693
WEATHER_TIMEZONE=America/Santiago
WEATHER_POLL_MS=600000
WEATHER_AUTOMATION_ENABLED=true
WEATHER_LOW_TEMP=10
WEATHER_HIGH_TEMP=26
LIGHT_AUTOMATION_ENABLED=true
LIGHT_ON_HOUR=6
LIGHT_OFF_HOUR=20
```

## Localizacion

El proyecto incluye un servicio de localizacion en memoria:

- Si el navegador entrega geolocalizacion, se usa esa posicion y se ajusta al huso horario chileno mas cercano.
- Si el usuario niega el permiso o el navegador no soporta GPS, se vuelve a la ubicacion default definida en `.env`.
- El dashboard permite seleccionar locaciones reales de Chile: Arica, Iquique, Antofagasta, Copiapo, La Serena, Valparaiso, Santiago, Rancagua, Talca, Chillan, Concepcion, Temuco, Valdivia, Puerto Montt, Coyhaique, Punta Arenas y Hanga Roa.
- Tambien puedes agregar locaciones manuales con nombre, latitud, longitud y zona horaria.
- Las locaciones manuales se guardan localmente en `data/locations.json`.

La ubicacion activa alimenta tanto el clima como la hora real usada para las luces.

La automatizacion meteorologica es supervisora:

- Si la temperatura exterior es mayor o igual a `WEATHER_HIGH_TEMP`, fuerza `FAN:ON` y `HEAT:OFF`.
- Si la temperatura exterior es menor o igual a `WEATHER_LOW_TEMP`, fuerza `HEAT:ON` y `FAN:OFF`.
- Si esta en rango, devuelve ambos controles a `AUTO`.

El sensor DHT del simulador sigue siendo la lectura interna del gallinero; la meteorologia exterior solo ayuda a anticipar ventilacion/calefaccion.

## Luces con hora real

La API controla las luces con hora real de la ubicacion configurada:

1. Usa primero la hora entregada por Open-Meteo (`current.time`).
2. Si Open-Meteo no entrega hora, consulta WorldTimeAPI con la zona IANA configurada.
3. Si ambas fuentes fallan, usa la hora del sistema formateada con `WEATHER_TIMEZONE`.

Por defecto las luces se encienden desde `LIGHT_ON_HOUR=6` hasta antes de `LIGHT_OFF_HOUR=20`.

## Endpoints principales

```text
GET  /api/health
GET  /api/state
GET  /api/events
GET  /api/weather
GET  /api/time
GET  /api/locations
POST /api/controls/fan      { "mode": "AUTO|ON|OFF" }
POST /api/controls/heat     { "mode": "AUTO|ON|OFF" }
POST /api/controls/light    { "mode": "AUTO|ON|OFF" }
POST /api/controls/alarm    { "state": "AUTO|OK|WARNING|DANGER" }
POST /api/controls/feed
POST /api/controls/reset
POST /api/controls/test
POST /api/resources
POST /api/weather/automation { "enabled": true, "lowTemp": 10, "highTemp": 26 }
POST /api/weather/refresh
POST /api/light/automation { "enabled": true, "onHour": 6, "offHour": 20 }
POST /api/time/refresh
POST /api/locations/active { "id": "cl-santiago" }
POST /api/locations/manual { "label": "Parcela Talca", "latitude": -35.42, "longitude": -71.65, "timezone": "America/Santiago" }
POST /api/locations/browser { "latitude": -33.45, "longitude": -70.66, "accuracy": 100 }
POST /api/locations/denied
POST /api/locations/reset
```

El API no simula telemetria si Wokwi/controlador esta apagado. Si no hay conexion RFC2217, el estado queda `disconnected`, se muestra una alerta critica y los controles no se aplican hasta que el simulador vuelva a estar conectado.
