import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LastSeenInterceptor } from './common/interceptors/last-seen.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MessagesModule } from './modules/messages/messages.module';
import { SignalLogModule } from './modules/signal-log/signal-log.module';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    GatewayModule,
    AuthModule,
    UsersModule,
    MessagesModule,
    SignalLogModule,
    StatsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LastSeenInterceptor,
    },
  ],
})
export class AppModule {}
