/*
 * Gallinero Automatizado - Simulacion Wokwi (Arduino Mega)
 * PRO204 Metodologias de Desarrollo de Software
 *
 * PERFORMANCE: sin delay() en el loop principal.
 * Cada subsistema corre con su propio intervalo via millis().
 */

#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Servo.h>

/* ── Pines ─────────────────────────────────────────────────── */
#define DHT_PIN     22
#define LED_RED     23
#define LED_GREEN   24
#define LED_YELLOW  25
#define BUZZER_PIN  26
#define SERVO_PIN    9
#define FAN_PIN     27
#define HEAT_PIN    28
#define LIGHT1      29
#define LIGHT2      30
#define LIGHT3      31
#define BTN_RESET   32
#define BTN_TEST    33

/* ── Umbrales ───────────────────────────────────────────────── */
#define TEMP_HIGH       26.0f
#define TEMP_LOW        10.0f
#define TEMP_DANGER_HI  34.0f
#define TEMP_DANGER_LO   4.0f
#define TEMP_WARN_HI    30.0f
#define TEMP_WARN_LO     7.0f
#define LIGHT_ON_H       6
#define LIGHT_OFF_H     20
#define FEED_EVERY_H     6
#define SUPPLY_WARN      8
#define SUPPLY_CRIT     12

/* ── Intervalos millis (sin delay!) ────────────────────────── */
#define INTERVAL_DHT      2000UL   /* DHT22 min 2 s entre lecturas   */
#define INTERVAL_DISPLAY  1000UL   /* OLED cada 1 s                  */
#define INTERVAL_SIMCLOCK  500UL   /* avance hora simulada cada 500ms */
#define SERVO_OPEN_MS     1500UL   /* tiempo compuerta abierta        */
#define BTN_DEBOUNCE_MS    200UL   /* debounce botones                */
#define TEMP_FAN_COOL_STEP  0.8f    /* enfriamiento simulado por lectura */
#define TEMP_HEAT_STEP      0.8f    /* calentamiento simulado por lectura */
#define TEMP_DRIFT_STEP     0.2f    /* retorno gradual al ambiente DHT    */

/* ── OLED ───────────────────────────────────────────────────── */
#define SCREEN_W  128
#define SCREEN_H   64
#define OLED_ADDR 0x3C

/* ── Objetos ────────────────────────────────────────────────── */
DHT              dht(DHT_PIN, DHT22);
Servo            feeder;
Adafruit_SSD1306 oled(SCREEN_W, SCREEN_H, &Wire, -1);

/* ── Estado ─────────────────────────────────────────────────── */
typedef enum { ALARM_OK, ALARM_WARNING, ALARM_DANGER } AlarmState;
typedef enum { MODE_AUTO, MODE_FORCE_OFF, MODE_FORCE_ON } ControlMode;
AlarmState    systemState  = ALARM_OK;
ControlMode   fanMode      = MODE_AUTO;
ControlMode   heatMode     = MODE_AUTO;
ControlMode   lightMode    = MODE_AUTO;
int           alarmOverride = -1;
int           fanSpeed     = 60;

int           simHour      = 6;
int           eggCount     = 0;
int           feedCount    = 0;
int           errorCount   = 0;
float         tempLast     = 22.0f;
float         tempAmbient  = 22.0f;
float         humLast      = 65.0f;
int           lastHourFed  = -1;

/* ── Timers millis ──────────────────────────────────────────── */
unsigned long tDHT         = 0;
unsigned long tDisplay     = 0;
unsigned long tClock       = 0;
unsigned long tServoClose  = 0;
unsigned long tBtnReset    = 0;
unsigned long tBtnTest     = 0;

/* ── Flags de estado no-bloqueante ─────────────────────────── */
bool servoOpen     = false;   /* compuerta comedero abierta   */
bool oledReady     = false;   /* OLED inicializado            */
unsigned long tickCount = 0;
char serialCmd[48];
byte serialCmdLen = 0;

