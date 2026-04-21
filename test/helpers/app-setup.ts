import './env'; // must be first — sets process.env before any NestJS module loads

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { createMockPrismaService, MockPrismaService } from './mock-prisma';

export interface TestApp {
  app: INestApplication;
  prisma: MockPrismaService;
  token: (userId: string) => string;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const prisma = createMockPrismaService();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const jwtService = moduleRef.get(JwtService);

  return {
    app,
    prisma,
    token: (userId: string) => jwtService.sign({ sub: userId }),
    close: () => app.close(),
  };
}
