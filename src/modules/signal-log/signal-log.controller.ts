import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SignalFeedResponseDto } from './dto/signal-feed-response.dto';
import { SignalLogResponseDto } from './dto/signal-log-response.dto';
import { SignalLogService } from './signal-log.service';

@ApiTags('signals')
@ApiBearerAuth()
@Controller('signals')
export class SignalLogController {
  constructor(private readonly signalLogService: SignalLogService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Get last 50 received signals for the user continent' })
  @ApiResponse({ status: 200, type: [SignalFeedResponseDto] })
  getSignalFeed(@CurrentUser() user: User): Promise<SignalFeedResponseDto[]> {
    return this.signalLogService.getSignalFeed(user.continent_id);
  }

  @Get('missed/count')
  @ApiOperation({ summary: 'Count unread missed signals' })
  @ApiResponse({ status: 200, schema: { properties: { count: { type: 'number' } } } })
  async getMissedCount(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.signalLogService.countUnread(user.id);
    return { count };
  }

  @Get('missed')
  @ApiOperation({ summary: 'Get unread missed signals and mark them as read' })
  @ApiResponse({ status: 200, type: [SignalLogResponseDto] })
  getMissed(@CurrentUser() user: User): Promise<SignalLogResponseDto[]> {
    return this.signalLogService.getMissedAndMarkRead(user.id);
  }
}
