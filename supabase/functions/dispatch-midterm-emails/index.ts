import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('MIDTERM_EMAIL_FROM');
  if (!projectUrl || !serviceKey || !resendKey || !fromAddress) {
    return Response.json({ error: 'Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and MIDTERM_EMAIL_FROM.' }, { status: 503, headers: corsHeaders });
  }
  if (request.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return Response.json({ error: 'Unauthorized worker request.' }, { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(projectUrl, serviceKey, { auth: { persistSession: false } });
  const { data: notifications, error: queryError } = await supabase
    .from('midterm_notification_outbox')
    .select('id, recipient_email, event_type, payload')
    .is('delivered_at', null)
    .not('recipient_email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (queryError) return Response.json({ error: queryError.message }, { status: 500, headers: corsHeaders });

  let sent = 0;
  const failures: Array<{ id: string; error: string }> = [];
  for (const item of notifications ?? []) {
    const details = Object.entries(item.payload ?? {})
      .filter(([key]) => key !== 'action_options')
      .map(([key, value]) => `<li><strong>${escapeHtml(key.replace(/_/g, ' '))}:</strong> ${escapeHtml(value)}</li>`)
      .join('');
    const actions = Array.isArray(item.payload?.action_options)
      ? `<p>Available actions: ${escapeHtml(item.payload.action_options.join(', '))}. Sign in to the Dean workspace to review.</p>`
      : '';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: [item.recipient_email],
        subject: `G.S. Gacuba Mid-Term: ${String(item.event_type).replace(/_/g, ' ')}`,
        html: `<p>A mid-term workspace update is ready for review.</p><ul>${details}</ul>${actions}<p>Open the school administration portal to take action.</p>`,
      }),
    });
    if (!response.ok) {
      failures.push({ id: item.id, error: `Email provider returned ${response.status}.` });
      continue;
    }
    const { error: updateError } = await supabase.from('midterm_notification_outbox')
      .update({ delivered_at: new Date().toISOString() }).eq('id', item.id);
    if (updateError) failures.push({ id: item.id, error: updateError.message });
    else sent += 1;
  }

  return Response.json({ sent, failed: failures.length, failures }, { headers: corsHeaders });
});
