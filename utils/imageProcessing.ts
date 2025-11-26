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
      // Threshold: Average brightness > 150 (out of 255)
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

  let fontSize = maxFontSize;
  let lines: string[] = [];
  let lineHeight = 1.1; // Tight line height for technical drawings
  
  // Iterative sizing loop
  while (fontSize >= minFontSize) {
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    
    // Check single line fit
    if (metrics.width <= w && fontSize * lineHeight <= h) {
      lines = [text];
      break; 
    }
    
    // If we are getting small, try wrapping
    if (fontSize <= maxFontSize * 0.8) {
      const words = text.split(''); // Character split for Chinese/Mixed support
      // Note: For pure English splitting by space is better, but char split is safer for mixed
      // Let's stick to word split for now if space exists, else char split
      const splitChar = text.includes(' ') ? ' ' : '';
      const tokens = text.split(splitChar);
      
      let currentLine = tokens[0];
      const tempLines: string[] = [];
      let validWrap = true;
      
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const testLine = currentLine + splitChar + token;
        const width = ctx.measureText(testLine).width;
        
        if (width < w) {
          currentLine = testLine;
        } else {
          // If a single token is wider than box, this font size is invalid
          if (ctx.measureText(token).width > w) {
             validWrap = false; break;
          }
          tempLines.push(currentLine);
          currentLine = token;
        }
      }
      tempLines.push(currentLine);
      
      const totalHeight = tempLines.length * (fontSize * lineHeight);
      
      if (validWrap && totalHeight <= h) {
        lines = tempLines;
        break; 
      }
    }

    fontSize--;
  }

  // Fallback: Use minFontSize even if it overflows slightly
  if (lines.length === 0) {
    fontSize = minFontSize;
    lines = [text]; // Just draw it, better than nothing
  }

  // Draw the text
  ctx.font = `${fontSize}px ${fontFamily}`;
  // Use a soft dark gray/blue instead of pure black for better integration
  ctx.fillStyle = "#1f2937"; 
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  
  const totalTextBlockHeight = lines.length * (fontSize * lineHeight);
  // Center vertically in the box
  const startY = y + (h - totalTextBlockHeight) / 2 + (fontSize * lineHeight) / 2;
  const centerX = x + w / 2;

  lines.forEach((line, index) => {
    // Offset slightly for visual centering
    ctx.fillText(line, centerX, startY + index * (fontSize * lineHeight) - (fontSize * 0.1));
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