import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { validateEnv } from '@/platform/config/configuration';
import { PrismaModule } from '@/platform/prisma/prisma.module';
import { AppConfigModule } from '@/platform/config/app-config.module';
import { EventBusModule } from '@/platform/event-bus/event-bus.module';
import { AuditModule } from '@/platform/audit/audit.module';
import { AuditInterceptor } from '@/platform/audit/audit.interceptor';
import { SecurityModule } from '@/platform/security/security.module';
import { JwtAuthGuard } from '@/platform/security/jwt-auth.guard';
import { RolesGuard } from '@/platform/security/roles.guard';
import { AllExceptionsFilter } from '@/platform/http/all-exceptions.filter';

import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { ProfilesModule } from '@/modules/profiles/profiles.module';
import { VenuesModule } from '@/modules/venues/venues.module';
import { EventsModule } from '@/modules/events/events.module';
import { ReviewsModule } from '@/modules/reviews/reviews.module';
import { ScoringModule } from '@/modules/scoring/scoring.module';
import { SearchModule } from '@/modules/search/search.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { SafetyModule } from '@/modules/safety/safety.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { MediaModule } from '@/modules/media/media.module';
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
    UsersModule,
    ProfilesModule,
    VenuesModule,
    EventsModule,
    ReviewsModule,
    ScoringModule,
    SearchModule,
    ModerationModule,
    SafetyModule,
    NotificationsModule,
    AnalyticsModule,
    MediaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: throttle -> authenticate -> authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
