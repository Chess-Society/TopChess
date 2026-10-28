-- Base nueva en Cloudflare D1. Sin usuarios ni datos de demostración.
CREATE TABLE users (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), name TEXT NOT NULL, email TEXT UNIQUE,
 password_hash TEXT, role text NOT NULL DEFAULT 'student' CHECK(role IN ('student','candidate','teacher','admin','superadmin')),
 verified_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE student_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), level text NOT NULL DEFAULT 'Principiante', timezone text NOT NULL DEFAULT 'Europe/Madrid', goals text, adult_confirmed INTEGER NOT NULL DEFAULT false);

CREATE TABLE auth_sessions (token_hash text PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE private_documents (key TEXT PRIMARY KEY, size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=5242880), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE private_document_chunks (document_key TEXT NOT NULL REFERENCES private_documents(key) ON DELETE CASCADE, sequence INTEGER NOT NULL CHECK(sequence>=0), data BLOB NOT NULL, PRIMARY KEY(document_key,sequence));

CREATE INDEX auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE auth_tokens (token_hash text PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('verify','reset')), expires_at TEXT NOT NULL);

CREATE TABLE rate_limits (key_hash text PRIMARY KEY, hits integer NOT NULL, reset_at TEXT NOT NULL);

CREATE TABLE teacher_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id), headline TEXT NOT NULL, bio text NOT NULL, languages TEXT NOT NULL DEFAULT '["Español"]',
 levels TEXT NOT NULL DEFAULT '["Principiante"]', specialties TEXT NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','paused','suspended','departed')),
 published INTEGER NOT NULL DEFAULT false, agreement_at TEXT, verified_at TEXT, teacher_bps integer NOT NULL DEFAULT 5000 CHECK(teacher_bps BETWEEN 5000 AND 9500),
 cycle integer NOT NULL DEFAULT 1, promotions_frozen INTEGER NOT NULL DEFAULT false, stripe_account_id text UNIQUE, last_activity_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE teacher_applications (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), user_id TEXT NOT NULL UNIQUE REFERENCES users(id), country text NOT NULL, languages TEXT NOT NULL,
 experience text NOT NULL, levels TEXT NOT NULL, presentation text NOT NULL, availability text NOT NULL, cv_key text NOT NULL,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','documents','review','references','interview','trial','approved','rejected','withdrawn')),
 privacy_version text NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE teacher_references (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), application_id TEXT NOT NULL REFERENCES teacher_applications(id), organization text NOT NULL, dates text NOT NULL, details text, verified_at TEXT);

CREATE TABLE teacher_status_history (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), status text NOT NULL, reason text NOT NULL, actor_id TEXT REFERENCES users(id), created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE teacher_availability (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), weekday integer NOT NULL CHECK(weekday BETWEEN 1 AND 7), start_time TEXT NOT NULL, end_time TEXT NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Madrid', approved INTEGER NOT NULL DEFAULT false, CHECK(end_time > start_time));

CREATE TABLE teacher_time_off (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT false, CHECK(ends_at>starts_at));

CREATE TABLE groups (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), title TEXT NOT NULL,
 level text NOT NULL, language text NOT NULL DEFAULT 'Español', capacity integer NOT NULL DEFAULT 4 CHECK(capacity BETWEEN 2 AND 12), min_students integer NOT NULL DEFAULT 2 CHECK(min_students>=2),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','pending','confirmed','active','full','suspended','finished','cancelled')),
 first_at TEXT NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Madrid', duration integer NOT NULL DEFAULT 60 CHECK(duration BETWEEN 30 AND 180),
 enrollment_deadline TEXT NOT NULL, excluded_dates TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), CHECK(capacity >= min_students), CHECK(enrollment_deadline<first_at)
);

CREATE INDEX groups_search ON groups(status,level,first_at);

CREATE TABLE campaigns (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), name text NOT NULL, code TEXT UNIQUE NOT NULL, city text, channel text NOT NULL, active INTEGER DEFAULT true);

CREATE TABLE group_enrollments (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), group_id TEXT NOT NULL REFERENCES groups(id), student_id TEXT NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','awaiting_payment','active','leaving','left','expired')), terms_version text NOT NULL,
 accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(group_id,student_id)
);

CREATE INDEX enrollment_students ON group_enrollments(student_id,status);

CREATE TABLE attribution_records (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), enrollment_id TEXT UNIQUE REFERENCES group_enrollments(id), campaign_id TEXT REFERENCES campaigns(id), source text NOT NULL);

