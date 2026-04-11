import { ApiProperty } from '@nestjs/swagger';

export class SignalFeedResponseDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty()
  declare sender_callsign: string;

  @ApiProperty()
  declare sender_continent: string;

  @ApiProperty()
  declare sender_direction: number;

  @ApiProperty()
  declare content: string;

  @ApiProperty()
  declare transmitted_at: string;

  @ApiProperty()
  declare is_interrupted: boolean;
}
