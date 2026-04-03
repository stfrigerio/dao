ALTER TABLE "projects" ADD COLUMN "linear_project_id" text;
ALTER TABLE "objectives" RENAME COLUMN "linear_project_id" TO "linear_milestone_id";
