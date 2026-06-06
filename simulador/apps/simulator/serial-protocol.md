# Protocolo serial Arduino/Wokwi

El API se conecta al simulador Wokwi por RFC2217 en `localhost:4000`.
Cada comando se envia como texto ASCII terminado en `\n`.

## Telemetria

El firmware publica una linea JSON cada 2 segundos y tambien despues de ejecutar un comando. `temp` representa la temperatura interna simulada del gallinero: toma el DHT como ambiente base y aplica enfriamiento si el ventilador esta encendido o calentamiento si el calefactor esta encendido.

```json
{
  "temp": 22.0,
  "hum": 65,
  "state": "OK",
  "fan": 0,
  "heat": 0,
  "light": 1,
  "hour": 6,
  "eggs": 0,
  "feed": 1,
  "err": 0,
  "servoOpen": 0,
  "fanSpeed": 60,
  "fanMode": "AUTO",
  "heatMode": "AUTO",
  "lightMode": "AUTO",
  "alarmMode": "AUTO"
}
```

## Comandos

| Comando | Efecto |
| --- | --- |
| `GET` | Fuerza una telemetria inmediata. |
| `FEED` | Abre la compuerta del comedero. |
| `RESET` | Reinicia alarmas, errores, alimento y modos manuales. |
| `TEST` | Alterna alarma de peligro/manual. |
| `FAN:AUTO` | Devuelve el extractor a control automatico. |
| `FAN:ON` | Fuerza extractor encendido. |
| `FAN:OFF` | Fuerza extractor apagado. |
| `FAN_SPEED:0..100` | Ajusta intensidad del ventilador y el enfriamiento simulado. |
| `HEAT:AUTO` | Devuelve calefactor a control automatico. |
| `HEAT:ON` | Fuerza calefactor encendido. |
| `HEAT:OFF` | Fuerza calefactor apagado. |
| `LIGHT:AUTO` | Devuelve luces al ciclo horario. |
| `LIGHT:ON` | Fuerza luces encendidas. |
| `LIGHT:OFF` | Fuerza luces apagadas. |
| `ALARM:AUTO` | Devuelve la alarma a evaluacion automatica. |
| `ALARM:OK` | Fuerza estado verde. |
| `ALARM:WARNING` | Fuerza estado amarillo. |
| `ALARM:DANGER` | Fuerza estado rojo. |
| `HOUR:0..23` | Ajusta la hora simulada. |
