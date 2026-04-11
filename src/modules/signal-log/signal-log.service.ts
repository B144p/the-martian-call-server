import { Injectable } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalFeedResponseDto } from './dto/signal-feed-response.dto';
import { SignalLogResponseDto } from './dto/signal-log-response.dto';

const FEED_LIMIT = 50;

@Injectable()
export class SignalLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the last N received messages for a continent. */
  async getSignalFeed(continentId: string): Promise<SignalFeedResponseDto[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        target_continents: { has: continentId },
        status: { in: [MessageStatus.sent, MessageStatus.interrupted] },
      },
      include: { sender: { select: { callsign: true } } },
      orderBy: { transmission_ends_at: 'desc' },
      take: FEED_LIMIT,
    });

    return messages.map((m) => ({
      id: m.id,
      sender_callsign: m.sender.callsign,
      sender_continent: m.sender_continent,
      sender_direction: m.sender_direction,
      content: m.content,
      transmitted_at: m.transmission_ends_at?.toISOString() ?? m.created_at.toISOString(),
      is_interrupted: m.status === MessageStatus.interrupted,
    }));
  }

  /** Returns unread missed signals and atomically marks them as read. */
  async getMissedAndMarkRead(userId: string): Promise<SignalLogResponseDto[]> {
    const logs = await this.prisma.signalLog.findMany({
      where: { recipient_id: userId, read_at: null },
      orderBy: { transmitted_at: 'desc' },
    });
    if (logs.length > 0) {
      await this.prisma.signalLog.updateMany({
        where: { recipient_id: userId, read_at: null },
        data: { read_at: new Date() },
      });
    }
    return logs.map(SignalLogResponseDto.from);
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.signalLog.count({
      where: { recipient_id: userId, read_at: null },
    });
  }
}
