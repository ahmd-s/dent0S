import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(
      await audioFile.arrayBuffer()
    );

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
              content: 'You are a clinical documentation assistant for a dental clinic in India. Extract the following from this doctor-patient conversation transcript and return ONLY a JSON object with no other text: { "chief_complaint": "main reason for visit", "clinical_notes": "examination findings", "diagnosis": "diagnosis text", "treatment_done": "treatment performed today", "treatment_plan": "plan for next visit", "prescriptions": [{ "medicine_name": "name", "dosage": "amount", "frequency": "how often", "duration": "how long", "instructions": "special instructions" }], "next_visit_recommended": false, "next_visit_notes": "" } If any field is not mentioned use empty string, false for boolean, empty array for prescriptions. Transcript: ' + transcript,
            },
          ],
        }),
      }
    );

    if (!extractionResponse.ok) {
      return NextResponse.json({
        transcript,
        extracted: null,
        error: 'Extraction failed',
      });
    }

    const extractionResult = 
      await extractionResponse.json();
    const extractedText = 
      extractionResult.content[0].text;

    let extracted = null;
    try {
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