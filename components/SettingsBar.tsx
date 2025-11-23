import React from 'react';
import { Language, Scenario } from '../types';

interface SettingsBarProps {
  sourceLang: Language;
  targetLang: Language;
  scenario: Scenario;
  onSourceChange: (l: Language) => void;
  onTargetChange: (l: Language) => void;
  onScenarioChange: (s: Scenario) => void;
  disabled: boolean;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({
  sourceLang,
  targetLang,
  scenario,
  onSourceChange,
  onTargetChange,
  onScenarioChange,
  disabled
}) => {
  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl bg-slate-900/50 p-3 rounded-xl border border-slate-800 backdrop-blur-sm">
      
      {/* Scenario Selector */}
      <div className="w-full flex items-center justify-between gap-4 border-b border-slate-800/50 pb-2">
         <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
           Scenario
         </span>
         <div className="flex gap-1 flex-1 overflow-x-auto scrollbar-hide">
            {Object.values(Scenario).map((s) => (
                <button
                    key={s}
                    onClick={() => onScenarioChange(s)}
                    disabled={disabled}
                    className={`
                        px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                        ${scenario === s 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {s}
                </button>
            ))}
         </div>
      </div>

      {/* Language Selectors */}
      <div className="flex flex-row gap-2 w-full items-end">
        <div className="flex-1">
            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">
            Speaking
            </label>
            <select
            value={sourceLang}
            onChange={(e) => onSourceChange(e.target.value as Language)}
            disabled={disabled}
            className="w-full bg-slate-800 text-white text-sm p-2 rounded-lg border border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer hover:bg-slate-750"
            >
            {Object.values(Language).map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
            ))}
            </select>
        </div>

        <div className="flex items-center justify-center px-1 text-slate-500 pb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
        </div>

        <div className="flex-1">
            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">
            Listening
            </label>
            <select
            value={targetLang}
            onChange={(e) => onTargetChange(e.target.value as Language)}
            disabled={disabled}
            className="w-full bg-slate-800 text-white text-sm p-2 rounded-lg border border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer hover:bg-slate-750"
            >
            {Object.values(Language).map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
            ))}
            </select>
        </div>
      </div>
    </div>
  );
};