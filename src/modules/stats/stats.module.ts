import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [UsersModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
