import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { SignalGateway } from './signal.gateway';
import { PrismaService } from '../../prisma/prisma.service';

const mockUser = { id: 'user-1', continent_id: 'na' };

function makeSocket(token?: string) {
  return {
    handshake: { auth: { token } },
    data: {} as Record<string, unknown>,
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
  };
}

function makeServer(sockets: { data: { userId?: string } }[] = []) {
  const roomChain = {
    fetchSockets: jest.fn().mockResolvedValue(sockets),
    emit: jest.fn(),
  };
  return {
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    in: jest.fn().mockReturnValue(roomChain),
    fetchSockets: jest.fn().mockResolvedValue(sockets),
  };
}

describe('SignalGateway', () => {
  let gateway: SignalGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = module.get(SignalGateway);
    gateway.server = makeServer() as never;
  });

  describe('handleConnection', () => {
    it('disconnects immediately when no token is provided', async () => {
      const socket = makeSocket(undefined);
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when JWT verification throws', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad token');
      });
      const socket = makeSocket('bad');
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when the user is not found in the database', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(null);
      const socket = makeSocket('valid');
      await gateway.handleConnection(socket as never);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('joins continent and user rooms on successful connection', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const socket = makeSocket('valid');
      await gateway.handleConnection(socket as never);
      expect(socket.join).toHaveBeenCalledWith('region:na');
      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.data.userId).toBe('user-1');
    });

    it('broadcasts presence update after successful connection', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      gateway.server = makeServer([{ data: { userId: 'user-1' } }]) as never;
      const socket = makeSocket('valid');
      await gateway.handleConnection(socket as never);
      await Promise.resolve(); // flush broadcastPresence
      expect(
        (gateway.server as unknown as ReturnType<typeof makeServer>).emit,
      ).toHaveBeenCalledWith('presence:update', { online_count: 1 });
    });
  });

  describe('handleDisconnect', () => {
    it('broadcasts presence:update', async () => {
      const server = makeServer([]);
      gateway.server = server as never;
      gateway.handleDisconnect();
      await Promise.resolve();
      expect(server.emit).toHaveBeenCalledWith('presence:update', {
        online_count: 0,
      });
    });
  });

  describe('getOnlineUserIdsInContinent', () => {
    it('returns a Set of user IDs in the given continent room', async () => {
      const sockets = [
        { data: { userId: 'user-1' } },
        { data: { userId: 'user-2' } },
        { data: {} },
      ];
      gateway.server = makeServer(sockets) as never;
      const result = await gateway.getOnlineUserIdsInContinent('na');
      expect(result).toEqual(new Set(['user-1', 'user-2']));
    });
  });

  describe('emitToRoom', () => {
    it('calls server.to(room).emit(event, data)', () => {
      const toSpy = jest.fn().mockReturnValue({ emit: jest.fn() });
      gateway.server = { to: toSpy } as never;
      gateway.emitToRoom('region:na', 'signal:received', { id: '1' });
      expect(toSpy).toHaveBeenCalledWith('region:na');
    });
  });

  describe('emitToUser', () => {
    it('calls server.to(user:<id>).emit(event, data)', () => {
      const emitSpy = jest.fn();
      const toSpy = jest.fn().mockReturnValue({ emit: emitSpy });
      gateway.server = { to: toSpy } as never;
      gateway.emitToUser('user-1', 'transmission:complete', {
        message_id: 'msg-1',
      });
      expect(toSpy).toHaveBeenCalledWith('user:user-1');
      expect(emitSpy).toHaveBeenCalledWith('transmission:complete', {
        message_id: 'msg-1',
      });
    });
  });
});
