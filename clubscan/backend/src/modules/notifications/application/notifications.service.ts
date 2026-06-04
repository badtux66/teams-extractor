import { Inject, Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { buildPage, clampLimit, decodeCursor } from '@/platform/pagination/cursor';
import { newId } from '@/shared/ids/uuid';
import { PUSH_GATEWAY, PushGatewayPort } from './ports/push.port';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  push?: { title: string; body: string };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_GATEWAY) private readonly push: PushGatewayPort,
  ) {}

  async create(input: CreateNotificationInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        id: newId(),
        userId: input.userId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });

    if (input.push) {
      const devices = await this.prisma.device.findMany({
        where: { userId: input.userId, pushToken: { not: null } },
        select: { pushToken: true },
      });
      const tokens = devices.map((d) => d.pushToken!).filter(Boolean);
      if (tokens.length > 0) {
        await this.push.send({
          tokens,
          title: input.push.title,
          body: input.push.body,
          data: { type: input.type },
        });
        await this.prisma.notification.updateMany({
          where: { userId: input.userId, type: input.type, sentPush: false },
          data: { sentPush: true },
        });
      }
    }
  }

  async list(userId: string, cursor?: string, limit?: number) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
