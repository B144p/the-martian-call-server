import { Injectable } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { RECENTLY_SEEN_WINDOW_MS } from '../../lib/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { PusherService } from '../../pusher/pusher.service';
import { CronResultDto } from './dto/cron-result.dto';

@Injectable()
export class CronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pusherService: PusherService,
  ) {}

  async processTransmissions(): Promise<CronResultDto> {
    const now = new Date();

    const completedMessages = await this.prisma.message.findMany({
      where: {
        status: MessageStatus.transmitting,
        transmission_ends_at: { lte: now },
      },
    });

    let delivered = 0;

    for (const message of completedMessages) {
      const sender = await this.prisma.user.findUnique({
        where: { id: message.sender_id },
        select: { callsign: true },
      });

      const pusherPayload: Record<string, unknown> = {
        id: message.id,
        sender_callsign: sender?.callsign ?? 'UNKNOWN',
        sender_continent: message.sender_continent,
        sender_direction: message.sender_direction,
        content: message.content,
        transmitted_at: now.toISOString(),
        is_interrupted: false,
      };

      // Fire Pusher events outside the transaction
      for (const continentId of message.target_continents) {
        await this.pusherService.trigger(
          `private-region-${continentId}`,
          'signal:received',
          pusherPayload,
        );
        delivered++;
      }

      const onlineThreshold = new Date(now.getTime() - RECENTLY_SEEN_WINDOW_MS);

      await this.prisma.$transaction(async (tx) => {
        // Find offline users in target continents to create signal log entries
        if (message.target_continents.length > 0) {
          const offlineUsers = await tx.user.findMany({
            where: {
              continent_id: { in: message.target_continents },
              last_seen_at: { lt: onlineThreshold },
            },
            select: { id: true },
          });

          if (offlineUsers.length > 0) {
            await tx.signalLog.createMany({
              data: offlineUsers.map((u) => ({
                recipient_id: u.id,
                sender_continent: message.sender_continent,
                sender_direction: message.sender_direction,
                transmitted_at: now,
              })),
            });
          }
        }

        await tx.message.update({
          where: { id: message.id },
          data: { status: MessageStatus.sent },
        });

        await tx.user.update({
          where: { id: message.sender_id },
          data: { is_transmitting: false },
        });
      });
    }

    return { processed: completedMessages.length, delivered };
  }
}
