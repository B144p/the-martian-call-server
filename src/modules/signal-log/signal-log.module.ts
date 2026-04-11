import { Module } from '@nestjs/common';
import { SignalLogController } from './signal-log.controller';
import { SignalLogService } from './signal-log.service';

@Module({
  controllers: [SignalLogController],
  providers: [SignalLogService],
})
export class SignalLogModule {}
