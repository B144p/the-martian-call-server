import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageStatus, User } from '@prisma/client';
import { getTargetContinents } from '../../lib/direction-map';
import { toHexSequence } from '../../lib/hex.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PusherService } from '../../pusher/pusher.service';
import { MessageResponseDto } from './dto/message-response.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pusherService: PusherService,
  ) {}

  async sendMessage(user: User, content: string): Promise<MessageResponseDto> {
    if (user.is_transmitting) {
      throw new ForbiddenException('Already transmitting');
    }

    const now = new Date();
    const transmissionDurationMs = (content.length / 2.0) * 1000;
    const transmission_ends_at = new Date(now.getTime() + transmissionDurationMs);
    const targetContinents = getTargetContinents(user.continent_id, user.antenna_direction);
    const hexSequence = toHexSequence(content);

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          sender_id: user.id,
          sender_continent: user.continent_id,
          sender_direction: user.antenna_direction,
          target_continents: targetContinents,
          content,
          hex_sequence: hexSequence,
          status: MessageStatus.transmitting,
          transmission_started_at: now,
          transmission_ends_at,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { is_transmitting: true },
      });
      return msg;
    });

    return MessageResponseDto.from(message);
  }

  async interruptMessage(user: User, messageId: string): Promise<MessageResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.sender_id !== user.id) throw new ForbiddenException();
    if (message.status !== MessageStatus.transmitting) {
      throw new BadRequestException('Message is not currently transmitting');
    }

    const now = new Date();
    const elapsedSeconds =
      (now.getTime() - message.transmission_started_at!.getTime()) / 1000;
    const charsSent = Math.floor(elapsedSeconds * 2);
    const truncatedContent =
      message.content.slice(0, charsSent) + ' [Transmission got interrupted!]';

    const [updated] = await this.prisma.$transaction([
      this.prisma.message.update({
        where: { id: messageId },
        data: {
          content: truncatedContent,
          chars_sent: charsSent,
          status: MessageStatus.interrupted,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { is_transmitting: false },
      }),
    ]);

    // Deliver partial message to target continents
    for (const continentId of message.target_continents) {
      await this.pusherService.trigger(
        `private-region-${continentId}`,
        'signal:received',
        {
          id: updated.id,
          sender_callsign: user.callsign,
          sender_continent: updated.sender_continent,
          sender_direction: updated.sender_direction,
          content: updated.content,
          transmitted_at: now.toISOString(),
          is_interrupted: true,
        },
      );
    }

    return MessageResponseDto.from(updated);
  }
}
