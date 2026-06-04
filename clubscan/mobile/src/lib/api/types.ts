/** API response shapes mirroring the backend contract (Phase 3 §9). */

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export interface VenueScore {
  score: string; // Decimal serialized as string
  reviewCount: number;
  avgSafetyForWomen: string;
  avgSecurity: string;
  safetyAdvisory: boolean;
}

export interface VenueListItem {
  id: string;
  slug: string;
  name: string;
  type: 'CLUB' | 'BAR' | 'FESTIVAL' | 'EVENT' | 'LOUNGE';
  city: string;
  country: string;
  coverPhotoUrl: string | null;
  score: VenueScore | null;
}

export interface VenueDetail extends VenueListItem {
  description: string | null;
  capacity: number | null;
  latitude: string;
  longitude: string;
  photos: { id: string; url: string }[];
  hours: { weekday: number; openMin: number; closeMin: number; isClosed: boolean }[];
  genres: { genre: { id: string; name: string; slug: string } }[];
}

export interface ReviewItem {
  id: string;
  body: string;
  helpfulCount: number;
  createdAt: string;
  rating: Record<string, number> | null;
  photos: { id: string; url: string }[];
  user: { id: string; profile: { username: string; avatarUrl: string | null } | null };
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
    reputationScore: number;
    locale: string;
  };
}
