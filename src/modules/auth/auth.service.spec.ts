import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const mockUser = {
  id: 'user-1',
  google_id: 'google-123',
  callsign: 'OPERATOR-1234',
  continent_id: 'na',
  antenna_direction: 0,
  is_transmitting: false,
  created_at: new Date('2024-01-01'),
  last_seen_at: new Date('2024-01-01'),
};

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
        { provide: UsersService, useValue: { findOrCreate: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
  });

  describe('login', () => {
    it('signs a token with the user id as sub', () => {
      const token = service.login(mockUser as never);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: mockUser.id });
      expect(token).toBe('signed-token');
    });
  });

  describe('googleTokenExchange', () => {
    it('returns a JWT when the Google token is valid', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ sub: 'google-123' }),
      } as unknown as Response);
      usersService.findOrCreate.mockResolvedValue(mockUser as never);

      const token = await service.googleTokenExchange('valid-access-token');
      expect(usersService.findOrCreate).toHaveBeenCalledWith('google-123');
      expect(token).toBe('signed-token');
    });

    it('throws UnauthorizedException when Google returns a non-OK response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false } as Response);
      await expect(service.googleTokenExchange('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when profile has no sub', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      } as unknown as Response);
      await expect(service.googleTokenExchange('token-no-sub')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
