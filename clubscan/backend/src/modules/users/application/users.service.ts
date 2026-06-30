import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { RegisterDeviceDto } from './dto/device.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, deviceId: true },
    });
    return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw DomainError.notFound('Session', sessionId);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async listDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, platform: true, name: true, lastSeenAt: true },
    });
  }

  /** Registers/updates an FCM device token for push (idempotent per token). */
  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findFirst({
      where: { userId, pushToken: dto.pushToken },
    });
    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), name: dto.name ?? existing.name, platform: dto.platform },
      });
      return { id: existing.id };
    }
    const device = await this.prisma.device.create({
      data: {
        id: newId(),
        userId,
        platform: dto.platform,
        pushToken: dto.pushToken,
        name: dto.name,
      },
    });
    return { id: device.id };
  }

  async removeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw DomainError.notFound('Device', deviceId);
    await this.prisma.device.delete({ where: { id: deviceId } });
    return { ok: true };
  }
}
