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
 * Step 5a: Advanced Erase / Smart Inpainting Simulation
 * Since we don't have OpenCV.inpaint in the browser without heavy WASM,
 * we perform a "Smart Background Fill" which samples the boundary pixels
 * of the text region to find the dominant background color, effectively
 * erasing the text on technical drawings (which usually have uniform backgrounds).
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

  // Get image data for the surrounding area
  // We sample a thin border AROUND the rect to determine background color
  const sampleThickness = 4;
  
  // Safe bounds check
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  const getImageDataSafe = (sx: number, sy: number, sw: number, sh: number) => {
    if (sx < 0 || sy < 0 || sx + sw > canvasWidth || sy + sh > canvasHeight) return null;
    return ctx.getImageData(sx, sy, sw, sh);
  };

  // Sample Top Border
  const topData = getImageDataSafe(rx, ry - sampleThickness, rw, sampleThickness);
  // Sample Bottom Border
  const bottomData = getImageDataSafe(rx, ry + rh, rw, sampleThickness);
  // Sample Left Border
  const leftData = getImageDataSafe(rx - sampleThickness, ry, sampleThickness, rh);
  // Sample Right Border
  const rightData = getImageDataSafe(rx + rw, ry, sampleThickness, rh);

  let r = 0, g = 0, b = 0, count = 0;

  const processData = (imgData: ImageData | null) => {
    if (!imgData) return;
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Simple brightness check to ignore black lines when sampling background
      // If pixel is very dark (likely a line), skip it for background color calculation
      if (data[i] < 50 && data[i+1] < 50 && data[i+2] < 50) continue;
      
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  };

  processData(topData);
  processData(bottomData);
  processData(leftData);
  processData(rightData);

  if (count > 0) {
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
  } else {
    // Fallback to white if we can't sample (e.g. edge of image or only black lines found)
    r = 255; g = 255; b = 255;
  }

  // Fill the "wound" with the calculated background color
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(rx, ry, rw, rh);
};

/**
 * Step 5b: Smart Write - Adaptive Font Sizing & Wrapping
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
  // Use Roboto Mono for engineering style, Noto Sans SC for Chinese support
  const fontFamily = "'Roboto Mono', 'Noto Sans SC', monospace"; 

  let fontSize = maxFontSize;
  let lines: string[] = [];
  let lineHeight = 1.1; // Tighter line height for technical text
  
  // Iterative sizing loop
  while (fontSize >= minFontSize) {
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    
    // Check single line fit
    if (metrics.width <= w && fontSize * lineHeight <= h) {
      lines = [text];
      break; 
    }
    
    // If we are at minFontSize, or close to it, try wrapping
    if (fontSize <= maxFontSize * 0.8 || fontSize === minFontSize) {
      const words = text.split(' ');
      let currentLine = words[0];
      const tempLines: string[] = [];
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < w) {
          currentLine += " " + word;
        } else {
          tempLines.push(currentLine);
          currentLine = word;
        }
      }
      tempLines.push(currentLine);
      
      const totalHeight = tempLines.length * (fontSize * lineHeight);
      
      if (totalHeight <= h) {
        lines = tempLines;
        break; // Found a valid wrap configuration
      }
    }

    fontSize--;
  }

  // If even minFontSize didn't fit perfectly, we strictly clamp to minFontSize and use the wrap calculated
  if (lines.length === 0) {
    fontSize = minFontSize;
    ctx.font = `${fontSize}px ${fontFamily}`;
     const words = text.split(' ');
      let currentLine = words[0] || text;
      lines = [];
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < w) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
  }

  // Draw the text
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = "#1e293b"; // Slate-800, dark grey instead of pure black for better blend
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  
  // Accurate vertical centering
  const totalTextBlockHeight = lines.length * (fontSize * lineHeight);
  // Correction factor: 0.5 * (totalHeight - singleLineHeightAdjustment)
  // But textBaseline middle simplifies this. 
  // We calculate the Y of the *middle* of the text block.
  const blockCenterY = y + h / 2;
  const startY = blockCenterY - (totalTextBlockHeight / 2) + ((fontSize * lineHeight) / 2);
  const centerX = x + w / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + index * (fontSize * lineHeight));
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

  // Filter items to process:
  // 1. Must be categorized as 'TEXT'
  // 2. AND the text must have actually changed
  const itemsToProcess = annotations.filter(item => {
    if (item.category === 'TECHNICAL') return false;
    
    const original = item.originalText ? item.originalText.trim() : "";
    const translated = item.translatedText ? item.translatedText.trim() : "";
    
    return original !== translated;
  });

  // 1. Iteration Pass: Inpaint (Erase)
  // We do this first for all blocks so text doesn't get erased by overlapping boxes
  itemsToProcess.forEach((item) => {
    const coords = denormalizeBox(item.box_2d, width, height);
    // Expand box slightly for cleaner erase (Dilation)
    smartInpaint(ctx, coords.x, coords.y, coords.w, coords.h, config.padding);
  });

  // 2. Iteration Pass: Write Translated Text
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