-- Add is_primary and receives_updates columns to participant_contacts
ALTER TABLE public.participant_contacts
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receives_updates boolean NOT NULL DEFAULT true;

-- Create unique index: only 1 primary per team
CREATE UNIQUE INDEX IF NOT EXISTS participant_contacts_one_primary_per_team
  ON public.participant_contacts (participant_id)
  WHERE is_primary = true;

-- Create unique index: prevent duplicate emails per team (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS participant_contacts_unique_email_per_team
  ON public.participant_contacts (participant_id, lower(email));
