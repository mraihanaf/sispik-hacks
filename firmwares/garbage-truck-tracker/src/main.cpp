#include <Arduino.h>
#include <ArduinoJson.h>
#include <MFRC522.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <time.h>

#if __has_include("secrets.h")
#include "secrets.h" // Local credentials; never commit this file.
#else
#include "secrets.example.h" // Allows credential-free CI compilation.
#endif

// Reference wiring: RC522 SDA=5, RST=4; NEO-6M TX=14, RX=12; buzzer=15; GPS power=25.
constexpr uint8_t GPS_RX_PIN = 14;
constexpr uint8_t GPS_TX_PIN = 12;
constexpr uint8_t RFID_SS_PIN = 5;
constexpr uint8_t RFID_RST_PIN = 4;
constexpr uint8_t BUZZER_PIN = 15;
constexpr uint8_t BUZZER_LEDC_CHANNEL = 0;
constexpr uint8_t GPS_POWER_PIN = 25;
constexpr unsigned long LOCATION_INTERVAL_MS = 3000;
constexpr unsigned long RFID_DECISION_TIMEOUT_MS = 8000;
constexpr unsigned long SIREN_DURATION_MS = 10000;

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastLocation = 0;
String pendingScanId;
unsigned long pendingScanStartedAt = 0;
bool sirenActive = false;
unsigned long sirenStartedAt = 0;
unsigned long nextSirenToneAt = 0;
uint8_t sirenToneIndex = 0;

const uint16_t SIREN_TONES[] = {2000, 1200, 2000, 1500, 2200, 1200, 1800, 1500};
const uint16_t SIREN_DURATIONS[] = {80, 80, 60, 100, 70, 90, 60, 110};
constexpr size_t SIREN_TONE_COUNT = sizeof(SIREN_TONES) / sizeof(SIREN_TONES[0]);

String statusTopic() { return String("sispik/v1/ingest/devices/") + DEVICE_ID + "/status"; }
String locationTopic() { return String("sispik/v1/ingest/vehicles/") + DEVICE_ID + "/telemetry"; }
String rfidTopic() { return String("sispik/v1/ingest/vehicles/") + DEVICE_ID + "/rfid"; }
String rfidDecisionTopic() { return String("sispik/v1/commands/vehicles/") + DEVICE_ID + "/rfid-decision"; }

String observedAt() {
  const time_t now = time(nullptr);
  if (now < 1700000000) return String();
  struct tm utc;
  gmtime_r(&now, &utc);
  char value[32];
  strftime(value, sizeof(value), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(value);
}

String nextMessageId() { return String((uint32_t)ESP.getEfuseMac(), HEX) + "-" + String(millis()); }

const char* wifiStatusName(wl_status_t status) {
  switch (status) {
    case WL_NO_SSID_AVAIL: return "SSID not found";
    case WL_CONNECT_FAILED: return "authentication failed";
    case WL_CONNECTION_LOST: return "connection lost";
    case WL_DISCONNECTED: return "disconnected";
    case WL_IDLE_STATUS: return "idle";
    default: return "connecting";
  }
}

bool connectWifi() {
  static bool attempted = false;
  static unsigned long lastAttemptAt = 0;

  if (WiFi.status() == WL_CONNECTED) return true;
  if (attempted && millis() - lastAttemptAt < 10000) return false;

  attempted = true;
  lastAttemptAt = millis();
  Serial.printf("Wi-Fi: connecting to %s (ESP32 supports 2.4 GHz only)\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long deadline = millis() + 20000;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(1000);
    Serial.printf("Wi-Fi: %s\n", wifiStatusName(WiFi.status()));
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi: connected, IP %s, RSSI %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
  }

  Serial.printf("Wi-Fi: failed after 20 seconds (%s); retrying in 10 seconds.\n", wifiStatusName(WiFi.status()));
  WiFi.disconnect();
  return false;
}

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
    Serial.printf("MQTT: connecting to %s:%d as %s\n", MQTT_HOST, MQTT_PORT, MQTT_USERNAME);
    if (mqtt.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD, statusTopic().c_str(), 1, true, lwt)) {
      mqtt.subscribe(rfidDecisionTopic().c_str(), 1);
      publishStatus("online", true);
      Serial.println("MQTT: connected; tracker is online.");
    } else {
      Serial.printf("MQTT: connection failed (state %d); retrying.\n", mqtt.state());
      delay(1000);
    }
  }
}

void startSiren() {
  sirenActive = true;
  sirenStartedAt = millis();
  nextSirenToneAt = 0;
  sirenToneIndex = 0;
}

