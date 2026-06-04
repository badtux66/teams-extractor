-- ClubScan — PostGIS geospatial augmentation (Phase 2 §6).
-- Applied as a follow-up migration after the Prisma baseline. Adds a generated
-- geography point + GiST index to power "near me" radius search, kept in sync
-- with the latitude/longitude columns. Prisma treats `geog` as Unsupported and
-- the VenueRepository queries it via raw SQL (ST_DWithin / KNN ordering).

CREATE EXTENSION IF NOT EXISTS postgis;

-- Generated column stays consistent automatically with lat/lng.
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_venues_geog ON venues USING GIST (geog);

-- Trigram + case-insensitive search support (Phase 2 §4).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_venues_name_trgm ON venues USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN (title gin_trgm_ops);
