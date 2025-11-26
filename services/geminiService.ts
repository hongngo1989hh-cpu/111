import { GoogleGenAI, Type } from "@google/genai";
import { AnnotationItem, TargetLanguage } from "../types";

export const analyzeImage = async (
  base64Image: string,
  targetLang: TargetLanguage
): Promise<AnnotationItem[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert technical drawing optical character recognition (OCR) and translation engine.
    
    Task:
    1. Detect all text blocks in the provided technical drawing.
    2. Classify each block into one of two categories:
       - 'TECHNICAL': Pure numbers, measurements (e.g., "R15.5", "ø25.4", "120", "+/-0.1"), geometric symbols, reference codes (e.g., "A-A", "B"), or isolated single letters.
       - 'TEXT': Descriptive words, sentences, titles, notes, technical requirements, and material names (e.g., "Steel", "Section View", "1. Hardness...").
    3. Translate the content to ${targetLang}:
       - If category is 'TECHNICAL': The 'translatedText' MUST BE IDENTICAL to 'originalText'. Do not translate or alter it.
       - If category is 'TEXT': Translate the text naturally. 
         **CRITICAL FORMATTING RULE**: If the text contains a numbered list (e.g., "1. Condition A 2. Condition B") or multiple specifications, YOU MUST insert a newline character (\\n) between items. Do not merge them into a single paragraph. Keep the translation compact and aligned.
    4. Return the bounding box coordinates for each text block using the 0-1000 scale (ymin, xmin, ymax, xmax).
  `;

  // Remove data URL prefix if present for the API call
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png", // Assuming PNG or JPEG, Gemini handles standard image types well
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING },
              translatedText: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['TEXT', 'TECHNICAL'] },
              box_2d: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "Bounding box [ymin, xmin, ymax, xmax] normalized to 1000x1000",
              },
            },
            required: ["originalText", "translatedText", "box_2d", "category"],
          },
        },
      },
    });

    if (!response.text) {
      throw new Error("No response from AI model.");
    }

    const data = JSON.parse(response.text) as AnnotationItem[];
    return data;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};