import React from 'react';
import { ProcessingStage, TargetLanguage } from '../types';

interface ControlPanelProps {
  stage: ProcessingStage;
  targetLang: TargetLanguage;
  setTargetLang: (lang: TargetLanguage) => void;
  onProcess: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  hasImage: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  stage,
  targetLang,
  setTargetLang,
  onProcess,
  onUpload,
  onDownload,
  hasImage
}) => {
  const isProcessing = stage === 'ANALYZING' || stage === 'RECONSTRUCTING';
  const isComplete = stage === 'COMPLETED';

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
      
      {/* Upload Section */}
      <div className="md:col-span-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">Source Drawing</label>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={onUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isProcessing}
          />
          <div className={`
            border-2 border-dashed rounded-lg p-3 text-center transition-all
            ${hasImage ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 bg-slate-900'}
          `}>
            {hasImage ? (
              <span className="text-blue-400 font-medium text-sm">Image Loaded</span>
            ) : (
              <span className="text-slate-400 text-sm">Click to Upload Image</span>
            )}
          </div>
        </div>
      </div>

      {/* Language Section */}
      <div className="md:col-span-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">Target Language</label>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value as TargetLanguage)}
          disabled={isProcessing}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {Object.values(TargetLanguage).map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {/* Action Section */}
      <div className="md:col-span-4 flex gap-2">
        <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-2">&nbsp;</label>
            <button
            onClick={onProcess}
            disabled={!hasImage || isProcessing}
            className={`
                w-full py-3 px-4 rounded-lg font-semibold text-white shadow-lg transition-all flex items-center justify-center gap-2
                ${!hasImage || isProcessing 
                ? 'bg-slate-600 cursor-not-allowed opacity-50' 
                : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 active:scale-95'}
            `}
            >
            {isProcessing ? (
                <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
                </>
            ) : (
                <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                <span>Translate</span>
                </>
            )}
            </button>
        </div>
        
        {isComplete && (
             <div className="w-1/3">
                <label className="block text-sm font-medium text-slate-400 mb-2">&nbsp;</label>
                <button
                    onClick={onDownload}
                    className="w-full py-3 px-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-500 shadow-lg transition-all flex items-center justify-center active:scale-95"
                    title="Download Result"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                </button>
             </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;