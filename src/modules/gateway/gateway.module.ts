import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Env } from '../../config/env.validation';
import { SignalGateway } from './signal.gateway';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
  ],
  providers: [SignalGateway],
  exports: [SignalGateway],
})
export class GatewayModule {}
