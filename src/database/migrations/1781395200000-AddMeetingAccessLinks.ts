import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetingAccessLinks1781395200000 implements MigrationInterface {
  name = 'AddMeetingAccessLinks1781395200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meeting_access_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "meeting_id" uuid NOT NULL,
        "token_hash" varchar NOT NULL,
        "label" varchar,
        "expires_at" timestamp NOT NULL,
        "revoked_at" timestamp,
        "max_uses" integer,
        "use_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_access_link_meeting"
          FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_access_link_meeting"
      ON "meeting_access_links" ("meeting_id", "expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "meeting_access_links"`);
  }
}
