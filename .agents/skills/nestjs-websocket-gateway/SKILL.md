---
name: nestjs-websocket-gateway
description: NestJS WebSocket gateway - Socket.IO gateways, lifecycle hooks, rooms, namespaces, broadcasting, WsException handling, ValidationPipe on events, Redis adapter scaling
---

# NestJS WebSocket Gateway (Socket.IO)

Build production-grade WebSocket gateways using `@nestjs/websockets` + `@nestjs/platform-socket.io`.
Covers gateway lifecycle, event handling, rooms, namespaces, broadcasting, error handling,
input validation on socket events, and horizontal scaling with Redis adapter.

## When to Use This Skill

- Creating or modifying a `*.gateway.ts` file
- Implementing real-time features: chat, notifications, live updates, presence
- Setting up rooms, namespaces, or broadcasting patterns
- Handling WebSocket authentication flow (gateway-side only)
- Debugging gateway lifecycle, connection, or event issues
- Scaling WebSocket servers horizontally with Redis adapter

## When NOT to Use This Skill

- JWT/Passport strategy implementation → use `nestjs-expert`
- Database queries or Prisma schema → use `prisma-expert`
- HTTP controllers, REST endpoints → use `nestjs-expert`

---

## Core Workflow

1. **Detect** — Read existing `*.gateway.ts` and `*.module.ts` files first
2. **Design** — Identify namespace, events, room strategy
3. **Implement** — Gateway + DTOs + Module registration
4. **Validate** — `npm run build` → `npm run test` → manual WS test

---

## Gateway Structure

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from "@nestjs/websockets";
import { UseGuards, UsePipes, ValidationPipe, Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  namespace: "/chat",
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");
  }

  async handleConnection(client: Socket) {
    try {
      // Delegate auth to your auth service — do NOT implement JWT logic here
      const user = await this.chatService.authenticateSocket(client);
      client.data.user = user;
      client.join(`user:${user.id}`);
      this.logger.log(`Connected: ${client.id} (user: ${user.id})`);
    } catch {
      client.emit("error", { message: "Unauthorized" });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (user) {
      // Delegate cleanup to your service layer
      await this.chatService.handleDisconnect(user.id);
      this.logger.log(`Disconnected: ${client.id} (user: ${user.id})`);
    }
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @SubscribeMessage("sendMessage")
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const message = await this.chatService.saveMessage({
      ...dto,
      senderId: client.data.user.id,
    });
    client.to(dto.roomId).emit("newMessage", message);
    return { event: "messageSent", data: message };
  }
}
```

---

## Lifecycle Hooks

All three hooks should always be implemented on every gateway.

| Hook                       | When                     | Use For                                                      |
| -------------------------- | ------------------------ | ------------------------------------------------------------ |
| `afterInit(server)`        | Socket.IO server created | Logging, registering server reference to shared service      |
| `handleConnection(client)` | Client connects          | Auth check, attach user to `client.data`, join personal room |
| `handleDisconnect(client)` | Client disconnects       | Cleanup rooms, update presence, delegate to service          |

> **Rule**: Authenticate in `handleConnection`. Disconnect immediately on failure.
> Never allow unauthenticated sockets to reach event handlers.

---

## Authentication Boundary

This skill owns the **gateway side** of auth only — how to extract the token from the
socket handshake and where to call your auth service. It does NOT own JWT verification
logic (that belongs to `nestjs-expert`).

```typescript
// Gateway-side: extract token from handshake
async handleConnection(client: Socket) {
  const token =
    client.handshake.auth?.token ??
    client.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    client.disconnect(true);
    return;
  }

  // Delegate verification to your auth service
  const user = await this.authService.verifyToken(token);
  client.data.user = user;
}
```

```typescript
// WS guard — checks client.data.user exists (auth already done in handleConnection)
@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    if (!client.data.user) throw new WsException("Unauthorized");
    return true;
  }
}
```

> **Rule**: Store authenticated user in `client.data.user`. Never trust
> `@MessageBody()` for user identity — always read from `client.data`.

---

## Event Validation

Apply `class-validator` on all `@MessageBody()` — same decorators as HTTP DTOs.

```typescript
// dto/send-message.dto.ts
import { IsString, IsUUID, MaxLength, IsNotEmpty } from "class-validator";

