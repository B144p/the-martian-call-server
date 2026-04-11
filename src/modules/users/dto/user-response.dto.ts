import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty()
  declare callsign: string;

  @ApiProperty()
  declare continent_id: string;

  @ApiProperty()
  declare antenna_direction: number;

  @ApiProperty()
  declare is_transmitting: boolean;

  @ApiProperty()
  declare created_at: Date;

  @ApiProperty()
  declare last_seen_at: Date;

  static from(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.callsign = user.callsign;
    dto.continent_id = user.continent_id;
    dto.antenna_direction = user.antenna_direction;
    dto.is_transmitting = user.is_transmitting;
    dto.created_at = user.created_at;
    dto.last_seen_at = user.last_seen_at;
    return dto;
  }
}
