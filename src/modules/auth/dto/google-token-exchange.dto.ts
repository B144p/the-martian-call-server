import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleTokenExchangeDto {
  @ApiProperty({ description: 'Google OAuth access token from the client' })
  @IsString()
  @IsNotEmpty()
  declare access_token: string;
}
