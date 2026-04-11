import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import type { AuthResponse } from 'pusher';
import { PusherService } from '../../pusher/pusher.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './dto/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly pusherService: PusherService,
    private readonly usersService: UsersService,
  ) {}

  login(user: User): string {
    const payload: JwtPayload = { sub: user.id };
    return this.jwtService.sign(payload);
  }

  /**
   * Validates a Google access token by calling Google's userinfo endpoint,
   * upserts the user, and returns a signed backend JWT.
   */
  async googleTokenExchange(accessToken: string): Promise<string> {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Google access token');
    }
    const profile = (await res.json()) as { sub?: string };
    if (!profile.sub) {
      throw new UnauthorizedException('Could not retrieve Google user ID');
    }
    const user = await this.usersService.findOrCreate(profile.sub);
    return this.login(user);
  }

  pusherAuth(user: User, socketId: string, channelName: string): AuthResponse {
    const expectedChannel = `private-region-${user.continent_id}`;
    if (channelName !== expectedChannel) {
      throw new ForbiddenException('Cannot authenticate channel for another continent');
    }
    return this.pusherService.authenticateChannel(socketId, channelName);
  }
}
