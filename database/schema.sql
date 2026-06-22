CREATE TYPE "user_role" AS ENUM (
  'owner',
  'admin'
);

CREATE TYPE "approval_status" AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE "field_type" AS ENUM (
  'text',
  'textarea',
  'dropdown',
  'checkbox',
  'radio'
);

CREATE TYPE "booking_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" user_role NOT NULL DEFAULT 'owner',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "businesses" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) UNIQUE NOT NULL,
  "description" text,
  "phone" varchar(20),
  "contact_email" varchar(255),
  "website_url" varchar(255),
  "is_active" boolean NOT NULL DEFAULT true,
  "approval_status" approval_status NOT NULL DEFAULT 'pending',
  "rejection_reason" text,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "availability_rules" (
  "id" SERIAL PRIMARY KEY,
  "business_id" uuid NOT NULL,
  "day_of_week" smallint NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "break_start" time,
  "break_end" time,
  "slot_duration_minutes" smallint NOT NULL,
  "is_available" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "booking_forms" (
  "id" SERIAL PRIMARY KEY,
  "business_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "booking_window_days" smallint NOT NULL DEFAULT 30,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "form_fields" (
  "id" SERIAL PRIMARY KEY,
  "form_id" integer NOT NULL,
  "label" varchar(255) NOT NULL,
  "field_type" field_type NOT NULL,
  "options" jsonb,
  "is_required" boolean NOT NULL DEFAULT false,
  "display_order" smallint NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "bookings" (
  "id" SERIAL PRIMARY KEY,
  "business_id" uuid NOT NULL,
  "form_id" integer NOT NULL,
  "customer_name" varchar(255) NOT NULL,
  "customer_email" varchar(255) NOT NULL,
  "customer_phone" varchar(20),
  "booking_date" date NOT NULL,
  "booking_time" time NOT NULL,
  "status" booking_status NOT NULL DEFAULT 'pending',
  "owner_notes" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "booking_field_values" (
  "id" SERIAL PRIMARY KEY,
  "booking_id" integer NOT NULL,
  "form_field_id" integer NOT NULL,
  "value" text
);

CREATE INDEX "idx_businesses_user_id" ON "businesses" ("user_id");

CREATE INDEX "idx_businesses_approval_status" ON "businesses" ("approval_status");

CREATE INDEX "idx_availability_rules_business_id" ON "availability_rules" ("business_id");

CREATE INDEX "idx_booking_forms_business_id" ON "booking_forms" ("business_id");

CREATE INDEX "idx_form_fields_form_id" ON "form_fields" ("form_id");

CREATE INDEX "idx_bookings_business_id" ON "bookings" ("business_id");

CREATE INDEX "idx_bookings_status" ON "bookings" ("status");

CREATE INDEX "idx_bookings_business_status" ON "bookings" ("business_id", "status");

CREATE INDEX "idx_booking_field_values_booking_id" ON "booking_field_values" ("booking_id");

CREATE INDEX "idx_booking_field_values_form_field_id" ON "booking_field_values" ("form_field_id");

COMMENT ON COLUMN "users"."id" IS 'Primary key';

COMMENT ON COLUMN "users"."password_hash" IS 'bcrypt hashed';

COMMENT ON COLUMN "users"."is_active" IS 'Admin can deactivate login';

COMMENT ON COLUMN "businesses"."id" IS 'Used in public booking URL';

COMMENT ON COLUMN "businesses"."slug" IS 'URL-friendly e.g. joes-plumbing';

COMMENT ON COLUMN "businesses"."contact_email" IS 'Separate from login email';

COMMENT ON COLUMN "businesses"."is_active" IS 'Admin suspend/activate';

COMMENT ON COLUMN "businesses"."rejection_reason" IS 'Admin fills on rejection';

COMMENT ON COLUMN "availability_rules"."day_of_week" IS '0 = Monday, 6 = Sunday';

COMMENT ON COLUMN "availability_rules"."slot_duration_minutes" IS 'e.g. 30 or 60';

COMMENT ON COLUMN "booking_forms"."title" IS 'e.g. Book a Consultation';

COMMENT ON COLUMN "booking_forms"."booking_window_days" IS 'How far ahead customers can book';

COMMENT ON COLUMN "booking_forms"."is_active" IS 'Only one active form per business';

COMMENT ON COLUMN "form_fields"."label" IS 'e.g. Choose your suburb';

COMMENT ON COLUMN "form_fields"."options" IS 'Array of options for dropdown/radio/checkbox';

COMMENT ON COLUMN "form_fields"."display_order" IS 'Controls render order on the form';

COMMENT ON COLUMN "bookings"."business_id" IS 'Denormalised for direct tenant queries';

COMMENT ON COLUMN "bookings"."owner_notes" IS 'Owner adds notes on approval/rejection';

COMMENT ON COLUMN "booking_field_values"."value" IS 'Customer answer stored as text regardless of field type';

ALTER TABLE "businesses" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "availability_rules" ADD FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "booking_forms" ADD FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "form_fields" ADD FOREIGN KEY ("form_id") REFERENCES "booking_forms" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bookings" ADD FOREIGN KEY ("business_id") REFERENCES "businesses" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bookings" ADD FOREIGN KEY ("form_id") REFERENCES "booking_forms" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "booking_field_values" ADD FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "booking_field_values" ADD FOREIGN KEY ("form_field_id") REFERENCES "form_fields" ("id") DEFERRABLE INITIALLY IMMEDIATE;
