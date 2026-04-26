# USDT Mine Auth + Dashboard

This project is a static frontend designed for GitHub + Vercel, with authentication and user data handled by Supabase.

## Pages

- `index.html` - landing page
- `signup.html` - signup with name, username, email, and password
- `login.html` - login with username or email + password
- `forgot-password.html` - password reset request page
- `account.html` - personal account dashboard

## Supabase files

- `supabase-config.js` - paste your Supabase URL and anon key here
- `supabase-client.js` - Supabase client setup
- `auth-helpers.js` - shared auth and dashboard helpers
- `supabase-schema.sql` - tables, trigger, RPCs, and RLS policies

## What the system does

- Creates an email/password account with Supabase Auth
- Stores user profile data in Supabase Postgres
- Sends email verification after signup
- Sends password reset emails and completes recovery on `update-password.html`
- Supports login by username or email
- Builds a personal account page with:
  - name
  - username
  - email
  - account balance
  - pending deposit requests
  - pending withdrawal requests
  - recent activity

## Important production note

The auth system is real.

The deposit and withdrawal dashboard is a starter workflow only. It creates request records in Firestore, but it is not a real payment processor or admin settlement system yet. For production money movement, add:

- admin approval logic
- wallet/payment integration
- server-side validation
- protected admin tools

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run the contents of `supabase-schema.sql`.
3. Copy your project URL and anon key into `supabase-config.js`.
4. In `Authentication > URL Configuration`, set your Site URL and add your Vercel URL plus any local dev URL you use.
5. In `Authentication > Providers > Email`, keep email/password enabled and keep confirm email enabled if you want verification before login.
6. Customize the email templates if you want branded verification and recovery emails.

## Email verification and password reset flow

- Signup sends a Supabase verification email
- Forgot password sends a Supabase reset email
- Password recovery redirects the user to `update-password.html`, where they set a new password

## Local development

Use a local web server or your Vercel preview deployment.

Do not run the auth flow from `file://` URLs because Supabase Auth expects an `http://` or `https://` origin for a reliable setup.

## Deploy on Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Deploy as a static site.

## Official docs used

- Supabase install and CDN usage: https://supabase.com/docs/reference/javascript/installing
- Supabase password auth: https://supabase.com/docs/guides/auth/passwords
- Supabase sign up: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase sign in with password: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Supabase password reset: https://supabase.com/docs/reference/javascript/v1/auth-resetpasswordforemail
- Supabase auth events: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- Supabase update user: https://supabase.com/docs/reference/javascript/auth-updateuser
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase RLS: https://supabase.com/docs/guides/auth/auth-deep-dive/auth-row-level-security
