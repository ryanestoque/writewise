# WriteWise email timer

A Node 24 process makes one authenticated request to the existing FastAPI email
dispatcher, validates its aggregate result, then exits. No packages are installed.
This process has no Supabase/Resend keys, backend imports or resident model.

Run disabled from the repository root:

```sh
node ops/email-dispatch/dispatch.mjs
node --test ops/email-dispatch/dispatch.test.mjs
```

The script reads process environment only. It does not automatically load
`.env.example`, the backend `.env`, or any dotenv file.

| Variable | Meaning |
|---|---|
| `WRITEWISE_EMAIL_SCHEDULER_ENABLED` | `true` or `false`, default false. Disabled mode exits without network access. |
| `WRITEWISE_BACKEND_ORIGIN` | Plain HTTPS origin of the intended hosted backend. No credentials, path, query or fragment. |
| `EMAIL_DISPATCH_SECRET` | Privately configured value matching the backend's secret, at least 32 non-whitespace printable ASCII characters. |
| `WRITEWISE_ALLOW_LOCALHOST` | `true` or `false`, default false. Explicitly permits literal HTTP loopback for controlled local checks only. |

Configure Railway as a **separate scheduled service**, with root directory
`ops/email-dispatch`, its Dockerfile and `railway.toml`. Use no inbound port,
healthcheck, volume or backend start command. Set only the settings above through
private variables; never include credentials in command text or the schedule.
The service runs every five minutes and exits. Restart policy NEVER is deliberate:
hosting restarts must not create automatic HTTP retries. Railway scheduling is
not precise to the minute; a still-running prior execution may skip a tick.

Default configuration is disabled. A hosted service cannot reach a developer PC's
localhost. Configure/enable it only after the retirement migration, intended
backend environment, recipient scope, sender/tracking settings and deployment
authorization have been checked. The normal endpoint can process any eligible
recipient in its queue; there is no recipient filter here.

The caller POSTs `{}` to `/api/internal/dispatch-emails`, sends the secret only as
`X-Dispatch-Secret`, refuses redirects, does not retry, and has a 30-second budget
including a maximum 16 KiB response body. The backend still owns all message
eligibility, provider requests and durable retries. It must also be separately
enabled before authenticated dispatch succeeds.

| Exit | Output |
|---|---|
| 0 | `dispatch_disabled`, or `dispatch_ok` plus validated counts |
| 1 | `dispatch_timeout`, `dispatch_network`, `dispatch_http`, or `dispatch_response` |
| 2 | `dispatch_configuration` |

Each run prints one JSON line with fixed codes and, on success, the five aggregate
counts. Backend failed/retried counts are valid acknowledged results and exit 0.
Counts are not evidence of inbox receipt. Output excludes secrets, URLs, raw
response/error text, addresses and provider message IDs.

To pause, disable this service's caller flag and backend dispatch. Preserve pending
rows and the separate database deadline sweep. Do not restore the retired pg_net
HTTP path as a rollback. See `docs/DEPLOYMENT.md` for the operational procedure.
