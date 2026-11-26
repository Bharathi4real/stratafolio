CREATE TABLE "stat_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"slug" text,
	"visitor" text NOT NULL,
	"referrer" text,
	"country" text,
	"device" text,
	"depth" integer,
	"seconds" integer
);
--> statement-breakpoint
CREATE TABLE "stat_salts" (
	"day" text PRIMARY KEY NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stat_events_at" ON "stat_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "stat_events_slug_at" ON "stat_events" USING btree ("slug","at");--> statement-breakpoint
CREATE INDEX "stat_events_type_at" ON "stat_events" USING btree ("type","at");