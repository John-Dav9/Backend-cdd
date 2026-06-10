import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1717977600000 implements MigrationInterface {
  name = 'BaselineSchema1717977600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    const tables = [
      `CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL, "full_name" varchar, "role" varchar NOT NULL DEFAULT 'user',
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "first_name" varchar NOT NULL,
        "last_name" varchar NOT NULL, "email" varchar NOT NULL UNIQUE, "phone" varchar,
        "city" varchar, "role" varchar NOT NULL DEFAULT 'member',
        "is_active" boolean NOT NULL DEFAULT true, "source" varchar NOT NULL DEFAULT 'registration',
        "created_at" timestamp NOT NULL DEFAULT now(), "last_login_at" timestamp
      )`,
      `CREATE TABLE IF NOT EXISTS "actualites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titre" varchar NOT NULL, "contenu" text,
        "auteur" varchar, "publiee" boolean NOT NULL DEFAULT false, "tags" jsonb NOT NULL DEFAULT '[]',
        "image_url" varchar, "video_id" varchar, "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "annonces" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titre" varchar NOT NULL, "contenu" text NOT NULL,
        "publiee" boolean NOT NULL DEFAULT false, "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" varchar, "user_email" varchar,
        "action" varchar NOT NULL, "resource_type" varchar, "resource_id" varchar, "details" jsonb,
        "ip_address" varchar, "created_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "bibliotheque" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titre" varchar NOT NULL, "auteur" varchar,
        "description" text, "categorie" varchar, "pdf_url" varchar NOT NULL, "pdf_path" varchar NOT NULL,
        "cover_url" varchar, "cover_path" varchar, "created_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "cell_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" varchar NOT NULL, "description" text,
        "leader_id" varchar, "leader_name" varchar, "memberIds" text, "jitsi_room_id" varchar,
        "meeting_day" varchar, "meeting_time" varchar, "isActive" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "community_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "is_open" boolean NOT NULL DEFAULT true,
        "updated_at" timestamp NOT NULL DEFAULT now(), "updated_by" uuid
      )`,
      `CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "key" varchar NOT NULL UNIQUE,
        "subject" varchar NOT NULL, "body" text NOT NULL, "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "inscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "type" varchar NOT NULL, "nom" varchar NOT NULL,
        "prenom" varchar NOT NULL, "email" varchar NOT NULL, "telephone" varchar, "date_culte" varchar,
        "pseudo_telegram" varchar, "departement" varchar, "enfant_prenom" varchar, "enfant_age" varchar,
        "universite" varchar, "type_voix" varchar, "statut" varchar NOT NULL DEFAULT 'CONFIRME',
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "marathons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titre" varchar NOT NULL, "description" text,
        "date_debut" varchar NOT NULL, "date_fin" varchar NOT NULL, "scope" varchar NOT NULL,
        "livres_choisis" jsonb NOT NULL DEFAULT '[]', "nb_jours" integer,
        "statut" varchar NOT NULL DEFAULT 'PLANIFIE', "plan_lecture" jsonb NOT NULL DEFAULT '[]',
        "nb_inscrits" integer NOT NULL DEFAULT 0, "flyer_url" varchar,
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "marathon_inscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "marathon_id" uuid NOT NULL,
        "full_name" varchar NOT NULL, "email" varchar NOT NULL, "phone" varchar, "city" varchar,
        "progress" jsonb NOT NULL DEFAULT '{}', "progress_percent" decimal(5,2) NOT NULL DEFAULT 0,
        "milestones_reached" jsonb NOT NULL DEFAULT '[]', "current_streak" integer NOT NULL DEFAULT 0,
        "max_streak" integer NOT NULL DEFAULT 0, "last_activity_at" varchar,
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "meetings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "title" varchar NOT NULL, "description" text,
        "start_time" timestamp NOT NULL, "end_time" timestamp, "is_public" boolean NOT NULL DEFAULT true,
        "is_recurring" boolean NOT NULL DEFAULT false, "lobby_enabled" boolean NOT NULL DEFAULT false,
        "recurrence_rule" varchar,
        "recurrence_series_id" varchar, "jitsi_room_id" varchar NOT NULL UNIQUE,
        "status" varchar NOT NULL DEFAULT 'scheduled', "created_by" uuid, "recording_path" varchar,
        "participant_count" integer NOT NULL DEFAULT 0, "created_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "meeting_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "meeting_id" uuid NOT NULL, "member_id" uuid,
        "display_name" varchar NOT NULL, "jitsi_participant_id" varchar,
        "joined_at" timestamp NOT NULL DEFAULT now(), "left_at" timestamp, "last_seen_at" timestamp,
        "was_admin" boolean NOT NULL DEFAULT false, "admission_status" varchar NOT NULL DEFAULT 'admitted',
        "admitted_at" timestamp, "reconnect_token" varchar,
        "disconnect_count" integer NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "title" varchar NOT NULL, "speaker" varchar NOT NULL,
        "date" date NOT NULL, "video_id" varchar NOT NULL, "publie" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar NOT NULL UNIQUE,
        "prenom" varchar, "created_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "otp_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar NOT NULL, "code" varchar NOT NULL,
        "type" varchar NOT NULL, "expires_at" timestamp NOT NULL, "used_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "prieres" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "prenom" varchar NOT NULL,
        "anonyme" boolean NOT NULL DEFAULT false, "sujet" varchar NOT NULL, "message" text NOT NULL,
        "email" varchar, "statut" varchar NOT NULL DEFAULT 'en_attente',
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "recordings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "meetingId" varchar, "title" varchar NOT NULL,
        "description" text, "speakerName" varchar, "video_url" varchar, "thumbnail_url" varchar,
        "duration_seconds" integer, "tags" jsonb NOT NULL DEFAULT '[]',
        "isPublic" boolean NOT NULL DEFAULT false, "published_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "member_id" uuid NOT NULL,
        "endpoint" varchar NOT NULL UNIQUE, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "settings" (
        "key" varchar PRIMARY KEY, "value" jsonb NOT NULL, "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS "temoignages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "nom" varchar NOT NULL, "contenu" text NOT NULL,
        "ville" varchar, "statut" varchar NOT NULL DEFAULT 'EN_ATTENTE',
        "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
    ];
    for (const sql of tables) await queryRunner.query(sql);

    await queryRunner.query(`ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "recurrence_series_id" varchar`);
    await queryRunner.query(`ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "lobby_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "meeting_participants" ADD COLUMN IF NOT EXISTS "jitsi_participant_id" varchar`);
    await queryRunner.query(`ALTER TABLE "meeting_participants" ADD COLUMN IF NOT EXISTS "admission_status" varchar NOT NULL DEFAULT 'admitted'`);
    await queryRunner.query(`ALTER TABLE "meeting_participants" ADD COLUMN IF NOT EXISTS "admitted_at" timestamp`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marathon_email" ON "marathon_inscriptions" ("marathon_id", "email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_otp_lookup" ON "otp_codes" ("email", "type", "expires_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_meeting_series" ON "meetings" ("recurrence_series_id", "start_time")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_participant_active" ON "meeting_participants" ("meeting_id", "left_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_participant_admission" ON "meeting_participants" ("meeting_id", "admission_status")`);

    await this.addForeignKey(queryRunner, 'community_settings', 'FK_community_updated_by',
      'FOREIGN KEY ("updated_by") REFERENCES "members"("id") ON DELETE SET NULL');
    await this.addForeignKey(queryRunner, 'meetings', 'FK_meeting_created_by',
      'FOREIGN KEY ("created_by") REFERENCES "members"("id") ON DELETE SET NULL');
    await this.addForeignKey(queryRunner, 'meeting_participants', 'FK_participant_meeting',
      'FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE');
    await this.addForeignKey(queryRunner, 'meeting_participants', 'FK_participant_member',
      'FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL');
    await this.addForeignKey(queryRunner, 'push_subscriptions', 'FK_push_member',
      'FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'push_subscriptions', 'meeting_participants', 'meetings', 'community_settings', 'otp_codes', 'recordings',
      'cell_groups', 'audit_logs', 'marathon_inscriptions', 'marathons', 'newsletter_subscribers',
      'bibliotheque', 'email_templates', 'inscriptions', 'actualites', 'annonces', 'messages',
      'prieres', 'temoignages', 'settings', 'members', 'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }

  private async addForeignKey(
    queryRunner: QueryRunner,
    table: string,
    constraint: string,
    definition: string,
  ) {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraint}') THEN
          ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" ${definition};
        END IF;
      END $$;
    `);
  }
}
