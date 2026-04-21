import './helpers/env';
import request from 'supertest';
import { App } from 'supertest/types';
import { MessageStatus } from '@prisma/client';
import { createTestApp, TestApp } from './helpers/app-setup';

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

const mockFeedMessage = {
  id: 'msg-1',
  sender_continent: 'eu',
  sender_direction: 270,
  content: 'hello',
  target_continents: ['na'],
  status: MessageStatus.sent,
  transmission_ends_at: new Date('2024-06-01T12:00:00Z'),
  created_at: new Date('2024-06-01T11:59:00Z'),
  sender: { callsign: 'OPERATOR-5678' },
};

const mockLog = {
  id: 'log-1',
  recipient_id: 'user-1',
  sender_continent: 'eu',
  sender_direction: 270,
  transmitted_at: new Date('2024-06-01T12:00:00Z'),
  read_at: null,
};

describe('Signals endpoints (e2e)', () => {
  let ctx: TestApp;
  let authHeader: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    authHeader = `Bearer ${ctx.token('user-1')}`;
  });

  afterAll(() => ctx.close());

  beforeEach(() => {
    ctx.prisma.user.findUnique.mockResolvedValue(mockUser);
    ctx.prisma.user.update.mockResolvedValue(mockUser);
  });

  describe('GET /api/v1/signals/feed', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/feed')
        .expect(401);
    });

    it('returns 200 with an array of signal feed items', async () => {
      ctx.prisma.message.findMany.mockResolvedValue([mockFeedMessage]);

      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/feed')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toMatchObject({
        id: 'msg-1',
        sender_callsign: 'OPERATOR-5678',
        sender_continent: 'eu',
        is_interrupted: false,
      });
    });

    it('returns 200 with empty array when no signals', async () => {
      ctx.prisma.message.findMany.mockResolvedValue([]);
      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/feed')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/signals/missed/count', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/missed/count')
        .expect(401);
    });

    it('returns 200 with count', async () => {
      ctx.prisma.signalLog.count.mockResolvedValue(3);

      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/missed/count')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.data).toEqual({ count: 3 });
    });
  });

  describe('GET /api/v1/signals/missed', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/missed')
        .expect(401);
    });

    it('returns 200 with missed logs and marks them as read', async () => {
      ctx.prisma.signalLog.findMany.mockResolvedValue([mockLog]);
      ctx.prisma.signalLog.updateMany = jest
        .fn()
        .mockResolvedValue({ count: 1 });

      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/missed')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].id).toBe('log-1');
      expect(ctx.prisma.signalLog.updateMany).toHaveBeenCalled();
    });

    it('returns 200 with empty array when no missed signals', async () => {
      ctx.prisma.signalLog.findMany.mockResolvedValue([]);

      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/signals/missed')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });
  });
});
