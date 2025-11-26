import { AnnotationItem, ProcessingConfig } from "../types";

/**
 * Converts 0-1000 normalized coordinates to pixel coordinates
 */
const denormalizeBox = (
  box: [number, number, number, number],
  width: number,
  height: number
) => {
  const [ymin, xmin, ymax, xmax] = box;
  return {
    y: (ymin / 1000) * height,
    x: (xmin / 1000) * width,
    h: ((ymax - ymin) / 1000) * height,
    w: ((xmax - xmin) / 1000) * width,
  };
};

/**
 * Step 5a: Precision Inpainting (Background Recovery)
 * 
 * IMPROVED ALGORITHM:
 * Instead of simply averaging all border pixels (which turns gray if a black line is nearby),
 * we filter for "Light" pixels only. This assumes the paper background is lighter than the ink.
 */
const smartInpaint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  padding: number
) => {
  // 1. Define the repair zone
  const pad = padding; 
  const rx = Math.max(0, Math.floor(x - pad));
  const ry = Math.max(0, Math.floor(y - pad));
  const rw = Math.floor(w + pad * 2);
  const rh = Math.floor(h + pad * 2);

  // Safe bounds check
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  // Sample a thin border AROUND the rect
  const sampleThickness = 3; 
  
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  
  const getImageDataSafe = (sx: number, sy: number, sw: number, sh: number) => {
    if (sx < 0 || sy < 0 || sx + sw > canvasWidth || sy + sh > canvasHeight) return null;
    return ctx.getImageData(sx, sy, sw, sh);
  };

  // Get samples from 4 sides
  const samples = [
    getImageDataSafe(rx, ry - sampleThickness, rw, sampleThickness), // Top
    getImageDataSafe(rx, ry + rh, rw, sampleThickness),              // Bottom
    getImageDataSafe(rx - sampleThickness, ry, sampleThickness, rh), // Left
    getImageDataSafe(rx + rw, ry, sampleThickness, rh)               // Right
  ];

  const processData = (imgData: ImageData | null) => {
    if (!imgData) return;
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // LOGIC: Only consider pixels that are "Light" (Background).
      // If a pixel is dark (ink/lines), ignore it so we don't smear gray lines.
      // Threshold: Average brightness > 120 (out of 255)
      const brightness = (r + g + b) / 3;
      
      if (brightness > 120) {
        rSum += r;
        gSum += g;
        bSum += b;
        count++;
      }
    }
  };

  samples.forEach(processData);

  let finalR = 255, finalG = 255, finalB = 255;

  if (count > 0) {
    finalR = Math.round(rSum / count);
    finalG = Math.round(gSum / count);
    finalB = Math.round(bSum / count);
  }

  // Fill the "wound" with the calculated clean background color
  ctx.fillStyle = `rgb(${finalR},${finalG},${finalB})`;
  ctx.fillRect(rx, ry, rw, rh);
};

/**
 * Step 5b: Smart Write - Engineering Style Typography
 * Updated to handle lists and paragraphs with alignment intelligence.
 */
