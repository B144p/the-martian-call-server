import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { StatsResponseDto } from './dto/stats-response.dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get online user count and total users' })
  @ApiResponse({ status: 200, type: StatsResponseDto })
  getStats(): Promise<StatsResponseDto> {
    return this.statsService.getStats();
  }
}
