# Server — Nest.js Context

## Stack
- Nest.js
- TypeScript (strict)
- Prisma (ORM)
- PostgreSQL
- Passport.js (authentication strategies)
- JWT (via passport-jwt)
- Swagger / OpenAPI (API documentation)
- Zod (validation)
- Class-validator + Class-transformer (DTO validation)
- PNPM (Package Management)
- @nestjs/websockets + @nestjs/platform-socket.io — WebSocket gateway
- socket.io — WebSocket server (used under the hood by NestJS gateway)

## Prisma Rules
- `prisma/schema.prisma` is the **source of truth** for all DB structure
- Always create migrations via `npx prisma migrate dev` — never edit migration files manually
- Run `npx prisma generate` after every schema change before writing service code
- Use `PrismaService` injected via NestJS DI — never instantiate `PrismaClient` directly
- Use Prisma transactions for operations that write to multiple tables:
  ```ts
  await this.prisma.$transaction([...])
  // or interactive transaction:
  await this.prisma.$transaction(async (tx) => { ... })
  ```
- Use soft delete pattern — add `deletedAt DateTime?` to models, filter in queries
- Never use `prisma.model.delete()` for user-facing data — use soft delete
- Index fields that are frequently queried or used in `where` clauses
- Keep seed data in `prisma/seed.ts` for local dev setup

## Module Rules
- One module per domain/feature — never mix concerns
- Each module owns its own controller, service, and DTOs
- Services contain all business logic — controllers only handle HTTP routing
- Never query Prisma directly in controllers — always go through services
- Always export only what other modules need from a module

## DTO Rules
- Every API request must have a DTO with class-validator decorators
- Every API response must have a DTO — never return raw Prisma model objects
- Name pattern: `CreateUserDto`, `UpdateUserDto`, `UserResponseDto`
- Use `@Exclude()` on sensitive fields (passwords, tokens) in response DTOs
- Use `@ApiProperty()` on every DTO field for Swagger documentation

## Swagger Rules
- Document every controller with `@ApiTags('module-name')`
- Document every endpoint with `@ApiOperation({ summary: '...' })`
- Document every response with `@ApiResponse({ status: 200, type: ResponseDto })`
- Document every request body with `@ApiBody({ type: CreateDto })`
- Mark protected endpoints with `@ApiBearerAuth()`
- Swagger UI available at `/api/docs` in development only
- Keep Swagger descriptions short and accurate — they are the frontend team's reference

## Auth / Passport Rules
- Use Passport strategies for all authentication flows
- Strategies live in `src/modules/auth/strategies/`
- Common strategies:
  - `JwtStrategy` — validates Bearer token, attaches user to request
  - `LocalStrategy` — validates email + password on login
- Use `@UseGuards(AuthGuard('jwt'))` or a named `JwtAuthGuard` wrapper
- Use `@Public()` custom decorator to explicitly mark public endpoints
- Default all routes to protected — public must be opted in, not the other way around
- Never store plain-text passwords — always hash with bcrypt (saltRounds: 10+)
- JWT payload should contain only: `{ sub: userId, email, role }` — nothing sensitive

## API Response Rules
- All responses must follow the contract in root `CLAUDE.md`
- Use a global response interceptor to wrap all responses in `{ data, error, meta }`
- Use a global exception filter to format all errors consistently
- HTTP status codes:
  - 200: success (GET, PATCH)
  - 201: created (POST)
  - 204: no content (DELETE)
  - 400: bad request / validation error
  - 401: unauthenticated
  - 403: unauthorized (authenticated but no permission)
  - 404: not found
  - 500: server error — never expose stack trace or raw error message

## WebSocket Gateway Rules
- All WebSocket logic lives in `src/modules/gateway/` — one `SignalGateway` for this project
- Use `@WebSocketGateway({ cors: { origin: ConfigService value } })` — never hardcode CORS origin
- Authenticate every socket connection in `handleConnection()` by extracting and verifying the JWT from `socket.handshake.auth.token` — disconnect unauthenticated sockets immediately
- On successful connection, call `socket.join(\`region:${user.continent_id}\`)` to assign the user to their continent room
- Expose the Socket.io server via `@WebSocketServer() server: Server` and inject the gateway into services that need to emit events
- Emit to a continent room from a service: `this.gateway.server.to(\`region:${continentId}\`).emit('signal:received', payload)`
- Transmission delivery timing: use `setTimeout(deliver, transmission_ends_at - Date.now())` — store the timeout reference keyed by message ID so it can be cleared on interrupt
- On server startup, query all messages with `status = 'transmitting'` and reschedule their delivery — this recovers in-flight transmissions after a restart
- Never use Pusher — all real-time delivery goes through the WebSocket gateway

## Environment Variables
- Always access env via `ConfigService` — never use `process.env` directly in code
- All required env vars must be validated on app startup via `ConfigModule`

## TypeScript Rules
- No `any` — use `unknown` or proper types
- Strict null checks — handle all nullable cases explicitly
- Use Prisma-generated types (e.g. `Prisma.UserCreateInput`) where appropriate

## Do NOT
- Do not use TypeORM — Prisma only
- Do not put business logic in controllers
- Do not return raw Prisma model objects from endpoints — always map to DTOs
- Do not use `synchronize` or auto-migration on production
- Do not hardcode secrets — always use `ConfigService`
- Do not expose Swagger UI in production — development only
- Do not use `process.env` directly — use `ConfigService`
- Do not edit files inside `prisma/migrations/` manually
- Do not use Pusher — use the WebSocket gateway for all real-time events
- Do not use `@nestjs/schedule` for transmission timing — use `setTimeout` with a stored reference instead (allows precise cancellation on interrupt)
- Do not call `socket.join()` from client-side — always assign rooms in `handleConnection()` on the server