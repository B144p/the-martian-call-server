import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CronAuthGuard } from '../auth/guards/cron-auth.guard';
import { CronResultDto } from './dto/cron-result.dto';
import { CronService } from './cron.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get('process-transmissions')
  @Public()
  @UseGuards(CronAuthGuard)
  @ApiOperation({ summary: 'Process completed transmissions and deliver signals' })
  @ApiResponse({ status: 200, type: CronResultDto })
  processTransmissions(): Promise<CronResultDto> {
    return this.cronService.processTransmissions();
  }
}
