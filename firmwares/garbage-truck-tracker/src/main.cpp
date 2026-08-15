/*
  ESP32 + RC522 + GPS NEO-6M + Buzzer
  - Kartu Meta/Azka ditap -> GPS menyala & mulai kirim koordinat, buzzer beep 1x
  - Kartu tak dikenal ditap -> buzzer sirine 10 detik, GPS tidak diaktifkan

  Library dibutuhkan (install via Library Manager):
  - MFRC522 (by GithubCommunity)
  - TinyGPSPlus (by Mikal Hart)

  Wiring RC522:
  SDA -> GPIO 5 | SCK -> GPIO 18 | MOSI -> GPIO 23
  MISO -> GPIO 19 | RST -> GPIO 4 | GND -> GND | 3.3V -> 3V3

  Wiring GPS NEO-6M:
  TX  -> GPIO 16 (RX2 ESP32)
  RX  -> GPIO 17 (TX2 ESP32, opsional)
  GND -> GND
  VCC -> lewat transistor/relay yang dikontrol GPIO 25
         (atau langsung ke 3.3V kalau tidak pakai kontrol power fisik)

  Wiring Buzzer Pasif:
  Signal -> GPIO 15
  GND    -> GND
*/

#include <SPI.h>
#include <MFRC522.h>
#include <TinyGPSPlus.h>
#include <Arduino.h>

#define SS_PIN       5
#define RST_PIN      4
#define BUZZER_PIN   15
#define GPS_POWER_PIN 25
#define GPS_RX_PIN   14   // GPS TX -> sini
#define GPS_TX_PIN   12   // GPS RX -> sini (opsional)

MFRC522 rfid(SS_PIN, RST_PIN);
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

bool gpsAktif = false;

struct User {
  const char* uid;
  const char* nama;
};

User database[] = {
  {"0E:09:21:10:89:18:3B", "Meta"},
  {"0E:57:48:18:78:B8:3B", "Azka"},
};
const int jumlahUser = sizeof(database) / sizeof(database[0]);

String cariNama(String uid) {
  for (int i = 0; i < jumlahUser; i++) {
    if (uid.equalsIgnoreCase(database[i].uid)) {
      return String(database[i].nama);
    }
  }
  return "";
}

void aktifkanGPS() {
  gpsAktif = true;
  digitalWrite(GPS_POWER_PIN, HIGH);  // nyalakan power GPS lewat transistor/relay
  Serial.println(">> GPS dinyalakan, menunggu sinyal satelit...");
}

void bacaGPS() {
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isValid()) {
        Serial.print("Latitude : ");
        Serial.println(gps.location.lat(), 6);
        Serial.print("Longitude: ");
        Serial.println(gps.location.lng(), 6);
        Serial.print("Link Maps: https://www.google.com/maps/place/");
        Serial.print(gps.location.lat(), 6);
        Serial.print(",");
        Serial.println(gps.location.lng(), 6);
        Serial.println("---");
      } else {
        Serial.println("GPS aktif, menunggu fix lokasi (pastikan di luar ruangan)...");
      }
    }
  }
}

void bunyiSekali() {
  tone(BUZZER_PIN, 1500, 300);
  delay(300);
  noTone(BUZZER_PIN);
}

void bunyiSirine() {
  unsigned long mulai = millis();
  int pola[] = {2000, 1200, 2000, 1500, 2200, 1200, 1800, 1500};
  int durasi[] = {80, 80, 60, 100, 70, 90, 60, 110};
  int jumlahNada = sizeof(pola) / sizeof(pola[0]);
  int idx = 0;

  while (millis() - mulai < 5000) {
    tone(BUZZER_PIN, pola[idx], durasi[idx]);
    delay(durasi[idx] + 20);
    idx = (idx + 1) % jumlahNada;
  }
  noTone(BUZZER_PIN);
}

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();

  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, LOW);   // GPS mati di awal

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  Serial.println("Sistem siap. Silakan tap kartu...");
}

void loop() {
  // Cek kartu RFID
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uid += (rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      uid += String(rfid.uid.uidByte[i], HEX);
      if (i != rfid.uid.size - 1) uid += ":";
    }
    uid.toUpperCase();

    String nama = cariNama(uid);

    Serial.println("========================");
    Serial.print("UID   : ");
    Serial.println(uid);

    if (nama != "") {
      Serial.print("Nama  : ");
      Serial.println(nama);
      Serial.println("Status: DIKENAL - GPS diaktifkan");
      bunyiSekali();
      aktifkanGPS();
    } else {
      Serial.println("Status: TIDAK DIKENAL - Peringatan orang asing!");
      bunyiSirine();
    }
    Serial.println("========================");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(500);
  }

  // Kalau GPS aktif, terus baca dan tampilkan koordinat
  if (gpsAktif) {
    bacaGPS();
  }
}

