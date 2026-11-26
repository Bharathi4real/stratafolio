# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue.

Include what you found, how to reproduce it, and the impact you expect. You'll get a reply within a few days, and a fix or a plan as soon as the issue is confirmed. Reporters are credited in the release notes unless they'd rather not be.

## Supported versions

Fixes go into the latest release on `main`.

## What's in scope

The admin (authentication, roles, Server Actions), uploads and media storage, the public site and its APIs (`/api/*`), and the defaults shipped in `next.config.ts` (CSP and security headers).

Issues in third-party services (Vercel, Neon, Cloudflare R2, Resend) should go to those providers.
