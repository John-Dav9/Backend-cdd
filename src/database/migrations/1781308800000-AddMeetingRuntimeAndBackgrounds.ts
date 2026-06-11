import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetingRuntimeAndBackgrounds1781308800000 implements MigrationInterface {
  name = 'AddMeetingRuntimeAndBackgrounds1781308800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meeting_runtime_states" (
        "meeting_id" uuid PRIMARY KEY,
        "spiritual_event" jsonb,
        "active_poll" jsonb,
        "poll_votes" jsonb NOT NULL DEFAULT '{}',
        "media_state" jsonb NOT NULL DEFAULT '{}',
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_runtime_meeting"
          FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spiritual_backgrounds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar NOT NULL UNIQUE,
        "label" varchar NOT NULL,
        "image_url" varchar,
        "gradient" varchar,
        "text_color" varchar NOT NULL DEFAULT '#ffffff',
        "overlay_color" varchar NOT NULL DEFAULT 'rgba(0,0,0,0.35)',
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "spiritual_backgrounds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "meeting_runtime_states"`);
  }
}
