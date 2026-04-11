import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { StatsResponseDto } from './dto/stats-response.dto';

@Injectable()
export class StatsService {
  constructor(private readonly usersService: UsersService) {}

  async getStats(): Promise<StatsResponseDto> {
    const [online_count, total_users, online_continents] = await Promise.all([
      this.usersService.countOnline(),
      this.usersService.countTotal(),
      this.usersService.getOnlineContinents(),
    ]);
    return { online_count, total_users, online_continents };
  }
}
