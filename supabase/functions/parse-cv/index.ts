import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkExperience {
  company: string
  title: string
  duration?: string
}

interface Education {
  institution: string
  degree: string
  year?: string
}

interface ParsedCandidate {
  candidate_id: string
  name: string
  current_title: string
  location: string
  email?: string
  phone?: string
  summary?: string
  skills: string[]
  work_history: WorkExperience[]
  education: Education[]
}

function normalizeNameCasing(input: unknown): string {
  const raw = String(input || "").replace(/\s+/g, " ").trim()
  if (!raw) return ""
  if (/^(unknown|not specified|could not parse)$/i.test(raw)) return raw

  const fixWord = (w: string): string => {
    if (w.length <= 1) return w
    if (!/[A-Z]/.test(w) || /[a-z]/.test(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  }

  const fixToken = (token: string): string =>
    token.replace(/[A-Za-z]+/g, (word) => fixWord(word))

  let name = raw
  const commaParts = name.split(",").map((p) => p.trim()).filter(Boolean)
  if (commaParts.length === 2 && !/[()]/.test(name)) {
    const leftCount = commaParts[0].split(/\s+/).filter(Boolean).length
    const rightCount = commaParts[1].split(/\s+/).filter(Boolean).length
    if (leftCount <= 3 && rightCount <= 3) {
      name = `${commaParts[1]} ${commaParts[0]}`.replace(/\s+/g, " ").trim()
    }
  }

  const hasLower = /[a-z]/.test(name)
  const hasUpper = /[A-Z]/.test(name)
  if (hasUpper && !hasLower) {
    name = name.split(" ").map(fixToken).join(" ")
  } else {
    name = name
      .split(" ")
      .map((token) => {
        const letters = token.replace(/[^A-Za-z]/g, "")
        if (letters.length >= 3 && letters === letters.toUpperCase()) return fixToken(token)
        return token
      })
      .join(" ")
  }

  return name.replace(/\s+/g, " ").trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type)

    // Get file as base64 for multimodal AI (chunked to avoid stack overflow)
    const fileBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(fileBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    const base64Data = btoa(binary)
    
    // Use AI to parse the CV content
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const candidateData = await parseWithAI(base64Data, file.type, LOVABLE_API_KEY)

    return new Response(
      JSON.stringify({ success: true, data: candidateData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Parse CV error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to parse CV' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function parseWithAI(base64Data: string, mimeType: string, apiKey: string, retryCount = 0): Promise<ParsedCandidate> {
  const maxRetries = 2
  
  // Determine the correct mime type for the AI
  let aiMimeType = mimeType
  if (mimeType === 'application/msword') {
    aiMimeType = 'application/msword'
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    aiMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  } else if (mimeType === 'application/pdf' || mimeType === '') {
    aiMimeType = 'application/pdf'
  }

  console.log('Sending to AI with mime type:', aiMimeType)

  // Use multimodal approach - send the file directly to Gemini
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.1-pro-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a precise CV/resume parser. Read the ENTIRE document carefully and extract every detail.

CRITICAL RULES:
1. You MUST call the extract_candidate_info function. Do not respond with prose.
2. Extract the candidate name ONLY from the CV body text — never from filename or metadata.
3. If the name is ALL CAPS, return it in natural Title Case.
4. Read EVERY page. Do not stop at the first job — capture the COMPLETE work history including the earliest roles.
5. Do NOT invent, infer, or hallucinate facts. If a field is not present, use "Not specified" (never guess).
6. Preserve original company names exactly (including abbreviations, & symbols, accents).
7. Skills must be discrete tokens (e.g. "Financial Modeling", "M&A", "Python") — not full sentences.
8. Duration format: prefer "MMM YYYY – MMM YYYY" or "YYYY – Present". Keep concise.
9. Verify each work history entry has both company AND title before including it.

Extract these fields with maximum fidelity:
- Full name (from CV text only)
- Current / most recent job title (the topmost role in the chronological history)
- Location (city, country — from header or contact block)
- Email address (exact)
- Phone number (with country code if shown)
- Professional summary (verbatim from CV summary/profile section, max 200 words; do NOT rewrite)
- Skills (up to 25 distinct skills, prioritize hard/technical skills first)
- COMPLETE work history (every role, oldest to newest or newest to oldest — do not omit any)
- Education (every institution, degree, year)`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${aiMimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_candidate_info',
            description: 'Extract structured candidate information from a CV including full work history',
            parameters: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Full name of the candidate'
                },
                current_title: {
                  type: 'string',
                  description: 'Current or most recent job title/position'
                },
                location: {
                  type: 'string',
                  description: 'City, state/country or location of the candidate'
                },
                email: {
                  type: 'string',
                  description: 'Email address'
                },
                phone: {
                  type: 'string',
                  description: 'Phone number'
                },
                summary: {
                  type: 'string',
                  description: 'Professional summary or objective from the CV (max 200 words)'
                },
                skills: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Distinct skills from the CV (up to 25, hard skills first)'
                },
                work_history: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      company: { type: 'string', description: 'Company name' },
                      title: { type: 'string', description: 'Job title at this company' },
                      duration: { type: 'string', description: 'Time period (e.g., "2020-2023" or "2 years")' }
                    },
                    required: ['company', 'title']
                  },
                  description: 'All previous work experience entries'
                },
                education: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      institution: { type: 'string', description: 'School/university name' },
                      degree: { type: 'string', description: 'Degree or certification' },
                      year: { type: 'string', description: 'Year of completion' }
                    },
                    required: ['institution', 'degree']
                  },
                  description: 'Educational background'
                }
              },
              required: ['name', 'current_title', 'location', 'work_history'],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'extract_candidate_info' } },
      temperature: 0.1,
      max_completion_tokens: 8192
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('AI API error:', response.status, errorText)
    
    // Retry on 500 errors
    if (response.status >= 500 && retryCount < maxRetries) {
      console.log(`Retrying AI request (attempt ${retryCount + 2}/${maxRetries + 1})...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
      return parseWithAI(base64Data, mimeType, apiKey, retryCount + 1)
    }
    
    throw new Error('Failed to parse CV with AI')
  }

  const data = await response.json()
  
  // Check if response has an error field (gateway error)
  if (data.error) {
    console.error('AI gateway error:', data.error)
    if (retryCount < maxRetries) {
      console.log(`Retrying AI request (attempt ${retryCount + 2}/${maxRetries + 1})...`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
      return parseWithAI(base64Data, mimeType, apiKey, retryCount + 1)
    }
  }
  
  console.log('AI response received')

  // Try to get tool call first
  let toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  
  // If no tool call, try to parse from content (fallback)
  if (!toolCall || toolCall.function?.name !== 'extract_candidate_info') {
    console.log('No tool call found, attempting to parse from content')
    const content = data.choices?.[0]?.message?.content
    
    // Try to extract JSON from content if present
    if (content) {
      console.log('Content received:', content.substring(0, 500))
      try {
        // Look for JSON in the content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          const candidateId = `CV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          return {
            candidate_id: candidateId,
            name: normalizeNameCasing(parsed.name) || 'Unknown',
            current_title: parsed.current_title || parsed.position || 'Not specified',
            location: parsed.location || 'Not specified',
            email: parsed.email || undefined,
            phone: parsed.phone || undefined,
            summary: parsed.summary || undefined,
            skills: parsed.skills || [],
            work_history: parsed.work_history || [],
            education: parsed.education || []
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON from content:', e)
      }
    }
    
    // If all else fails, return a minimal result with error info
    console.error('AI did not return expected format, returning minimal result')
    const candidateId = `CV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return {
      candidate_id: candidateId,
      name: 'Could not parse',
      current_title: 'Not specified',
      location: 'Not specified',
      email: undefined,
      phone: undefined,
      summary: 'CV parsing failed. Please try a different file or format (PDF works best).',
      skills: [],
      work_history: [],
      education: []
    }
  }

  // Sanitize tool args: strip control chars, detect truncation, fall back to repair
  const rawArgs: string = toolCall.function.arguments || ''
  let parsed: any
  try {
    parsed = JSON.parse(rawArgs)
  } catch (e) {
    console.warn('Tool args JSON parse failed, attempting repair. Length:', rawArgs.length)
    // Truncation guard: balance braces/brackets so we recover at least the head fields
    const cleaned = rawArgs.replace(/[\u0000-\u001F]+/g, ' ')
    let opened = 0, closedNeeded = 0, openSq = 0, closeSqNeeded = 0
    for (const ch of cleaned) {
      if (ch === '{') opened++
      else if (ch === '}') opened--
      else if (ch === '[') openSq++
      else if (ch === ']') openSq--
    }
    closedNeeded = Math.max(0, opened)
    closeSqNeeded = Math.max(0, openSq)
    const repaired = cleaned + ']'.repeat(closeSqNeeded) + '}'.repeat(closedNeeded)
    try {
      parsed = JSON.parse(repaired)
      console.log('Recovered partial CV via brace-balancing repair')
    } catch (e2) {
      console.error('Could not repair tool args, returning minimal result')
      parsed = {}
    }
  }

  // Cross-validation: drop work_history entries missing required fields
  if (Array.isArray(parsed.work_history)) {
    parsed.work_history = parsed.work_history.filter((w: any) =>
      w && typeof w === 'object' && (w.company || '').toString().trim() && (w.title || '').toString().trim()
    )
  }
  if (Array.isArray(parsed.skills)) {
    parsed.skills = Array.from(new Set(parsed.skills.map((s: any) => String(s || '').trim()).filter(Boolean))).slice(0, 25)
  }

  const candidateId = `CV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  return {
    candidate_id: candidateId,
    name: normalizeNameCasing(parsed.name) || 'Unknown',
    current_title: parsed.current_title || 'Not specified',
    location: parsed.location || 'Not specified',
    email: parsed.email || undefined,
    phone: parsed.phone || undefined,
    summary: parsed.summary || undefined,
    skills: parsed.skills || [],
    work_history: parsed.work_history || [],
    education: parsed.education || []
  }
}
