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

  const { action, listId: inputListId } = await req.json() as { action: string, listId?: number }
  const listId = inputListId || 2903  // Latest list
  const results: Record<string, any> = {}

  if (action === 'diagnose') {
    // 1. Check how many members the entity endpoint returns
    const membersRes = await fetch(`${restUrl}entity/DistributionList/${listId}/members?fields=id,firstName,lastName,email&count=500&BhRestToken=${bhRestToken}`)
    const membersData = await membersRes.json()
    results.membersEndpoint = {
      status: membersRes.status,
      total: membersData?.total,
      count: membersData?.count,
      dataLen: membersData?.data?.length,
      sample: membersData?.data?.slice(0, 5),
    }

    // 2. Check search index
    const searchRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${listId}&fields=id,firstName,lastName,email&count=500&BhRestToken=${bhRestToken}`)
    const searchData = await searchRes.json()
    results.searchIndex = {
      status: searchRes.status,
      total: searchData?.total,
      count: searchData?.count,
      dataLen: searchData?.data?.length,
      sample: searchData?.data?.slice(0, 5),
    }

    // 3. Get list entity details
    const entityRes = await fetch(`${restUrl}entity/DistributionList/${listId}?fields=id,name,description,type,isPrivate&BhRestToken=${bhRestToken}`)
    results.entity = await entityRes.json()

    // 4. Try a single PUT to add a known contact and see the FULL response
    // Pick the first contact from the search results
    if (searchData?.data?.[0]?.id) {
      const testCid = searchData.data[0].id
      const putRes = await fetch(`${restUrl}entity/DistributionList/${listId}/members/${testCid}?BhRestToken=${bhRestToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      const putText = await putRes.text()
      results.putTest = { contactId: testCid, status: putRes.status, response: putText.slice(0, 500) }
    }

    // 5. Try adding via the contact's side - update the contact's distributionLists
    // This is the REVERSE approach: instead of adding member to list, add list to contact
    if (searchData?.data?.[1]?.id) {
      const testCid = searchData.data[1].id
      // Try associating from contact side
      const reverseRes = await fetch(`${restUrl}entity/ClientContact/${testCid}/distributionLists/${listId}?BhRestToken=${bhRestToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      const reverseText = await reverseRes.text()
      results.reverseAssocTest = { contactId: testCid, status: reverseRes.status, response: reverseText.slice(0, 500) }
    }

    // 6. Also check all lists for this instance to see which ones have members
    const allListsRes = await fetch(`${restUrl}query/DistributionList?where=id>0&fields=id,name&count=20&orderBy=-id&BhRestToken=${bhRestToken}`)
    const allListsData = await allListsRes.json()
    results.recentLists = allListsData?.data?.slice(0, 10)
  }

  if (action === 'reverse-add-all') {
    // Strategy: Add the distribution list to each contact's distributionLists field
    // instead of adding contacts to the list's members field
    
    // Get all contacts from the enrichment run
    const { data: run } = await supabase
      .from('enrichment_runs')
      .select('enriched_data')
      .eq('id', '2857d36c-71a0-40bf-9ccf-606edfa87311')
      .single()

    const enrichedContacts = (run?.enriched_data as any[]) || []
    const emails = enrichedContacts.map((c: any) => c.email?.toLowerCase()).filter(Boolean)

    // Find all these contacts in Bullhorn by email
    const successes: any[] = []
    const failures: any[] = []

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      try {
        // Search for contact
        const searchRes = await fetch(`${restUrl}search/ClientContact?query=email:"${encodeURIComponent(email)}"&fields=id&count=1&BhRestToken=${bhRestToken}`)
        const searchData = await searchRes.json()
        
        if (!searchData?.data?.[0]?.id) {
          failures.push({ email, error: 'not found in BH' })
          continue
        }

        const cid = searchData.data[0].id

        // Add list to contact's distributionLists (reverse association)
        const assocRes = await fetch(`${restUrl}entity/ClientContact/${cid}/distributionLists/${listId}?BhRestToken=${bhRestToken}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        })
        const assocText = await assocRes.text()

        if (assocRes.ok) {
          successes.push({ email, cid, response: assocText.slice(0, 200) })
        } else {
          failures.push({ email, cid, status: assocRes.status, error: assocText.slice(0, 200) })
        }
      } catch (e: any) {
        failures.push({ email, error: e.message })
      }

      // Rate limit
      if (i % 10 === 9) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Verify
    await new Promise(r => setTimeout(r, 1000))
    const verifyRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${listId}&fields=id&count=1&BhRestToken=${bhRestToken}`)
    const verifyData = await verifyRes.json()

    results.successes = successes.length
    results.failures = failures.length
    results.failureSample = failures.slice(0, 10)
    results.successSample = successes.slice(0, 5)
    results.totalInListAfter = verifyData?.total
  }

  return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
