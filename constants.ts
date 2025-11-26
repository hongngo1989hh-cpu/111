import { TargetLanguage } from "./types";

export const APP_NAME = "TechDraw Translator";

export const DEFAULT_CONFIG = {
  targetLang: TargetLanguage.ENGLISH,
  minFontSize: 9,
  maxFontSize: 16, // Reduced from 28 to 16 to match standard engineering drawing text size
  padding: 1, // Reduced from 4 to 1 to prevent erasing surrounding lines/geometry
};

export const SAMPLE_IMAGE_URL = "https://picsum.photos/800/600";