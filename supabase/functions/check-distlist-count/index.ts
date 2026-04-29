import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('bullhorn_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: 'No Bullhorn tokens found', details: tokenErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const targetListId = Number(body?.listId ?? 2895)
    const targetStart = Number(body?.start ?? 0)
    const targetCount = Number(body?.count ?? 500)

    const restUrl = tokenRow.rest_url
    const bhRestToken = tokenRow.bh_rest_token

    const safeJson = async (res: Response) => {
      const text = await res.text()
      try { return { ok: res.ok, status: res.status, data: JSON.parse(text) } }
      catch { return { ok: res.ok, status: res.status, data: null, raw: text.slice(0, 300) } }
    }

    const listRes = await fetch(`${restUrl}entity/DistributionList/${targetListId}?fields=id,name,description&BhRestToken=${bhRestToken}`)
    const listResult = await safeJson(listRes)

    const membersRes = await fetch(`${restUrl}entity/DistributionList/${targetListId}/members?fields=id,firstName,lastName&count=${targetCount}&start=${targetStart}&BhRestToken=${bhRestToken}`)
    const membersResult = await safeJson(membersRes)

    const membersData = membersResult.data
    return new Response(JSON.stringify({
      list: listResult.data ?? listResult,
      start: membersData?.start,
      returnedCountField: membersData?.count,
      dataLength: Array.isArray(membersData?.data) ? membersData.data.length : 0,
      sampleFirst10: Array.isArray(membersData?.data) ? membersData.data.slice(0, 10) : [],
      raw: membersResult.raw,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const err = e as any
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
