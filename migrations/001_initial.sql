CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL, email varchar(254) NOT NULL UNIQUE,
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'student' CHECK(role IN ('student','candidate','teacher','admin','superadmin')),
 verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE student_profiles (user_id uuid PRIMARY KEY REFERENCES users(id), level text NOT NULL DEFAULT 'Principiante', timezone text NOT NULL DEFAULT 'Europe/Madrid', goals text, adult_confirmed boolean NOT NULL DEFAULT false);
CREATE TABLE auth_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_tokens (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('verify','reset')), expires_at timestamptz NOT NULL);
CREATE TABLE rate_limits (key_hash text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE TABLE teacher_profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id), headline varchar(160) NOT NULL, bio text NOT NULL, languages text[] NOT NULL DEFAULT ARRAY['Español'],
 levels text[] NOT NULL DEFAULT ARRAY['Principiante'], specialties text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','paused','suspended','departed')),
 published boolean NOT NULL DEFAULT false, agreement_at timestamptz, verified_at timestamptz, teacher_bps integer NOT NULL DEFAULT 5000 CHECK(teacher_bps BETWEEN 5000 AND 9500),
 cycle integer NOT NULL DEFAULT 1, promotions_frozen boolean NOT NULL DEFAULT false, stripe_account_id text UNIQUE, last_activity_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id), country text NOT NULL, languages text[] NOT NULL,
 experience text NOT NULL, levels text[] NOT NULL, presentation text NOT NULL, availability text NOT NULL, cv_key text NOT NULL,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','documents','review','references','interview','trial','approved','rejected','withdrawn')),
 privacy_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_references (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES teacher_applications(id), organization text NOT NULL, dates text NOT NULL, details text, verified_at timestamptz);
CREATE TABLE teacher_status_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id), status text NOT NULL, reason text NOT NULL, actor_id uuid REFERENCES users(id), created_at timestamptz DEFAULT now());
CREATE TABLE teacher_availability (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id), weekday integer NOT NULL CHECK(weekday BETWEEN 1 AND 7), start_time time NOT NULL, end_time time NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Madrid', approved boolean NOT NULL DEFAULT false, CHECK(end_time > start_time));
CREATE TABLE teacher_time_off (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, approved boolean NOT NULL DEFAULT false, CHECK(ends_at>starts_at));
CREATE TABLE groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id), title varchar(120) NOT NULL,
 level text NOT NULL, language text NOT NULL DEFAULT 'Español', capacity integer NOT NULL DEFAULT 4 CHECK(capacity BETWEEN 2 AND 12), min_students integer NOT NULL DEFAULT 2 CHECK(min_students>=2),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','pending','confirmed','active','full','suspended','finished','cancelled')),
 first_at timestamptz NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Madrid', duration integer NOT NULL DEFAULT 60 CHECK(duration BETWEEN 30 AND 180),
 enrollment_deadline timestamptz NOT NULL, excluded_dates date[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), CHECK(capacity >= min_students), CHECK(enrollment_deadline<first_at)
);
CREATE INDEX groups_search ON groups(status,level,first_at);
CREATE TABLE campaigns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, code varchar(80) UNIQUE NOT NULL, city text, channel text NOT NULL, active boolean DEFAULT true);
CREATE TABLE group_enrollments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES groups(id), student_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','awaiting_payment','active','leaving','left','expired')), terms_version text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(group_id,student_id)
);
CREATE INDEX enrollment_students ON group_enrollments(student_id,status);
CREATE TABLE attribution_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid UNIQUE REFERENCES group_enrollments(id), campaign_id uuid REFERENCES campaigns(id), source text NOT NULL);
CREATE TABLE billing_cycles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES groups(id), sequence integer NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, approved boolean NOT NULL DEFAULT false, UNIQUE(group_id,sequence), CHECK(ends_at>starts_at));
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES groups(id), cycle_id uuid NOT NULL REFERENCES billing_cycles(id), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','taught','teacher_absent','rescheduled','cancelled')),
 video_url text, UNIQUE(group_id,starts_at), CHECK(ends_at>starts_at),
 EXCLUDE USING gist (teacher_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status NOT IN ('cancelled','rescheduled'))
);
CREATE TABLE attendance (session_id uuid REFERENCES sessions(id), student_id uuid REFERENCES users(id), status text NOT NULL CHECK(status IN ('present','absent')), marked_by uuid NOT NULL REFERENCES users(id), PRIMARY KEY(session_id,student_id));
CREATE TABLE student_slots (enrollment_id uuid NOT NULL REFERENCES group_enrollments(id), student_id uuid NOT NULL REFERENCES users(id), session_id uuid NOT NULL REFERENCES sessions(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, PRIMARY KEY(student_id,session_id), EXCLUDE USING gist(student_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&));
CREATE TABLE subscription_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents=5000), sessions_included integer NOT NULL CHECK(sessions_included=4), stripe_price_id text UNIQUE);
CREATE TABLE subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL UNIQUE REFERENCES group_enrollments(id), stripe_id text UNIQUE, stripe_customer_id text,
 checkout_id text UNIQUE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','past_due','cancelled','incomplete','paused')),
 cancel_at_period_end boolean NOT NULL DEFAULT false, current_period_end timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_commission_levels (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), threshold integer NOT NULL CHECK(threshold>=0), teacher_bps integer NOT NULL CHECK(teacher_bps BETWEEN 5000 AND 9500), effective_from date NOT NULL, UNIQUE(threshold,effective_from));
