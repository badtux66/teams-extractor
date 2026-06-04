import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/platform/security/decorators';
import { VenuesService } from '../application/venues.service';
import { VenueQueryDto } from '../application/dto/venue-query.dto';

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Public()
  @Get()
  list(@Query() query: VenueQueryDto) {
    return this.venues.list(query);
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.venues.getBySlug(slug);
  }
}
