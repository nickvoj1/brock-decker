import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  
  const { listId, contactIds } = await req.json()
  
  const { data: tokenRow } = await supabase
    .from('bullhorn_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!tokenRow) {
    return new Response(JSON.stringify({ error: 'No Bullhorn tokens found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const restUrl = tokenRow.rest_url
  const bhRestToken = tokenRow.bh_rest_token

  let addedCount = 0
  let failedCount = 0
  const errors: string[] = []

  // Individual PUT calls with minimal delay (50ms)
  for (let i = 0; i < contactIds.length; i++) {
    const cid = contactIds[i]
    try {
      const url = `${restUrl}entity/DistributionList/${listId}/members/${cid}?BhRestToken=${bhRestToken}`
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' } })
      if (res.ok) {
        await res.text()
        addedCount++
      } else {
        const errText = await res.text()
        failedCount++
        if (errors.length < 5) errors.push(`${cid}: ${res.status} ${errText.slice(0, 100)}`)
      }
    } catch (err: any) {
      failedCount++
      if (errors.length < 5) errors.push(`${cid}: ${err?.message}`)
    }

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${addedCount}/${i + 1} added, ${failedCount} failed`)
    }

    // Minimal delay to avoid rate limiting
    if (i < contactIds.length - 1) {
      await new Promise(r => setTimeout(r, 50))
    }
  }

  console.log(`Done: ${addedCount}/${contactIds.length} added, ${failedCount} failed`)

  // Verify
  await new Promise(r => setTimeout(r, 2000))
  let verifiedCount = 0
  try {
    const countUrl = `${restUrl}search/ClientContact?query=distributionLists.id:${listId}&fields=id&count=1&BhRestToken=${bhRestToken}`
    const countRes = await fetch(countUrl)
    if (countRes.ok) {
      const data = await countRes.json()
      verifiedCount = data?.total || data?.count || 0
    }
  } catch {}

  return new Response(JSON.stringify({
    listId,
    totalContacts: contactIds.length,
    addedCount,
    failedCount,
    verifiedCount,
    sampleErrors: errors
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
