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

describe('Users endpoints (e2e)', () => {
  let ctx: TestApp;
  let authHeader: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    authHeader = `Bearer ${ctx.token('user-1')}`;
  });

  afterAll(() => ctx.close());

  beforeEach(() => {
    // JwtStrategy.validate calls findById → findUnique
    ctx.prisma.user.findUnique.mockResolvedValue(mockUser);
    // LastSeenInterceptor calls user.update after each request
    ctx.prisma.user.update.mockResolvedValue(mockUser);
  });

  describe('GET /api/v1/users/me', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/users/me')
        .expect(401);
    });

    it('returns 200 with user and null activeMessage when idle', async () => {
      ctx.prisma.message.findFirst = jest.fn();

      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/users/me')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.data.user.id).toBe('user-1');
      expect(res.body.data.activeMessage).toBeNull();
    });

    it('returns 200 with activeMessage when transmitting', async () => {
      const transmittingUser = { ...mockUser, is_transmitting: true };
      ctx.prisma.user.findUnique.mockResolvedValue(transmittingUser);
      const activeMsg = {
        id: 'msg-1',
        content: 'hi',
        hex_sequence: '68 69',
        status: MessageStatus.transmitting,
        chars_sent: 0,
        transmission_started_at: new Date(),
        transmission_ends_at: new Date(Date.now() + 10_000),
        sender_id: 'user-1',
      };
      ctx.prisma.message.findFirst = jest.fn().mockResolvedValue(activeMsg);

      const res = await request(ctx.app.getHttpServer() as App)
        .get('/api/v1/users/me')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.data.activeMessage).not.toBeNull();
      expect(res.body.data.activeMessage.id).toBe('msg-1');
    });
  });

  describe('PATCH /api/v1/users/me/antenna', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/users/me/antenna')
        .send({ direction: 30 })
        .expect(401);
    });

    it('returns 200 for a valid CW step (0 → 30)', async () => {
      const updated = { ...mockUser, antenna_direction: 30 };
      ctx.prisma.user.update.mockResolvedValue(updated);

      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/users/me/antenna')
        .set('Authorization', authHeader)
        .send({ direction: 30 })
        .expect(200);

      expect(res.body.data.antenna_direction).toBe(30);
    });

    it('returns 400 for a direction that skips a step', async () => {
      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/users/me/antenna')
        .set('Authorization', authHeader)
        .send({ direction: 60 })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 for a direction not in VALID_DIRECTIONS (class-validator)', async () => {
      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/users/me/antenna')
        .set('Authorization', authHeader)
        .send({ direction: 45 })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 403 when the user is transmitting', async () => {
      const transmittingUser = { ...mockUser, is_transmitting: true };
      ctx.prisma.user.findUnique.mockResolvedValue(transmittingUser);

      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/users/me/antenna')
        .set('Authorization', authHeader)
        .send({ direction: 30 })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