CREATE TABLE billing_cycles (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), group_id TEXT NOT NULL REFERENCES groups(id), sequence integer NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT false, UNIQUE(group_id,sequence), CHECK(ends_at>starts_at));

CREATE TABLE sessions (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), group_id TEXT NOT NULL REFERENCES groups(id), cycle_id TEXT NOT NULL REFERENCES billing_cycles(id), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id),
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','taught','teacher_absent','rescheduled','cancelled')),
 video_url text, UNIQUE(group_id,starts_at), CHECK(ends_at>starts_at));

CREATE TABLE attendance (session_id TEXT REFERENCES sessions(id), student_id TEXT REFERENCES users(id), status text NOT NULL CHECK(status IN ('present','absent')), marked_by TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(session_id,student_id));

CREATE TABLE student_slots (enrollment_id TEXT NOT NULL REFERENCES group_enrollments(id), student_id TEXT NOT NULL REFERENCES users(id), session_id TEXT NOT NULL REFERENCES sessions(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, PRIMARY KEY(student_id,session_id));

CREATE TABLE subscription_plans (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), name text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents=5000), sessions_included integer NOT NULL CHECK(sessions_included=4), stripe_price_id text UNIQUE);

CREATE TABLE subscriptions (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), enrollment_id TEXT NOT NULL UNIQUE REFERENCES group_enrollments(id), stripe_id text UNIQUE, stripe_customer_id text,
 checkout_id text UNIQUE, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','past_due','cancelled','incomplete','paused')),
 cancel_at_period_end INTEGER NOT NULL DEFAULT false, current_period_end TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE teacher_commission_levels (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), threshold integer NOT NULL CHECK(threshold>=0), teacher_bps integer NOT NULL CHECK(teacher_bps BETWEEN 5000 AND 9500), effective_from TEXT NOT NULL, UNIQUE(threshold,effective_from));

CREATE TABLE teacher_commission_history (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT REFERENCES teacher_profiles(user_id), cycle integer NOT NULL, teacher_bps integer NOT NULL CHECK(teacher_bps BETWEEN 5000 AND 9500), period TEXT NOT NULL, unique_students integer NOT NULL, reason text NOT NULL, UNIQUE(teacher_id,cycle,period));

CREATE TABLE payments (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), subscription_id TEXT NOT NULL REFERENCES subscriptions(id), stripe_invoice_id text UNIQUE NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>=0), currency text NOT NULL DEFAULT 'eur' CHECK(currency='eur'), status text NOT NULL CHECK(status IN ('paid','failed','refunded','disputed')),
 teacher_bps integer NOT NULL CHECK(teacher_bps BETWEEN 5000 AND 9500), teacher_cycle integer NOT NULL, paid_at TEXT, invoice_url text
);

CREATE TABLE refunds (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), payment_id TEXT NOT NULL REFERENCES payments(id), stripe_id text UNIQUE NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>0), reason text NOT NULL, status text NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE payouts (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), period TEXT NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>=0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paid','failed')), stripe_transfer_id text UNIQUE, closed_at TEXT, UNIQUE(teacher_id,period));

CREATE TABLE ledger_entries (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), payment_id TEXT REFERENCES payments(id), payout_id TEXT REFERENCES payouts(id), kind text NOT NULL CHECK(kind IN ('receipt','refund','teacher_allocation','academy_allocation','payout','adjustment')), amount_cents integer NOT NULL, idempotency_key text NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE reviews (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), enrollment_id TEXT NOT NULL UNIQUE REFERENCES group_enrollments(id), rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden','removed')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE review_moderation_actions (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), review_id TEXT NOT NULL REFERENCES reviews(id), actor_id TEXT NOT NULL REFERENCES users(id), action text NOT NULL, reason text NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE student_withdrawals (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), enrollment_id TEXT NOT NULL REFERENCES group_enrollments(id), reason TEXT, kind text NOT NULL CHECK(kind IN ('cancel_renewal','change_teacher','change_group','wait')), effective_at TEXT NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE teacher_departures (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id), cycle integer NOT NULL, reason text NOT NULL, effective_at TEXT NOT NULL, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE notifications (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), user_id TEXT NOT NULL REFERENCES users(id), title text NOT NULL, body text NOT NULL, dedupe_key text NOT NULL UNIQUE, read_at TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE mail_outbox (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), recipient text NOT NULL, subject text NOT NULL, body text NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), sent_at TEXT, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE incidents (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), group_id TEXT REFERENCES groups(id), session_id TEXT REFERENCES sessions(id), reported_by TEXT REFERENCES users(id), kind text NOT NULL, description TEXT NOT NULL, status text NOT NULL DEFAULT 'open', created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE audit_logs (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',(random() & 3)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))), actor_id TEXT REFERENCES users(id), action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

