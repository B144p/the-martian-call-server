import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CronController } from './cron.controller';
import { CronService } from './cron.service';

@Module({
  imports: [AuthModule],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
