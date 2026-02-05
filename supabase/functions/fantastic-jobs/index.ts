 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
// RapidAPI hosts:
// - The official "Active Jobs DB" API uses the API slug as the host.
// - Some subscriptions expose a per-user "default application" host.
const OFFICIAL_HOST = 'active-jobs-db.p.rapidapi.com';
const LEGACY_APP_HOST = 'fantastic-jobs-default-application-11540375.p.rapidapi.com';
 
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
    
     // Active Jobs DB endpoints (per RapidAPI docs)
     // NOTE: We'll still try legacy endpoints as fallback.
     const primaryEndpoints = ['/active-jobs-db-7-days', '/active-jobs-db-24h'];
     const legacyEndpoints = ['/active-jobs', '/jobs', '/search', '/api/jobs'];
     const endpointsToTry = [...primaryEndpoints, ...legacyEndpoints];
    
     // Build query parameters for the API
     const queryParams = new URLSearchParams();
 
     // Title filter (RapidAPI docs: title_filter). Keep legacy 'keyword' too.
      const keyword = (body.keyword as string) || url.searchParams.get('keyword') || '';
      if (keyword) {
        queryParams.set('title_filter', keyword);
        queryParams.set('keyword', keyword);
      }
 
     // Location filter (RapidAPI docs: location_filter). Keep legacy 'location' too.
      const location = (body.location as string) || url.searchParams.get('location') || '';
      if (location) {
        queryParams.set('location_filter', location);
        queryParams.set('location', location);
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
 
     // Pagination: docs use offset + limit (limit typically 10-100, but docs mention up to 500 for some endpoints)
      const limit = (body.limit as string) || url.searchParams.get('limit') || '50';
      queryParams.set('limit', limit);
     
     const offset = (body.offset as string) || url.searchParams.get('offset') || '0';
     queryParams.set('offset', offset);
 
     console.log(`[fantastic-jobs] Fetch params:`, Object.fromEntries(queryParams));

     // Call RapidAPI with a *small* fallback matrix to avoid burning quota.
     let lastStatus = 500;
     let lastErrorText = '';
     let data: unknown = null;

     const attemptPlans: Array<{ host: string; endpoints: string[] }> = [
       { host: OFFICIAL_HOST, endpoints: primaryEndpoints },
       { host: LEGACY_APP_HOST, endpoints: legacyEndpoints },
     ];

     for (const plan of attemptPlans) {
       for (const endpoint of plan.endpoints) {
         const apiUrl = `https://${plan.host}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
         console.log(`[fantastic-jobs] Trying: ${apiUrl}`);

         const res = await fetch(apiUrl, {
           method: 'GET',
           headers: {
             'X-RapidAPI-Key': rapidApiKey,
             'X-RapidAPI-Host': plan.host,
           },
         });

         if (res.ok) {
           data = await res.json();
           console.log(`[fantastic-jobs] Success via host=${plan.host} endpoint=${endpoint}`);
           lastErrorText = '';
           lastStatus = 200;
           break;
         }

         lastStatus = res.status;
         lastErrorText = await res.text();
         console.error(`[fantastic-jobs] Upstream error via host=${plan.host} endpoint=${endpoint}: ${res.status} - ${lastErrorText}`);

         // If rate limited, stop trying alternatives.
         if (res.status === 429) {
           return new Response(
             JSON.stringify({
               success: false,
               error: 'Rate limit exceeded. Please wait a moment and try again.',
               jobs: [],
               rateLimited: true,
             }),
             {
               status: 429,
               headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             },
           );
         }
       }

       if (lastStatus === 200 && data) break;
     }

     if (!data) {
       // Keep error concise and consistent with existing frontend handling.
       throw new Error(`API request failed: ${lastStatus} - ${lastErrorText.substring(0, 200)}`);
     }

     console.log(`[fantastic-jobs] Received ${Array.isArray(data) ? data.length : ((data as any)?.jobs?.length || 'unknown')} jobs`);

     const jobs = Array.isArray(data) ? data : (((data as any).jobs) || ((data as any).results) || ((data as any).data) || []);
 
     return new Response(JSON.stringify({
       success: true,
      jobs: normalizeJobs(jobs),
      total: jobs.length,
       offset: parseInt((body.offset as string) || url.searchParams.get('offset') || '0'),
       limit: parseInt((body.limit as string) || url.searchParams.get('limit') || '50'),
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

// Helper function to normalize job data
function normalizeJobs(jobs: Record<string, unknown>[]): Record<string, unknown>[] {
  return jobs.map((job, index) => {
    // Parse locations from locations_derived if available
    const locations = job.locations_derived as Array<{city?: string; admin?: string; country?: string}> || [];
    const locationStr = locations.length > 0 
      ? locations.map(l => [l.city, l.admin, l.country].filter(Boolean).join(', ')).join(' | ')
      : (job.location as string || 'Remote');
    
    // Check if remote
    const isRemote = job.location_type === 'TELECOMMUTE' || 
      job.remote_derived === true || 
      (job.remote as boolean) || false;
    
    // Get salary info - prefer AI extracted data
    const salaryMin = job.ai_salary_minvalue || job.ai_salary_value || null;
    const salaryMax = job.ai_salary_maxvalue || null;
    const salaryCurrency = job.ai_salary_currency || 'USD';
    
    // Get employment type
    const empTypes = job.employment_type as string[] || job.ai_employment_type as string[] || [];
    const jobType = empTypes.length > 0 ? empTypes[0] : 'Full-time';
    
    return {
      id: job.id || `job-${index}`,
      title: job.title || 'Untitled Position',
      company: job.organization || 'Unknown Company',
      company_url: job.organization_url || null,
      company_logo: job.organization_logo || null,
      location: locationStr,
      salary: salaryMin && salaryMax 
        ? `${salaryCurrency} ${salaryMin.toLocaleString()} - ${salaryMax.toLocaleString()}`
        : salaryMin 
          ? `${salaryCurrency} ${salaryMin.toLocaleString()}+`
          : null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      currency: salaryCurrency,
      posted_at: job.date_posted || new Date().toISOString(),
      apply_url: job.url || null,
      description: job.description_text || '',
      remote: isRemote,
      job_type: jobType,
      source: job.source || 'fantastic.jobs',
      ai_skills: job.ai_key_skills || [],
      ai_experience: job.ai_experience_level || null,
    };
  });
}