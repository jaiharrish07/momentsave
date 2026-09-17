-- Scope team members to the admin who created them.
--
-- Nullable so admins (self-registered) have created_by_admin_id = NULL.
-- Existing team members created before this migration are also NULL —
-- they become orphaned and won't appear in any admin's list until an
-- admin adopts them (out of scope; can be done via a manual UPDATE).
ALTER TABLE "users" ADD COLUMN "created_by_admin_id" bigint;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_admin_id_fk"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."users"("user_id")
  ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_users_created_by_admin_id"
  ON "users" USING btree ("created_by_admin_id");
