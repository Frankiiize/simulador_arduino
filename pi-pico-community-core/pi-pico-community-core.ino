/*
 * Gallinero Automatizado — Simulacion Wokwi (Raspberry Pi Pico)
 * PRO204 Metodologias de Desarrollo de Software
 *
 * RF-02 Alarma         : LED rojo/verde/amarillo + buzzer
 * RF-03 Estadisticas   : OLED muestra temp, humedad, huevos, errores
 * RF-04 Reinicio auto  : recuperacion en <1 min via boton RESET
 * RF-05/09 Temperatura : DHT22, ventilacion >26 C, calefaccion <10 C
 * RF-07 Alimentos      : servo comedero cada FEED_EVERY_H horas
 * RF-08 Iluminacion    : ciclo solar 14h (06:00 - 20:00)
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

/* ── Umbrales de temperatura ────────────────────────────────── */
#define TEMP_HIGH       26.0f   /* RF-09: encima -> ventilador  */
#define TEMP_LOW        10.0f   /* RF-09: abajo  -> calefaccion */
#define TEMP_DANGER_HI  34.0f
#define TEMP_DANGER_LO   4.0f
#define TEMP_WARN_HI    30.0f
#define TEMP_WARN_LO     7.0f

/* ── Iluminacion (RF-08) ────────────────────────────────────── */
#define LIGHT_ON_H   6          /* 06:00 encendido             */
#define LIGHT_OFF_H 20          /* 20:00 apagado (14 horas)    */

/* ── Suministros (RF-07) ────────────────────────────────────── */
#define FEED_EVERY_H  6
#define SUPPLY_WARN   8         /* aviso amarillo              */
#define SUPPLY_CRIT  12         /* alarma roja                 */

/* ── OLED ───────────────────────────────────────────────────── */
#define SCREEN_W   128
#define SCREEN_H    64
#define OLED_ADDR 0x3C

/* ── Objetos globales ───────────────────────────────────────── */
DHT            dht(DHT_PIN, DHT22);
Servo          feeder;
Adafruit_SSD1306 oled(SCREEN_W, SCREEN_H, &Wire, -1);

/* ── Estado del sistema ─────────────────────────────────────── */
typedef enum { ALARM_OK, ALARM_WARNING, ALARM_DANGER } AlarmState;

AlarmState     systemState = ALARM_OK;
int            simHour     = 6;
int            eggCount    = 0;
int            feedCount   = 0;
int            errorCount  = 0;
float          tempLast    = 22.0f;
float          humLast     = 65.0f;
unsigned long  tick        = 0;
int            lastHourFed = -1;

/* ──────────────────────────────────────────────────────────────
 * RF-02  Alarma
 * ────────────────────────────────────────────────────────────── */
void setAlarm(AlarmState s) {
    systemState = s;
    digitalWrite(LED_RED,    s == ALARM_DANGER  ? HIGH : LOW);
    digitalWrite(LED_GREEN,  s == ALARM_OK      ? HIGH : LOW);
    digitalWrite(LED_YELLOW, s == ALARM_WARNING ? HIGH : LOW);

    if (s == ALARM_OK) {
        noTone(BUZZER_PIN);
    } else if (s == ALARM_WARNING) {
        tone(BUZZER_PIN, 800);    /* tono suave — bajo dB */
    } else {
        tone(BUZZER_PIN, 2500);   /* tono de peligro      */
    }
}

/* ──────────────────────────────────────────────────────────────
 * RF-04  Reinicio automatico
 * ────────────────────────────────────────────────────────────── */
void autoRecover(void) {
    setAlarm(ALARM_OK);
    digitalWrite(FAN_PIN,  LOW);
    digitalWrite(HEAT_PIN, LOW);
}

/* ──────────────────────────────────────────────────────────────
 * RF-08  Iluminacion — ciclo solar simulado (14 horas)
 * ────────────────────────────────────────────────────────────── */
