# SVM EdTech Admin

Private dashboard for SVM EdTech: schools, leads, billing, accounting, support queries and the vendor support login.
Node 22, Express, Neon Postgres (the database stays on Neon; only this app is hosted on GoDaddy).

## Settings (GoDaddy > app > Settings > Secrets, in BOTH Preview and Publish)

| Name | What it is |
|---|---|
| DATABASE_URL | The Neon connection string (copy it from the old Render service's Environment page) |
| CRON_SECRET | Copy from the old Render service, if it has one |
| MARKETING_SITE_ORIGIN | https://svmedtech.com,https://www.svmedtech.com (lets the website send enquiries into Leads) |
| RENDER_API_KEY | Optional. Only for the old Deploys panel on Render-hosted schools |

## What connects here
- svmedtech.com "Request a demo" form -> POST /api/public/leads -> Leads tab
- Every school's ERP -> heartbeat and error reports (VENDOR_DASHBOARD_URL, VENDOR_SCHOOL_ID, VENDOR_API_KEY in that school's Secrets)
- Schools tab -> Support Login opens a school's ERP for 10 minutes, no password needed
