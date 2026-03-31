ALTER TABLE "projects" ADD COLUMN "linear_api_key" text;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "linear_team_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN IF EXISTS "linear_project_id";
