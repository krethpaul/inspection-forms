# Inspection forms

Self-hosted inspection form pages that post into a form backend, plus a small
function that emails a PDF of the finished inspection.

## Layout

    public/                     everything served on the site
      index.html                chooser page listing the forms
      _headers                  adds X-Robots-Tag: noindex
      <slug>/index.html         one folder per form
    netlify/functions/
      send-report.mjs           emails the finished PDF
    netlify.toml                publish directory and functions directory

## Deploying

Push to `main`. Netlify builds and publishes automatically; there is no build
step, it copies `public/` and bundles the function.

## Configuration

The function reads its settings from environment variables set in the Netlify
UI, never from this repository:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key for the mail provider (marked secret) |
| `REPORT_RECIPIENTS` | Comma-separated addresses that receive the PDF |
| `REPORT_FROM` | Optional sender override |

Changing who receives a report is an environment-variable edit plus a redeploy,
not a code change.

## How a form page works

Each page is one self-contained HTML file. On submit it posts the answers to the
form backend, then builds a PDF in the browser and posts that to
`/.netlify/functions/send-report`, which emails it. The two paths are
independent: if the email fails, the submission still went through.

Operational details — form identifiers, alert thresholds, recipients, phone
numbers — are deliberately not documented here. They live in the private
operations runbook.
