import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  
  const { listId, contactIds } = await req.json()
  
  // Get Bullhorn tokens
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

  const results: any = { listId, totalContacts: contactIds.length, batches: [] }
  
  // Batch in groups of 50
  const BATCH_SIZE = 50
  let addedCount = 0
  
  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    const batch = contactIds.slice(i, i + BATCH_SIZE)
    const batchIds = batch.join(',')
    
    const assocUrl = `${restUrl}entity/DistributionList/${listId}/members/${batchIds}?BhRestToken=${bhRestToken}`
    const res = await fetch(assocUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })
    
    const body = await res.text()
    const batchResult = { batchIndex: i / BATCH_SIZE, count: batch.length, status: res.status, ok: res.ok }
    results.batches.push(batchResult)
    
    if (res.ok) {
      addedCount += batch.length
    }
    
    console.log(`Batch ${i / BATCH_SIZE}: ${batch.length} contacts, status ${res.status}, ok: ${res.ok}`)
    
    // Small delay between batches
    if (i + BATCH_SIZE < contactIds.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  results.addedCount = addedCount

  // Verify final count
  await new Promise(r => setTimeout(r, 1000))
  const countUrl = `${restUrl}entity/DistributionList/${listId}/members?fields=id&count=1&BhRestToken=${bhRestToken}`
  const countRes = await fetch(countUrl)
  if (countRes.ok) {
    const countData = await countRes.json()
    results.verifiedMemberCount = countData?.count || 'unknown'
  }

  return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
