-- Lichess es el único proveedor de acceso. No se enlazan cuentas por email.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN lichess_id text UNIQUE;
ALTER TABLE users ADD COLUMN lichess_username varchar(100);
ALTER TABLE users ADD COLUMN profile_completed_at timestamptz;
ALTER TABLE users ADD COLUMN profile_kind text CHECK(profile_kind IN ('student','teacher'));
ALTER TABLE users ADD COLUMN privacy_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN privacy_version text;
CREATE UNIQUE INDEX users_lichess_id_ci ON users(lower(lichess_id)) WHERE lichess_id IS NOT NULL;
-- Revocar sesiones y tokens anteriores: ningún acceso heredado por contraseña permanece activo.
DELETE FROM auth_sessions;
DELETE FROM auth_tokens;
UPDATE users SET password_hash=NULL;
