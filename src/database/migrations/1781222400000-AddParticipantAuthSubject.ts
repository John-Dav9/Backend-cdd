import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParticipantAuthSubject1781222400000 implements MigrationInterface {
  name = 'AddParticipantAuthSubject1781222400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "meeting_participants"
      ADD COLUMN IF NOT EXISTS "auth_subject" varchar
    `);

    // Keep only the latest active legacy row for a non-member moderator.
    await queryRunner.query(`
      WITH duplicates AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "meeting_id", LOWER(TRIM("display_name"))
            ORDER BY "last_seen_at" DESC NULLS LAST, "joined_at" DESC, "id" DESC
          ) AS row_number
        FROM "meeting_participants"
        WHERE "member_id" IS NULL
          AND "was_admin" = true
          AND "left_at" IS NULL
          AND "admission_status" = 'admitted'
      )
      UPDATE "meeting_participants" participant
      SET "left_at" = NOW()
      FROM duplicates
      WHERE participant."id" = duplicates."id"
        AND duplicates.row_number > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_meeting_participant_auth_subject"
      ON "meeting_participants" ("meeting_id", "auth_subject")
      WHERE "auth_subject" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_meeting_participant_auth_subject"
    `);
    await queryRunner.query(`
      ALTER TABLE "meeting_participants"
      DROP COLUMN IF EXISTS "auth_subject"
    `);
  }
}
