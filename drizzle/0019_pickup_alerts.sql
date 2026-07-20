ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "pickup_alerts" boolean DEFAULT true NOT NULL;
