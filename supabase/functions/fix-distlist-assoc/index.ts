import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  
  const { listId, contactIds, startAt = 0 } = await req.json()
  
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
  const idsToProcess = contactIds.slice(startAt)
  
  // Process 5 concurrent requests at a time
  const CONCURRENCY = 5
  for (let i = 0; i < idsToProcess.length; i += CONCURRENCY) {
    const chunk = idsToProcess.slice(i, i + CONCURRENCY)
    
    const results = await Promise.allSettled(chunk.map(async (cid: number) => {
      const url = `${restUrl}entity/DistributionList/${listId}/members/${cid}?BhRestToken=${bhRestToken}`
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' } })
      const body = await res.text()
      return { cid, ok: res.ok, status: res.status, body: body.slice(0, 100) }
    }))

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) addedCount++
      else failedCount++
    }

    if ((i + CONCURRENCY) % 50 < CONCURRENCY) {
      console.log(`Progress: ${startAt + i + chunk.length}/${contactIds.length} processed, ${addedCount} added, ${failedCount} failed`)
    }
  }

  console.log(`Done: ${addedCount}/${idsToProcess.length} added, ${failedCount} failed (started at ${startAt})`)

  // Verify via search
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
    processedFrom: startAt,
    processedCount: idsToProcess.length,
    addedCount,
    failedCount,
    verifiedCount,
    sampleErrors: errors.slice(0, 5)
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
