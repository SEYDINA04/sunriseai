This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Scripts

| Command                 | Description                      |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Start the dev server             |
| `npm run build`         | Production build (`next build`)  |
| `npm run start`         | Serve the production build       |
| `npm run lint`          | ESLint                           |
| `npm run type-check`    | TypeScript (`tsc --noEmit`)      |
| `npm run format`        | Format all files with Prettier   |
| `npm run format:check`  | Verify formatting (used in CI)   |
| `npm run test`          | Run the Vitest unit suite        |
| `npm run test:watch`    | Vitest in watch mode             |
| `npm run test:coverage` | Run tests with a coverage report |

## CI/CD

Every push and pull request to `main` and `dev` runs the pipeline in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml). All gates run in parallel
and **must pass** before anything is deployed:

1. **Lint** — ESLint
2. **Type check** — `tsc --noEmit`
3. **Format** — `prettier --check`
4. **Test** — Vitest unit suite (with coverage)
5. **Build** — `next build`
6. **Security audit** — `npm audit --audit-level=high` (high/critical block; moderate is reported)

When — and only when — all gates pass **and** the event is a push to `main`, the
`deploy` job triggers the AWS Amplify production build via an incoming webhook.

### Required configuration

- **Repository secret** `AMPLIFY_WEBHOOK_URL` — the Amplify _Incoming webhook_ URL
  for the production branch (Amplify console → App settings → Build settings →
  Incoming webhooks). Disable Amplify's automatic branch build so this pipeline is
  the only deploy trigger. If this secret is not set, CI will skip the deploy step
  (with a warning) instead of failing.
- **Optional repository variable** `ASR_API_URL` — used at build time in CI; the
  runtime value is injected by Amplify (see `amplify.yml`).
- **Branch protection** on `main` and `dev`: require the **"All checks passed"**
  status check, and enable **Settings → General → Allow auto-merge**.

### Dependency updates

[`.github/dependabot.yml`](.github/dependabot.yml) opens weekly grouped update PRs
for npm packages and GitHub Actions against `dev`. Patch/minor and dev-dependency
updates are auto-merged by
[`.github/workflows/dependabot-auto-merge.yml`](.github/workflows/dependabot-auto-merge.yml)
once the full pipeline passes; major framework upgrades (Next.js/React) are left
for manual review.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
