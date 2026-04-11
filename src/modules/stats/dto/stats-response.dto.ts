import { ApiProperty } from '@nestjs/swagger';

export class StatsResponseDto {
  @ApiProperty()
  declare online_count: number;

  @ApiProperty()
  declare total_users: number;

  @ApiProperty({ type: [String] })
  declare online_continents: string[];
}
