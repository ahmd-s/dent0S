import { NextResponse } from 'next/server';
import axios from 'axios';

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

    // STEP 1: Transcribe with Groq Whisper
    const groqFormData = new FormData();
    const audioBlob = new Blob(
      [audioBuffer], 
      { type: 'audio/webm' }
    );
    groqFormData.append('file', audioBlob, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('language', 'en');

    const transcriptionResponse = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      groqFormData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    const transcript = transcriptionResponse.data.text;

    // STEP 2: Extract with Groq LLM (free)
    const extractionResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You are a clinical documentation assistant for a dental clinic in India. Extract structured data from doctor-patient conversation transcripts. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Just the raw JSON object.'
          },
          {
            role: 'user',
            content: `Extract the following fields from this dental note:

- chief_complaint: what the patient complains about
- clinical_notes/examination_findings: clinical observations
- diagnosis: the diagnosis
- treatment_done: what treatment was actually performed today (look for phrases like 'treatment done today', 'we performed', 'procedure done', 'initiated', 'completed today')
- treatment_plan/plan_for_next_visit: future plans
- prescriptions: medicines with dosage and frequency

Return ONLY a JSON object:

{
  "chief_complaint": "main reason for visit as a short sentence",
  "clinical_notes": "examination findings mentioned",
  "diagnosis": "diagnosis mentioned",
  "treatment_done": "treatment performed today (look for phrases like 'treatment done today', 'we performed', 'procedure done', 'initiated', 'completed today')",
  "treatment_plan": "plan for future visits",
  "prescriptions": [
    {
      "medicine_name": "name of medicine",
      "dosage": "dose amount like 500mg",
      "frequency": "how often like TDS or BD or OD",
      "duration": "how long like 5 days",
      "instructions": "special instructions like after food"
    }
  ],
  "next_visit_recommended": false,
  "next_visit_notes": ""
}

Rules:
- Use empty string for missing text fields
- Use false for next_visit_recommended if not mentioned
- Use empty array for prescriptions if none mentioned
- Extract ALL medicines mentioned
- next_visit_recommended should be true if follow up is mentioned
- For treatment_done, look specifically for what was done TODAY in this visit

Transcript: ${transcript}`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    const extractedText = extractionResponse.data.choices[0].message.content;

    let extracted = null;
    try {
      const cleanJson = extractedText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      extracted = JSON.parse(cleanJson);
    } catch (e) {
      console.error('JSON parse error:', e);
      console.error('Raw response:', extractedText);
    }

    return NextResponse.json({
      transcript,
      extracted,
    });

  } catch (error) {
    console.error("VOICE ROUTE CRASH:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}