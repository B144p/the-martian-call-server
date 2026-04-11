import { ApiProperty } from '@nestjs/swagger';
import { SignalLog } from '@prisma/client';

export class SignalLogResponseDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty()
  declare sender_continent: string;

  @ApiProperty()
  declare sender_direction: number;

  @ApiProperty()
  declare transmitted_at: Date;

  @ApiProperty({ nullable: true, type: Date })
  declare read_at: Date | null;

  static from(log: SignalLog): SignalLogResponseDto {
    const dto = new SignalLogResponseDto();
    dto.id = log.id;
    dto.sender_continent = log.sender_continent;
    dto.sender_direction = log.sender_direction;
    dto.transmitted_at = log.transmitted_at;
    dto.read_at = log.read_at;
    return dto;
  }
}
