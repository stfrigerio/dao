export function buildExecutionObjectivesPrompt(
	projectName: string,
	projectType: string,
	projectDescription: string | null,
	scope: string | null,
	planningContext: string | null
): string {
	return `You are generating the Execution phase work breakdown for "${projectName}".

Project: ${projectName}
Type: ${projectType}
${projectDescription ? `Description: ${projectDescription}` : ''}
${scope ? `\nProject Brief:\n${scope}` : ''}
${planningContext ? `\nPlanning phase specifications — this is the source of truth for what to build:\n${planningContext}` : ''}

## Your job

Read the planning specs. Produce objectives and tasks that a developer works through sequentially.

## Structure

**Objective** = a self-contained functional area. "Auth System", "Project CRUD & Phases", "Agent Pipeline", "Phase Panel UI". NOT a tech layer like "Backend" or "Frontend".

**Task** = one clearly scoped unit of work within the objective. A task should be:
- **Named precisely** — include the concrete thing being built: endpoint path, table name, component name, store name
- **Bounded** — it covers one thing, not a grab-bag. "POST /api/auth/login" not "auth endpoints"
- **Self-describing** — reading just the task name, a developer knows what to build without needing to re-read the full planning specs

## Task naming rules

Good task names (precise, bounded, self-describing):
- "users table — id, uuid, email, passwordHash, name, role, createdAt"
- "POST /api/auth/login — validate credentials, return JWT + refresh cookie"
- "POST /api/auth/refresh — reissue access token from httpOnly cookie"
- "requireAuth middleware — verify Bearer JWT, attach user to req"
- "useAuthStore — login(), logout(), fetchMe(), token persistence"
- "LoginPage component — email/password form, error display, redirect on success"
- "ProjectCard component — name, type badge, phase progress, click to detail"

Bad task names (vague, bundled, need re-reading specs to understand):
- "Auth system with JWT tokens and middleware" (that's 5 tasks)
- "Project and phase CRUD routes" (which endpoints? what do they do?)
- "Frontend application shell" (that's an entire page)
- "Database schema and migrations" (for which tables?)

## Rules

1. Generate as many objectives and tasks as the project needs. Do not compress.
2. One task = one endpoint, one table, one component, one store, one middleware, or one config concern.
3. Include key details from the specs in the task name (columns, params, return shapes).
4. Order tasks by dependency within each objective.
5. Do NOT include testing, documentation, code review, or CI/CD.

## Output format

Output ONLY a raw JSON array. No preamble, no explanation, no markdown fences.

[
  {
    "name": "Auth System",
    "tasks": [
      "users table — id, uuid, email, passwordHash, name, role enum (admin/member), createdAt",
      "POST /api/auth/login — validate email+password, return { accessToken, user }, set httpOnly refresh cookie",
      "POST /api/auth/refresh — verify refresh cookie, return new accessToken",
      "POST /api/auth/logout — clear refresh cookie",
      "GET /api/auth/me — return authenticated user profile",
      "requireAuth middleware — verify Bearer JWT, attach { userId, role } to req",
      "requireAdmin middleware — reject non-admin after requireAuth"
    ]
  }
]`;
}
