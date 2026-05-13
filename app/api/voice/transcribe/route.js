import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const audioBuffer = Buffer.from(
      await audioFile.arrayBuffer()
    );

    // Send to Groq Whisper for transcription
    const groqFormData = new FormData();
    const audioBlob = new Blob(
      [audioBuffer], 
      { type: 'audio/webm' }
    );
    groqFormData.append('file', audioBlob, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('language', 'en');

    const transcriptionResponse = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: groqFormData,
      }
    );

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.json();
      console.error('Groq error:', error);
      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: 500 }
      );
    }

    const transcriptionResult = 
      await transcriptionResponse.json();
    const transcript = transcriptionResult.text;

    // Send transcript to Claude for extraction
    const extractionResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `You are a clinical documentation 
assistant for a dental clinic in India.

Extract the following from this doctor-patient 
conversation transcript and return ONLY a JSON 
object with no other text:

{
  "chief_complaint": "main reason for visit",
  "clinical_notes": "examination findings",
  "diagnosis": "diagnosis text",
  "treatment_done": "treatment performed today",
  "treatment_plan": "plan for next visit",
  "prescriptions": [
    {
      "medicine_name": "name",
      "dosage": "amount",
      "frequency": "how often",
      "duration": "how long",
      "instructions": "special instructions"
    }
  ],
  "next_visit_recommended": true or false,
  "next_visit_notes": "notes for next visit"
}

If any field is not mentioned in the transcript, 
use an empty string "" for text fields, 
false for boolean, and [] for arrays.

Transcript:
${transcript}`,
            },
          ],
        }),
      }
    );

    if (!extractionResponse.ok) {
      // Return just transcript if Claude fails
      return NextResponse.json({
        transcript,
        extracted: null,
        error: 'Extraction failed, transcript only',
      });
    }

    const extractionResult = 
      await extractionResponse.json();
    const extractedText = 
      extractionResult.content[0].text;

    // Parse the JSON response from Claude
    let extracted = null;
    try {
      // Remove any markdown code blocks if present
      const cleanJson = extractedText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      extracted = JSON.parse(cleanJson);
    } catch (e) {
      console.error('JSON parse error:', e);
    }

    return NextResponse.json({
      transcript,
      extracted,
    });

  } catch (error) {
    console.error('Voice transcription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}