import { Module } from '@nestjs/common';
import { VenuesService } from './application/venues.service';
import { VENUE_REPOSITORY } from './application/ports/venue.repository.port';
import { PrismaVenueRepository } from './infrastructure/prisma-venue.repository';
import { VenuesController } from './presentation/venues.controller';

@Module({
  controllers: [VenuesController],
  providers: [
    VenuesService,
    { provide: VENUE_REPOSITORY, useClass: PrismaVenueRepository },
  ],
  exports: [VENUE_REPOSITORY],
})
export class VenuesModule {}
