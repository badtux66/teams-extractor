import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { validateEnv } from '@/platform/config/configuration';
import { PrismaModule } from '@/platform/prisma/prisma.module';
import { AppConfigModule } from '@/platform/config/app-config.module';
import { EventBusModule } from '@/platform/event-bus/event-bus.module';
import { AuditModule } from '@/platform/audit/audit.module';
import { SecurityModule } from '@/platform/security/security.module';
import { JwtAuthGuard } from '@/platform/security/jwt-auth.guard';
import { RolesGuard } from '@/platform/security/roles.guard';
import { AllExceptionsFilter } from '@/platform/http/all-exceptions.filter';

import { AuthModule } from '@/modules/auth/auth.module';
import { VenuesModule } from '@/modules/venues/venues.module';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { ScoringModule } from '@/modules/scoring/scoring.module';
import { HealthModule } from '@/modules/health/health.module';

@Module({
  imports: [
    // Platform / cross-cutting
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AppConfigModule,
    EventBusModule,
    AuditModule,
    SecurityModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Feature modules (bounded contexts)
    AuthModule,
    VenuesModule,
    ReviewsModule,
    ScoringModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: throttle -> authenticate -> authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
