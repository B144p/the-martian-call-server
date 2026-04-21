import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { MessageStatus, User } from '@prisma/client';
import { getTargetContinents } from '../../lib/direction-map';
import { toHexSequence } from '../../lib/hex.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalGateway } from '../gateway/signal.gateway';
import { MessageResponseDto } from './dto/message-response.dto';

@Injectable()
export class MessagesService implements OnModuleInit {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: SignalGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const inFlight = await this.prisma.message.findMany({
      where: { status: MessageStatus.transmitting },
    });

    const now = Date.now();
    for (const msg of inFlight) {
      const delay = Math.max(
        0,
        (msg.transmission_ends_at?.getTime() ?? now) - now,
      );
      const timer = setTimeout(() => this.deliverMessage(msg.id), delay);
      this.timers.set(msg.id, timer);
    }
  }

  async sendMessage(user: User, content: string): Promise<MessageResponseDto> {
    if (user.is_transmitting) {
      throw new ForbiddenException('Already transmitting');
    }

    const now = new Date();
    const transmissionDurationMs = (content.length / 2.0) * 1000;
    const transmission_ends_at = new Date(
      now.getTime() + transmissionDurationMs,
    );
    const targetContinents = getTargetContinents(
      user.continent_id,
      user.antenna_direction,
    );
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

    const timer = setTimeout(
      () => this.deliverMessage(message.id),
      transmissionDurationMs,
    );
    this.timers.set(message.id, timer);

    return MessageResponseDto.from(message);
  }

  async interruptMessage(
    user: User,
    messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.sender_id !== user.id) throw new ForbiddenException();
    if (message.status !== MessageStatus.transmitting) {
      throw new BadRequestException('Message is not currently transmitting');
    }

    const timer = this.timers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(messageId);
    }

    const now = new Date();
    const elapsedSeconds =
      (now.getTime() - message.transmission_started_at!.getTime()) / 1000;
    const charsSent = Math.floor(elapsedSeconds * 2);
    const truncatedContent = message.content.slice(0, charsSent);

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

    await this.deliverToRooms(updated, user.callsign, true, now);

    return MessageResponseDto.from(updated);
  }

  private async deliverMessage(messageId: string): Promise<void> {
    this.timers.delete(messageId);

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.status !== MessageStatus.transmitting) return;

    const sender = await this.prisma.user.findUnique({
      where: { id: message.sender_id },
      select: { callsign: true },
    });

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: MessageStatus.sent,
          chars_sent: message.content.length,
        },
      }),
      this.prisma.user.update({
        where: { id: message.sender_id },
        data: { is_transmitting: false },
      }),
    ]);

    await this.deliverToRooms(
      message,
      sender?.callsign ?? 'UNKNOWN',
      false,
      now,
    );

    this.gateway.emitToUser(message.sender_id, 'transmission:complete', {
      message_id: messageId,
    });
  }

  private async deliverToRooms(
    message: {
      id: string;
      sender_continent: string;
      sender_direction: number;
      content: string;
      target_continents: string[];
      sender_id: string;
    },
    callsign: string,
    isInterrupted: boolean,
    now: Date,
  ): Promise<void> {
    for (const continentId of message.target_continents) {
      this.gateway.emitToRoom(`region:${continentId}`, 'signal:received', {
        id: message.id,
        sender_callsign: callsign,
        sender_continent: message.sender_continent,
        sender_direction: message.sender_direction,
        content: message.content,
        transmitted_at: now.toISOString(),
        is_interrupted: isInterrupted,
      });

      const onlineIds =
        await this.gateway.getOnlineUserIdsInContinent(continentId);
      const offlineUsers = await this.prisma.user.findMany({
        where: {
          continent_id: continentId,
          id: { notIn: [...onlineIds] },
        },
        select: { id: true },
      });

      if (offlineUsers.length > 0) {
        await this.prisma.signalLog.createMany({
          data: offlineUsers.map((u) => ({
            recipient_id: u.id,
            sender_continent: message.sender_continent,
            sender_direction: message.sender_direction,
            transmitted_at: now,
          })),
        });
      }
    }
  }
}
