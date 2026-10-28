import { pgTable, uuid, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import type { Role } from './domain';
/** Proyección ORM del núcleo. Las migraciones SQL conservan todas las restricciones. */
export const usersTable = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 254 }).unique(),
  lichessId: text('lichess_id').unique(),
  lichessUsername: varchar('lichess_username', { length: 100 }),
  profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),
  role: text().$type<Role>().notNull().default('student'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const authSessionsTable = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const teacherProfilesTable = pgTable('teacher_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => usersTable.id),
  headline: varchar({ length: 160 }).notNull(),
  bio: text().notNull(),
  published: boolean().notNull().default(false),
  teacherBps: integer('teacher_bps').notNull().default(5000),
  cycle: integer().notNull().default(1),
  status: text().notNull().default('active'),
});