CREATE TABLE platform_settings (key text PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE stripe_events (id text PRIMARY KEY, type text NOT NULL, processed_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));

INSERT INTO subscription_plans(name,amount_cents,sessions_included) VALUES('Academia · grupo reducido',5000,4);

INSERT INTO platform_settings VALUES ('enrollment_cutoff_hours','48'),('max_group_size','4'),('terms_version','"2026-10-mvp-1"');
ALTER TABLE users ADD COLUMN lichess_id TEXT;
CREATE UNIQUE INDEX users_lichess_id ON users(lichess_id);
ALTER TABLE users ADD COLUMN lichess_username TEXT;
ALTER TABLE users ADD COLUMN profile_completed_at TEXT;
ALTER TABLE users ADD COLUMN profile_kind TEXT CHECK(profile_kind IN ('student','teacher'));
ALTER TABLE users ADD COLUMN privacy_accepted_at TEXT;
ALTER TABLE users ADD COLUMN privacy_version TEXT;
CREATE UNIQUE INDEX users_lichess_id_ci ON users(lower(lichess_id)) WHERE lichess_id IS NOT NULL;
CREATE TRIGGER immutable_ledger_update BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT,'Registro financiero inmutable'); END;
CREATE TRIGGER immutable_ledger_delete BEFORE DELETE ON ledger_entries BEGIN SELECT RAISE(ABORT,'Registro financiero inmutable'); END;
CREATE TRIGGER immutable_audit_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT,'Auditoría inmutable'); END;
CREATE TRIGGER immutable_audit_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT,'Auditoría inmutable'); END;
CREATE TRIGGER immutable_payment BEFORE UPDATE ON payments WHEN NEW.teacher_bps<>OLD.teacher_bps OR NEW.amount_cents<>OLD.amount_cents OR NEW.teacher_cycle<>OLD.teacher_cycle BEGIN SELECT RAISE(ABORT,'Snapshot económico inmutable'); END;
CREATE TRIGGER immutable_payout BEFORE UPDATE ON payouts WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'Liquidación cerrada inmutable'); END;
CREATE TRIGGER immutable_payout_delete BEFORE DELETE ON payouts WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'Liquidación cerrada inmutable'); END;
CREATE TRIGGER teacher_overlap_insert BEFORE INSERT ON sessions WHEN NEW.status NOT IN ('cancelled','rescheduled') AND EXISTS(SELECT 1 FROM sessions s WHERE s.teacher_id=NEW.teacher_id AND s.status NOT IN ('cancelled','rescheduled') AND s.starts_at<NEW.ends_at AND s.ends_at>NEW.starts_at) BEGIN SELECT RAISE(ABORT,'El horario se solapa con otra clase del profesor'); END;
CREATE TRIGGER teacher_overlap_update BEFORE UPDATE OF starts_at,ends_at,teacher_id,status ON sessions WHEN NEW.status NOT IN ('cancelled','rescheduled') AND EXISTS(SELECT 1 FROM sessions s WHERE s.id<>NEW.id AND s.teacher_id=NEW.teacher_id AND s.status NOT IN ('cancelled','rescheduled') AND s.starts_at<NEW.ends_at AND s.ends_at>NEW.starts_at) BEGIN SELECT RAISE(ABORT,'El horario se solapa con otra clase del profesor'); END;
CREATE TRIGGER student_overlap_insert BEFORE INSERT ON student_slots WHEN EXISTS(SELECT 1 FROM student_slots s WHERE s.student_id=NEW.student_id AND s.starts_at<NEW.ends_at AND s.ends_at>NEW.starts_at AND s.session_id<>NEW.session_id) BEGIN SELECT RAISE(ABORT,'El horario se solapa con otra reserva del alumno'); END;
CREATE TRIGGER enrollment_guard BEFORE INSERT ON group_enrollments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.student_id AND role='student' AND profile_completed_at IS NOT NULL) THEN RAISE(ABORT,'Completa tu perfil de alumno') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM groups g JOIN teacher_profiles t ON t.user_id=g.teacher_id WHERE g.id=NEW.group_id AND g.status IN ('published','pending','confirmed') AND t.status='active' AND t.published=1 AND g.enrollment_deadline>strftime('%Y-%m-%dT%H:%M:%fZ','now')) THEN RAISE(ABORT,'El grupo no admite nuevas reservas') END;
 SELECT CASE WHEN (SELECT count(*) FROM group_enrollments WHERE group_id=NEW.group_id AND status IN ('reserved','awaiting_payment','active','leaving')) >= (SELECT capacity FROM groups WHERE id=NEW.group_id) THEN RAISE(ABORT,'No quedan plazas') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM sessions a JOIN sessions b ON a.starts_at<b.ends_at AND a.ends_at>b.starts_at JOIN group_enrollments e ON e.group_id=b.group_id WHERE a.group_id=NEW.group_id AND e.student_id=NEW.student_id AND e.status IN ('reserved','awaiting_payment','active','leaving') AND a.status NOT IN ('cancelled','rescheduled') AND b.status NOT IN ('cancelled','rescheduled')) THEN RAISE(ABORT,'El horario se solapa con otra reserva del alumno') END;
