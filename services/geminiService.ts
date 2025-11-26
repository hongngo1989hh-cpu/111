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
    
    CRITICAL INSTRUCTION: You must strictly distinguish between content that needs translation and content that MUST remain untouched to preserve the drawing's integrity.

    Task:
    1. Detect all text blocks in the provided technical drawing.
    2. Classify each block into one of two categories:
       
       CATEGORY 'TECHNICAL' (DO NOT TRANSLATE - Keep Original):
       - All numbers, dimensions, tolerances (e.g., "R15.5", "ø25.4", "+/-0.1").
       - Geometric symbols, single letter references (e.g., "A", "B").
       - View labels and Section identifiers (e.g., "SECTION A-A", "DETAIL B", "View C") -> KEEP THESE ORIGINAL to avoid messing up the layout.
       - Common standard labels that are not critical to the manufacturing process.
       
       CATEGORY 'TEXT' (TRANSLATE):
       - Material specifications (e.g., "Aluminum 6061", "BK7 Glass", "Sapphire").
       - Surface treatment and Processing requirements (e.g., "Polished", "Anodized", "Chamfer 0.5").
       - Optical parameter descriptions (e.g., "Surface Flatness", "Scratch-Dig 60-40", "Coating").
       - Technical notes and critical warnings.

    3. Translate the content to ${targetLang}:
       - If category is 'TECHNICAL': The 'translatedText' MUST BE IDENTICAL to 'originalText'.
       - If category is 'TEXT': Translate the text accurately using technical engineering terminology.
    4. Return the bounding box coordinates for each text block using the 0-1000 scale (ymin, xmin, ymax, xmax). Return TIGHT bounding boxes.
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