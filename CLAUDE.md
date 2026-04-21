# Server — NestJS

## Overview
The Martian Call is a real-time signal-transmission game. Players tune a directional antenna across 30° steps, transmit short text messages, and receive signals from players on other continents. This server is a NestJS 11 / TypeScript strict API that handles authentication (Google OAuth + JWT), timed message transmission with `setTimeout`-based delivery, continent-scoped WebSocket broadcasting via Socket.io, and persistence through Prisma 6 on PostgreSQL.

---

## Testing Conventions

- **Unit tests** — Jest 29 + `@nestjs/testing`. Files: `*.spec.ts` co-located in `src/`. Run: `pnpm test`
- **E2E tests** — Jest 29 + Supertest against a full `AppModule`. Files: `*.e2e-spec.ts` in `test/`. Run: `pnpm test:e2e`
- Mock `PrismaService` and `SignalGateway` with `jest.fn()` stubs in unit tests — never instantiate `PrismaClient`.
- Use `jest.useFakeTimers()` in any test that touches `setTimeout`-based transmission logic.
- Each spec file name must mirror its source file (`messages.service.spec.ts` ↔ `messages.service.ts`).

---

## Never Do

**Architecture**
- Never put business logic in a controller — controllers route HTTP only, services own logic
- Never call `PrismaService` in `SignalGateway` except for the user lookup in `handleConnection()`
- Never import a sibling module's service without it being in that module's `exports` array
- Never instantiate `PrismaClient` directly — use the injected `PrismaService`

**Data**
- Never use `prisma.model.delete()` on user-facing data — use soft delete (`deletedAt` field)
- Never edit files inside `prisma/migrations/` manually
- Never skip `npx prisma generate` after a schema change
- Never return a raw Prisma model from a controller — always map to a response DTO

**API contract**
- Never change the `{ data, error, meta }` response envelope shape
- Never expose stack traces or raw error messages in HTTP 500 responses
- Never add a field to a response DTO without updating the matching frontend type in the same session

**Security**
- Never mark a route `@Public()` unless it is intentionally unauthenticated
- Never store plain-text passwords — bcrypt only (saltRounds ≥ 10)
- Never read `process.env` directly — use `ConfigService`
- Never expose Swagger UI when `NODE_ENV === 'production'`
- Never commit `.env` files — `.env.example` only

**Real-time**
- Never use Pusher — all real-time delivery goes through `SignalGateway`
- Never call `socket.join()` from the client — room assignment happens server-side in `handleConnection()`
- Never use `@nestjs/schedule` for transmission timing — use `setTimeout` with a `Map`-stored reference keyed by message ID (allows cancellation on interrupt)

**TypeScript**
- Never use `any` — use `unknown` or a specific type
- Never suppress TS errors with `@ts-ignore` without a comment explaining why
