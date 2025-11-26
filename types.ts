export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface AnnotationItem {
  originalText: string;
  translatedText: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] (0-1000 scale)
  category: 'TEXT' | 'TECHNICAL';
}

export enum TargetLanguage {
  ENGLISH = 'English',
  CHINESE = 'Chinese (Simplified)',
  RUSSIAN = 'Russian'
}

export interface ProcessingConfig {
  targetLang: TargetLanguage;
  minFontSize: number;
  maxFontSize: number;
  padding: number;
}

export type ProcessingStage = 'IDLE' | 'ANALYZING' | 'RECONSTRUCTING' | 'COMPLETED' | 'ERROR';