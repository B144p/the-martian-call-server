import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';
import type { AuthResponse } from 'pusher';
import { Env } from '../config/env.validation';

@Injectable()
export class PusherService {
  private readonly pusher: Pusher;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.pusher = new Pusher({
      appId: config.get('PUSHER_APP_ID'),
      key: config.get('PUSHER_KEY'),
      secret: config.get('PUSHER_SECRET'),
      cluster: config.get('PUSHER_CLUSTER'),
      useTLS: true,
    });
  }

  async trigger(channel: string, event: string, data: Record<string, unknown>): Promise<void> {
    await this.pusher.trigger(channel, event, data);
  }

  authenticateChannel(socketId: string, channel: string): AuthResponse {
    return this.pusher.authorizeChannel(socketId, channel);
  }
}
