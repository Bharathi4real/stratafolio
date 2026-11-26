# Contributing

Thanks for helping improve Stratafolio. Bug reports, fixes, docs and small features are all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Check [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), especially **Rules worth keeping**: they cover Cache Components and the design rules, and a PR that breaks them will be asked to change.

## Set up

```bash
bun install
docker compose up -d   # local Postgres
cp .env.example .env   # DATABASE_URL, AUTH_SECRET, SEED_ADMIN_EMAIL
bun run db:migrate
bun run seed
bun run dev
```

## Making a change

1. Create a branch from `main`.
2. Keep the change focused: one fix or feature per pull request.
3. Run `bun run check` (Biome + TypeScript) and `bun run build` before pushing. CI runs the same checks.
4. Schema changes: edit `db/schema.ts`, run `bun run db:generate`, and commit the new migration. Never edit a migration that has already shipped.
5. Keep code comments short, and only where the code can't explain itself.
6. Write commit messages as `type: summary`, for example `fix: keep the editor fields readable when a block is selected`. Common types: `feat`, `fix`, `perf`, `docs`, `chore`.

## Pull requests

Describe what changed and why, how you tested it, and add a screenshot for anything visual. Be kind in reviews; everyone here is volunteering their time.

## Security issues

Please don't open a public issue. See [SECURITY.md](SECURITY.md).
