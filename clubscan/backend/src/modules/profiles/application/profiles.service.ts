import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { EVENT_BUS, EventBusPort } from '@/platform/event-bus/event-bus.port';
import { buildPage, clampLimit, decodeCursor } from '@/platform/pagination/cursor';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { UpdateProfileDto } from './dto/profile.dto';
import { UserFollowedEvent } from '../domain/profile.events';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { socialLinks: true } } },
    });
    if (!user) throw DomainError.notFound('User', userId);
    return this.present(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw DomainError.notFound('Profile');

    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { userId },
        data: {
          displayName: dto.displayName,
          bio: dto.bio,
          avatarUrl: dto.avatarUrl,
          isPrivate: dto.isPrivate,
        },
      });
      if (dto.socialLinks) {
        await tx.socialLink.deleteMany({ where: { profileId: profile.id } });
        if (dto.socialLinks.length > 0) {
          await tx.socialLink.createMany({
            data: dto.socialLinks.map((l) => ({
              id: newId(),
              profileId: profile.id,
              platform: l.platform,
              url: l.url,
            })),
          });
        }
      }
    });
    return this.getMe(userId);
  }

  async getPublicProfile(username: string, viewerId?: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { username, deletedAt: null },
      include: {
        socialLinks: true,
        user: { select: { id: true, reputationScore: true, status: true } },
      },
    });
    if (!profile || profile.user.status === 'DELETED') throw DomainError.notFound('Profile');

    const [followers, following, isFollowing] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: profile.userId } }),
      this.prisma.follow.count({ where: { followerId: profile.userId } }),
      viewerId
        ? this.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: profile.userId } },
          })
        : null,
    ]);

    return {
      id: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      verificationStatus: profile.verificationStatus,
      reputationScore: profile.user.reputationScore,
      socialLinks: profile.socialLinks.map((l) => ({ platform: l.platform, url: l.url })),
      counts: { followers, following },
      isFollowing: !!isFollowing,
    };
  }

  async follow(followerId: string, targetUserId: string) {
    if (followerId === targetUserId) {
      throw DomainError.validation('You cannot follow yourself');
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, status: { not: 'DELETED' } },
      select: { id: true },
    });
    if (!target) throw DomainError.notFound('User', targetUserId);

    const created = await this.prisma.follow
      .create({ data: { id: newId(), followerId, followingId: targetUserId } })
      .catch(() => null);

    if (created) {
      await this.bus.publish(new UserFollowedEvent({ followerId, followingId: targetUserId }));
    }
    return { ok: true };
  }

  async unfollow(followerId: string, targetUserId: string) {
    await this.prisma.follow
      .delete({
        where: { followerId_followingId: { followerId, followingId: targetUserId } },
      })
      .catch(() => null);
    return { ok: true };
  }

  async listFollowers(userId: string, cursor?: string, limit?: number) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.follow.findMany({
      where: {
        followingId: userId,
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      include: {
        follower: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }

  async listFollowing(userId: string, cursor?: string, limit?: number) {
    const take = clampLimit(limit);
    const decoded = decodeCursor(cursor);
    const rows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        ...(decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {}),
      },
      include: {
        following: { select: { id: true, profile: { select: { username: true, avatarUrl: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    return buildPage(rows, take);
  }

  private present(user: {
    id: string;
    email: string;
    role: string;
    reputationScore: number;
    locale: string;
    emailVerifiedAt: Date | null;
    profile: {
      username: string;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
      isPrivate: boolean;
      verificationStatus: string;
      socialLinks: { platform: string; url: string }[];
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      reputationScore: user.reputationScore,
      locale: user.locale,
      emailVerified: !!user.emailVerifiedAt,
      profile: user.profile
        ? {
            username: user.profile.username,
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
            isPrivate: user.profile.isPrivate,
            verificationStatus: user.profile.verificationStatus,
            socialLinks: user.profile.socialLinks.map((l) => ({ platform: l.platform, url: l.url })),
          }
        : null,
    };
  }
}
