import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

const baseUser = {
  id: 'user-1',
  google_id: 'google-123',
  callsign: 'OPERATOR-1234',
  continent_id: 'na',
  antenna_direction: 0,
  is_transmitting: false,
  created_at: new Date('2024-01-01'),
  last_seen_at: new Date('2024-01-01'),
};

const transmittingUser = { ...baseUser, is_transmitting: true };

const inFlightMessage = {
  id: 'msg-1',
  sender_id: 'user-1',
  content: 'hello',
  status: MessageStatus.transmitting,
  transmission_started_at: new Date(Date.now() - 1000),
  transmission_ends_at: new Date(Date.now() - 1), // already past
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    message: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      message: { findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((arg: unknown) =>
          typeof arg === 'function'
            ? arg(prisma)
            : Promise.all(arg as Promise<unknown>[]),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findOrCreate', () => {
    it('updates last_seen_at and returns existing user', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        last_seen_at: new Date(),
      });
      const result = await service.findOrCreate('google-123');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { google_id: 'google-123' },
      });
      expect(prisma.user.update).toHaveBeenCalled();
      expect(result.google_id).toBe('google-123');
    });

    it('creates a new user when none exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(baseUser);
      const result = await service.findOrCreate('new-google-id');
      expect(prisma.user.create).toHaveBeenCalled();
      const createCall = prisma.user.create.mock.calls[0][0] as {
        data: typeof baseUser;
      };
      expect(createCall.data).toMatchObject({
        google_id: 'new-google-id',
        antenna_direction: 0,
        is_transmitting: false,
      });
      expect(result).toEqual(baseUser);
    });

    it('assigns a valid CONTINENT_ID when creating', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        ({ data }: { data: typeof baseUser }) =>
          Promise.resolve({ ...baseUser, continent_id: data.continent_id }),
      );
      const result = await service.findOrCreate('new-id');
      const valid = ['na', 'sa', 'eu', 'af', 'as', 'oc'];
      expect(valid).toContain(result.continent_id);
    });
  });

  describe('getMe', () => {
    it('returns user and null activeMessage when not transmitting', async () => {
      const result = await service.getMe(baseUser as never);
      expect(result.activeMessage).toBeNull();
      expect(result.user.id).toBe('user-1');
    });

    it('returns active message when transmitting and ends_at is in the future', async () => {
      const futureMsg = {
        ...inFlightMessage,
        transmission_ends_at: new Date(Date.now() + 10_000),
      };
      prisma.message.findFirst.mockResolvedValue(futureMsg);
      const result = await service.getMe(transmittingUser as never);
      expect(result.activeMessage).not.toBeNull();
      expect(result.activeMessage!.id).toBe('msg-1');
    });

    it('heals stuck transmission — message past ends_at clears is_transmitting', async () => {
      prisma.message.findFirst.mockResolvedValue(inFlightMessage);
      const healed = { ...transmittingUser, is_transmitting: false };
      prisma.user.update.mockResolvedValue(healed);
      prisma.message.update = jest.fn().mockResolvedValue(inFlightMessage);
      const result = await service.getMe(transmittingUser as never);
      expect(result.user.is_transmitting).toBe(false);
      expect(result.activeMessage).toBeNull();
    });

    it('heals orphaned is_transmitting flag when no message found', async () => {
      prisma.message.findFirst.mockResolvedValue(null);
      const healed = { ...transmittingUser, is_transmitting: false };
      prisma.user.update.mockResolvedValue(healed);
      const result = await service.getMe(transmittingUser as never);
      expect(result.user.is_transmitting).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { is_transmitting: false },
      });
    });
  });

  describe('rotateAntenna', () => {
    it('accepts the next CW step (0 → 30)', async () => {
      const updated = { ...baseUser, antenna_direction: 30 };
      prisma.user.update.mockResolvedValue(updated);
      const result = await service.rotateAntenna(baseUser as never, 30);
      expect(result.antenna_direction).toBe(30);
    });

    it('accepts the CCW step (0 → 330)', async () => {
      const updated = { ...baseUser, antenna_direction: 330 };
      prisma.user.update.mockResolvedValue(updated);
      const result = await service.rotateAntenna(baseUser as never, 330);
      expect(result.antenna_direction).toBe(330);
    });

    it('wraps correctly — 330 CW → 0', async () => {
      const user = { ...baseUser, antenna_direction: 330 };
      prisma.user.update.mockResolvedValue({ ...user, antenna_direction: 0 });
      await service.rotateAntenna(user as never, 0);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('throws ForbiddenException when user is transmitting', async () => {
      await expect(
        service.rotateAntenna(transmittingUser as never, 30),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for a direction that skips a step', async () => {
      await expect(
        service.rotateAntenna(baseUser as never, 60),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a completely invalid direction', async () => {
      await expect(
        service.rotateAntenna(baseUser as never, 45),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('countOnline / countTotal / getOnlineContinents', () => {
    it('countOnline delegates to prisma with recent window', async () => {
      prisma.user.count.mockResolvedValue(4);
      const result = await service.countOnline();
      expect(result).toBe(4);
      const call = prisma.user.count.mock.calls[0][0] as {
        where: { last_seen_at: { gte: Date } };
      };
      expect(call.where.last_seen_at.gte).toBeInstanceOf(Date);
    });

    it('countTotal counts all users', async () => {
      prisma.user.count.mockResolvedValue(100);
      expect(await service.countTotal()).toBe(100);
    });

    it('getOnlineContinents returns distinct continent IDs', async () => {
      prisma.user.findMany.mockResolvedValue([
        { continent_id: 'na' },
        { continent_id: 'eu' },
      ]);
      const result = await service.getOnlineContinents();
      expect(result).toEqual(['na', 'eu']);
    });
  });
});
