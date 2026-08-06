-- New "warehouse" role: sees only the Warehouse Inventory tool; every other
-- area is gated off server-side (src/lib/auth.ts). App DB access runs as the
-- table owner (RLS bypassed), so the requireRole checks are the real gate.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'warehouse';
