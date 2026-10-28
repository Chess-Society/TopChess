-- Aditiva: conserva pagos previos; no migra tarjetas ni ejecuta cargos.
ALTER TABLE groups ADD COLUMN billing_model TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE billing_cycles ADD COLUMN collection_state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE subscriptions ADD COLUMN billing_model TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE subscriptions ADD COLUMN setup_completed_at TEXT;
ALTER TABLE subscriptions ADD COLUMN payment_method_id TEXT;
ALTER TABLE subscriptions ADD COLUMN billing_start_at TEXT;
ALTER TABLE subscriptions ADD COLUMN billing_end_at TEXT;
ALTER TABLE subscriptions ADD COLUMN checkout_generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN checkout_expires_at TEXT;
ALTER TABLE subscriptions ADD COLUMN checked_at TEXT;
ALTER TABLE subscriptions ADD COLUMN schedule_id TEXT;
CREATE UNIQUE INDEX subscriptions_schedule ON subscriptions(schedule_id);
ALTER TABLE payments ADD COLUMN period_start TEXT;
ALTER TABLE payments ADD COLUMN period_end TEXT;
ALTER TABLE payments ADD COLUMN invoice_number TEXT;
ALTER TABLE payments ADD COLUMN invoice_date TEXT;
ALTER TABLE payments ADD COLUMN invoice_pdf TEXT;
ALTER TABLE payments ADD COLUMN tax_cents INTEGER;
ALTER TABLE payouts ADD COLUMN payment_reference TEXT;
ALTER TABLE payouts ADD COLUMN paid_at TEXT;
CREATE TABLE billing_actions(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('cancel','stop_renewal','refund')), subscription_id TEXT NOT NULL REFERENCES subscriptions(id), invoice_id TEXT, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE manual_payout_items(payout_id TEXT NOT NULL REFERENCES payouts(id), ledger_id TEXT NOT NULL UNIQUE REFERENCES ledger_entries(id), PRIMARY KEY(payout_id,ledger_id));
CREATE TABLE teacher_earnings(ledger_id TEXT PRIMARY KEY REFERENCES ledger_entries(id),teacher_id TEXT NOT NULL REFERENCES teacher_profiles(user_id),earned_at TEXT NOT NULL);
CREATE TABLE teacher_bank_accounts(teacher_id TEXT PRIMARY KEY REFERENCES teacher_profiles(user_id),holder TEXT NOT NULL,iban_encrypted TEXT NOT NULL,last_four TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TRIGGER monthly_enrollment_guard BEFORE INSERT ON group_enrollments WHEN (SELECT billing_model FROM groups WHERE id=NEW.group_id)='calendar_month'
BEGIN
 SELECT CASE WHEN (SELECT substr(first_at,1,7) FROM groups WHERE id=NEW.group_id)<>strftime('%Y-%m','now','start of month','+1 month') THEN RAISE(ABORT,'La incorporación es para el mes siguiente') END;
END;
