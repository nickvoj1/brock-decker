import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: tokenRow } = await supabase
    .from('bullhorn_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  const restUrl = tokenRow!.rest_url
  const bhRestToken = tokenRow!.bh_rest_token
  const listId = 2897
  const a = 154852
  const b = 154919
  const c = 154918

  const count = async () => {
    const res = await fetch(`${restUrl}entity/DistributionList/${listId}/members?fields=id,firstName,lastName&count=200&BhRestToken=${bhRestToken}`)
    return await res.json()
  }

  const before = await count()

  const postRes = await fetch(`${restUrl}entity/DistributionList/${listId}?BhRestToken=${bhRestToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ members: { add: [a, b] } }),
  })
  const postText = await postRes.text()
  const afterPost = await count()

  const putRes = await fetch(`${restUrl}entity/DistributionList/${listId}/members/${a},${b}?BhRestToken=${bhRestToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  })
  const putText = await putRes.text()
  const afterPut = await count()

  const putSingleRes = await fetch(`${restUrl}entity/DistributionList/${listId}/members/${c}?BhRestToken=${bhRestToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
  })
  const putSingleText = await putSingleRes.text()
  const afterPutSingle = await count()

  return new Response(JSON.stringify({
    before,
    post: { status: postRes.status, body: postText },
    afterPost,
    putCsv: { status: putRes.status, body: putText },
    afterPut,
    putSingle: { status: putSingleRes.status, body: putSingleText },
    afterPutSingle,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
