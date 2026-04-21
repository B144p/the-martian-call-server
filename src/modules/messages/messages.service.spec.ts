import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { MessagesService } from './messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalGateway } from '../gateway/signal.gateway';

const baseUser = {
  id: 'user-1',
  callsign: 'OPERATOR-1234',
  continent_id: 'na',
  antenna_direction: 60,
  is_transmitting: false,
};

const transmittingUser = { ...baseUser, is_transmitting: true };

const now = new Date('2024-06-01T12:00:00Z');

const mockMessage = {
  id: 'msg-1',
  sender_id: 'user-1',
  sender_continent: 'na',
  sender_direction: 60,
  target_continents: ['eu'],
  content: 'hello',
  hex_sequence: '68 65 6c 6c 6f',
  status: MessageStatus.transmitting,
  chars_sent: 0,
  created_at: now,
  transmission_started_at: now,
  transmission_ends_at: new Date(now.getTime() + 2500),
};

/** Dual-form $transaction: handles both callback and array signatures. */
function makeTxMock(prisma: object) {
  return jest
    .fn()
    .mockImplementation(
      (arg: unknown[] | ((tx: unknown) => Promise<unknown>)) =>
        typeof arg === 'function'
          ? arg(prisma)
          : Promise.all(
              (arg as Promise<unknown>[]).map((p) => Promise.resolve(p)),
            ),
    );
}

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: {
    message: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    signalLog: { createMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let gateway: jest.Mocked<
    Pick<
      SignalGateway,
      'emitToRoom' | 'emitToUser' | 'getOnlineUserIdsInContinent'
    >
  >;

  beforeEach(async () => {
    jest.useFakeTimers();

    prisma = {
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockMessage),
        update: jest.fn().mockResolvedValue(mockMessage),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ callsign: 'OPERATOR-1234' }),
        update: jest.fn().mockResolvedValue(baseUser),
        findMany: jest.fn().mockResolvedValue([]),
      },
      signalLog: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: makeTxMock({}),
    };
    // Give $transaction access to prisma itself for callback form
    prisma.$transaction = makeTxMock(prisma);

    gateway = {
      emitToRoom: jest.fn(),
      emitToUser: jest.fn(),
      getOnlineUserIdsInContinent: jest.fn().mockResolvedValue(new Set()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SignalGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(MessagesService);
    // onModuleInit: findMany returns [] by default, no timers scheduled
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('reschedules timers for in-flight messages', async () => {
      const futureMsg = {
        ...mockMessage,
        transmission_ends_at: new Date(Date.now() + 5000),
      };
      prisma.message.findMany.mockResolvedValue([futureMsg]);
      prisma.message.findUnique.mockResolvedValue(futureMsg);
      prisma.message.update.mockResolvedValue({
        ...futureMsg,
        status: MessageStatus.sent,
      });

      const freshModule = await Test.createTestingModule({
        providers: [
          MessagesService,
          { provide: PrismaService, useValue: prisma },
          { provide: SignalGateway, useValue: gateway },
        ],
      }).compile();
      const freshService = freshModule.get(MessagesService);
      await freshService.onModuleInit();

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { status: MessageStatus.transmitting },
      });

      await jest.advanceTimersByTimeAsync(6000);

      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'transmission:complete',
        {
          message_id: 'msg-1',
        },
      );
    });
  });

  describe('sendMessage', () => {
    it('throws ForbiddenException when user is already transmitting', async () => {
      await expect(
        service.sendMessage(transmittingUser as never, 'hello'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a message and returns it in transmitting status', async () => {
      const result = await service.sendMessage(baseUser as never, 'hello');
      expect(result.id).toBe('msg-1');
      expect(result.status).toBe(MessageStatus.transmitting);
    });

    it('sets transmission_ends_at based on content.length / 2 * 1000 ms', async () => {
      prisma.message.create.mockImplementation(
        ({ data }: { data: typeof mockMessage }) =>
          Promise.resolve({ ...mockMessage, ...data }),
      );
      await service.sendMessage(baseUser as never, 'abcde'); // 5 chars → 2500 ms
      const { data } = prisma.message.create.mock.calls[0][0] as {
        data: { transmission_ends_at: Date; transmission_started_at: Date };
      };
      const duration =
        data.transmission_ends_at.getTime() -
        data.transmission_started_at.getTime();
      expect(duration).toBe(2500);
    });

    it('fires deliverMessage after the transmission duration elapses', async () => {
      prisma.message.findUnique.mockResolvedValue(mockMessage);

      await service.sendMessage(baseUser as never, 'hello'); // 2500 ms

      await jest.advanceTimersByTimeAsync(3000);

      expect(gateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'transmission:complete',
        {
          message_id: 'msg-1',
        },
      );
    });
  });

  describe('interruptMessage', () => {
    it('throws NotFoundException when message does not exist', async () => {
      prisma.message.findUnique.mockResolvedValue(null);
      await expect(
        service.interruptMessage(baseUser as never, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when sender is a different user', async () => {
      prisma.message.findUnique.mockResolvedValue({
        ...mockMessage,
        sender_id: 'other',
      });
      await expect(
        service.interruptMessage(baseUser as never, 'msg-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when message is not transmitting', async () => {
      prisma.message.findUnique.mockResolvedValue({
        ...mockMessage,
        status: MessageStatus.sent,
      });
      await expect(
        service.interruptMessage(baseUser as never, 'msg-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('truncates content to chars sent and updates status to interrupted', async () => {
      const startedAt = new Date(Date.now() - 2000); // 2 s → 4 chars
      const msg = { ...mockMessage, transmission_started_at: startedAt };
      prisma.message.findUnique.mockResolvedValue(msg);
      const interrupted = {
        ...msg,
        status: MessageStatus.interrupted,
        content: 'hell',
        chars_sent: 4,
      };
      prisma.message.update.mockResolvedValue(interrupted);

      const result = await service.interruptMessage(baseUser as never, 'msg-1');
      expect(result.status).toBe(MessageStatus.interrupted);

      const { data } = prisma.message.update.mock.calls[0][0] as {
        data: { content: string; chars_sent: number; status: MessageStatus };
      };
      expect(data.content).toBe('hell');
      expect(data.chars_sent).toBe(4);
    });

    it('emits signal:received with is_interrupted: true', async () => {
      const startedAt = new Date(Date.now() - 1000);
      const msg = { ...mockMessage, transmission_started_at: startedAt };
      prisma.message.findUnique.mockResolvedValue(msg);
      prisma.message.update.mockResolvedValue({
        ...msg,
        status: MessageStatus.interrupted,
      });

      await service.interruptMessage(baseUser as never, 'msg-1');
      expect(gateway.emitToRoom).toHaveBeenCalledWith(
        'region:eu',
        'signal:received',
        expect.objectContaining({ is_interrupted: true }),
      );
    });

    it('clears the pending delivery timer so deliverMessage does not fire', async () => {
      // Schedule a timer via sendMessage first
      await service.sendMessage(baseUser as never, 'hello'); // 2500 ms

      // Interrupt before the timer fires
      const startedAt = new Date(Date.now() - 500);
      prisma.message.findUnique.mockResolvedValue({
        ...mockMessage,
        transmission_started_at: startedAt,
      });
      prisma.message.update.mockResolvedValue({
        ...mockMessage,
        status: MessageStatus.interrupted,
      });

      await service.interruptMessage(baseUser as never, 'msg-1');

      // Advance past the original timeout — timer must have been cleared
      await jest.advanceTimersByTimeAsync(5000);

      const completeCalls = (gateway.emitToUser as jest.Mock).mock.calls.filter(
        (c: unknown[]) => c[1] === 'transmission:complete',
      );
      expect(completeCalls).toHaveLength(0);
    });
  });
});