export class SendMessageDto {
  @IsUUID()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
```

Apply per-handler or globally:

```typescript
// Per handler
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@SubscribeMessage('sendMessage')
async handleMessage(@MessageBody() dto: SendMessageDto) { ... }

// Or globally in main.ts (applies to both HTTP and WS)
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

---

## Module Registration

```typescript
@Module({
  imports: [AuthModule], // import your existing auth module
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
```

> **Rule**: Gateways are `providers`, NOT `controllers`. Always register in `providers[]`.

---

## Namespace Strategy

One gateway per namespace. Do not put all events in a single gateway.

| Use Case       | Namespace        | Gateway File              |
| -------------- | ---------------- | ------------------------- |
| Chat           | `/chat`          | `chat.gateway.ts`         |
| Notifications  | `/notifications` | `notification.gateway.ts` |
| Live dashboard | `/dashboard`     | `dashboard.gateway.ts`    |

---

## Room Patterns

### Naming Convention

```typescript
client.join(`user:${userId}`); // personal room
client.join(`room:${roomId}`); // entity room (chat, doc, etc.)
client.join(`role:admin`); // role-based room
```

### Join / Leave

```typescript
@SubscribeMessage('joinRoom')
async handleJoinRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() dto: JoinRoomDto,
) {
  await client.join(`room:${dto.roomId}`);
  client.to(`room:${dto.roomId}`).emit('userJoined', {
    userId: client.data.user.id,
  });
  return { event: 'joinedRoom', data: { roomId: dto.roomId } };
}

@SubscribeMessage('leaveRoom')
async handleLeaveRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() dto: JoinRoomDto,
) {
  await client.leave(`room:${dto.roomId}`);
  client.to(`room:${dto.roomId}`).emit('userLeft', {
    userId: client.data.user.id,
  });
}
```

---

## Broadcasting Patterns

```typescript
// To specific user (all their connected sockets)
this.server.to(`user:${userId}`).emit("notification", data);

// To room — excluding sender
client.to(`room:${roomId}`).emit("newMessage", data);

// To room — including sender
this.server.in(`room:${roomId}`).emit("roomUpdate", data);

// To entire namespace (use sparingly)
this.server.emit("systemAnnouncement", data);
```

> **Rule**: Never broadcast sensitive/personal data to entire namespace.
> Always scope to user or room.

---

## Emitting from Outside the Gateway

Use a shared service so HTTP controllers or background jobs can push events.

```typescript
// websocket.service.ts
@Injectable()
export class WebSocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  emitToRoom(roomId: string, event: string, data: unknown) {
    this.server?.in(`room:${roomId}`).emit(event, data);
  }
}
```

Register the server in `afterInit`:

```typescript
afterInit(server: Server) {
  this.websocketService.setServer(server);
}
```

---

## Error Handling

```typescript
// Always use WsException — never HttpException
throw new WsException("Room not found");

// Global WS exception filter
@Catch(WsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    client.emit("error", {
      message: exception.getError(),
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Acknowledgments

Return from `@SubscribeMessage` handler to send acknowledgment back to the sender:

```typescript
@SubscribeMessage('sendMessage')
async handleMessage(@MessageBody() dto: SendMessageDto) {
  const result = await this.chatService.saveMessage(dto);
  return { event: 'messageSent', data: result };  // ack to sender
}
```

Client-side receives via callback:

```typescript
socket.emit("sendMessage", payload, (response) => {
  console.log(response.data); // acknowledgment
});
```

---

## Heartbeat / Keep-Alive

Socket.IO handles ping/pong automatically. Configure in gateway decorator:

```typescript
@WebSocketGateway({
  namespace: '/chat',
  pingInterval: 25000,   // default: 25s
  pingTimeout: 20000,    // default: 20s
})
```

Do NOT implement manual ping/pong — Socket.IO manages it internally.

---

## Horizontal Scaling with Redis Adapter

Without Redis adapter, `emit` only reaches clients connected to the same process.

```typescript
// main.ts
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

// Apply adapter to the Socket.IO server
const ioServer = app.get(IoAdapter); // or configure via custom adapter
```

> **Rule**: Redis adapter is required in production when running 2+ instances.

---

## Constraints

### MUST DO

- Implement all three lifecycle hooks (`afterInit`, `handleConnection`, `handleDisconnect`)
- Authenticate in `handleConnection` — disconnect on failure
- Store user in `client.data.user` — never trust `@MessageBody()` for identity
- Validate all `@MessageBody()` with `class-validator` DTOs
- Use `WsException` inside gateways — never `HttpException`
- Register gateways in `providers[]` — never `controllers[]`
- Use explicit namespace on every `@WebSocketGateway()`
- One gateway per namespace — separate concerns
- Delegate business logic and DB calls to a Service — keep gateways thin
- Use Redis adapter in multi-instance production deployments

### MUST NOT DO

- Do NOT implement JWT verification inside the gateway — delegate to auth service
- Do NOT call database/ORM directly inside a gateway class
- Do NOT use `HttpException` inside event handlers
- Do NOT broadcast personal data to entire namespace
- Do NOT store unbounded state in gateway memory (user maps, message history)
- Do NOT mix HTTP decorators (`@Get`, `@Post`) in a gateway class
- Do NOT skip `ValidationPipe` on `@MessageBody()`
- Do NOT implement manual ping/pong — Socket.IO handles it

---

## Output Template

When creating a new gateway, provide:

1. **Gateway** (`*.gateway.ts`) — decorator, lifecycle hooks, event handlers
2. **DTOs** (`dto/*.dto.ts`) — `class-validator` decorated event payloads
3. **Module** (`*.module.ts`) — providers registration
4. **WebSocketService** (if emitting from outside the gateway)

---

## Common Pitfalls

| Problem                                 | Cause                                      | Fix                                      |
| --------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Gateway not initialized                 | Registered in `controllers[]`              | Move to `providers[]`                    |
| Events received but guard not triggered | `@UseGuards` missing on handler            | Add `@UseGuards(WsJwtGuard)`             |
| `HttpException` not caught on WS        | Wrong exception type                       | Use `WsException`                        |
| Emit not reaching other pods            | No Redis adapter                           | Install `@socket.io/redis-adapter`       |
| Validation silently ignored             | No `ValidationPipe` applied                | Add `@UsePipes(new ValidationPipe(...))` |
| `client.data.user` is undefined         | Auth failed silently in `handleConnection` | Add try/catch + disconnect on error      |
| Memory leak on disconnect               | `handleDisconnect` not cleaning up         | Always clean up rooms and state          |
| All events in one gateway               | Missing namespace separation               | One gateway per namespace                |