void updateBuzzer() {
  const unsigned long now = millis();
  if (!sirenActive) return;
  if (now - sirenStartedAt >= SIREN_DURATION_MS) {
    sirenActive = false;
    noTone(BUZZER_PIN);
    return;
  }
  if (now >= nextSirenToneAt) {
    tone(BUZZER_PIN, SIREN_TONES[sirenToneIndex], SIREN_DURATIONS[sirenToneIndex]);
    nextSirenToneAt = now + SIREN_DURATIONS[sirenToneIndex] + 20;
    sirenToneIndex = (sirenToneIndex + 1) % SIREN_TONE_COUNT;
  }
}

void confirmationBeep() {
  if (!sirenActive) tone(BUZZER_PIN, 1500, 300);
}

bool isAcceptedOutcome(const String& outcome) {
  return outcome == "ROUTE_STARTED" || outcome == "ROUTE_COMPLETED";
}

void handleRfidDecision(char* rawTopic, byte* rawPayload, unsigned int length) {
  if (String(rawTopic) != rfidDecisionTopic()) return;
  StaticJsonDocument<320> payload;
  if (deserializeJson(payload, rawPayload, length)) return;
  const char* messageId = payload["messageId"] | "";
  const char* outcomeValue = payload["outcome"] | "";
  const bool accepted = payload["accepted"] | false;
  const uint64_t expiresAtEpochMs = payload["expiresAtEpochMs"] | 0ULL;
  if (!pendingScanId.length() || pendingScanId != messageId) return;
  const String outcome(outcomeValue);
  if (!outcome.length() || accepted != isAcceptedOutcome(outcome)) return;
  const time_t now = time(nullptr);
  if (expiresAtEpochMs == 0 || (now >= 1700000000 && expiresAtEpochMs < static_cast<uint64_t>(now) * 1000ULL)) return;

  pendingScanId = "";
  if (accepted) {
    Serial.printf("e-KTP accepted: %s\n", outcome.c_str());
    confirmationBeep();
  } else {
    Serial.printf("e-KTP rejected: %s\n", outcome.c_str());
    startSiren();
  }
}

void publishLocation() {
  if (!gps.location.isValid()) return;
  const String timestamp = observedAt();
  if (!timestamp.length()) return;
  StaticJsonDocument<256> payload;
  payload["messageId"] = nextMessageId();
  payload["latitude"] = gps.location.lat();
  payload["longitude"] = gps.location.lng();
  payload["speedKph"] = gps.speed.kmph();
  payload["heading"] = gps.course.deg();
  payload["observedAt"] = timestamp;
  char buffer[256];
  serializeJson(payload, buffer);
  mqtt.publish(locationTopic().c_str(), buffer, false);
}

String normalizedRfidUid() {
  String uid;
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += '0';
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void publishRfidScan() {
  if (pendingScanId.length() || !rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  const String timestamp = observedAt();
  if (!timestamp.length()) return;
  const String scanId = nextMessageId();
  StaticJsonDocument<192> payload;
  payload["messageId"] = scanId;
  payload["rfidUid"] = normalizedRfidUid();
  payload["observedAt"] = timestamp;
  char buffer[192];
  serializeJson(payload, buffer);
  if (mqtt.publish(rfidTopic().c_str(), buffer, false)) {
    pendingScanId = scanId;
    pendingScanStartedAt = millis();
    Serial.printf("e-KTP scan sent: %s\n", scanId.c_str());
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void updatePendingScan() {
  if (pendingScanId.length() && millis() - pendingScanStartedAt >= RFID_DECISION_TIMEOUT_MS) {
    Serial.println("e-KTP decision timed out; no buzzer action taken.");
    pendingScanId = "";
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  // Arduino's tone/noTone implementation uses LEDC channel 0, but noTone()
  // is called at startup before tone() gets a chance to configure it.
  ledcSetup(BUZZER_LEDC_CHANNEL, 2000, 8);
  setToneChannel(BUZZER_LEDC_CHANNEL);
  noTone(BUZZER_PIN);
  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, HIGH); // GPS remains powered continuously.

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  SPI.begin();
  rfid.PCD_Init();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleRfidDecision);
  WiFi.mode(WIFI_STA);
  if (connectWifi()) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    connectMqtt();
  }
  Serial.println("Truck tracker ready: GPS always on, e-KTP is validated by the backend.");
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
  if (!connectWifi()) {
    updateBuzzer();
    return;
  }
  connectMqtt();
  mqtt.loop();
  updateBuzzer();
  updatePendingScan();
  publishRfidScan();
  if (millis() - lastLocation >= LOCATION_INTERVAL_MS) {
    lastLocation = millis();
    publishLocation();
  }
}
