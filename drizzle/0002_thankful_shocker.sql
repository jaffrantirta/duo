CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"on_date" date,
	"at_time" time,
	"status" text DEFAULT 'idea' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plans_couple_id_idx" ON "plans" USING btree ("couple_id");