const char *modeToStr(ControlMode mode) {
    if (mode == MODE_FORCE_ON) return "ON";
    if (mode == MODE_FORCE_OFF) return "OFF";
    return "AUTO";
}

int clampPercent(int value) {
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
}

const char *alarmToStr(AlarmState state) {
    if (state == ALARM_WARNING) return "WARNING";
    if (state == ALARM_DANGER) return "DANGER";
    return "OK";
}

/* ──────────────────────────────────────────────────────────────
 * RF-02 Alarma
 * ────────────────────────────────────────────────────────────── */
void setAlarm(AlarmState s) {
    systemState = s;
    digitalWrite(LED_RED,    s == ALARM_DANGER  ? HIGH : LOW);
    digitalWrite(LED_GREEN,  s == ALARM_OK      ? HIGH : LOW);
    digitalWrite(LED_YELLOW, s == ALARM_WARNING ? HIGH : LOW);
    if (s == ALARM_OK)            noTone(BUZZER_PIN);
    else if (s == ALARM_WARNING)  tone(BUZZER_PIN, 800);
    else                          tone(BUZZER_PIN, 2500);
}

/* ──────────────────────────────────────────────────────────────
 * RF-04 Reinicio automatico
 * ────────────────────────────────────────────────────────────── */
void autoRecover(void) {
    fanMode = MODE_AUTO;
    heatMode = MODE_AUTO;
    lightMode = MODE_AUTO;
    alarmOverride = -1;
    setAlarm(ALARM_OK);
    updateLighting(simHour);
    updateThermal(tempLast);
}

/* ──────────────────────────────────────────────────────────────
 * RF-08 Iluminacion
 * ────────────────────────────────────────────────────────────── */
void updateLighting(int hour) {
    int on = (hour >= LIGHT_ON_H && hour < LIGHT_OFF_H) ? HIGH : LOW;
    if (lightMode == MODE_FORCE_ON) on = HIGH;
    else if (lightMode == MODE_FORCE_OFF) on = LOW;
    digitalWrite(LIGHT1, on);
    digitalWrite(LIGHT2, on);
    digitalWrite(LIGHT3, on);
}

/* ──────────────────────────────────────────────────────────────
 * RF-09 Control termico
 * ────────────────────────────────────────────────────────────── */
void updateThermal(float temp) {
    int fanOn = temp > TEMP_HIGH ? HIGH : LOW;
    int heatOn = temp < TEMP_LOW ? HIGH : LOW;

    if (fanMode == MODE_FORCE_ON) fanOn = HIGH;
    else if (fanMode == MODE_FORCE_OFF) fanOn = LOW;

    if (heatMode == MODE_FORCE_ON) heatOn = HIGH;
    else if (heatMode == MODE_FORCE_OFF) heatOn = LOW;

    digitalWrite(FAN_PIN, fanOn);
    digitalWrite(HEAT_PIN, heatOn);
}

/* ──────────────────────────────────────────────────────────────
 * Telemetria JSON para API REST / dashboard
 * ────────────────────────────────────────────────────────────── */
void printTelemetry(void) {
    Serial.print("{\"temp\":");   Serial.print(tempLast, 1);
    Serial.print(",\"hum\":");    Serial.print(humLast,  0);
    Serial.print(",\"state\":\"");Serial.print(alarmToStr(systemState));
    Serial.print("\",\"fan\":");  Serial.print(digitalRead(FAN_PIN));
    Serial.print(",\"heat\":");   Serial.print(digitalRead(HEAT_PIN));
    Serial.print(",\"light\":");  Serial.print(digitalRead(LIGHT1));
    Serial.print(",\"hour\":");   Serial.print(simHour);
    Serial.print(",\"eggs\":");   Serial.print(eggCount);
    Serial.print(",\"feed\":");   Serial.print(feedCount);
    Serial.print(",\"err\":");    Serial.print(errorCount);
    Serial.print(",\"servoOpen\":"); Serial.print(servoOpen ? 1 : 0);
    Serial.print(",\"fanSpeed\":"); Serial.print(fanSpeed);
    Serial.print(",\"fanMode\":\""); Serial.print(modeToStr(fanMode));
    Serial.print("\",\"heatMode\":\""); Serial.print(modeToStr(heatMode));
    Serial.print("\",\"lightMode\":\""); Serial.print(modeToStr(lightMode));
    Serial.print("\",\"alarmMode\":\"");
    Serial.print(alarmOverride < 0 ? "AUTO" : alarmToStr((AlarmState)alarmOverride));
    Serial.println("\"}");
}

