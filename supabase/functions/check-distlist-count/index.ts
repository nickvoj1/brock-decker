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

  const { listId } = (await req.json().catch(() => ({ listId: 2895 }))) as { listId?: number }
  const targetListId = listId || 2895

  const restUrl = tokenRow!.rest_url
  const bhRestToken = tokenRow!.bh_rest_token

  const listRes = await fetch(`${restUrl}entity/DistributionList/${targetListId}?fields=id,name,description&BhRestToken=${bhRestToken}`)
  const listData = await listRes.json()

  const membersRes = await fetch(`${restUrl}entity/DistributionList/${targetListId}/members?fields=id,firstName,lastName&count=500&BhRestToken=${bhRestToken}`)
  const membersData = await membersRes.json()

  return new Response(JSON.stringify({
    list: listData,
    returnedCountField: membersData?.count,
    dataLength: Array.isArray(membersData?.data) ? membersData.data.length : 0,
    sampleFirst10: Array.isArray(membersData?.data) ? membersData.data.slice(0, 10) : [],
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
