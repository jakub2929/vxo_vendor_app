-- =============================================================================
-- Ryan production DB mirror — schema dump (mobile app tables)
-- Source: screenshots in supabase/ryan-prod-mirror/ (1.JPG, 2.JPG)
-- =============================================================================

CREATE TABLE vendor_profiles (
  id                 uuid PRIMARY KEY,
  user_id            uuid,              -- FK -> auth.users
  name               text NOT NULL,
  email              text,
  phone              text,
  service_area       text,              -- currently used as business name
  license_number     text,
  state              text,
  city               text,
  zipcode            text,
  service_categories text[],            -- ["HVAC","Plumbing"]
  rating             numeric,
  created_at         timestamptz NOT NULL
);

CREATE TABLE vendor_requests (
  id                uuid PRIMARY KEY,
  client_id         uuid NOT NULL,      -- FK -> profiles.id
  service_type      text NOT NULL,
  description       text NOT NULL,
  location          text NOT NULL,
  zipcode           varchar,
  priority          text NOT NULL,      -- Low | Medium | High
  status            text NOT NULL,      -- pending | in_progress | completed
  stripe_payment_id text,
  admin_notes       text,
  created_at        timestamptz NOT NULL
);

CREATE TABLE request_vendors (
  id                          uuid PRIMARY KEY,
  request_id                  uuid NOT NULL,  -- FK -> vendor_requests.id
  vendor_id                   uuid NOT NULL,  -- FK -> vendor_profiles.id
  job_status                  text NOT NULL,
  -- pending | in_progress | on_the_way | arrived | working | completed | cancelled
  va_confirmed_time           boolean,
  va_confirmed_job_acceptance boolean,
  va_notes                    text,
  created_at                  timestamptz NOT NULL
);

CREATE TABLE job_messages (
  id         bigint PRIMARY KEY,
  job_id     bigint,                    -- NULLABLE — legacy only, ignore
  request_id uuid,                      -- FK -> vendor_requests.id  <- USE THIS
  sender     text NOT NULL,             -- "client" | "vendor" | "system" | "agent"
  message    text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE device_tokens (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL,
  token      text NOT NULL,             -- Expo push token
  platform   text NOT NULL,             -- ios | android
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  type       text NOT NULL,
  read       boolean NOT NULL,
  data       jsonb,                     -- { request_id, vendor_id, ... }
  created_at timestamptz NOT NULL
);
