 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
// User's subscribed API host (custom application)
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
    
    // Try multiple endpoint formats since this is a custom RapidAPI app
    // The user's original code used /active-jobs
    const endpoint = '/active-jobs';
    
     // Build query parameters for the API
     const queryParams = new URLSearchParams();
 
    // Title filter - use title_filter parameter per API docs
     const keyword = body.keyword as string || url.searchParams.get('keyword') || '';
     if (keyword) {
      // Try both formats - API might use 'keyword' or 'title_filter'
      queryParams.set('keyword', keyword);
     }
 
    // Location filter - use location_filter per API docs
     const location = body.location as string || url.searchParams.get('location') || '';
     if (location) {
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
 
    // Limit and offset for pagination (API returns max 100 per request)
     const limit = body.limit as string || url.searchParams.get('limit') || '50';
     queryParams.set('limit', limit);
    
    const offset = body.offset as string || url.searchParams.get('offset') || '';
    if (offset && parseInt(offset) > 0) {
      queryParams.set('offset', offset);
    }
    
    // Add page parameter for pagination
    const page = body.page as string || url.searchParams.get('page') || '1';
    queryParams.set('page', page);
 
    console.log(`[fantastic-jobs] Fetching jobs from ${endpoint} with params:`, Object.fromEntries(queryParams));
 
     // Call the fantastic.jobs API
    const apiUrl = `${BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
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
      
      // If 404, try alternate endpoint formats
      if (response.status === 404) {
        // Try /jobs endpoint
        const altEndpoints = ['/jobs', '/search', '/api/jobs'];
        
        for (const altEndpoint of altEndpoints) {
          console.log(`[fantastic-jobs] Trying alternate endpoint: ${altEndpoint}`);
          const altUrl = `${BASE_URL}${altEndpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
          
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': rapidApiKey,
              'X-RapidAPI-Host': RAPIDAPI_HOST,
            },
          });
          
          if (altResponse.ok) {
            const altData = await altResponse.json();
            const jobs = Array.isArray(altData) ? altData : (altData.jobs || altData.results || altData.data || []);
            console.log(`[fantastic-jobs] Alt endpoint ${altEndpoint} succeeded with ${jobs.length} jobs`);
            return new Response(JSON.stringify({
              success: true,
              jobs: normalizeJobs(jobs),
              total: jobs.length,
              offset: parseInt(offset || '0'),
              limit: parseInt(limit),
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
      
      // Check for rate limiting
      if (response.status === 429) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please wait a moment and try again.',
          jobs: [],
          rateLimited: true,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`API request failed: ${response.status} - ${errorText.substring(0, 200)}`);
     }
 
     const data = await response.json();
    console.log(`[fantastic-jobs] Received ${Array.isArray(data) ? data.length : (data.jobs?.length || 'unknown')} jobs`);
 
    const jobs = Array.isArray(data) ? data : (data.jobs || data.results || []);
 
     return new Response(JSON.stringify({
       success: true,
      jobs: normalizeJobs(jobs),
      total: jobs.length,
      offset: parseInt(body.offset as string || url.searchParams.get('offset') || '0'),
      limit: parseInt(body.limit as string || url.searchParams.get('limit') || '50'),
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