import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { UsersService } from '../users/users.service';

describe('StatsService', () => {
  let service: StatsService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'countOnline' | 'countTotal' | 'getOnlineContinents'>
  >;

  beforeEach(async () => {
    usersService = {
      countOnline: jest.fn().mockResolvedValue(3),
      countTotal: jest.fn().mockResolvedValue(10),
      getOnlineContinents: jest.fn().mockResolvedValue(['na', 'eu']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(StatsService);
  });

  it('aggregates online count, total users, and online continents in parallel', async () => {
    const result = await service.getStats();
    expect(result).toEqual({
      online_count: 3,
      total_users: 10,
      online_continents: ['na', 'eu'],
    });
    expect(usersService.countOnline).toHaveBeenCalledTimes(1);
    expect(usersService.countTotal).toHaveBeenCalledTimes(1);
    expect(usersService.getOnlineContinents).toHaveBeenCalledTimes(1);
  });
});
