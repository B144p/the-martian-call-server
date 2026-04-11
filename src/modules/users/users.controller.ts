import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RotateAntennaDto } from './dto/rotate-antenna.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user and active transmission' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.getMe(user);
  }

  @Patch('me/antenna')
  @ApiOperation({ summary: 'Rotate antenna one step (30°)' })
  @ApiBody({ type: RotateAntennaDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  rotateAntenna(
    @CurrentUser() user: User,
    @Body() dto: RotateAntennaDto,
  ): Promise<UserResponseDto> {
    return this.usersService.rotateAntenna(user, dto.direction);
  }
}
