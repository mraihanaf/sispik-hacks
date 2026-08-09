#pragma once
#define WIFI_SSID "replace-me"
#define WIFI_PASSWORD "replace-me"
#define MQTT_HOST "192.168.1.10"
#define MQTT_PORT 1883
// EMQX JWT mode: username is this device ID and password is a pre-provisioned
// JWT granting only this device's ingest topics. Never use the broker secret.
#define MQTT_USERNAME "SENSOR-TPS-001"
#define MQTT_PASSWORD "replace-with-device-scoped-jwt"
#define DEVICE_ID "SENSOR-TPS-001"

// Local serial-only diagnostics. Configure the backend device calibration separately.
#define BIN_HEIGHT_CM 30.0f
#define FULL_DISTANCE_CM 8.0f
#define NEAR_FULL_DISTANCE_CM 12.0f
