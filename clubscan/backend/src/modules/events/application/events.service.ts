import { Inject, Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { EVENT_BUS, EventBusPort } from '@/platform/event-bus/event-bus.port';
import { buildPage, clampLimit, decodeCursor } from '@/platform/pagination/cursor';
import { DomainEvent } from '@/shared/domain/domain-event';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { EventQueryDto } from './dto/event-query.dto';

class EventSavedEvent extends DomainEvent<{ userId: string; eventId: string }> {
  readonly name = 'event.saved';
  constructor(readonly payload: { userId: string; eventId: string }) {
    super();
  }
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
  ) {}

  async discover(query: EventQueryDto) {
    const take = clampLimit(query.limit);
    const decoded = decodeCursor(query.cursor);

    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
      deletedAt: null,
      startsAt: { gte: query.from ?? new Date() },
      ...(query.to ? { startsAt: { gte: query.from ?? new Date(), lte: query.to } } : {}),
      ...(query.city ? { venue: { city: { equals: query.city, mode: 'insensitive' } } } : {}),
      ...(query.genre ? { genres: { some: { genre: { slug: query.genre } } } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(decoded
        ? {
            OR: [
              { startsAt: { gt: new Date(decoded.createdAt) } },
              { startsAt: new Date(decoded.createdAt), id: { gt: decoded.id } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.event.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true, slug: true, city: true } },
        genres: { include: { genre: true } },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    // Cursor keyed on startsAt (ascending) for upcoming-events ordering.
    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const last = data[data.length - 1];
    return {
      data,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.startsAt.toISOString(), id: last.id }),
            ).toString('base64url')
          : null,
    };
  }

  async getById(id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: {
        venue: { select: { id: true, name: true, slug: true, city: true, country: true } },
        genres: { include: { genre: true } },
        photos: { orderBy: { position: 'asc' } },
      },
    });
    if (!event) throw DomainError.notFound('Event', id);
    return event;
  }

  async save(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });
    if (!event) throw DomainError.notFound('Event', eventId);

    const created = await this.prisma.savedEvent
      .create({ data: { id: newId(), userId, eventId } })
      .catch(() => null);
    if (created) await this.bus.publish(new EventSavedEvent({ userId, eventId }));
    return { ok: true };
  }

  async unsave(userId: string, eventId: string) {
    await this.prisma.savedEvent
      .delete({ where: { userId_eventId: { userId, eventId } } })
      .catch(() => null);
    return { ok: true };
  }

  async listSaved(userId: string, cursor?: string, limit?: number) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.savedEvent.findMany({
      where: {
        userId,
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      include: {
        event: {
          include: { venue: { select: { name: true, slug: true, city: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }

  /** Deep-link share payload for an event (Phase 1 §9 flow 7). */
  async share(eventId: string) {
    const event = await this.getById(eventId);
    return {
      url: `clubscan://event/${event.id}`,
      universalLink: `https://clubscan.app/event/${event.id}`,
      title: event.title,
      venue: event.venue.name,
      startsAt: event.startsAt,
    };
  }
}
