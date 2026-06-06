# GallineroSmart — Nave Industrial v1.0

Sistema de monitoreo y control automatizado para gallinero industrial de 50 gallinas ponedoras. Integra un simulador Arduino/Raspberry Pi Pico (Wokwi), una API REST en Node.js y un dashboard React con visualización en tiempo real.

## Estructura del repositorio

```
gallenero/
├── simulador/              # Aplicación principal (API + Front)
│   ├── apps/
│   │   ├── api/            # Express — lógica de negocio y adaptadores
│   │   ├── front/          # React/Vite — dashboard industrial
│   │   └── simulator/      # Documentación del protocolo serial
│   ├── gallinero/
│   │   └── gallinero.ino   # Firmware Arduino Mega
│   ├── diagram.json        # Circuito Wokwi
│   └── wokwi.toml          # Configuración RFC2217
├── wokwi/                  # Proyecto Wokwi alternativo (Pi Pico)
├── pi-pico-community-core/ # Base del simulador Pi Pico (Wokwi community)
├── gallinero_industrial.html
└── gallinero_smart_mockup.html
```

## Arquitectura

```
┌─────────────┐    RFC2217     ┌──────────────┐    SSE/REST    ┌────────────┐
│  Wokwi      │ ─────────────► │  API Express │ ─────────────► │  React     │
│  (Arduino)  │ ◄───────────── │  :3000       │                │  :5173     │
│  :4000      │  Comandos      └──────────────┘                └────────────┘
└─────────────┘                       │
                                       ▼
                              ┌──────────────────┐
                              │  Open-Meteo API  │
                              │  WorldTimeAPI    │
                              └──────────────────┘
```

El firmware Arduino evalúa alarmas y controla actuadores. La API Node.js actúa como capa de orquestación — recibe telemetría por RFC2217, aplica automatización climática/horaria y expone el estado completo por REST y SSE. El front React consume únicamente la API.

## Funcionalidades

- **Telemetría en tiempo real** — temperatura, humedad, estado de actuadores vía SSE
- **Control de actuadores** — ventilador (con velocidad PWM), calefactor, iluminación LED, comedero servo
- **Automatización climática** — enciende/apaga ventilador o calefactor según temperatura exterior real (Open-Meteo)
- **Automatización horaria** — controla las luces según hora real de la ubicación (WorldTimeAPI / Open-Meteo)
- **Sistema de alarmas** — OK / WARNING / DANGER con motivos específicos (temperatura + suministro)
- **Mortalidad simulada** — las gallinas mueren si el sistema permanece en DANGER térmico
- **Autonomía calculada** — días estimados de alimento y agua según datos reales FAO/K-State
- **Gestión de ubicación** — GPS del navegador, presets de Chile o coordenadas manuales

## Parámetros reales del sistema

| Recurso | Capacidad | Consumo diario (50 gallinas) | Autonomía típica |
|---------|-----------|------------------------------|-----------------|
| Alimento | 150 kg (3 × 50 kg) | 6.0 kg/día (120 g/gallina) | ~25 días lleno |
| Agua | 200 L | 12.5 L/día (250 ml/gallina) | ~16 días lleno |

Ciclo de alimentación: cada 6 horas simuladas (4 ciclos/día). Fuentes: FAO, K-State Extension, Alabama Cooperative Extension.

## Requisitos

- Node.js 18+
- VS Code + extensión Wokwi (para el simulador)
- Cuenta Wokwi (para RFC2217)

## Instalación

```bash
cd simulador
npm install
cp .env.example .env   # ajusta ubicación y umbrales si es necesario
```

## Uso

### 1. Iniciar el simulador Wokwi

Abre `simulador/` en VS Code y ejecuta `F1 → Wokwi: Start Simulator`. Mantén visible la pestaña del simulador. Expone el serial en `localhost:4000`.

### 2. Iniciar API y front

```bash
cd simulador
npm run dev
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:3000 |
| Dashboard | http://localhost:5173 |

## Variables de entorno

```bash
# Ubicación predeterminada
WEATHER_LOCATION="Santiago, CL"
WEATHER_LATITUDE=-33.4489
WEATHER_LONGITUDE=-70.6693
WEATHER_TIMEZONE=America/Santiago

# Automatización climática
WEATHER_AUTOMATION_ENABLED=true
WEATHER_LOW_TEMP=10           # calefactor ON bajo este umbral (°C)
WEATHER_HIGH_TEMP=26          # ventilador ON sobre este umbral (°C)

# Automatización de luces
LIGHT_AUTOMATION_ENABLED=true
LIGHT_ON_HOUR=6
LIGHT_OFF_HOUR=20
```

## Umbrales de alarma (firmware)

| Condición | Estado |
|-----------|--------|
| Temperatura > 34°C o < 4°C | DANGER |
| Temperatura 30–34°C o 4–7°C | WARNING |
| Ciclos de alimentación ≥ 12 | DANGER |
| Ciclos de alimentación ≥ 8 | WARNING |

Mortalidad: 1 gallina cada 10 ciclos de telemetría (≈ 20 segundos) en DANGER térmico sostenido.

## Endpoints principales

```
GET  /api/state
GET  /api/events                           # SSE
POST /api/controls/fan      { mode }       # AUTO | ON | OFF
POST /api/controls/heat     { mode }
POST /api/controls/light    { mode }
POST /api/controls/alarm    { state }      # AUTO | OK | WARNING | DANGER
POST /api/controls/fan-speed { speed }     # 0–100
POST /api/controls/feed
POST /api/controls/reset
POST /api/resources         { lux, water, silos }
POST /api/weather/automation { enabled, lowTemp, highTemp }
POST /api/light/automation  { enabled, onHour, offHour }
POST /api/locations/active  { id }
POST /api/locations/manual  { label, latitude, longitude, timezone }
```

## Router del dashboard

| Ruta | Contenido |
|------|-----------|
| `/` | Dashboard — estado del sistema, producción, temperatura |
| `/controles` | Iluminación, extractor, calefactor |
| `/recursos` | Comedero, silos, agua con autonomía |
| `/ubicacion` | Localización GPS, meteorología exterior |
