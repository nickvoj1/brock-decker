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
  const listId = 2901

  const results: Record<string, any> = {}

  // Get searchURL and other fields
  const entityRes = await fetch(`${restUrl}entity/DistributionList/${listId}?fields=id,name,description,searchURL,type,restrictListToRecordType,groupName&BhRestToken=${bhRestToken}`)
  results.entity = await entityRes.json()

  // Get the 23 emails from the UI (known in list) and find their Bullhorn IDs
  const uiEmails = [
    'egandoy@apollo.com', 'mstaub@apollo.com', 'sushanta.saha@arqiva.com',
    'igor.romanovsky@axaxl.com', 'jsaiman@baincapital.com', 'altaz.jhetam@bcpartners.com',
    'graham@beaufortsociety.com', 'llewellyn.jones@brighthorizons.com',
    'satya.bandi@capgemini.com', 'simon.weekes@capgemini.com', 'pjackson@cls-group.com',
    'peter.read@endava.com', 'iain.thomson@fleetdatacenters.com', 'raju.dinavahi@kantar.com',
    'thomas.neill@morganstanley.com', 'simon.bohn@nb.com', 'alex.salvaris@qtsdatacenters.com',
    'tyler.chambers@qtsdatacenters.com', 'omar.ibrahim@towerbrook.com',
    'kevin.matthews@validationcloud.io', 'smoir@vaultica.com', 'marco.silva1@vodafone.com',
    'ian.baggley@woodgreenacademy.co.uk'
  ]

  // Search each to get their IDs
  const uiContactIds: number[] = []
  for (const email of uiEmails.slice(0, 5)) {
    const res = await fetch(`${restUrl}search/ClientContact?query=email:"${email}"&fields=id,firstName,lastName,email,distributionLists&count=1&BhRestToken=${bhRestToken}`)
    const data = await res.json()
    if (data?.data?.[0]) {
      uiContactIds.push(data.data[0].id)
    }
  }

  // Now search a few contacts that are in the search index (142) but NOT in the UI (23)
  // Pick some that are in the enriched data but not in the 23 UI emails
  const notInUi = [
    'nthamm@baincapital.com', 'hmongia@apollo.com', 'rdelgado@capricorncapital.com',
    'adaneschdar@apollo.com', 'muthayophas@adcouncil.ae'
  ]
  
  const notInUiResults: any[] = []
  for (const email of notInUi) {
    const res = await fetch(`${restUrl}search/ClientContact?query=email:"${email}"&fields=id,firstName,lastName,email&count=1&BhRestToken=${bhRestToken}`)
    const data = await res.json()
    
    // Also check if they have distributionLists containing our list
    if (data?.data?.[0]) {
      const cid = data.data[0].id
      const dlRes = await fetch(`${restUrl}entity/ClientContact/${cid}?fields=id,firstName,lastName,distributionLists&BhRestToken=${bhRestToken}`)
      const dlData = await dlRes.json()
      notInUiResults.push({ email, id: cid, name: `${data.data[0].firstName} ${data.data[0].lastName}`, distributionLists: dlData?.data?.distributionLists })
    }
  }

  results.uiContactIdsSample = uiContactIds
  results.notInUiContacts = notInUiResults

  // NEW: Try creating a BRAND NEW list and adding just 5 contacts ONE BY ONE
  const newListRes = await fetch(`${restUrl}entity/DistributionList?BhRestToken=${bhRestToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'test_add_5_singles', description: 'Testing single adds' }),
  })
  const newListData = await newListRes.json()
  const testListId = newListData.changedEntityId
  results.testListId = testListId

  // Add 5 contacts one by one with PUT
  const testIds = [154960, 154959, 154957, 154953, 154951] // Jamie, Stefan, Jude, Amanda, Andrew
  const addResults: any[] = []
  for (const tid of testIds) {
    const addRes = await fetch(`${restUrl}entity/DistributionList/${testListId}/members/${tid}?BhRestToken=${bhRestToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })
    const addText = await addRes.text()
    addResults.push({ id: tid, status: addRes.status, body: addText.slice(0, 200) })
    await new Promise(r => setTimeout(r, 300))
  }
  results.singleAddResults = addResults

  // Check how many are actually in the test list
  await new Promise(r => setTimeout(r, 1000))
  const checkRes = await fetch(`${restUrl}search/ClientContact?query=distributionLists.id:${testListId}&fields=id,firstName,lastName&count=10&BhRestToken=${bhRestToken}`)
  const checkData = await checkRes.json()
  results.testListSearch = { total: checkData?.total, count: checkData?.count, data: checkData?.data }

  return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
