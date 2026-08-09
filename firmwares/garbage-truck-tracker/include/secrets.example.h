#pragma once
#define WIFI_SSID "replace-me"
#define WIFI_PASSWORD "replace-me"
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
// EMQX JWT mode: username is this device ID and password is a pre-provisioned
// JWT granting this tracker publish access to ingest topics and subscribe access
// only to its own RFID decision topic. Never use the broker secret.
#define MQTT_USERNAME "TRACKER-TRK-001"
#define MQTT_PASSWORD "replace-with-device-scoped-jwt"
#define DEVICE_ID "TRACKER-TRK-001"
