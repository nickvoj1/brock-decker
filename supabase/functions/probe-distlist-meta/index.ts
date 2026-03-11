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

  // Get Bullhorn tokens
  const { data: tokenRow } = await supabase
    .from('bullhorn_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!tokenRow) return new Response(JSON.stringify({ error: 'No tokens' }), { headers: corsHeaders })

  const restUrl = tokenRow.rest_url
  const bhRestToken = tokenRow.bh_rest_token

  // Get meta for DistributionList
  const metaUrl = `${restUrl}meta/DistributionList?fields=*&BhRestToken=${encodeURIComponent(bhRestToken)}`
  const metaRes = await fetch(metaUrl)
  const metaData = await metaRes.json()

  // Extract association fields
  const associations = (metaData.fields || [])
    .filter((f: any) => f.type === 'TO_MANY' || f.associatedEntity)
    .map((f: any) => ({
      name: f.name,
      type: f.type,
      associatedEntity: f.associatedEntity?.entity || null,
      label: f.label,
    }))

  // Also try to get members of list 2894
  const listUrl = `${restUrl}entity/DistributionList/2894?fields=id,name,description&BhRestToken=${encodeURIComponent(bhRestToken)}`
  const listRes = await fetch(listUrl)
  const listData = await listRes.json()

  // Try to get members
  const membersUrl = `${restUrl}entity/DistributionList/2894/members?fields=id,firstName,lastName&count=5&BhRestToken=${encodeURIComponent(bhRestToken)}`
  const membersRes = await fetch(membersUrl)
  const membersData = await membersRes.json()

  // Also try clientContacts
  const ccUrl = `${restUrl}entity/DistributionList/2894/clientContacts?fields=id,firstName,lastName&count=5&BhRestToken=${encodeURIComponent(bhRestToken)}`
  const ccRes = await fetch(ccUrl)
  const ccData = await ccRes.json()

  return new Response(JSON.stringify({
    associations,
    listData,
    membersData,
    clientContactsData: ccData,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
