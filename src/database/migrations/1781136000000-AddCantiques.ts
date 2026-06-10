import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCantiques1781136000000 implements MigrationInterface {
  name = 'AddCantiques1781136000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cantiques" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "number" varchar,
        "author" varchar,
        "lyrics" text NOT NULL,
        "source" varchar,
        "rights_note" varchar,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cantiques_title" ON "cantiques" ("title")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cantiques"`);
  }
}
