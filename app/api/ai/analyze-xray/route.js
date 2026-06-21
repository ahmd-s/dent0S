import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const prompt = `You are a dental radiograph analysis assistant. 
Analyze this dental X-ray image and provide:
1. Key radiographic findings
2. Possible diagnoses based on findings  
3. Recommended treatment considerations
Keep response concise and clinical.
Format as plain text, no markdown symbols.`

    // Fetch the image and convert to base64
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
    }
    
    const buffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(buffer).toString('base64')
    
    // Detect mime type from URL or default to jpeg
    const mimeType = imageUrl.includes('.png') ? 'image/png' : 
                     imageUrl.includes('.webp') ? 'image/webp' : 'image/jpeg'

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Gemini API error:', errorData)
      return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
    }

    const data = await response.json()
    const findings = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available'

    return NextResponse.json({ findings })
  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
