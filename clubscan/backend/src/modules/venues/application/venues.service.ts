import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@/shared/errors/domain-error';
import { VenueQueryDto } from './dto/venue-query.dto';
import {
  VENUE_REPOSITORY,
  VenueListFilter,
  VenueRepositoryPort,
} from './ports/venue.repository.port';

@Injectable()
export class VenuesService {
  constructor(
    @Inject(VENUE_REPOSITORY) private readonly venues: VenueRepositoryPort,
  ) {}

  async list(query: VenueQueryDto) {
    const filter: VenueListFilter = {
      city: query.city,
      type: query.type,
      genre: query.genre,
      q: query.q,
      radiusKm: query.radiusKm,
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    };
    if (query.near) {
      const [lat, lng] = query.near.split(',').map(Number);
      filter.near = { lat, lng };
    }
    return this.venues.list(filter);
  }

  async getBySlug(slug: string) {
    const venue = await this.venues.findBySlug(slug);
    if (!venue) throw DomainError.notFound('Venue');
    return venue;
  }
}
