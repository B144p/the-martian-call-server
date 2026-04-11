import { ApiProperty } from '@nestjs/swagger';

export class CronResultDto {
  @ApiProperty()
  declare processed: number;

  @ApiProperty()
  declare delivered: number;
}
