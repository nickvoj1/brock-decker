import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: tokenRow } = await supabase
    .from('bullhorn_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!tokenRow) return new Response(JSON.stringify({ error: 'No tokens' }), { headers: corsHeaders })

  const restUrl = tokenRow.rest_url
  const bhRestToken = tokenRow.bh_rest_token

  // Pick a known contact ID from earlier logs
  const testContactId = 154852
  const listId = 2894

  // Try PUT with members (current approach)
  const putUrl = `${restUrl}entity/DistributionList/${listId}/members/${testContactId}?BhRestToken=${bhRestToken}`
  const putRes = await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' } })
  const putStatus = putRes.status
  const putBody = await putRes.text()

  // Check members count after PUT
  const checkUrl1 = `${restUrl}entity/DistributionList/${listId}/members?fields=id&count=5&BhRestToken=${bhRestToken}`
  const check1 = await fetch(checkUrl1)
  const check1Data = await check1.json()

  // Try POST with members  
  const postUrl = `${restUrl}entity/DistributionList/${listId}/members/${testContactId}?BhRestToken=${bhRestToken}`
  const postRes = await fetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
  const postStatus = postRes.status
  const postBody = await postRes.text()

  // Check members count after POST
  const check2 = await fetch(checkUrl1)
  const check2Data = await check2.json()

  return new Response(JSON.stringify({
    putResult: { status: putStatus, body: putBody },
    afterPut: check1Data,
    postResult: { status: postStatus, body: postBody },
    afterPost: check2Data,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
