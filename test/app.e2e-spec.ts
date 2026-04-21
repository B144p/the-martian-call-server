import './helpers/env';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, TestApp } from './helpers/app-setup';

describe('Global envelope + auth guard (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.close());

  it('returns 401 { data, error, meta } on a protected route without a token', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .get('/api/v1/users/me')
      .expect(401);

    expect(res.body).toMatchObject({
      data: null,
      error: { code: 'UNAUTHORIZED' },
      meta: {},
    });
  });

  it('wraps 2xx responses in { data, error: null, meta }', async () => {
    ctx.prisma.user.count.mockResolvedValue(2);
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const res = await request(ctx.app.getHttpServer() as App)
      .get('/api/v1/stats')
      .expect(200);

    expect(res.body).toMatchObject({
      data: expect.any(Object),
      error: null,
      meta: {},
    });
  });

  it('returns 404 with error envelope for unknown routes', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .get('/api/v1/does-not-exist')
      .expect(404);

    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('data', null);
  });
});
