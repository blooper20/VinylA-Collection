-- ============================================================
-- Read Tracking Migration (2026-07-13)
-- Run this section manually in the Supabase SQL Editor.
--
-- This adds the columns required for the "edit inquiry" and "edit reply"
-- features.
-- 1. ADMIN_READ_AT on INQUIRY: Set when an admin opens the inquiry thread.
--    Users can edit their inquiries as long as this is null.
-- 2. READ_AT on INQUIRY_REPLY: Set when a user opens the inquiry thread.
--    Admins can edit their replies as long as this is null.
-- ============================================================

ALTER TABLE public."INQUIRY" ADD COLUMN IF NOT EXISTS "ADMIN_READ_AT" timestamp with time zone;
ALTER TABLE public."INQUIRY_REPLY" ADD COLUMN IF NOT EXISTS "READ_AT" timestamp with time zone;
