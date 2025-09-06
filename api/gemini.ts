import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

// Vercel has a default body size limit of 4.5mb. This can be increased if needed.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pdfText, action } = req.body;

  if (!pdfText || !action) {
    return res.status(400).json({ error: 'Missing pdfText or action' });
  }
  
  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let prompt = "";

    if (action === "summary" || action === "studyPlan") {
        if (action === "summary") {
            prompt = `Provide a concise, well-structured summary of the following document. Use markdown for formatting:\n\n---\n${pdfText}\n---`;
        } else { // studyPlan
            prompt = `Based on the following document, create a detailed 4-week study plan. Break it down week by week with specific goals, topics to cover, and suggestions for revision. Use markdown for formatting:\n\n---\n${pdfText}\n---`;
        }
      
        const stream = await ai.models.generateContentStream({ model: "gemini-2.5-flash", contents: prompt });
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        for await (const chunk of stream) {
            res.write(chunk.text);
        }
        res.end();

    } else if (action === "quiz") {
      const quizSchema = {
        type: Type.OBJECT,
        properties: {
          quiz: {
            type: Type.ARRAY, description: "An array of quiz questions.",
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["mcq", "tf", "short"] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
              },
              required: ["question", "type", "answer"],
            },
          },
        },
      };
      prompt = `Generate a 10-question quiz based on the following document. Include multiple-choice (mcq), true/false (tf), and short-answer (short) questions. For each question, provide the question, type, options (for mcq), and the correct answer. The answer for mcq must exactly match one of the options. Document content:\n\n---\n${pdfText}\n---`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: quizSchema },
      });

      const jsonText = response.text;
      if (!jsonText) {
        throw new Error("Failed to generate quiz. The AI returned an empty response.");
      }
      
      res.status(200).json(JSON.parse(jsonText.trim()));

    } else {
      return res.status(400).json({ error: 'Invalid action specified' });
    }
  } catch (e: any) {
    console.error('Error calling Gemini API:', e);
    res.status(500).json({ error: 'An error occurred while communicating with the AI.' });
  }
}