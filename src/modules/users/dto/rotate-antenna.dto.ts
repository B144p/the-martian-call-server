import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';
import { VALID_DIRECTIONS } from '../../../lib/constants';

export class RotateAntennaDto {
  @ApiProperty({ enum: VALID_DIRECTIONS, example: 30 })
  @IsInt()
  @IsIn(VALID_DIRECTIONS)
  declare direction: number;
}
