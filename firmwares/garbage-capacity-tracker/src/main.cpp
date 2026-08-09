#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <time.h>

#if __has_include("secrets.h")
#include "secrets.h" // Local credentials; never commit this file.
#else
#include "secrets.example.h" // Allows credential-free CI compilation.
#endif

// HC-SR04 ECHO is 5V on many modules: use a voltage divider/level shifter before ESP8266 GPIO.
constexpr uint8_t TRIG_PIN = D5;
constexpr uint8_t ECHO_PIN = D6;
constexpr unsigned long PUBLISH_INTERVAL_MS = 15000;
// These thresholds are local diagnostics only. The backend remains authoritative for capacity percentage.
#ifndef BIN_HEIGHT_CM
#define BIN_HEIGHT_CM 30.0f
#endif
#ifndef FULL_DISTANCE_CM
#define FULL_DISTANCE_CM 8.0f
#endif
#ifndef NEAR_FULL_DISTANCE_CM
#define NEAR_FULL_DISTANCE_CM 12.0f
#endif

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastPublish = 0;

String statusTopic() { return String("sispik/v1/ingest/devices/") + DEVICE_ID + "/status"; }
String telemetryTopic() { return String("sispik/v1/ingest/sites/") + DEVICE_ID + "/telemetry"; }

void connectWifi() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) delay(250);
  }
}

String observedAt() {
  const time_t now = time(nullptr);
  if (now < 1700000000) return String();
  struct tm utc;
  gmtime_r(&now, &utc);
  char value[32];
  strftime(value, sizeof(value), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(value);
}

String nextMessageId() { return String(ESP.getChipId(), HEX) + "-" + String(millis()); }

void publishStatus(const char* status, bool retained) {
  StaticJsonDocument<160> payload;
  payload["messageId"] = nextMessageId();
  payload["status"] = status;
  const String timestamp = observedAt();
  if (timestamp.length()) payload["observedAt"] = timestamp;
  char buffer[160];
  serializeJson(payload, buffer);
  mqtt.publish(statusTopic().c_str(), buffer, retained);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    const char* lwt = "{\"messageId\":\"lwt\",\"status\":\"offline\"}";
    if (mqtt.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD, statusTopic().c_str(), 1, true, lwt)) publishStatus("online", true);
    else delay(1000);
  }
}

float medianDistance() {
  float readings[5];
  uint8_t count = 0;
  for (uint8_t i = 0; i < 5; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    const unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    const float cm = duration * 0.0343f / 2.0f;
    if (cm > 1.0f && cm < 1000.0f) readings[count++] = cm;
    delay(50);
  }
  if (!count) return NAN;
  for (uint8_t i = 0; i < count; i++) for (uint8_t j = i + 1; j < count; j++) if (readings[j] < readings[i]) { const float value = readings[i]; readings[i] = readings[j]; readings[j] = value; }
  return readings[count / 2];
}

const char* localFillStatus(float distanceCm) {
  if (distanceCm <= FULL_DISTANCE_CM) return "FULL";
  if (distanceCm <= NEAR_FULL_DISTANCE_CM) return "NEAR_FULL";
  return "NORMAL";
}

void publishTelemetry() {
  const float distanceCm = medianDistance();
  if (!isfinite(distanceCm)) {
    Serial.println("Ultrasonic measurement failed.");
    return;
  }
  const String timestamp = observedAt();
  if (!timestamp.length()) return;
  const float localPercent = constrain(((BIN_HEIGHT_CM - distanceCm) / (BIN_HEIGHT_CM - FULL_DISTANCE_CM)) * 100.0f, 0.0f, 100.0f);
  Serial.printf("Distance: %.1f cm | Local fill: %.0f%% | %s\n", distanceCm, localPercent, localFillStatus(distanceCm));

  StaticJsonDocument<256> payload;
  payload["messageId"] = nextMessageId();
  payload["distanceCm"] = distanceCm;
  payload["signalStrength"] = WiFi.RSSI();
  payload["observedAt"] = timestamp;
  char buffer[256];
  serializeJson(payload, buffer);
  mqtt.publish(telemetryTopic().c_str(), buffer, false);
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  connectWifi();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  connectMqtt();
}

void loop() {
  connectWifi();
  connectMqtt();
  mqtt.loop();
  if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = millis();
    publishTelemetry();
  }
}
