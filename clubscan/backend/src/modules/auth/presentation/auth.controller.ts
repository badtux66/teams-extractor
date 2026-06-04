import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OAuthProvider } from '@prisma/client';
import { Request } from 'express';
import { Public, CurrentUser } from '@/platform/security/decorators';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  OAuthAppleDto,
  OAuthGoogleDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../application/dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.ctx(req));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.ctx(req));
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(@CurrentUser('id') userId: string) {
    await this.auth.logoutAll(userId);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('oauth/google')
  oauthGoogle(@Body() dto: OAuthGoogleDto, @Req() req: Request) {
    return this.auth.oauthLogin(OAuthProvider.GOOGLE, dto.idToken, dto.username, this.ctx(req));
  }

  @Public()
  @HttpCode(200)
  @Post('oauth/apple')
  oauthApple(@Body() dto: OAuthAppleDto, @Req() req: Request) {
    return this.auth.oauthLogin(
      OAuthProvider.APPLE,
      dto.identityToken,
      dto.username,
      this.ctx(req),
    );
  }
}