void applyAlarmState(AlarmState evaluatedState) {
    if (alarmOverride >= 0) setAlarm((AlarmState)alarmOverride);
    else setAlarm(evaluatedState);
}

ControlMode parseMode(String value) {
    value.trim();
    value.toUpperCase();
    if (value == "ON") return MODE_FORCE_ON;
    if (value == "OFF") return MODE_FORCE_OFF;
    return MODE_AUTO;
}

void updateSimulatedTemperature(float ambientTemp) {
    tempAmbient = ambientTemp;

    if (digitalRead(FAN_PIN) == HIGH) {
        float cooling = TEMP_FAN_COOL_STEP * (fanSpeed / 100.0f);
        tempLast -= cooling;
    } else if (digitalRead(HEAT_PIN) == HIGH) {
        tempLast += TEMP_HEAT_STEP;
    } else if (tempLast < tempAmbient) {
        tempLast += TEMP_DRIFT_STEP;
        if (tempLast > tempAmbient) tempLast = tempAmbient;
    } else if (tempLast > tempAmbient) {
        tempLast -= TEMP_DRIFT_STEP;
        if (tempLast < tempAmbient) tempLast = tempAmbient;
    } else {
        tempLast = tempAmbient;
    }

    if (tempLast < -10.0f) tempLast = -10.0f;
    if (tempLast > 60.0f) tempLast = 60.0f;
}

void handleSerialCommand(String cmd) {
    cmd.trim();
    cmd.toUpperCase();
    if (cmd.length() == 0) return;

    if (cmd == "GET") {
        printTelemetry();
        return;
    }
    if (cmd == "FEED") {
        startFeed();
        printTelemetry();
        return;
    }
    if (cmd == "RESET") {
        autoRecover();
        feedCount = 0;
        errorCount = 0;
        printTelemetry();
        return;
    }
    if (cmd == "TEST") {
        alarmOverride = systemState == ALARM_DANGER ? -1 : ALARM_DANGER;
        applyAlarmState(evaluateAlarms(tempLast));
        printTelemetry();
        return;
    }
    if (cmd.startsWith("FAN:")) {
        fanMode = parseMode(cmd.substring(4));
        updateThermal(tempLast);
        printTelemetry();
        return;
    }
    if (cmd.startsWith("FAN_SPEED:")) {
        fanSpeed = clampPercent(cmd.substring(10).toInt());
        if (fanSpeed > 0 && fanMode == MODE_FORCE_OFF) fanMode = MODE_FORCE_ON;
        if (fanSpeed == 0 && fanMode == MODE_FORCE_ON) fanMode = MODE_FORCE_OFF;
        updateThermal(tempLast);
        printTelemetry();
        return;
    }
    if (cmd.startsWith("HEAT:")) {
        heatMode = parseMode(cmd.substring(5));
        updateThermal(tempLast);
        printTelemetry();
        return;
    }
    if (cmd.startsWith("LIGHT:")) {
        lightMode = parseMode(cmd.substring(6));
        updateLighting(simHour);
        printTelemetry();
        return;
    }
    if (cmd.startsWith("ALARM:")) {
        String value = cmd.substring(6);
        value.trim();
        if (value == "AUTO") alarmOverride = -1;
        else if (value == "OK") alarmOverride = ALARM_OK;
        else if (value == "WARNING") alarmOverride = ALARM_WARNING;
        else if (value == "DANGER") alarmOverride = ALARM_DANGER;
        applyAlarmState(evaluateAlarms(tempLast));
        printTelemetry();
        return;
    }
    if (cmd.startsWith("HOUR:")) {
        int nextHour = cmd.substring(5).toInt();
        if (nextHour >= 0 && nextHour < 24) {
            simHour = nextHour;
            updateLighting(simHour);
        }
        printTelemetry();
        return;
    }

    Serial.print("{\"error\":\"UNKNOWN_COMMAND\",\"cmd\":\"");
    Serial.print(cmd);
    Serial.println("\"}");
}

