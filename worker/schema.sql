-- Run once in the Cloudflare D1 console (or: wrangler d1 execute mesharialoud-bookings --file=schema.sql)
CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  slot_utc       TEXT NOT NULL,                 -- ISO UTC start, e.g. 2026-11-08T14:00:00Z
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT NOT NULL,
  note           TEXT,
  lang           TEXT NOT NULL DEFAULT 'en',
  status         TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | declined | expired
  payment_status TEXT NOT NULL DEFAULT 'unpaid',    -- unpaid | paid (set by the payment webhook later)
  fee_kwd        REAL NOT NULL DEFAULT 10,
  ip_hash        TEXT,
  created_at     TEXT NOT NULL,
  decided_at     TEXT
);
-- A time slot can only be held by ONE active booking (prevents double booking even under race conditions)
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_active ON bookings(slot_utc) WHERE status IN ('pending','confirmed');
CREATE INDEX IF NOT EXISTS ix_ip_time ON bookings(ip_hash, created_at);
