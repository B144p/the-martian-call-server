import './helpers/env';
import request from 'supertest';
import { App } from 'supertest/types';
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

describe('Auth endpoints (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.close());

  describe('POST /api/v1/auth/google', () => {
    it('returns 200 with access_token for a valid Google token', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ sub: 'google-123' }),
      } as unknown as Response);
      ctx.prisma.user.findUnique.mockResolvedValue(mockUser);
      ctx.prisma.user.update.mockResolvedValue(mockUser);

      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/auth/google')
        .send({ access_token: 'valid-google-token' })
        .expect(200);

      expect(res.body.data).toHaveProperty('access_token');
      expect(typeof res.body.data.access_token).toBe('string');
    });

    it('returns 401 when the Google token is rejected', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false } as Response);

      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/auth/google')
        .send({ access_token: 'bad-token' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when access_token is missing from the request body', async () => {
      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/auth/google')
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when access_token is not a string', async () => {
      const res = await request(ctx.app.getHttpServer() as App)
        .post('/api/v1/auth/google')
        .send({ access_token: 123 })
        .expect(400);

      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });
});
