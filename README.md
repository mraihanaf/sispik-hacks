# Rotom

Rotom is an IoT-assisted waste-collection operations platform. Capacity sensors and truck trackers send telemetry through MQTT; a dashboard turns that data into actionable site, fleet, route, alert, and anomaly information.

## What is included

| Area | Location | Purpose |
| --- | --- | --- |
| Operations dashboard | `apps/dashboard` | Next.js application for operators and administrators. It owns the operational data model, authentication, routes, alerts, and reports. |
| IoT ingestor | `apps/iot-ingestor` | NestJS service that validates MQTT device messages and forwards them to the dashboard through authenticated oRPC procedures. |
| Simulator | `apps/simulator` | Development application for simulating operational data. |
| Shared contracts | `packages/iot-contracts` | MQTT topic helpers and Zod schemas shared by services. |
| Firmware | `firmwares/` | PlatformIO projects for capacity-sensor and garbage-truck tracker devices. |
| Local infrastructure | `docker-compose.yaml` | PostgreSQL, MinIO (S3-compatible storage), and EMQX MQTT broker. |

See [the technical architecture](docs/TECHNICAL_ARCHITECTURE.md) for system boundaries, message flows, MQTT topics, and authorization details.

## Prerequisites

- Node.js 22 or later
- Corepack (bundled with supported Node.js releases) to provide the repository-pinned pnpm version
- Docker Compose
- PlatformIO, only when building firmware

## Quick start

1. Enable Corepack and install the exact locked dependency graph.

   ```sh
   corepack enable
   pnpm install --frozen-lockfile
   ```

   Install automatically builds the generated entrypoint for the shared `@sispik-hacks/iot-contracts` package. Do not commit its `dist/` directory; rerun its Nx build target after changing its source outside a running dependency-aware build.

2. Configure the applications. Do not commit these files or real secrets.

   ```sh
   cp apps/dashboard/.env.example apps/dashboard/.env
   cp apps/iot-ingestor/.env.example apps/iot-ingestor/.env
   ```

   For local development, set the same values for `MQTT_JWT_SECRET` in both files, and set the dashboard's `IOT_INGESTOR_SERVICE_TOKEN` to the ingestor's `DASHBOARD_SERVICE_TOKEN`.

3. Start local services.

   ```sh
   docker compose up -d
   docker compose ps
   ```

4. Generate the Prisma client and apply the existing development migrations.

   ```sh
   pnpm nx run dashboard:prisma:generate
   pnpm nx run dashboard:prisma:migrate
   ```

5. In separate terminals, start the dashboard and ingestor.

   ```sh
   pnpm nx run dashboard:dev
   pnpm nx run iot-ingestor:start:dev
   ```

   The dashboard runs at <http://localhost:3000>; the ingestor defaults to port `3001`. Use the dashboard setup page to create the initial administrator account.

6. Optionally start the simulator.

   ```sh
   pnpm nx run simulator:dev
   ```

   It runs at <http://localhost:4200>. Enable its API in `apps/dashboard/.env` with `ENABLE_SIMULATOR_DEV_API=true` when needed.

## Local services

| Service | Address | Notes |
| --- | --- | --- |
| Dashboard | <http://localhost:3000> | Operator application |
| IoT ingestor | <http://localhost:3001> | MQTT-to-oRPC ingestion service |
| Simulator | <http://localhost:4200> | Optional development tool |
| PostgreSQL | `localhost:5432` | Default database: `portal` |
| MinIO API / console | <http://localhost:9000> / <http://localhost:9001> | S3-compatible local storage |
| EMQX MQTT / WebSocket | `mqtt://localhost:1883` / `ws://localhost:8083/mqtt` | MQTT broker |
| EMQX dashboard | <http://localhost:18083> | Default development login: `admin` / `public-development-only` |

The EMQX defaults are for local development only. MQTT requires JWT authentication and is deny-by-default; use the application’s authenticated paths rather than anonymous MQTT clients.

## Common commands

Run workspace tasks through Nx:

```sh
# Inspect projects and their available targets
pnpm nx show projects
pnpm nx show project dashboard

# Build applications and shared contracts
pnpm nx run dashboard:build
pnpm nx run iot-ingestor:build
pnpm nx run @sispik-hacks/iot-contracts:build

# Run tests
pnpm nx run @sispik-hacks/iot-contracts:test
pnpm nx run iot-ingestor:test
pnpm nx run dashboard:test:domain
pnpm nx run simulator-e2e:e2e

# Lint a project
pnpm nx run dashboard:lint
```

For all available targets, run `pnpm nx show project <project-name>`.

## MQTT and security model

Devices publish only to their own `sispik/v1/ingest/...` topics. The ingestor validates topic identity and payload schemas before sending data to the dashboard’s internal oRPC API. The dashboard publishes normalized read-only events under `sispik/v1/realtime/...`; browser clients may subscribe but cannot publish.

To mint a local device credential, use a non-production `MQTT_JWT_SECRET` and store the resulting token only in the device’s untracked `secrets.h` file:

```sh
MQTT_JWT_SECRET='your-local-secret' \
  pnpm nx run dashboard:mqtt:mint-device-token -- SENSOR-TPS-001 720h
```

Never place MQTT signing secrets, service tokens, or device credentials in browser code or version control.

## Firmware

The firmware projects live in:

- `firmwares/garbage-capacity-tracker` — ESP8266 and HC-SR04 capacity sensor
- `firmwares/garbage-truck-tracker` — ESP32 GPS and RFID tracker

Copy each project’s `include/secrets.example.h` to `include/secrets.h`, fill in its device-specific credentials, then build or upload with PlatformIO from that project directory.

## Architecture at a glance

```text
Sensors and truck trackers → EMQX MQTT → IoT ingestor → dashboard oRPC → PostgreSQL
                                                     ↘
Dashboard ← authenticated browser oRPC + read-only MQTT/WebSocket realtime events
```
