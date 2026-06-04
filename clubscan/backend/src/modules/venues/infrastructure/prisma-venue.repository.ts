import { Injectable } from '@nestjs/common';
import { Prisma, VenueStatus } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { buildPage, clampLimit, decodeCursor, Paginated } from '@/platform/pagination/cursor';
import {
  VenueDetail,
  VenueListFilter,
  VenueRepositoryPort,
  VenueWithScore,
} from '../application/ports/venue.repository.port';

@Injectable()
export class PrismaVenueRepository implements VenueRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: VenueListFilter): Promise<Paginated<VenueWithScore>> {
    const limit = clampLimit(filter.limit);

    // Geo/distance sort uses raw PostGIS; other sorts use keyset pagination.
    if (filter.near && filter.sort === 'distance') {
      return this.listByDistance(filter, limit);
    }

    const cursor = decodeCursor(filter.cursor);
    const where: Prisma.VenueWhereInput = {
      status: VenueStatus.PUBLISHED,
      deletedAt: null,
      ...(filter.city ? { city: { equals: filter.city, mode: 'insensitive' } } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.genre
        ? { genres: { some: { genre: { slug: filter.genre } } } }
        : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: 'insensitive' } },
              { description: { contains: filter.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.VenueOrderByWithRelationInput[] =
      filter.sort === 'score'
        ? [{ score: { score: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const rows = await this.prisma.venue.findMany({
      where,
      include: { score: true },
      orderBy,
      take: limit + 1,
    });

    return buildPage(rows, limit);
  }

  private async listByDistance(
    filter: VenueListFilter,
    limit: number,
  ): Promise<Paginated<VenueWithScore>> {
    const { lat, lng } = filter.near!;
    const radiusMeters = filter.radiusKm * 1000;

    // Raw PostGIS query; parameters are bound (no SQL injection).
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM venues
      WHERE status = 'PUBLISHED'
        AND "deletedAt" IS NULL
        AND ST_DWithin(
          geog,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY geog <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      LIMIT ${limit}
    `;

    const venues = await this.prisma.venue.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: { score: true },
    });
    // Preserve distance ordering from the raw query.
    const order = new Map(ids.map((r, i) => [r.id, i]));
    venues.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return { data: venues, nextCursor: null };
  }

  async findBySlug(slug: string): Promise<VenueDetail | null> {
    return this.prisma.venue.findFirst({
      where: { slug, deletedAt: null },
      include: {
        score: true,
        photos: { orderBy: { position: 'asc' } },
        hours: true,
        genres: { include: { genre: true } },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.venue.findFirst({ where: { id, deletedAt: null } });
  }
}
