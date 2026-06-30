-- New "butcher" role: full buyer access except Order Errors, the Error Reports
-- table, and Applications. Page/action gates exclude those for butcher.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'butcher';
