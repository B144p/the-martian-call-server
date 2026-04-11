import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MessageStatus, User } from '@prisma/client';
import { generateCallsign } from '../../lib/callsign.util';
import { CONTINENT_IDS, RECENTLY_SEEN_WINDOW_MS } from '../../lib/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageResponseDto } from '../messages/dto/message-response.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findOrCreate(googleId: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { google_id: googleId },
    });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { last_seen_at: new Date() },
      });
    }

    const continent_id =
      CONTINENT_IDS[Math.floor(Math.random() * CONTINENT_IDS.length)];

    return this.prisma.user.create({
      data: {
        google_id: googleId,
        callsign: generateCallsign(),
        continent_id,
        antenna_direction: 0,
        is_transmitting: false,
      },
    });
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { last_seen_at: new Date() },
    });
  }

  async getMe(user: User): Promise<{ user: UserResponseDto; activeMessage: MessageResponseDto | null }> {
    let activeMessage: MessageResponseDto | null = null;
    if (user.is_transmitting) {
      const message = await this.prisma.message.findFirst({
        where: { sender_id: user.id, status: MessageStatus.transmitting },
      });
      activeMessage = message ? MessageResponseDto.from(message) : null;
    }
    return { user: UserResponseDto.from(user), activeMessage };
  }

  async rotateAntenna(user: User, direction: number): Promise<UserResponseDto> {
    if (user.is_transmitting) {
      throw new ForbiddenException('Cannot rotate antenna while transmitting');
    }

    const expectedDirection = (user.antenna_direction + 30) % 360;
    if (direction !== expectedDirection) {
      throw new BadRequestException(
        `Direction must advance exactly one step: expected ${expectedDirection}`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { antenna_direction: direction },
    });
    return UserResponseDto.from(updated);
  }

  countOnline(): Promise<number> {
    return this.prisma.user.count({
      where: {
        last_seen_at: { gte: new Date(Date.now() - RECENTLY_SEEN_WINDOW_MS) },
      },
    });
  }

  countTotal(): Promise<number> {
    return this.prisma.user.count();
  }

  async getOnlineContinents(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        last_seen_at: { gte: new Date(Date.now() - RECENTLY_SEEN_WINDOW_MS) },
      },
      select: { continent_id: true },
      distinct: ['continent_id'],
    });
    return rows.map((r) => r.continent_id);
  }
}
