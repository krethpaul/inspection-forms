// Emails a finished inspection PDF. Called by the form page after a successful submission.
// Requires two Netlify environment variables:
//   RESEND_API_KEY     - the API key from resend.com
//   REPORT_RECIPIENTS  - comma-separated list of addresses to send to
// Optional:
//   REPORT_FROM        - sender, defaults to "Shorty Small's Inspections <paul@hatchtable.com>"

const ALLOWED_ORIGINS = [
  'https://forms.inspectionreadykitchens.com'
];

const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB of base64; keeps us under Netlify's payload ceiling
const MIN_PDF_BYTES = 400;                // anything smaller is not a real report

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  });

export default async (req) => {
  const origin = req.headers.get('origin') || '';

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': ALLOWED_ORIGINS.includes(origin) ? origin : '',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // Require the request to come from the form site. A browser cannot forge
  // Origin, so this stops anything driven from another page; it does not stop a
  // handcrafted request from a script.
  const referer = req.headers.get('referer') || '';
  const fromSite =
    ALLOWED_ORIGINS.includes(origin) ||
    (!origin && ALLOWED_ORIGINS.some((o) => referer.startsWith(o + '/')));
  if (!fromSite) return json(403, { error: 'Forbidden' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return json(500, { error: 'Mail is not configured' });

  const to = (process.env.REPORT_RECIPIENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) return json(500, { error: 'No recipients configured' });

  const from = process.env.REPORT_FROM || "Shorty Small's Inspections <paul@hatchtable.com>";

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Bad request' });
  }

  const pdf = typeof body.pdf === 'string' ? body.pdf : '';
  if (!pdf) return json(400, { error: 'Missing report' });
  if (pdf.length > MAX_PDF_BYTES) return json(413, { error: 'Report too large' });
  if (pdf.length < MIN_PDF_BYTES) return json(400, { error: 'Report too small' });

  // Base64 of a real PDF always begins "JVBERi0x" (%PDF-1). This refuses any
  // other payload rather than forwarding it as an attachment.
  if (!/^JVBERi0x/.test(pdf)) return json(400, { error: 'Not a PDF' });
  if (!/^[A-Za-z0-9+/=\s]+$/.test(pdf)) return json(400, { error: 'Malformed report' });

  // Everything below is derived server-side or sanitised — nothing from the
  // request decides who the mail goes to.
  const clean = (v, max) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, max);

  const formName = clean(body.formName || 'Inspection', 80);
  const inspector = clean(body.inspector || 'Unknown', 80);
  const when = clean(body.when || '', 40);
  const filename = (clean(body.filename || 'inspection', 60).replace(/[^A-Za-z0-9._-]/g, '-')) + '.pdf';

  const flags = Array.isArray(body.flags) ? body.flags.slice(0, 30).map((f) => clean(f, 140)) : [];

  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const flagHtml = flags.length
    ? `<p style="margin:0 0 6px;font-weight:600;color:#a5341f">${flags.length} item${
        flags.length === 1 ? '' : 's'
      } need attention:</p><ul style="margin:0 0 18px;padding-left:20px;color:#a5341f">${flags
        .map((f) => `<li>${esc(f)}</li>`)
        .join('')}</ul>`
    : `<p style="margin:0 0 18px;color:#167a48;font-weight:600">All items passed.</p>`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#1e2420;line-height:1.5">
<p style="margin:0 0 4px;font-size:17px;font-weight:600">${esc(formName)}</p>
<p style="margin:0 0 18px;color:#66706a">Completed by ${esc(inspector)}${when ? ' on ' + esc(when) : ''}</p>
${flagHtml}
<p style="margin:0;color:#66706a;font-size:13px">The full report is attached as a PDF.</p>
</div>`;

  const subject = `${formName} - ${when || 'completed'}${flags.length ? ' - ' + flags.length + ' item(s) need attention' : ''}`;

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        attachments: [{ filename, content: pdf }]
      })
    });
  } catch (e) {
    return json(502, { error: 'Mail service unreachable' });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.log('Resend error', res.status, detail);
    return json(502, { error: 'Mail service rejected the message', status: res.status });
  }

  return json(200, { ok: true, sent: to.length });
};
