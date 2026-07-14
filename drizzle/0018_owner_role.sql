-- New "owner" role: uses the order sections (Meat / Fish / Other Preorders)
-- plus Pickups & Deliveries. Access is gated server-side in src/lib/auth.ts.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'owner';
