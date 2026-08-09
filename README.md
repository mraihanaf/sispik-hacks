# SispikHacks

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

## EMQX development

`docker-compose.yaml` runs EMQX 5.8.8 as the local SISPik MQTT broker.

| Use | Endpoint |
| --- | --- |
| Device and backend MQTT | `mqtt://localhost:${EMQX_MQTT_PORT:-1883}` |
| Browser MQTT over WebSocket | `ws://localhost:${EMQX_WS_PORT:-8083}/mqtt` |
| EMQX management dashboard | `http://localhost:${EMQX_DASHBOARD_PORT:-18083}` |

Start and inspect it with:

```sh
docker compose up -d emqx
docker compose ps emqx
docker compose logs -f emqx
```

The dashboard credentials use `EMQX_DASHBOARD_USERNAME` and
`EMQX_DASHBOARD_PASSWORD`; development defaults are `admin` and
`public-development-only`. Put replacements in an untracked root `.env` before
sharing a development environment.

### Authentication strategy

EMQX now requires an HMAC JWT in the MQTT password field and uses the checked-in
ACL file for deny-by-default authorization. These identities and permissions
are enforced:

| Identity | Authentication | Allowed access |
| --- | --- | --- |
| Physical device | Per-device MQTT credential | Publish only to its own `sispik/v1/ingest/...` topics |
| IoT ingestor | Service credential | Subscribe only to `sispik/v1/ingest/#` |
| Dashboard backend | Service credential | Publish only to `sispik/v1/realtime/#` |
| Dashboard user | Short-lived JWT from protected oRPC | Subscribe only to `sispik/v1/realtime/#`; never publish |

Firmware `MQTT_USERNAME` must equal `DEVICE_ID`; `MQTT_PASSWORD` must be a
pre-provisioned JWT with a short, renewable lifetime. It is not the JWT signing
secret. Local services use the same `MQTT_JWT_SECRET` as EMQX only to mint their
own constrained service tokens.

Mint a device credential from the dashboard package and place its output only in
the device's untracked `secrets.h`:

```sh
MQTT_JWT_SECRET='...' pnpm --filter @sispik-hacks/dashboard run mqtt:mint-device-token -- SENSOR-TPS-001 720h
```

Browser MQTT is a read-only realtime projection. All browser queries and
mutations remain on protected oRPC. Production must expose encrypted
`wss://…/mqtt`; no browser code may contain permanent EMQX credentials.

### Smoke test

Use the authenticated application paths for local smoke tests. Anonymous
mosquitto clients are intentionally rejected.

```sh
docker run --rm --network sispik-hacks_default eclipse-mosquitto:2 \
  mosquitto_sub -h emqx -t 'sispik/v1/dev/smoke' -v
```

```sh
docker run --rm --network sispik-hacks_default eclipse-mosquitto:2 \
  mosquitto_pub -h emqx -t 'sispik/v1/dev/smoke' -m connected
```

The subscriber should print `sispik/v1/dev/smoke connected`. This topic is
only an infrastructure smoke test; application topics remain reserved for the
shared contracts introduced in Phase 2.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Generate a library

```sh
npx nx g @nx/js:lib packages/pkg1 --publishable --importPath=@my-org/pkg1
```

## Run tasks

To build the library use:

```sh
npx nx build pkg1
```

To run any task with Nx use:

```sh
npx nx <target> <project-name>
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Keep TypeScript project references up to date

Nx automatically updates TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files to ensure they remain accurate based on your project dependencies (`import` or `require` statements). This sync is automatically done when running tasks such as `build` or `typecheck`, which require updated references to function correctly.

To manually trigger the process to sync the project graph dependencies information to the TypeScript project references, run the following command:

```sh
npx nx sync
```

You can enforce that the TypeScript project references are always in the correct state when running in CI by adding a step to your CI job configuration that runs the following command:

```sh
npx nx sync:check
```

[Learn more about nx sync](https://nx.dev/reference/nx-commands#sync)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