void processSerialCommands(void) {
    while (Serial.available() > 0) {
        char ch = (char)Serial.read();
        if (ch == '\n' || ch == '\r') {
            if (serialCmdLen > 0) {
                serialCmd[serialCmdLen] = '\0';
                handleSerialCommand(String(serialCmd));
                serialCmdLen = 0;
            }
        } else if (serialCmdLen < sizeof(serialCmd) - 1) {
            serialCmd[serialCmdLen++] = ch;
        }
    }
}

/* ──────────────────────────────────────────────────────────────
 * RF-09 Control termico
 * ────────────────────────────────────────────────────────────── */
void updateThermalLegacy(float temp) {
    if (temp > TEMP_HIGH) {
        digitalWrite(FAN_PIN,  HIGH);
        digitalWrite(HEAT_PIN, LOW);
    } else if (temp < TEMP_LOW) {
        digitalWrite(FAN_PIN,  LOW);
        digitalWrite(HEAT_PIN, HIGH);
    } else {
        digitalWrite(FAN_PIN,  LOW);
        digitalWrite(HEAT_PIN, LOW);
    }
}

/* ──────────────────────────────────────────────────────────────
 * RF-07 Comedero — inicia apertura no-bloqueante
 * ────────────────────────────────────────────────────────────── */
void startFeed(void) {
    if (servoOpen) return;         /* ya abierto, ignorar         */
    feeder.write(90);              /* abrir compuerta             */
    tServoClose = millis();        /* armar temporizador de cierre */
    servoOpen = true;
    feedCount++;
}

/* ──────────────────────────────────────────────────────────────
 * Tick servo: cierra compuerta cuando expira el timer
 * ────────────────────────────────────────────────────────────── */
void tickServo(void) {
    if (servoOpen && (millis() - tServoClose >= SERVO_OPEN_MS)) {
        feeder.write(0);
        servoOpen = false;
    }
}

/* ──────────────────────────────────────────────────────────────
 * Evaluar nivel de alarma
 * ────────────────────────────────────────────────────────────── */
AlarmState evaluateAlarms(float temp) {
    if (temp > TEMP_DANGER_HI || temp < TEMP_DANGER_LO) {
        errorCount++;
        return ALARM_DANGER;
    }
    if (feedCount >= SUPPLY_CRIT) {
        errorCount++;
        return ALARM_DANGER;
    }
    if (temp > TEMP_WARN_HI || temp < TEMP_WARN_LO || feedCount >= SUPPLY_WARN) {
        return ALARM_WARNING;
    }
    return ALARM_OK;
}

/* ──────────────────────────────────────────────────────────────
 * RF-03 Pantalla OLED
 * ────────────────────────────────────────────────────────────── */
void updateDisplay(void) {
    if (!oledReady) return;
    const char *stateStr =
        (systemState == ALARM_OK)      ? "OK"      :
        (systemState == ALARM_WARNING)  ? "WARN"    : "DANGER";

    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);

    oled.setCursor(0, 0);   oled.print("GALLINERO AUTO");
    oled.setCursor(0, 10);
    oled.print("T:"); oled.print(tempLast, 1);
    oled.print("C H:"); oled.print(humLast, 0); oled.print("%");
    oled.setCursor(0, 20);
    oled.print("Hora:"); oled.print(simHour);
    oled.print(" Luz:"); oled.print(digitalRead(LIGHT1) ? "SI" : "NO");
    oled.setCursor(0, 30);
    oled.print("Fan:"); oled.print(digitalRead(FAN_PIN)  ? "SI" : "NO");
    oled.print(" Cal:"); oled.print(digitalRead(HEAT_PIN) ? "SI" : "NO");
    oled.setCursor(0, 40);
    oled.print("Hvs:"); oled.print(eggCount);
    oled.print(" Alim:"); oled.print(feedCount);
    oled.setCursor(0, 54);
    oled.print(stateStr);
    oled.print(" Err:"); oled.print(errorCount);

    oled.display();
}

