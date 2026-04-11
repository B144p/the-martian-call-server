import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { Env } from '../../config/env.validation';
import { AuthService } from './auth.service';
import { GoogleTokenExchangeDto } from './dto/google-token-exchange.dto';
import { PusherAuthDto } from './dto/pusher-auth.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('google')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange Google access token for backend JWT' })
  @ApiBody({ type: GoogleTokenExchangeDto })
  @ApiResponse({ status: 200, schema: { properties: { access_token: { type: 'string' } } } })
  async googleTokenExchange(
    @Body() dto: GoogleTokenExchangeDto,
  ): Promise<{ access_token: string }> {
    const access_token = await this.authService.googleTokenExchange(dto.access_token);
    return { access_token };
  }

  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login (redirect flow)' })
  googleLogin(): void {
    // Passport redirects to Google — no body needed
  }

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(
    @Req() req: Request & { user: User },
    @Res() res: Response,
  ): void {
    const token = this.authService.login(req.user);
    const frontendUrl = this.config.get('FRONTEND_URL');
    res.redirect(`${frontendUrl}?token=${token}`);
  }

  @Post('pusher')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Authenticate Pusher private channel' })
  @ApiBody({ type: PusherAuthDto })
  @ApiResponse({ status: 200 })
  pusherAuth(
    @Req() req: Request & { user: User },
    @Body() dto: PusherAuthDto,
    @Res() res: Response,
  ): void {
    const result = this.authService.pusherAuth(req.user, dto.socket_id, dto.channel_name);
    res.json(result);
  }
}
