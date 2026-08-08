<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses the latest Next.js App Router. Read the relevant guide in `apps/dashboard/node_modules/next/dist/docs/` before writing Next.js code and heed deprecation notices.

# API Layer

For our API layer, we use **oRPC**. This rule overrides generic Next.js guidance.

- **Every client-to-server read and mutation MUST go through an oRPC router** defined in `src/routers/`.
- Frontend code MUST use the provided `useQuery` and `useMutation` hooks from `@/lib/orpc/client`.
- Do NOT use Server Actions, ad-hoc fetch calls, route handlers, API routes, or direct Prisma calls from Client Components for application data or mutations.
- Server Components may use the DAL for protected reads needed to render the initial page, but client-triggered mutations still belong in oRPC.
- Add authentication and authorization checks in the oRPC middleware/router as well as in any protected server-rendering boundary; never rely on the UI alone.

# Database and API

We use **Prisma** as our primary ORM and database client. Always use the Prisma client for database operations. Import the singleton client from `@/lib/prisma`; do not instantiate `PrismaClient` directly.

**Never create, edit, delete, or hand-write files under `prisma/migrations/`.** Migration files are generated and managed by the project owner’s Prisma workflow. If the schema requires a migration, update only `prisma/schema.prisma` and report that a migration must be generated separately.

# Authentication

Use **Better Auth** for authentication. Import the server instance from `@/lib/auth` and the browser client from `@/lib/auth-client`.

# Background Tasks

Use Trigger.dev v4 for background jobs and long-running tasks. Define tasks in `src/trigger/`.

# UI and Components

Use shadcn/ui. Shared components live in `src/components/ui/`; add them with `pnpm dlx shadcn@latest add <component>` or follow the existing component patterns.

# Environment

Required configuration is documented in `apps/dashboard/.env.example`. The application uses PostgreSQL and S3-compatible object storage only.
<!-- END:nextjs-agent-rules -->