CREATE TABLE teacher_commission_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid REFERENCES teacher_profiles(user_id), cycle integer NOT NULL, teacher_bps integer NOT NULL CHECK(teacher_bps BETWEEN 5000 AND 9500), period date NOT NULL, unique_students integer NOT NULL, reason text NOT NULL, UNIQUE(teacher_id,cycle,period));
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES subscriptions(id), stripe_invoice_id text UNIQUE NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>=0), currency text NOT NULL DEFAULT 'eur' CHECK(currency='eur'), status text NOT NULL CHECK(status IN ('paid','failed','refunded','disputed')),
 teacher_bps integer NOT NULL CHECK(teacher_bps BETWEEN 5000 AND 9500), teacher_cycle integer NOT NULL, paid_at timestamptz, invoice_url text
);
CREATE TABLE refunds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id), stripe_id text UNIQUE NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>0), reason text NOT NULL, status text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE payouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id), period date NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>=0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paid','failed')), stripe_transfer_id text UNIQUE, closed_at timestamptz, UNIQUE(teacher_id,period));
CREATE TABLE ledger_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid REFERENCES payments(id), payout_id uuid REFERENCES payouts(id), kind text NOT NULL CHECK(kind IN ('receipt','refund','teacher_allocation','academy_allocation','payout','adjustment')), amount_cents integer NOT NULL, idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION immutable_finance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registro financiero inmutable; utilizar ajustes'; END $$;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION immutable_finance();
CREATE FUNCTION protect_payment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.teacher_bps<>OLD.teacher_bps OR NEW.amount_cents<>OLD.amount_cents OR NEW.teacher_cycle<>OLD.teacher_cycle THEN RAISE EXCEPTION 'Snapshot económico inmutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER payment_snapshot BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION protect_payment_snapshot();
CREATE FUNCTION protect_closed_payout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Liquidación cerrada inmutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER payout_closed BEFORE UPDATE OR DELETE ON payouts FOR EACH ROW EXECUTE FUNCTION protect_closed_payout();
CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL UNIQUE REFERENCES group_enrollments(id), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment varchar(2000), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden','removed')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE review_moderation_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL REFERENCES reviews(id), actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, reason text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE student_withdrawals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES group_enrollments(id), reason varchar(2000), kind text NOT NULL CHECK(kind IN ('cancel_renewal','change_teacher','change_group','wait')), effective_at timestamptz NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE teacher_departures (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teacher_profiles(user_id), cycle integer NOT NULL, reason text NOT NULL, effective_at timestamptz NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), title text NOT NULL, body text NOT NULL, dedupe_key text NOT NULL UNIQUE, read_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE mail_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient text NOT NULL, subject text NOT NULL, body text NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id), session_id uuid REFERENCES sessions(id), reported_by uuid REFERENCES users(id), kind text NOT NULL, description varchar(3000) NOT NULL, status text NOT NULL DEFAULT 'open', created_at timestamptz DEFAULT now());
CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id), action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_finance();
CREATE TABLE platform_settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE stripe_events (id text PRIMARY KEY, type text NOT NULL, processed_at timestamptz DEFAULT now());
INSERT INTO subscription_plans(name,amount_cents,sessions_included) VALUES('Academia · grupo reducido',5000,4);
INSERT INTO platform_settings VALUES ('enrollment_cutoff_hours','48'),('max_group_size','4'),('terms_version','"2026-10-mvp-1"');
