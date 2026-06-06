# Capa simulador

Esta capa contiene el contrato entre el API y el firmware Arduino/Wokwi.

Archivos principales:

- `../../gallinero/gallinero.ino`: firmware Arduino Mega usado por Wokwi.
- `../../diagram.json`: circuito Wokwi.
- `../../wokwi.toml`: firmware compilado y puerto RFC2217.
- `serial-protocol.md`: comandos y telemetria del puerto Serial.

El firmware se compila desde la raiz del proyecto:

```bash
npm run build:firmware
```

Luego inicia Wokwi desde VS Code con:

```text
F1 -> Wokwi: Start Simulator
```

Con el simulador abierto, Wokwi expone el Serial en `localhost:4000`.
