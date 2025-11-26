import { TargetLanguage } from "./types";

export const APP_NAME = "TechDraw Translator";

export const DEFAULT_CONFIG = {
  targetLang: TargetLanguage.ENGLISH,
  // Engineering drawings usually have small, uniform text (approx 2.5mm - 5mm).
  // We clamp the size to avoid "cartoonishly large" text in empty spaces.
  minFontSize: 9,
  maxFontSize: 16, 
  // Ultra-tight padding to prevent erasing nearby geometry lines.
  padding: 1, 
};

export const SAMPLE_IMAGE_URL = "https://picsum.photos/800/600";