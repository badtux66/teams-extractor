import { PrismaClient, UserRole, VenueType } from '@prisma/client';
import * as argon2 from 'argon2';
import { v7 as uuidv7 } from 'uuid';
import { DEFAULT_SCORING_CONFIG } from '../src/platform/config/scoring-config';

const prisma = new PrismaClient();

const GENRES = [
  'House',
  'Techno',
  'Hip-Hop',
  'Disco',
  'Drum & Bass',
  'Afrobeats',
  'Pop',
  'R&B',
];

async function main(): Promise<void> {
  // Genres
  for (const name of GENRES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await prisma.genre.upsert({
      where: { slug },
      update: {},
      create: { id: uuidv7(), name, slug },
    });
  }

  // Singleton app config (scoring weights/thresholds).
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: { config: { scoring: DEFAULT_SCORING_CONFIG } },
    create: { id: 1, config: { scoring: DEFAULT_SCORING_CONFIG } },
  });

  // Super admin (env-driven).
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@clubscan.app';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const adminId = uuidv7();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.SUPER_ADMIN },
    create: {
      id: adminId,
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
      emailVerifiedAt: new Date(),
      role: UserRole.SUPER_ADMIN,
      profile: { create: { id: uuidv7(), username: 'clubscan', displayName: 'ClubScan' } },
    },
  });

  // Dev demo venue (only outside production).
  if (process.env.NODE_ENV !== 'production') {
    const venueId = uuidv7();
    await prisma.venue.upsert({
      where: { slug: 'neon-cathedral' },
      update: {},
      create: {
        id: venueId,
        slug: 'neon-cathedral',
        name: 'Neon Cathedral',
        description: 'Flagship techno club with a renowned sound system.',
        type: VenueType.CLUB,
        city: 'Istanbul',
        country: 'TR',
        latitude: 41.0082,
        longitude: 28.9784,
        capacity: 1200,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
