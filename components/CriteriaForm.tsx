import React from 'react';
import { EvaluationCriteria } from '../types';
import { Settings, BookOpen, Target, CheckSquare, BarChart } from 'lucide-react';

interface CriteriaFormProps {
  criteria: EvaluationCriteria;
  setCriteria: React.Dispatch<React.SetStateAction<EvaluationCriteria>>;
  disabled: boolean;
  t: any;
}

const CriteriaForm: React.FC<CriteriaFormProps> = ({ criteria, setCriteria, disabled, t }) => {
  const toggle = (key: keyof EvaluationCriteria) => {
    if (typeof criteria[key] === 'boolean') {
      setCriteria(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 w-full max-w-2xl mx-auto mt-6">
      <div className="flex items-center gap-2 mb-4 border-b pb-3">
        <Settings className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-800">{t.criteriaTitle}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => !disabled && toggle('iloClarity')}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${criteria.iloClarity ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <Target className={`w-5 h-5 mt-0.5 ${criteria.iloClarity ? 'text-blue-600' : 'text-slate-400'}`} />
          <div>
            <h4 className="font-medium text-slate-800">{t.iloClarity}</h4>
            <p className="text-xs text-slate-500">{t.iloClarityDesc}</p>
          </div>
        </div>

        <div 
          onClick={() => !disabled && toggle('iloAlignment')}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${criteria.iloAlignment ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <CheckSquare className={`w-5 h-5 mt-0.5 ${criteria.iloAlignment ? 'text-blue-600' : 'text-slate-400'}`} />
          <div>
            <h4 className="font-medium text-slate-800">{t.iloAlignment}</h4>
            <p className="text-xs text-slate-500">{t.iloAlignmentDesc}</p>
          </div>
        </div>

        <div 
          onClick={() => !disabled && toggle('assessmentQuality')}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${criteria.assessmentQuality ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <BarChart className={`w-5 h-5 mt-0.5 ${criteria.assessmentQuality ? 'text-blue-600' : 'text-slate-400'}`} />
          <div>
            <h4 className="font-medium text-slate-800">{t.assessmentQuality}</h4>
            <p className="text-xs text-slate-500">{t.assessmentQualityDesc}</p>
          </div>
        </div>

        <div 
          onClick={() => !disabled && toggle('referenceCurrency')}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${criteria.referenceCurrency ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <BookOpen className={`w-5 h-5 mt-0.5 ${criteria.referenceCurrency ? 'text-blue-600' : 'text-slate-400'}`} />
          <div>
            <h4 className="font-medium text-slate-800">{t.referenceCurrency}</h4>
            <p className="text-xs text-slate-500">{t.referenceCurrencyDesc}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">{t.benchmarkLabel}</label>
        <input 
          type="text" 
          value={criteria.benchmarkUniversities}
          onChange={(e) => setCriteria({...criteria, benchmarkUniversities: e.target.value})}
          placeholder={t.benchmarkPlaceholder}
          disabled={disabled}
          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        />
      </div>
    </div>
  );
};

export default CriteriaForm;