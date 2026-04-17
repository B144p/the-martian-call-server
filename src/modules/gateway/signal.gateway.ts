import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/dto/jwt-payload.interface';

@WebSocketGateway({ cors: { origin: true } })
export class SignalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() declare server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect();
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      socket.disconnect();
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, continent_id: true },
    });

    if (!user) {
      socket.disconnect();
      return;
    }

    socket.data.userId = user.id;
    await socket.join(`region:${user.continent_id}`);
    await socket.join(`user:${user.id}`);

    void this.broadcastPresence();
  }

  handleDisconnect() {
    void this.broadcastPresence();
  }

  private async broadcastPresence(): Promise<void> {
    const sockets = await this.server.fetchSockets();
    const uniqueUsers = new Set(
      sockets.map((s) => s.data.userId as string).filter(Boolean),
    );
    this.server.emit('presence:update', { online_count: uniqueUsers.size });
  }

  async getOnlineUserIdsInContinent(continentId: string): Promise<Set<string>> {
    const sockets = await this.server
      .in(`region:${continentId}`)
      .fetchSockets();
    return new Set(sockets.map((s) => s.data.userId as string).filter(Boolean));
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    this.server.to(room).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