const drawAdaptiveText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  config: ProcessingConfig
) => {
  const { minFontSize, maxFontSize } = config;
  // Use Roboto Mono for numbers/technical look, Noto Sans SC for Chinese
  const fontFamily = "'Roboto Mono', 'Noto Sans SC', monospace"; 

  // --- Alignment Detection ---
  // If text has newlines, or starts with "1.", "-", or "•", treat it as a list/note -> Left Align
  // Otherwise (short labels, titles) -> Center Align
  const isListOrMultiLine = text.includes('\n') || /^\s*(\d+\.|-|•)/.test(text);
  const alignment = isListOrMultiLine ? 'left' : 'center';

  let fontSize = maxFontSize;
  let finalLines: string[] = [];
  const lineHeightMultiplier = 1.2; // Slightly more breathing room for lists
  
  // Helper to split text into wrapped lines for a given font size
  const computeLines = (currentFontSize: number): string[] => {
    ctx.font = `${currentFontSize}px ${fontFamily}`;
    
    // 1. Split by explicit newlines (from API)
    const paragraphs = text.split('\n'); 
    const allWrappedLines: string[] = [];

    for (const paragraph of paragraphs) {
      if (!paragraph) {
         // Preserve empty lines if necessary, but usually we skip them in drawings
         continue; 
      }
      
      const words = paragraph.split(''); // Char split for CJK support mixed with English
      // Optimization: For pure English sentences, word splitting is cleaner, but CJK needs char split.
      // We use a simple tokenization strategy:
      const tokens = paragraph.includes(' ') ? paragraph.split(' ') : paragraph.split('');
      const separator = paragraph.includes(' ') ? ' ' : '';

      let currentLine = tokens[0];
      
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const testLine = currentLine + separator + token;
        const width = ctx.measureText(testLine).width;
        
        if (width <= w) {
          currentLine = testLine;
        } else {
          // Check if single word is too wide (rare but possible)
          if (ctx.measureText(token).width > w) {
             // If a single word is too big, this font size fails immediately
             return []; 
          }
          allWrappedLines.push(currentLine);
          currentLine = token;
        }
      }
      allWrappedLines.push(currentLine);
    }
    return allWrappedLines;
  };

  // Iterative sizing loop
  while (fontSize >= minFontSize) {
    const lines = computeLines(fontSize);
    
    // Check if lines were successfully generated (no single word overflow)
    if (lines.length > 0) {
      const totalHeight = lines.length * (fontSize * lineHeightMultiplier);
      if (totalHeight <= h) {
        finalLines = lines;
        break; // Found the largest size that fits
      }
    }
    fontSize--;
  }

  // Fallback: If text is too huge, use minFontSize and clip/draw anyway
  if (finalLines.length === 0) {
    fontSize = minFontSize;
    finalLines = computeLines(minFontSize);
    // If computeLines failed due to width even at min size, force split by char (brute force)
    if (finalLines.length === 0) {
       finalLines = [text]; // Last resort: just draw raw text
    }
  }

  // Draw the text
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = "#1f2937"; // Dark gray
  ctx.textBaseline = "middle";
  ctx.textAlign = alignment;
  
  const lineHeight = fontSize * lineHeightMultiplier;
  const totalTextBlockHeight = finalLines.length * lineHeight;
  
  // Vertical Centering calculation
  // Start drawing at: Y_center - Half_Total_Height + Half_First_Line_Height
  const startY = y + (h - totalTextBlockHeight) / 2 + (lineHeight / 2);
  
  // Horizontal Position
  const drawX = alignment === 'left' ? x : x + w / 2;

  finalLines.forEach((line, index) => {
    // Add small adjustment to Y to correct visual baseline
    ctx.fillText(line, drawX, startY + index * lineHeight - (fontSize * 0.1));
  });
};

export const processCanvas = (
  canvas: HTMLCanvasElement,
  annotations: AnnotationItem[],
  config: ProcessingConfig
) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Filter items to process
  const itemsToProcess = annotations.filter(item => {
    // 1. Strictly ignore TECHNICAL items
    if (item.category === 'TECHNICAL') return false;
    
    // 2. Ignore if text hasn't changed (preserving original pixels is always better)
    const original = item.originalText ? item.originalText.trim() : "";
    const translated = item.translatedText ? item.translatedText.trim() : "";
    if (original === translated) return false;

    // 3. Ignore empty translations
    if (!translated) return false;
    
    return true;
  });

  // Pass 1: Precision Inpaint
  itemsToProcess.forEach((item) => {
    const coords = denormalizeBox(item.box_2d, width, height);
    smartInpaint(ctx, coords.x, coords.y, coords.w, coords.h, config.padding);
  });

  // Pass 2: Engineering Write
  itemsToProcess.forEach((item) => {
    const coords = denormalizeBox(item.box_2d, width, height);
    drawAdaptiveText(
        ctx, 
        item.translatedText, 
        coords.x, 
        coords.y, 
        coords.w, 
        coords.h, 
        config
    );
  });
};