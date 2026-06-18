-- New "scheduling" role: views submissions (all sections + all submissions) and
-- may edit line weight and submission status only.
ALTER TYPE "public"."user_role" ADD VALUE 'scheduling';
