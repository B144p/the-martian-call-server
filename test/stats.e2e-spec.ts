import './helpers/env';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, TestApp } from './helpers/app-setup';

describe('GET /api/v1/stats (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.prisma.user.count.mockResolvedValue(5);
    ctx.prisma.user.findMany.mockResolvedValue([
      { continent_id: 'na' },
      { continent_id: 'eu' },
    ]);
  });

  afterAll(() => ctx.close());

  it('returns 200 with correct stats shape — no token required', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .get('/api/v1/stats')
      .expect(200);

    expect(res.body.data).toMatchObject({
      online_count: expect.any(Number),
      total_users: expect.any(Number),
      online_continents: expect.any(Array),
    });
    expect(res.body.error).toBeNull();
  });
});
