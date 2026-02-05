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
 
     const url = new URL(req.url);
     const action = url.searchParams.get('action') || 'search';
 
     // Parse request body for POST requests
     let body: Record<string, unknown> = {};
     if (req.method === 'POST') {
       try {
         body = await req.json();
       } catch {
         body = {};
       }
     }
 
     // Build query parameters for the API
     const queryParams = new URLSearchParams();
 
     // Keywords - default to PE/VC related
     const keyword = body.keyword as string || url.searchParams.get('keyword') || '';
     if (keyword) {
       queryParams.set('keyword', keyword);
     }
 
     // Location filter
     const location = body.location as string || url.searchParams.get('location') || '';
     if (location) {
       queryParams.set('location', location);
     }
 
     // Salary minimum
     const salaryMin = body.salary_min as string || url.searchParams.get('salary_min') || '';
     if (salaryMin) {
       queryParams.set('salary_min', salaryMin);
     }
 
     // Remote filter
     const remote = body.remote as string || url.searchParams.get('remote') || '';
     if (remote === 'true') {
       queryParams.set('remote', 'true');
     }
 
     // Posted after filter (e.g., "7days", "24hours", "30days")
     const postedAfter = body.posted_after as string || url.searchParams.get('posted_after') || '';
     if (postedAfter) {
       queryParams.set('posted_after', postedAfter);
     }
 
     // Page/limit for pagination
     const page = body.page as string || url.searchParams.get('page') || '1';
     const limit = body.limit as string || url.searchParams.get('limit') || '50';
     queryParams.set('page', page);
     queryParams.set('limit', limit);
 
     console.log(`[fantastic-jobs] Fetching jobs with params:`, Object.fromEntries(queryParams));
 
     // Call the fantastic.jobs API
     const apiUrl = `${BASE_URL}/active-jobs?${queryParams.toString()}`;
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
     console.log(`[fantastic-jobs] Received ${Array.isArray(data) ? data.length : 'unknown'} jobs`);
 
     // Normalize the response to a consistent format
     const jobs = Array.isArray(data) ? data : (data.jobs || data.results || []);
 
     // Map jobs to our expected format
     const normalizedJobs = jobs.map((job: Record<string, unknown>, index: number) => ({
       id: job.id || job.job_id || `job-${index}`,
       title: job.title || job.job_title || 'Untitled Position',
       company: job.company || job.company_name || job.employer || 'Unknown Company',
       location: job.location || job.city || job.country || 'Remote',
       salary: job.salary || job.salary_range || job.compensation || null,
       salary_min: job.salary_min || job.min_salary || null,
       salary_max: job.salary_max || job.max_salary || null,
       currency: job.currency || job.salary_currency || 'EUR',
       posted_at: job.posted_at || job.date_posted || job.created_at || new Date().toISOString(),
       apply_url: job.apply_url || job.url || job.application_url || job.link || null,
       description: job.description || job.job_description || '',
       remote: job.remote || job.is_remote || false,
       job_type: job.job_type || job.employment_type || 'Full-time',
       source: 'fantastic.jobs',
     }));
 
     return new Response(JSON.stringify({
       success: true,
       jobs: normalizedJobs,
       total: normalizedJobs.length,
       page: parseInt(page),
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