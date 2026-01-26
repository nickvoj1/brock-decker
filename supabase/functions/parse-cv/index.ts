import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedCandidate {
  candidate_id: string
  name: string
  position: string
  location: string
  company?: string
  email?: string
  phone?: string
  skills?: string[]
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
    // For PDF, we'll extract text using a simple approach
    // Convert buffer to text and try to extract readable content
    const uint8Array = new Uint8Array(buffer)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let rawText = decoder.decode(uint8Array)
    
    // Try to extract text between stream markers (common in PDFs)
    const textMatches = rawText.match(/stream[\s\S]*?endstream/g) || []
    let extractedText = ''
    
    for (const match of textMatches) {
      // Extract readable ASCII content
      const cleaned = match
        .replace(/stream|endstream/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (cleaned.length > 10) {
        extractedText += cleaned + ' '
      }
    }
    
    // If stream extraction didn't work well, try direct text extraction
    if (extractedText.length < 100) {
      extractedText = rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
    
    // Limit to first 15000 chars to stay within AI context limits
    return extractedText.slice(0, 15000)
  }
  
  if (fileName.endsWith('.docx')) {
    // For DOCX, extract text from the XML content
    const uint8Array = new Uint8Array(buffer)
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const rawText = decoder.decode(uint8Array)
    
    // Extract text from XML tags
    const textContent = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return textContent.slice(0, 15000)
  }
  
  if (fileName.endsWith('.doc')) {
    // For older DOC format, try to extract readable text
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
          content: `You are a CV/resume parser. Extract candidate information from the provided CV text. 
You must return the data using the extract_candidate_info function.
Be accurate and extract real information - do not make up data.
If information is not clearly present, leave that field empty or use "Not specified".`
        },
        {
          role: 'user',
          content: `Parse the following CV and extract the candidate's information:\n\n${cvText}`
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'extract_candidate_info',
            description: 'Extract structured candidate information from a CV',
            parameters: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Full name of the candidate'
                },
                position: {
                  type: 'string',
                  description: 'Current or most recent job title/position'
                },
                location: {
                  type: 'string',
                  description: 'City, state/country or location of the candidate'
                },
                company: {
                  type: 'string',
                  description: 'Current or most recent company/employer'
                },
                email: {
                  type: 'string',
                  description: 'Email address'
                },
                phone: {
                  type: 'string',
                  description: 'Phone number'
                },
                skills: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key skills mentioned in the CV (max 10)'
                }
              },
              required: ['name', 'position', 'location'],
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
  
  // Extract the tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.function.name !== 'extract_candidate_info') {
    throw new Error('AI did not return expected format')
  }

  const parsed = JSON.parse(toolCall.function.arguments)
  
  // Generate a unique candidate ID
  const candidateId = `CV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  return {
    candidate_id: candidateId,
    name: parsed.name || 'Unknown',
    position: parsed.position || 'Not specified',
    location: parsed.location || 'Not specified',
    company: parsed.company || undefined,
    email: parsed.email || undefined,
    phone: parsed.phone || undefined,
    skills: parsed.skills || undefined
  }
}
