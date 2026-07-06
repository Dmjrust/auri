-- Tour guiado de onboarding: marca se o médico já viu o tour do primeiro acesso
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false;
