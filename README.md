# Inspection Ready Kitchens - inspection forms

Self-hosted inspection form pages that post into Jotform without any Jotform branding,
served at https://forms.inspectionreadykitchens.com

## Layout

    public/                     everything served on the site
      index.html                chooser page listing the forms
      _headers                  adds X-Robots-Tag: noindex
      kitchen-walk/             M.K copy
      sample-inspection/        Shorty Small's sample inspection
      kb-kitchen-walk/          K.B copy
      food-truck-daily/         Shorty Small's Food Truck Daily Inspection
    netlify/functions/
      send-report.mjs           emails the finished PDF (food truck form)
    netlify.toml                tells Netlify what to publish and where functions live

## Deploying

Push to `main`. Netlify builds and publishes automatically - there is no build
step, it just copies `public/` and bundles the function.

## Environment variables (Netlify: Project configuration -> Environment variables)

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key from resend.com, used to send the report email |
| `REPORT_RECIPIENTS` | Comma-separated addresses that receive the PDF |
| `REPORT_FROM` | Optional. Defaults to `Shorty Small's Inspections <paul@hatchtable.com>` |

Changing who receives the report is an environment-variable edit, not a code change.

## How a form page works

Each page is one self-contained HTML file. On submit it posts the answers straight to
`submit.jotform.com`, so notifications, PDFs, the submissions table and Zapier all keep
working. The food truck page additionally builds a PDF in the browser and posts it to
`/.netlify/functions/send-report`, which emails it. If that email fails, the submission
still went through - the two are independent.

Hidden quality fields on the food truck form: `Time Spent` (seconds from first
interaction to submit), `Photo 1 Age` and `Photo 2 Age` (minutes old each photo file was
when attached). A Zap alerts on time under 240s or a photo older than 30 minutes.
