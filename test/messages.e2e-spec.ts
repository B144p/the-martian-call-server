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
  antenna_direction: 60,
  is_transmitting: false,
  created_at: new Date(),
  last_seen_at: new Date(),
};

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
  created_at: new Date(),
  transmission_started_at: new Date(),
  transmission_ends_at: new Date(Date.now() + 2500),
};

describe('Messages endpoints (e2e)', () => {
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
    ctx.prisma.user.findMany.mockResolvedValue([]);
    ctx.prisma.message.findMany.mockResolvedValue([]);
  });

  describe('POST /api/v1/messages', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/messages')
        .send({ content: 'hello' })
        .expect(401);
    });

    it('returns 201 and a transmitting message on success', async () => {
      ctx.prisma.message.create.mockResolvedValue(mockMessage);
      ctx.prisma.$transaction.mockImplementation((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => Promise<unknown>)(ctx.prisma)
          : Promise.all(arg as Promise<unknown>[]),
      );

      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/messages')
        .set('Authorization', authHeader)
        .send({ content: 'hello' })
        .expect(201);

      expect(res.body.data.status).toBe(MessageStatus.transmitting);
      expect(res.body.data.id).toBe('msg-1');
    });

    it('returns 403 when the user is already transmitting', async () => {
      const transmittingUser = { ...mockUser, is_transmitting: true };
      ctx.prisma.user.findUnique.mockResolvedValue(transmittingUser);

      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/messages')
        .set('Authorization', authHeader)
        .send({ content: 'hello' })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when content is empty (class-validator MinLength)', async () => {
      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/messages')
        .set('Authorization', authHeader)
        .send({ content: '' })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when content exceeds 100 characters', async () => {
      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/messages')
        .set('Authorization', authHeader)
        .send({ content: 'x'.repeat(101) })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when body is missing entirely', async () => {
      await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/messages')
        .set('Authorization', authHeader)
        .expect(400);
    });
  });

  describe('PATCH /api/v1/messages/:id/interrupt', () => {
    it('returns 401 without token', async () => {
      await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/messages/msg-1/interrupt')
        .expect(401);
    });

    it('returns 200 with interrupted message on success', async () => {
      const startedAt = new Date(Date.now() - 1000);
      const transmittingMsg = {
        ...mockMessage,
        transmission_started_at: startedAt,
      };
      ctx.prisma.message.findUnique.mockResolvedValue(transmittingMsg);
      const interrupted = {
        ...transmittingMsg,
        status: MessageStatus.interrupted,
        content: 'he',
        chars_sent: 2,
      };
      ctx.prisma.message.update.mockResolvedValue(interrupted);

      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/messages/msg-1/interrupt')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.data.status).toBe(MessageStatus.interrupted);
    });

    it('returns 404 when message does not exist', async () => {
      ctx.prisma.message.findUnique.mockResolvedValue(null);

      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/messages/missing/interrupt')
        .set('Authorization', authHeader)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 when the sender is a different user', async () => {
      ctx.prisma.message.findUnique.mockResolvedValue({
        ...mockMessage,
        sender_id: 'other-user',
      });

      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/messages/msg-1/interrupt')
        .set('Authorization', authHeader)
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when the message is not currently transmitting', async () => {
      ctx.prisma.message.findUnique.mockResolvedValue({
        ...mockMessage,
        status: MessageStatus.sent,
      });

      const res = await request(ctx.app.getHttpServer() as App)
        .patch('/api/v1/messages/msg-1/interrupt')
        .set('Authorization', authHeader)
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });
});
