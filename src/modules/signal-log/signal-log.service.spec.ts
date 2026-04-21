import { Test, TestingModule } from '@nestjs/testing';
import { MessageStatus } from '@prisma/client';
import { SignalLogService } from './signal-log.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockMessage = {
  id: 'msg-1',
  sender_continent: 'na',
  sender_direction: 60,
  content: 'hello',
  target_continents: ['eu'],
  status: MessageStatus.sent,
  transmission_ends_at: new Date('2024-06-01T12:00:00Z'),
  created_at: new Date('2024-06-01T11:59:00Z'),
  sender: { callsign: 'OPERATOR-1234' },
};

const mockLog = {
  id: 'log-1',
  recipient_id: 'user-1',
  sender_continent: 'na',
  sender_direction: 60,
  transmitted_at: new Date('2024-06-01T12:00:00Z'),
  read_at: null,
};

describe('SignalLogService', () => {
  let service: SignalLogService;
  let prisma: {
    message: { findMany: jest.Mock };
    signalLog: { findMany: jest.Mock; updateMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      message: { findMany: jest.fn() },
      signalLog: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SignalLogService);
  });

  describe('getSignalFeed', () => {
    it('maps messages to SignalFeedResponseDto shape', async () => {
      prisma.message.findMany.mockResolvedValue([mockMessage]);
      const result = await service.getSignalFeed('eu');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        sender_callsign: 'OPERATOR-1234',
        sender_continent: 'na',
        sender_direction: 60,
        content: 'hello',
        is_interrupted: false,
      });
    });

    it('returns empty array when no messages', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      expect(await service.getSignalFeed('eu')).toEqual([]);
    });

    it('marks interrupted messages correctly', async () => {
      prisma.message.findMany.mockResolvedValue([
        { ...mockMessage, status: MessageStatus.interrupted },
      ]);
      const [item] = await service.getSignalFeed('eu');
      expect(item.is_interrupted).toBe(true);
    });
  });

  describe('getMissedAndMarkRead', () => {
    it('returns logs and calls updateMany to mark them read', async () => {
      prisma.signalLog.findMany.mockResolvedValue([mockLog]);
      const result = await service.getMissedAndMarkRead('user-1');
      expect(result).toHaveLength(1);
      expect(prisma.signalLog.updateMany).toHaveBeenCalledWith({
        where: { recipient_id: 'user-1', read_at: null },
        data: { read_at: expect.any(Date) },
      });
    });

    it('skips updateMany when no unread logs', async () => {
      prisma.signalLog.findMany.mockResolvedValue([]);
      await service.getMissedAndMarkRead('user-1');
      expect(prisma.signalLog.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('countUnread', () => {
    it('returns the count from prisma', async () => {
      prisma.signalLog.count.mockResolvedValue(5);
      expect(await service.countUnread('user-1')).toBe(5);
      expect(prisma.signalLog.count).toHaveBeenCalledWith({
        where: { recipient_id: 'user-1', read_at: null },
      });
    });
  });
});
