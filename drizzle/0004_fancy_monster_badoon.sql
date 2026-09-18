CREATE TABLE "discover_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"couple_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discover_swipes" (
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"decision" boolean NOT NULL,
	"swiped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discover_swipes_card_id_user_id_pk" PRIMARY KEY("card_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "discover_cards" ADD CONSTRAINT "discover_cards_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_cards" ADD CONSTRAINT "discover_cards_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_swipes" ADD CONSTRAINT "discover_swipes_card_id_discover_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."discover_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_swipes" ADD CONSTRAINT "discover_swipes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discover_cards_couple_id_idx" ON "discover_cards" USING btree ("couple_id");--> statement-breakpoint
CREATE INDEX "discover_swipes_user_id_idx" ON "discover_swipes" USING btree ("user_id");