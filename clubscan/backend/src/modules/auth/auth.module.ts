import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import { MAILER } from './application/ports/mailer.port';
import { OAUTH_VERIFIER } from './application/ports/oauth-verifier.port';
import { LogMailerAdapter } from './infrastructure/log-mailer.adapter';
import { OAuthVerifierAdapter } from './infrastructure/oauth-verifier.adapter';
import { AuthController } from './presentation/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    { provide: MAILER, useClass: LogMailerAdapter },
    { provide: OAUTH_VERIFIER, useClass: OAuthVerifierAdapter },
  ],
  exports: [TokenService],
})
export class AuthModule {}
