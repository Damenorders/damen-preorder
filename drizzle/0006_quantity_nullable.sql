-- Quantity is now optional: products without a piece count (most fish, meats)
-- store NULL, and count fields can be marked optional (e.g. Number of Lobsters).
ALTER TABLE "order_lines" ALTER COLUMN "quantity" DROP NOT NULL;
