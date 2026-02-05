 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 const RAPIDAPI_HOST = 'fantastic-jobs-default-application-11540375.p.rapidapi.com';
 const BASE_URL = `https://${RAPIDAPI_HOST}`;
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
     if (!rapidApiKey) {
       throw new Error('RAPIDAPI_KEY is not configured');
     }
 
     // Parse request body for POST requests
     let body: Record<string, unknown> = {};
     if (req.method === 'POST') {
       try {
         body = await req.json();
       } catch {
         body = {};
       }
     }
 
    const url = new URL(req.url);
    
    // Determine which endpoint to use based on date filter
    const postedAfter = body.posted_after as string || url.searchParams.get('posted_after') || '7days';
    let endpoint = '/active-jobs-db-7-days';
    if (postedAfter === '24hours' || postedAfter === '24h') {
      endpoint = '/active-jobs-db-24h';
    }
    
     // Build query parameters for the API
     const queryParams = new URLSearchParams();
 
    // Title filter - use title_filter parameter per API docs
     const keyword = body.keyword as string || url.searchParams.get('keyword') || '';
     if (keyword) {
      queryParams.set('title_filter', keyword);
     }
 
    // Location filter - use location_filter per API docs
     const location = body.location as string || url.searchParams.get('location') || '';
     if (location) {
      queryParams.set('location_filter', location);
     }
 
    // Salary minimum - use salary_min per API docs
     const salaryMin = body.salary_min as string || url.searchParams.get('salary_min') || '';
     if (salaryMin) {
       queryParams.set('salary_min', salaryMin);
     }
 
    // Remote filter - set to 'true' for remote only
     const remote = body.remote as string || url.searchParams.get('remote') || '';
     if (remote === 'true') {
       queryParams.set('remote', 'true');
     }
 
    // Limit and offset for pagination (API returns max 100 per request)
     const limit = body.limit as string || url.searchParams.get('limit') || '50';
     queryParams.set('limit', limit);
    
    const offset = body.offset as string || url.searchParams.get('offset') || '0';
    if (parseInt(offset) > 0) {
      queryParams.set('offset', offset);
    }
 
    console.log(`[fantastic-jobs] Fetching jobs from ${endpoint} with params:`, Object.fromEntries(queryParams));
 
     // Call the fantastic.jobs API
    const apiUrl = `${BASE_URL}${endpoint}?${queryParams.toString()}`;
     console.log(`[fantastic-jobs] API URL: ${apiUrl}`);
 
     const response = await fetch(apiUrl, {
       method: 'GET',
       headers: {
         'X-RapidAPI-Key': rapidApiKey,
         'X-RapidAPI-Host': RAPIDAPI_HOST,
       },
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error(`[fantastic-jobs] API error: ${response.status} - ${errorText}`);
       throw new Error(`API request failed: ${response.status} - ${errorText}`);
     }
 
     const data = await response.json();
    console.log(`[fantastic-jobs] Received ${Array.isArray(data) ? data.length : (data.jobs?.length || 'unknown')} jobs`);
 
     // Normalize the response to a consistent format
     const jobs = Array.isArray(data) ? data : (data.jobs || data.results || []);
 
     // Map jobs to our expected format
     const normalizedJobs = jobs.map((job: Record<string, unknown>, index: number) => ({
       id: job.id || job.job_id || `job-${index}`,
      title: job.title || job.job_title || job.name || 'Untitled Position',
      company: job.company || job.company_name || job.employer || job.organization || 'Unknown Company',
       location: job.location || job.city || job.country || 'Remote',
       salary: job.salary || job.salary_range || job.compensation || null,
       salary_min: job.salary_min || job.min_salary || null,
       salary_max: job.salary_max || job.max_salary || null,
       currency: job.currency || job.salary_currency || 'EUR',
      posted_at: job.date_posted || job.posted_at || job.created_at || job.date || new Date().toISOString(),
      apply_url: job.url || job.apply_url || job.application_url || job.link || job.final_url || null,
      description: job.description || job.job_description || job.text_description || '',
       remote: job.remote || job.is_remote || false,
      job_type: job.job_type || job.employment_type || job.type || 'Full-time',
       source: 'fantastic.jobs',
     }));
 
     return new Response(JSON.stringify({
       success: true,
       jobs: normalizedJobs,
       total: normalizedJobs.length,
      offset: parseInt(offset),
       limit: parseInt(limit),
     }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
 
   } catch (error) {
     console.error('[fantastic-jobs] Error:', error);
     return new Response(JSON.stringify({
       success: false,
       error: error instanceof Error ? error.message : 'Unknown error',
       jobs: [],
     }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 });