void updateLighting(int hour) {
    int on = (hour >= LIGHT_ON_H && hour < LIGHT_OFF_H) ? HIGH : LOW;
    digitalWrite(LIGHT1, on);
    digitalWrite(LIGHT2, on);
    digitalWrite(LIGHT3, on);
}

/* ──────────────────────────────────────────────────────────────
 * RF-09  Monitoreo termico y ventilacion
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
 * RF-07  Comedero automatico (servo)
 * ────────────────────────────────────────────────────────────── */
void triggerFeed(void) {
    feeder.write(90);    /* abrir compuerta  */
    delay(1500);
    feeder.write(0);     /* cerrar compuerta */
    feedCount++;
}

/* ──────────────────────────────────────────────────────────────
 * Evaluar nivel de alarma segun sensores y suministros
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
 * RF-03  Estadisticas en pantalla OLED
 * ────────────────────────────────────────────────────────────── */
void updateDisplay(void) {
    const char *stateStr =
        (systemState == ALARM_OK)      ? "OK"      :
        (systemState == ALARM_WARNING)  ? "WARNING" : "DANGER";

    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);

    oled.setCursor(0, 0);
    oled.print("GALLINERO AUTO");

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
    /* Salidas digitales */
    pinMode(LED_RED,   OUTPUT);
    pinMode(LED_GREEN,  OUTPUT);
    pinMode(LED_YELLOW, OUTPUT);
    pinMode(FAN_PIN,    OUTPUT);
    pinMode(HEAT_PIN,   OUTPUT);
    pinMode(LIGHT1,     OUTPUT);
    pinMode(LIGHT2,     OUTPUT);
    pinMode(LIGHT3,     OUTPUT);

    /* Entradas con pull-up interno */
    pinMode(BTN_RESET, INPUT_PULLUP);
    pinMode(BTN_TEST,  INPUT_PULLUP);

    /* Sensor temperatura/humedad */
    dht.begin();

    /* Servo comedero */
    feeder.attach(SERVO_PIN);
    feeder.write(0);

    /* OLED via I2C en GP20/GP21 */
    Wire.setSDA(I2C_SDA);
    Wire.setSCL(I2C_SCL);
    Wire.begin();
    oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
    oled.clearDisplay();
    oled.display();

    setAlarm(ALARM_OK);
    triggerFeed();    /* alimentacion inicial al arrancar */
}

/* ──────────────────────────────────────────────────────────────
 * Loop principal
 * ────────────────────────────────────────────────────────────── */
void loop(void) {
    tick++;

    /* Leer DHT22 (RF-05) */
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) tempLast = t;
    if (!isnan(h)) humLast  = h;

    /* RF-09 control termico */
    updateThermal(tempLast);

    /* RF-08 ciclo de luz */
    updateLighting(simHour);

    /* RF-02 evaluacion y alarma */
    setAlarm(evaluateAlarms(tempLast));

    /* RF-03 pantalla OLED */
    updateDisplay();

    /* RF-07 comedero segun hora simulada */
    if (simHour != lastHourFed && simHour % FEED_EVERY_H == 0) {
        triggerFeed();
        lastHourFed = simHour;
    }

    /* RF-03 produccion de huevos: 1 por dia simulado al mediodia */
    if (simHour == 12 && tick % (24UL * 4UL) == 0) {
        eggCount++;
    }

    /* Boton RESET — RF-04 reinicio automatico */
    if (digitalRead(BTN_RESET) == LOW) {
        autoRecover();
        feedCount  = 0;
        errorCount = 0;
        delay(400);
    }

    /* Boton TEST — probar alarma de forma manual */
    if (digitalRead(BTN_TEST) == LOW) {
        setAlarm(ALARM_DANGER);
        delay(2000);
        setAlarm(ALARM_OK);
        delay(400);
    }

    /* Avanzar hora simulada: cada 4 ticks = 1 hora */
    if (tick % 4 == 0) {
        simHour = (simHour + 1) % 24;
    }

    delay(500);
}
