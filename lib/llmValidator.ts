/**
 * llmValidator.ts — Expo/React Native only
 * Validates complaints and their attached images using Gemini 2.0 Flash.
 */

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export interface LLMValidationResult {
  valid: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;           // Explication/reason shown to the user (preferably in the language of the complaint)
  issue_confirmed: string;  // Confirming the category or giving a corrected one
}

/**
 * Validates the text of a complaint and optionally an attached image using Gemini 2.0 Flash.
 *
 * @param complaintText Plain text description of the civic issue
 * @param issueType The predicted issue type (e.g. "Street Light", "Road Damage")
 * @param imageBase64 Optional base64-encoded image string (without data:image/... prefix)
 * @param mimeType Optional mimeType of the image (e.g. "image/jpeg")
 */
export async function validateComplaintWithLLM(
  complaintText: string,
  issueType: string,
  imageBase64: string | null = null,
  mimeType: string = 'image/jpeg'
): Promise<LLMValidationResult> {
  if (!GEMINI_API_KEY) {
    console.warn('EXPO_PUBLIC_GEMINI_API_KEY is not set. Skipping LLM validation (auto-approving).');
    return {
      valid: true,
      confidence: 'LOW',
      reason: 'Gemini API Key missing, auto-approved.',
      issue_confirmed: issueType,
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  // Build content parts
  const contentsParts: any[] = [];

  // System instruction / Context
  const systemInstruction = 
    `You are an AI auditor/validator for JanSetu, a citizen-focused civic issue reporting platform in India.
Your task is to analyze the user's written/voice complaint and the optional attached image.

Check two criteria:
1. Is the complaint valid? (i.e. is it a real, genuine civic issue like potholes, garbage, street light issues, water supply, illegal construction, stray animals, electricity hazard? Reject spam, gibberish, test entries, personal disputes, self-promotion, or offensive content).
2. If an image is provided, does it match the text description of the issue? (e.g. if text says "broken street light" but the image is a selfie, a plate of food, a screenshot of a chat, or a generic clean street, reject it).

Respond with a JSON object matching this TypeScript structure:
{
  "valid": boolean,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reason": "Clear explanation of why it is valid or invalid. If invalid, explain the mismatch or issue politely in Hindi or English (based on text language) so the citizen can correct it.",
  "issue_confirmed": "The confirmed/corrected department or category name (e.g., 'Street Light', 'Road Damage')"
}`;

  const prompt = `Complaint text: "${complaintText}"
Reported category: "${issueType}"
Analyze the complaint above. Check if it's a valid civic issue and if the image (if provided) matches. Respond in JSON.`;

  // If there's an image, insert it as an inlineData block
  if (imageBase64) {
    contentsParts.push({
      inlineData: {
        mimeType: mimeType,
        data: imageBase64
      }
    });
  }

  contentsParts.push({
    text: prompt
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: contentsParts
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1, // low temperature for consistent evaluation
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const resJson = await response.json();
    const resultText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error('Gemini returned an empty response');
    }

    const parsedResult: LLMValidationResult = JSON.parse(resultText);
    return parsedResult;

  } catch (error) {
    console.error('Gemini Validation error:', error);
    // Fallback in case of rate limits or failures
    return {
      valid: true, // Fail-open to avoid locking the application, but flag confidence
      confidence: 'LOW',
      reason: `Validation service unavailable: ${error instanceof Error ? error.message : String(error)}. Form submitted without verification.`,
      issue_confirmed: issueType
    };
  }
}
