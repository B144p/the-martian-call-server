import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { Env } from '../../../config/env.validation';

@Injectable()
export class CronAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers['authorization'] ?? '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

    const secret = this.config.get('CRON_SECRET');

    if (token.length !== secret.length) {
      throw new UnauthorizedException();
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(secret),
    );

    if (!isValid) throw new UnauthorizedException();
    return true;
  }
}
