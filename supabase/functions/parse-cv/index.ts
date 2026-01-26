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

    // Extract text from the file
    const fileBuffer = await file.arrayBuffer()
    const fileText = await extractTextFromFile(file, fileBuffer)

    if (!fileText || fileText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not extract text from file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use AI to parse the CV content
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const candidateData = await parseWithAI(fileText, LOVABLE_API_KEY)

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

async function extractTextFromFile(file: File, buffer: ArrayBuffer): Promise<string> {
  const fileName = file.name.toLowerCase()
  
  if (fileName.endsWith('.pdf')) {
    const uint8Array = new Uint8Array(buffer)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let rawText = decoder.decode(uint8Array)
    
    const textMatches = rawText.match(/stream[\s\S]*?endstream/g) || []
    let extractedText = ''
    
    for (const match of textMatches) {
      const cleaned = match
        .replace(/stream|endstream/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (cleaned.length > 10) {
        extractedText += cleaned + ' '
      }
    }
    
    if (extractedText.length < 100) {
      extractedText = rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    return extractedText.slice(0, 15000)
  }
  
  if (fileName.endsWith('.docx')) {
    const uint8Array = new Uint8Array(buffer)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const rawText = decoder.decode(uint8Array)
    
    const textContent = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return textContent.slice(0, 15000)
  }
  
  if (fileName.endsWith('.doc')) {
    const uint8Array = new Uint8Array(buffer)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const rawText = decoder.decode(uint8Array)
    
    const textContent = rawText
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return textContent.slice(0, 15000)
  }
  
  return ''
}

async function parseWithAI(cvText: string, apiKey: string): Promise<ParsedCandidate> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: `You are a CV/resume parser. Extract comprehensive candidate information from the provided CV text.
You must return the data using the extract_candidate_info function.
Be accurate and extract real information - do not make up data.
Extract ALL work history entries with company names - this is critical for finding job opportunities.
If information is not clearly present, leave that field empty or use "Not specified".`
        },
        {
          role: 'user',
          content: `Parse the following CV and extract the candidate's full profile including all work experience:\n\n${cvText}`
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
                  description: 'Key skills mentioned in the CV (max 15)'
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
      tool_choice: { type: 'function', function: { name: 'extract_candidate_info' } }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('AI API error:', response.status, errorText)
    throw new Error('Failed to parse CV with AI')
  }

  const data = await response.json()
  
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.function.name !== 'extract_candidate_info') {
    throw new Error('AI did not return expected format')
  }

  const parsed = JSON.parse(toolCall.function.arguments)
  
  const candidateId = `CV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  return {
    candidate_id: candidateId,
    name: parsed.name || 'Unknown',
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
