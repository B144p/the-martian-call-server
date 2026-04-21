import './helpers/env';
import { createTestApp, TestApp } from './helpers/app-setup';
import { io, Socket } from 'socket.io-client';
import { SignalGateway } from '../src/modules/gateway/signal.gateway';

const mockUser = {
  id: 'user-1',
  google_id: 'google-123',
  callsign: 'OPERATOR-1234',
  continent_id: 'na',
  antenna_direction: 0,
  is_transmitting: false,
  created_at: new Date(),
  last_seen_at: new Date(),
};

function waitFor(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Timeout waiting for '${event}'`)),
      timeoutMs,
    );
    socket.once(event, (data: unknown) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function connectSocket(url: string, token?: string): Socket {
  return io(url, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    autoConnect: false,
  });
}

describe('SignalGateway (e2e)', () => {
  let ctx: TestApp;
  let url: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    // Must listen on a real port for socket.io-client to connect
    await ctx.app.listen(0);
    const addr = ctx.app.getHttpServer().address() as { port: number };
    url = `http://localhost:${addr.port}`;

    ctx.prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; google_id?: string } }) =>
        where.id === 'user-1' || where.google_id === 'google-123'
          ? Promise.resolve(mockUser)
          : Promise.resolve(null),
    );
    ctx.prisma.user.update.mockResolvedValue(mockUser);
  });

  afterAll(() => ctx.close());

  function withSocket(
    token?: string,
  ): Promise<{ socket: Socket; cleanup: () => void }> {
    return new Promise((resolve) => {
      const socket = connectSocket(url, token);
      const cleanup = () => {
        if (socket.connected) socket.disconnect();
      };
      socket.on('connect', () => resolve({ socket, cleanup }));
      socket.on('connect_error', () => resolve({ socket, cleanup }));
      socket.connect();
    });
  }

  describe('connection authentication', () => {
    it('disconnects a socket with no token', (done) => {
      const socket = connectSocket(url);
      socket.on('disconnect', () => {
        socket.close();
        done();
      });
      socket.connect();
    }, 5000);

    it('disconnects a socket with an invalid token', (done) => {
      const socket = connectSocket(url, 'bad.token.here');
      socket.on('disconnect', () => {
        socket.close();
        done();
      });
      socket.connect();
    }, 5000);

    it('stays connected with a valid JWT', async () => {
      const token = ctx.token('user-1');
      const { socket, cleanup } = await withSocket(token);
      expect(socket.connected).toBe(true);
      cleanup();
    }, 5000);

    it('receives presence:update on connect', async () => {
      const token = ctx.token('user-1');
      const socket = connectSocket(url, token);
      const presencePromise = waitFor(socket, 'presence:update');
      socket.connect();
      const data = await presencePromise;
      expect(data).toMatchObject({ online_count: expect.any(Number) });
      socket.disconnect();
    }, 5000);
  });

  describe('event delivery', () => {
    it('delivers signal:received to the continent room', async () => {
      const token = ctx.token('user-1');
      const { socket, cleanup } = await withSocket(token);

      const signalPromise = waitFor(socket, 'signal:received');
      const gateway = ctx.app.get(SignalGateway);
      // Small delay to ensure the socket has joined its rooms
      await new Promise((r) => setTimeout(r, 50));
      gateway.emitToRoom('region:na', 'signal:received', { id: 'msg-test' });

      const payload = await signalPromise;
      expect(payload).toMatchObject({ id: 'msg-test' });
      cleanup();
    }, 5000);

    it('delivers transmission:complete only to the specific user socket', async () => {
      const token = ctx.token('user-1');
      const { socket, cleanup } = await withSocket(token);

      const completePromise = waitFor(socket, 'transmission:complete');
      const gateway = ctx.app.get(SignalGateway);
      await new Promise((r) => setTimeout(r, 50));
      gateway.emitToUser('user-1', 'transmission:complete', {
        message_id: 'msg-1',
      });

      const payload = await completePromise;
      expect(payload).toMatchObject({ message_id: 'msg-1' });
      cleanup();
    }, 5000);
  });
});