END;
CREATE TRIGGER enrollment_confirm AFTER INSERT ON group_enrollments BEGIN
 UPDATE groups SET status=CASE WHEN (SELECT count(*) FROM group_enrollments e WHERE e.group_id=NEW.group_id AND e.status IN ('reserved','awaiting_payment','active','leaving'))>=min_students THEN 'confirmed' ELSE 'pending' END WHERE id=NEW.group_id;
 UPDATE group_enrollments SET status='awaiting_payment' WHERE group_id=NEW.group_id AND status='reserved' AND (SELECT status FROM groups WHERE id=NEW.group_id)='confirmed';
 INSERT INTO student_slots(enrollment_id,student_id,session_id,starts_at,ends_at) SELECT e.id,e.student_id,s.id,s.starts_at,s.ends_at FROM group_enrollments e JOIN sessions s ON s.group_id=e.group_id WHERE e.group_id=NEW.group_id AND e.status='awaiting_payment' AND s.status='scheduled' ON CONFLICT(student_id,session_id) DO NOTHING;
 INSERT INTO notifications(user_id,title,body,dedupe_key) SELECT student_id,'Grupo confirmado','Consulta las fechas en tu panel. Tu reserva no ha generado ningún cobro.','confirmed:'||id FROM group_enrollments WHERE group_id=NEW.group_id AND status='awaiting_payment' ON CONFLICT(dedupe_key) DO NOTHING;
END;
CREATE TRIGGER review_guard BEFORE INSERT ON reviews WHEN NOT EXISTS(SELECT 1 FROM group_enrollments e JOIN attendance a ON a.student_id=e.student_id JOIN sessions s ON s.id=a.session_id AND s.group_id=e.group_id WHERE e.id=NEW.enrollment_id AND a.status='present' AND s.status='taught') BEGIN SELECT RAISE(ABORT,'Solo puedes valorar después de asistir a una clase impartida'); END;
CREATE TRIGGER attendance_guard BEFORE INSERT ON attendance WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN group_enrollments e ON e.group_id=s.group_id WHERE s.id=NEW.session_id AND s.status='taught' AND e.student_id=NEW.student_id AND e.status IN ('active','leaving')) BEGIN SELECT RAISE(ABORT,'No se puede registrar asistencia para esta relación académica'); END;

CREATE TRIGGER teacher_status_continuity BEFORE UPDATE OF status ON teacher_profiles WHEN NEW.status IN ('paused','suspended','departed') AND EXISTS(SELECT 1 FROM sessions s JOIN group_enrollments e ON e.group_id=s.group_id WHERE s.teacher_id=NEW.user_id AND s.starts_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND e.status IN ('active','leaving','awaiting_payment')) BEGIN SELECT RAISE(ABORT,'Gestiona la continuidad de las clases antes de cambiar el estado del profesor'); END;
CREATE TRIGGER application_closed BEFORE UPDATE OF status ON teacher_applications WHEN OLD.status IN ('approved','rejected','withdrawn') BEGIN SELECT RAISE(ABORT,'El expediente ya está cerrado'); END;
CREATE TRIGGER session_vacation BEFORE INSERT ON sessions WHEN EXISTS(SELECT 1 FROM teacher_time_off o WHERE o.teacher_id=NEW.teacher_id AND o.approved=1 AND o.starts_at<NEW.ends_at AND o.ends_at>NEW.starts_at) BEGIN SELECT RAISE(ABORT,'El calendario coincide con vacaciones aprobadas'); END;
