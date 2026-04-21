import { ApiProperty } from '@nestjs/swagger';
import { Message, MessageStatus } from '@prisma/client';

export class MessageResponseDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty()
  declare content: string;

  @ApiProperty()
  declare hex_sequence: string;

  @ApiProperty()
  declare status: MessageStatus;

  @ApiProperty()
  declare chars_sent: number;

  @ApiProperty({ nullable: true, type: String })
  declare transmission_started_at: string | null;

  @ApiProperty({ nullable: true, type: String })
  declare transmission_ends_at: string | null;

  static from(message: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = message.id;
    dto.content = message.content;
    dto.hex_sequence = message.hex_sequence;
    dto.status = message.status;
    dto.chars_sent = message.chars_sent;
    dto.transmission_started_at =
      message.transmission_started_at?.toISOString() ?? null;
    dto.transmission_ends_at =
      message.transmission_ends_at?.toISOString() ?? null;
    return dto;
  }
}