/* ──────────────────────────────────────────────────────────────
 * Setup
 * ────────────────────────────────────────────────────────────── */
void setup(void) {
    pinMode(LED_RED,    OUTPUT);
    pinMode(LED_GREEN,  OUTPUT);
    pinMode(LED_YELLOW, OUTPUT);
    pinMode(FAN_PIN,    OUTPUT);
    pinMode(HEAT_PIN,   OUTPUT);
    pinMode(LIGHT1,     OUTPUT);
    pinMode(LIGHT2,     OUTPUT);
    pinMode(LIGHT3,     OUTPUT);
    pinMode(BTN_RESET,  INPUT_PULLUP);
    pinMode(BTN_TEST,   INPUT_PULLUP);

    Serial.begin(115200);

    dht.begin();

    feeder.attach(SERVO_PIN);
    feeder.write(0);

    Wire.begin();
    if (oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        oledReady = true;
        oled.clearDisplay();
        oled.display();
    }

    setAlarm(ALARM_OK);
    startFeed();    /* alimentacion inicial */
}

/* ──────────────────────────────────────────────────────────────
 * Loop principal — CERO delay(), todo por millis()
 * ────────────────────────────────────────────────────────────── */
void loop(void) {
    unsigned long now = millis();
    tickCount++;

    processSerialCommands();

    /* ── Servo no-bloqueante ── */
    tickServo();

    /* ── Leer DHT22 cada 2 s (intervalo minimo del sensor) ── */
    if (now - tDHT >= INTERVAL_DHT) {
        tDHT = now;
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(h)) humLast  = h;

        /* RF-09 y RF-02 actualizados junto al sensor */
        updateThermal(tempLast);
        if (!isnan(t)) {
            updateSimulatedTemperature(t);
            updateThermal(tempLast);
        }
        applyAlarmState(evaluateAlarms(tempLast));

        /* RF-01 — JSON para dashboard web / app movil */
        printTelemetry();
    }

    /* ── Reloj simulado y control de luz ── */
    if (now - tClock >= INTERVAL_SIMCLOCK) {
        tClock = now;
        simHour = (simHour + 1) % 24;
        updateLighting(simHour);

        /* RF-07 comedero cada FEED_EVERY_H horas */
        if (simHour != lastHourFed && simHour % FEED_EVERY_H == 0) {
            startFeed();
            lastHourFed = simHour;
        }

        /* RF-03 huevo por dia simulado al mediodia */
        if (simHour == 12) eggCount++;
    }

    /* ── Actualizar OLED cada 1 s ── */
    if (now - tDisplay >= INTERVAL_DISPLAY) {
        tDisplay = now;
        updateDisplay();
    }

    /* ── Boton RESET (RF-04) con debounce ── */
    if (digitalRead(BTN_RESET) == LOW && now - tBtnReset >= BTN_DEBOUNCE_MS) {
        tBtnReset = now;
        autoRecover();
        feedCount  = 0;
        errorCount = 0;
    }

    /* ── Boton TEST con debounce ── */
    if (digitalRead(BTN_TEST) == LOW && now - tBtnTest >= BTN_DEBOUNCE_MS) {
        tBtnTest = now;
        /* alterna DANGER/OK con cada pulsacion */
        alarmOverride = systemState == ALARM_DANGER ? -1 : ALARM_DANGER;
        applyAlarmState(evaluateAlarms(tempLast));
    }
}
