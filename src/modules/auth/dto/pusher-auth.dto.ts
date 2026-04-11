import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PusherAuthDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  declare socket_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  declare channel_name: string;
}
