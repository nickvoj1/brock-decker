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

  const results: Record<string, any> = {}

  // 1. Get DistributionList meta to find all fields and associations
  const metaRes = await fetch(`${restUrl}meta/DistributionList?fields=*&BhRestToken=${bhRestToken}`)
  const metaData = await metaRes.json()
  
  // Extract to-many associations
  const toManyFields = metaData?.fields?.filter((f: any) => 
    f.type === 'TO_MANY' || f.associatedEntity
  ) || []
  results.toManyFields = toManyFields.map((f: any) => ({
    name: f.name,
    type: f.type,
    associatedEntity: f.associatedEntity?.entity,
    label: f.label,
  }))

  // Also get all field names
  results.allFieldNames = metaData?.fields?.map((f: any) => f.name) || []

  // 2. Get full entity details for list 2901 with ALL fields  
  const entityRes = await fetch(`${restUrl}entity/DistributionList/2901?fields=*&BhRestToken=${bhRestToken}`)
  const entityData = await entityRes.json()
  results.entity2901 = entityData

  // 3. Try different association names
  const assocNames = ['members', 'clientContacts', 'candidates', 'persons', 'contacts', 'people', 'distributionListMembers']
  for (const assoc of assocNames) {
    try {
      const res = await fetch(`${restUrl}entity/DistributionList/2901/${assoc}?fields=id,firstName,lastName&count=5&BhRestToken=${bhRestToken}`)
      const data = await res.json()
      results[`assoc_${assoc}`] = { status: res.status, count: data?.count, total: data?.total, dataLen: data?.data?.length, sample: data?.data?.slice(0, 3) }
    } catch (e: any) {
      results[`assoc_${assoc}`] = { error: e.message }
    }
  }

  // 4. Try query approach - search for contacts associated with a specific list
  try {
    const qRes = await fetch(`${restUrl}query/ClientContact?where=distributionLists.id=2901&fields=id,firstName,lastName&count=5&BhRestToken=${bhRestToken}`)
    const qData = await qRes.json()
    results.queryByList = { status: qRes.status, count: qData?.count, total: qData?.total, dataLen: qData?.data?.length, sample: qData?.data?.slice(0, 3) }
  } catch (e: any) {
    results.queryByList = { error: e.message }
  }

  // 5. Try search approach
  try {
    const sRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:2901&fields=id,firstName,lastName&count=5&BhRestToken=${bhRestToken}`)
    const sData = await sRes.json()
    results.searchByList = { status: sRes.status, count: sData?.count, total: sData?.total, dataLen: sData?.data?.length, sample: sData?.data?.slice(0, 3) }
  } catch (e: any) {
    results.searchByList = { error: e.message }
  }

  // 6. Also check list 2895 to compare
  try {
    const s2Res = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:2895&fields=id,firstName,lastName&count=5&BhRestToken=${bhRestToken}`)
    const s2Data = await s2Res.json()
    results.searchByList2895 = { status: s2Res.status, count: s2Data?.count, total: s2Data?.total, dataLen: s2Data?.data?.length, sample: s2Data?.data?.slice(0, 3) }
  } catch (e: any) {
    results.searchByList2895 = { error: e.message }
  }

  return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
