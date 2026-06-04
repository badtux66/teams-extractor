import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/platform/security/decorators';
import { SearchService, SearchType } from '../application/search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } })
  @Get()
  query(@Query('q') q = '', @Query('type') type: SearchType = 'all') {
    return this.search.search(q, type);
  }
}
