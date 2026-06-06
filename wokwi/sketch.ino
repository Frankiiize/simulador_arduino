/*
 * Gallinero Automatizado — Simulacion Wokwi (Raspberry Pi Pico)
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
#define DHT_PIN     0
#define LED_RED     1
#define LED_GREEN   2
#define LED_YELLOW  3
#define BUZZER_PIN  4
#define SERVO_PIN   5
#define FAN_PIN     6
#define HEAT_PIN    7
#define LIGHT1      8
#define LIGHT2      9
#define LIGHT3     10
#define BTN_RESET  14
#define BTN_TEST   15
#define I2C_SDA    20
#define I2C_SCL    21

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
AlarmState    systemState  = ALARM_OK;

int           simHour      = 6;
int           eggCount     = 0;
int           feedCount    = 0;
int           errorCount   = 0;
float         tempLast     = 22.0f;
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
    setAlarm(ALARM_OK);
    digitalWrite(FAN_PIN,  LOW);
    digitalWrite(HEAT_PIN, LOW);
}

/* ──────────────────────────────────────────────────────────────
 * RF-08 Iluminacion
 * ────────────────────────────────────────────────────────────── */
void updateLighting(int hour) {
    int on = (hour >= LIGHT_ON_H && hour < LIGHT_OFF_H) ? HIGH : LOW;
    digitalWrite(LIGHT1, on);
    digitalWrite(LIGHT2, on);
    digitalWrite(LIGHT3, on);
}

/* ──────────────────────────────────────────────────────────────
 * RF-09 Control termico
 * ────────────────────────────────────────────────────────────── */
void updateThermal(float temp) {
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

    Wire.setSDA(I2C_SDA);
    Wire.setSCL(I2C_SCL);
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

    /* ── Servo no-bloqueante ── */
    tickServo();

    /* ── Leer DHT22 cada 2 s (intervalo minimo del sensor) ── */
    if (now - tDHT >= INTERVAL_DHT) {
        tDHT = now;
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(t)) tempLast = t;
        if (!isnan(h)) humLast  = h;

        /* RF-09 y RF-02 actualizados junto al sensor */
        updateThermal(tempLast);
        setAlarm(evaluateAlarms(tempLast));

        /* RF-01 — JSON para dashboard web / app movil */
        const char *stateStr =
            (systemState == ALARM_OK)      ? "OK"      :
            (systemState == ALARM_WARNING)  ? "WARNING" : "DANGER";
        Serial.print("{\"temp\":");   Serial.print(tempLast, 1);
        Serial.print(",\"hum\":");    Serial.print(humLast,  0);
        Serial.print(",\"state\":\"");Serial.print(stateStr);
        Serial.print("\",\"fan\":");  Serial.print(digitalRead(FAN_PIN));
        Serial.print(",\"heat\":");   Serial.print(digitalRead(HEAT_PIN));
        Serial.print(",\"light\":"); Serial.print(digitalRead(LIGHT1));
        Serial.print(",\"hour\":");  Serial.print(simHour);
        Serial.print(",\"eggs\":");  Serial.print(eggCount);
        Serial.print(",\"feed\":");  Serial.print(feedCount);
        Serial.print(",\"err\":");   Serial.print(errorCount);
        Serial.println("}");
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
        setAlarm(systemState == ALARM_DANGER ? ALARM_OK : ALARM_DANGER);
    }
}
