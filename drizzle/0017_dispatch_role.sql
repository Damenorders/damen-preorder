-- New "dispatch" role: sees only the Pickups & Deliveries tools and Order
-- Alerts. Everything else is gated server-side in src/lib/auth.ts.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'dispatch';
