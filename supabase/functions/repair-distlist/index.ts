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

  const { action, listId, contactIds } = await req.json() as { action: string, listId?: number, contactIds?: number[] }
  const targetListId = listId || 2901
  const results: Record<string, any> = {}

  if (action === 'inspect') {
    // Get list details with specific fields
    const entityRes = await fetch(`${restUrl}entity/DistributionList/${targetListId}?fields=id,name,description,restrictListToRecordType,type,isPrivate,isReadOnly,dateAdded&BhRestToken=${bhRestToken}`)
    results.entity = await entityRes.json()

    // Check how many contacts have this list in their distributionLists
    // Try querying from the contact side
    const contactSideRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${targetListId}&fields=id,firstName,lastName&count=500&BhRestToken=${bhRestToken}`)
    const contactSideData = await contactSideRes.json()
    results.contactSideSearch = { total: contactSideData?.total, count: contactSideData?.count, dataLen: contactSideData?.data?.length }

    // Also query using query endpoint (not search)
    try {
      const queryRes = await fetch(`${restUrl}query/DistributionList/${targetListId}/members?where=_subtype='ClientContact'&fields=id,firstName,lastName&count=500&BhRestToken=${bhRestToken}`)
      results.queryMembers = { status: queryRes.status, body: await queryRes.text() }
    } catch(e: any) { results.queryMembers = { error: e.message } }
  }

  if (action === 'add-one-by-one') {
    // Add contacts one by one with PUT
    const ids = contactIds || []
    const successes: number[] = []
    const failures: { id: number, error: string }[] = []

    for (let i = 0; i < Math.min(ids.length, 10); i++) {
      const cid = ids[i]
      try {
        const res = await fetch(`${restUrl}entity/DistributionList/${targetListId}/members/${cid}?BhRestToken=${bhRestToken}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        })
        const text = await res.text()
        if (res.ok) {
          successes.push(cid)
        } else {
          failures.push({ id: cid, error: text })
        }
      } catch (e: any) {
        failures.push({ id: cid, error: e.message })
      }
      // Delay
      await new Promise(r => setTimeout(r, 200))
    }

    // Verify
    const verifyRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${targetListId}&fields=id&count=1&BhRestToken=${bhRestToken}`)
    const verifyData = await verifyRes.json()

    results.successes = successes
    results.failures = failures
    results.totalAfter = verifyData?.total
  }

  if (action === 'try-post-single') {
    // Try POST with single member add, one at a time
    const ids = contactIds || []
    const results2: any[] = []

    for (let i = 0; i < Math.min(ids.length, 5); i++) {
      const cid = ids[i]
      const res = await fetch(`${restUrl}entity/DistributionList/${targetListId}?BhRestToken=${bhRestToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: { add: [cid] } }),
      })
      const text = await res.text()
      results2.push({ id: cid, status: res.status, body: text.slice(0, 300) })
      await new Promise(r => setTimeout(r, 300))
    }

    // Verify
    const verifyRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${targetListId}&fields=id&count=1&BhRestToken=${bhRestToken}`)
    const verifyData = await verifyRes.json()

    results.postResults = results2
    results.totalAfter = verifyData?.total
  }

  if (action === 'find-missing') {
    // Get the 174 contact IDs from the enrichment run
    const { data: run } = await supabase
      .from('enrichment_runs')
      .select('enriched_data')
      .eq('id', '2857d36c-71a0-40bf-9ccf-606edfa87311')
      .single()

    const enrichedEmails = ((run?.enriched_data as any[]) || []).map((c: any) => c.email?.toLowerCase()).filter(Boolean)

    // Get the 23 contacts currently in the list from Bullhorn
    // Search from the contact side
    const searchRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${targetListId}&fields=id,firstName,lastName,email&count=500&BhRestToken=${bhRestToken}`)
    const searchData = await searchRes.json()
    
    const inListEmails = new Set((searchData?.data || []).map((c: any) => c.email?.toLowerCase()).filter(Boolean))
    const missingEmails = enrichedEmails.filter((e: string) => !inListEmails.has(e))

    results.totalEnriched = enrichedEmails.length
    results.totalInList = searchData?.total
    results.inListCount = inListEmails.size
    results.missingCount = missingEmails.length
    results.missingSample = missingEmails.slice(0, 20)
  }

  return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
