CREATE TABLE "event_members" (
	"event_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_members_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"event_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"gallery_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "galleries_gallery_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone,
	"pin_hash" text NOT NULL,
	"public_token" text NOT NULL,
	"created_by" bigint NOT NULL,
	"published_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "galleries_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "galleries_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "galleries_status_check" CHECK ("galleries"."status" IN ('draft', 'published')),
	CONSTRAINT "galleries_published_consistency_check" CHECK (("galleries"."status" = 'published' AND "galleries"."published_at" IS NOT NULL) OR ("galleries"."status" = 'draft'))
);
--> statement-breakpoint
CREATE TABLE "gallery_photos" (
	"gallery_id" bigint NOT NULL,
	"photo_id" bigint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_photos_gallery_id_photo_id_pk" PRIMARY KEY("gallery_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"photo_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "photos_photo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" bigint NOT NULL,
	"uploaded_by" bigint NOT NULL,
	"filename" text NOT NULL,
	"s3_key" text NOT NULL,
	"file_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"photo_status" text NOT NULL,
	"content_type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_file_size_check" CHECK ("photos"."file_size" >= 0),
	CONSTRAINT "photos_status_check" CHECK ("photos"."photo_status" IN ('pending', 'uploaded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('admin', 'team_member'))
);
--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_gallery_id_galleries_gallery_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("gallery_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_photo_id_photos_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("photo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_events_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("event_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_users_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_event_members_user_id" ON "event_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_events_created_by" ON "events" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_galleries_created_by" ON "galleries" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_gallery_photos_photo_id" ON "gallery_photos" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "idx_photos_event_id" ON "photos" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_photos_uploaded_by" ON "photos" USING btree ("uploaded_by");