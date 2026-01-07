import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { EvaluationCriteria, AnalysisResult, ProcessingStatus } from './types';
import * as geminiService from './services/geminiService';
import { translations } from './translations';

import FileUpload from './components/FileUpload';
import CriteriaForm from './components/CriteriaForm';
import ResultsView from './components/ResultsView';

const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [criteria, setCriteria] = useState<EvaluationCriteria>({
    iloClarity: true,
    iloAlignment: true,
    assessmentQuality: true,
    referenceCurrency: true,
    structureCompliance: true,
    benchmarkUniversities: '',
  });
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const t = translations[language];

  const handleLanguageChange = async () => {
    const newLang = language === 'en' ? 'ar' : 'en';
    setLanguage(newLang);

    // If we have results, translate them
    if (results && status === 'complete') {
        setIsTranslating(true);
        try {
            const translatedResults = await geminiService.translateAnalysisResult(results, newLang);
            setResults(translatedResults);
        } catch (error) {
            console.error("Translation failed:", error);
            // Optionally revert language or show warning
        } finally {
            setIsTranslating(false);
        }
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    try {
      setErrorMessage(null);
      setStatus('uploading');
      const filePart = await geminiService.fileToGenerativePart(file);

      setStatus('analyzing');
      const analysis = await geminiService.evaluateSyllabusContent(filePart, criteria, language);
      
      setStatus('gathering_data');
      
      // Execute external searches in parallel to save time
      // We pass the extraction topics from analysis to the benchmarking service for context
      const [benchmarks, tutors] = await Promise.all([
        geminiService.performBenchmarking(
          analysis.courseTitle || 'Unknown Course',
          criteria.benchmarkUniversities,
          analysis.syllabusTopics || [],
          language
        ),
        geminiService.findLocalTutors(
          analysis.courseTitle || 'Unknown Course',
          language
        )
      ]);

      setResults({
        ...analysis,
        benchmarks,
        tutors
      } as AnalysisResult);

      setStatus('complete');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "An unexpected error occurred");
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResults(null);
    setErrorMessage(null);
    setStatus('idle');
  };

  return (
    <div className={`min-h-screen bg-slate-50 pb-20 font-sans ${language === 'ar' ? 'font-arabic' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 shadow-sm no-print">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/e/e8/Palestine_Ahliya_University_Logo.png" 
              alt="PAU Logo" 
              className="h-12 w-auto object-contain"
            />
            <div className="hidden md:flex flex-col">
              <span className="text-slate-900 font-bold text-lg leading-tight">{t.uniName}</span>
              <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">{t.appTitle}</span>
            </div>
          </div>
          <button 
            onClick={handleLanguageChange}
            disabled={isTranslating}
            className={`text-sm font-medium text-slate-600 hover:text-blue-600 px-3 py-1 border rounded-md ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isTranslating ? (
                <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Translating...
                </span>
            ) : (
                language === 'en' ? 'العربية' : 'English'
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-6 py-10 max-w-6xl mx-auto print:p-0 print:max-w-none">
        {status === 'idle' || status === 'error' ? (
           <div className="space-y-8 animate-fade-in-up">
              <div className="text-center space-y-4 mb-12">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {t.uniName} <br/>
                  <span className="text-blue-700">{t.mainHeading}</span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  {t.subtitle}
                </p>
              </div>

              <FileUpload 
                onFileSelect={setFile} 
                selectedFile={file} 
                t={t}
              />
              
              <CriteriaForm 
                criteria={criteria} 
                setCriteria={setCriteria} 
                disabled={false}
                t={t}
              />

              <div className="flex justify-center pt-6">
                <button
                  onClick={handleProcess}
                  disabled={!file}
                  className={`
                    px-8 py-3 rounded-full font-bold text-white shadow-lg transition-all transform
                    ${file ? 'bg-blue-600 hover:bg-blue-700 hover:scale-105 shadow-blue-500/30' : 'bg-slate-300 cursor-not-allowed'}
                  `}
                >
                  {t.analyzeBtn}
                </button>
              </div>

              {status === 'error' && (
                <div className="text-center text-red-600 mt-6 bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="font-bold">Analysis Failed</p>
                  <p className="text-sm">{errorMessage || "Please try again with a different file or try again later."}</p>
                </div>
              )}
           </div>
        ) : status === 'complete' && results && !isTranslating ? (
          <div>
            <div className="mb-6 no-print">
              <button onClick={handleReset} className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1">
                {language === 'ar' ? '←' : '←'} {t.analyzeAnother}
              </button>
            </div>
            <ResultsView data={results} language={language} t={t} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
             <div className="relative">
               <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                 <Loader2 className="w-8 h-8 text-blue-600 animate-pulse" />
               </div>
             </div>
             
             <div className="text-center space-y-2">
               <h3 className="text-xl font-bold text-slate-800">
                 {isTranslating ? 'Translating Content...' : (
                   <>
                    {status === 'uploading' && 'Processing File...'}
                    {status === 'analyzing' && t.processing}
                    {status === 'gathering_data' && t.gathering}
                   </>
                 )}
               </h3>
               <p className="text-slate-500 text-sm">
                  {isTranslating ? 'Please wait while we translate the report...' : (
                      <>
                        {status === 'analyzing' && t.analyzing}
                        {status === 'gathering_data' && 'Searching global databases...'}
                      </>
                  )}
               </p>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

export default App;