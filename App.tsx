import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import { AnnotationItem, ProcessingStage, TargetLanguage } from './types';
import { DEFAULT_CONFIG } from './constants';
import { analyzeImage } from './services/geminiService';
import { processCanvas } from './utils/imageProcessing';

const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('IDLE');
  const [targetLang, setTargetLang] = useState<TargetLanguage>(DEFAULT_CONFIG.targetLang);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);

  // Handle File Upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
          setStage('IDLE');
          setErrorMsg(null);
          setAnnotations([]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Draw initial image to canvases
  useEffect(() => {
    if (imageSrc && originalCanvasRef.current && resultCanvasRef.current) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const w = img.width;
        const h = img.height;

        // Set dimensions for both canvases
        originalCanvasRef.current!.width = w;
        originalCanvasRef.current!.height = h;
        resultCanvasRef.current!.width = w;
        resultCanvasRef.current!.height = h;

        // Draw original
        const ctxOrig = originalCanvasRef.current!.getContext('2d');
        ctxOrig?.drawImage(img, 0, 0);

        // Draw result (initially copy of original)
        const ctxRes = resultCanvasRef.current!.getContext('2d');
        ctxRes?.drawImage(img, 0, 0);
      };
    }
  }, [imageSrc]);

  // Main Processing Workflow
  const handleProcess = async () => {
    if (!imageSrc) return;
    setStage('ANALYZING');
    setErrorMsg(null);

    try {
      // Step 1: Gemini Vision Analysis (OCR + Translation + Detection)
      const detectedItems = await analyzeImage(imageSrc, targetLang);
      setAnnotations(detectedItems);

      setStage('RECONSTRUCTING');
      
      // Step 2: Client-Side Image Reconstruction (Inpainting + Text Layout)
      // Small timeout to allow React to render the state change
      setTimeout(() => {
        if (resultCanvasRef.current && originalCanvasRef.current) {
          // Reset result canvas to clean original state before processing
          const ctxRes = resultCanvasRef.current.getContext('2d');
          ctxRes?.drawImage(originalCanvasRef.current, 0, 0);
          
          processCanvas(resultCanvasRef.current, detectedItems, DEFAULT_CONFIG);
          setStage('COMPLETED');
        }
      }, 100);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred during processing.");
      setStage('ERROR');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        
        {/* API Key Check (Simple visual warning if not set in environment, though in prod this is handled differently) */}
        {!process.env.API_KEY && (
           <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6 text-center">
             ⚠️ API Key missing. Please configure `process.env.API_KEY` with a valid Google Gemini API Key.
           </div>
        )}

        <ControlPanel 
          stage={stage}
          targetLang={targetLang}
          setTargetLang={setTargetLang}
          onProcess={handleProcess}
          onUpload={handleUpload}
          hasImage={!!imageSrc}
        />

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-lg mb-6">
            Error: {errorMsg}
          </div>
        )}

        {/* Canvases Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
          
          {/* Original View */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden relative group">
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white z-10">
              ORIGINAL
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              {imageSrc ? (
                 <canvas ref={originalCanvasRef} className="max-w-full shadow-2xl" style={{ maxHeight: '100%' }} />
              ) : (
                <div className="text-slate-500 flex flex-col items-center">
                   <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                   <p>No image loaded</p>
                </div>
              )}
            </div>
          </div>

          {/* Result View */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col overflow-hidden relative group">
            <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold text-white z-10 transition-colors ${stage === 'COMPLETED' ? 'bg-green-600' : 'bg-blue-600'}`}>
              {stage === 'COMPLETED' ? 'TRANSLATED' : 'PREVIEW'}
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              {imageSrc ? (
                 <canvas ref={resultCanvasRef} className="max-w-full shadow-2xl" style={{ maxHeight: '100%' }} />
              ) : (
                 <div className="text-slate-500 flex flex-col items-center">
                   <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                   <p>Waiting for process...</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Stats / Info Footer */}
        {annotations.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
               <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Blocks Detected</div>
               <div className="text-2xl font-bold text-white">{annotations.length}</div>
             </div>
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
               <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Target Language</div>
               <div className="text-2xl font-bold text-white">{targetLang}</div>
             </div>
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
               <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Method</div>
               <div className="text-xl font-medium text-white truncate">Smart Inpaint + Auto-Size</div>
             </div>
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
               <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Engine</div>
               <div className="text-xl font-medium text-blue-400">Gemini 2.5 Flash</div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
