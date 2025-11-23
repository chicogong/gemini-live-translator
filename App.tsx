import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, Scenario, TranscriptItem } from './types';
import { GeminiLiveClient } from './services/liveClient';
import { Visualizer } from './components/Visualizer';
import { SettingsBar } from './components/SettingsBar';

const App: React.FC = () => {
  const [sourceLang, setSourceLang] = useState<Language>(Language.CHINESE);
  const [targetLang, setTargetLang] = useState<Language>(Language.ENGLISH);
  const [scenario, setScenario] = useState<Scenario>(Scenario.CONVERSATION);
  const [isConnected, setIsConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of transcripts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleTranscriptUpdate = useCallback((text: string, isUser: boolean, isComplete: boolean) => {
    setTranscripts(prev => {
      const lastItem = prev[prev.length - 1];
      const currentSource = isUser ? 'user' : 'model';
      
      if (!text.trim()) return prev; 

      // Case 1: Existing incomplete message -> Update it
      if (lastItem && lastItem.source === currentSource && !lastItem.isComplete) {
         const updated = [...prev];
         updated[updated.length - 1] = {
             ...lastItem,
             text: text,
             isComplete: isComplete,
             timestamp: Date.now() 
         };
         return updated;
      }
      
      // Case 2: ASR Steady State Logic / Deduplication
      if (lastItem && lastItem.source === currentSource && lastItem.isComplete) {
          
          // Case 2a: Exact Duplicate -> Ignore completely
          // This prevents "Saying it twice" when the model sends the same final text in a new turn.
          if (lastItem.text === text) {
              return prev;
          }

          // Case 2b: Subset -> Ignore (ASR Flutter)
          // If the new text is just a prefix of what we already finalized, ignore it.
          // e.g. Finalized "Hello World" -> New "Hello"
          if (lastItem.text.startsWith(text)) {
              return prev;
          }

          // Case 2c: Superset -> Re-open and Update (ASR Continuation)
          // If the new text contains the previous text plus more, treat it as a continuation/correction.
          // e.g. Finalized "Hello" -> New "Hello World"
          if (text.startsWith(lastItem.text)) {
             const updated = [...prev];
             updated[updated.length - 1] = {
                 ...lastItem,
                 text: text,
                 isComplete: isComplete,
                 timestamp: Date.now()
             };
             return updated;
          }
      }

      // Case 3: Create a new message bubble
      return [
        ...prev, 
        {
          id: Date.now().toString(),
          source: currentSource,
          text: text,
          timestamp: Date.now(),
          isComplete: isComplete
        }
      ];
    });
  }, []);

  const toggleConnection = async () => {
    if (isConnected) {
      clientRef.current?.disconnect();
      setIsConnected(false);
      setVolume(0);
    } else {
      setError(null);
      
      if (!process.env.API_KEY) {
        setError("API Key not found in environment variables.");
        return;
      }

      const client = new GeminiLiveClient({
        apiKey: process.env.API_KEY,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        scenario: scenario,
        onTranscriptUpdate: handleTranscriptUpdate,
        onAudioVisualizer: (vol) => setVolume(vol),
        onClose: () => {
            setIsConnected(false);
            setVolume(0);
        },
        onError: (err) => {
            setError(err.message);
            setIsConnected(false);
        }
      });

      clientRef.current = client;
      
      try {
        await client.connect();
        setIsConnected(true);
      } catch (e: any) {
        setError(e.message || "Failed to connect");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header */}
      <header className="flex-none p-3 text-center z-10">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Gemini Live Translator
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start overflow-hidden w-full max-w-5xl mx-auto px-2 gap-2 z-10">
        
        {/* Settings */}
        <SettingsBar 
            sourceLang={sourceLang}
            targetLang={targetLang}
            scenario={scenario}
            onSourceChange={setSourceLang}
            onTargetChange={setTargetLang}
            onScenarioChange={setScenario}
            disabled={isConnected}
        />

        {/* Visualizer */}
        <div className="w-full relative">
             <Visualizer isActive={isConnected} volume={volume} />
             {!isConnected && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <p className="text-slate-500 text-xs bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 backdrop-blur">
                         Ready to interpret
                     </p>
                 </div>
             )}
        </div>

        {/* Transcript Area */}
        <div className="flex-1 w-full bg-slate-900/40 rounded-2xl border border-slate-800/60 p-4 overflow-y-auto scrollbar-hide backdrop-blur-md flex flex-col gap-4 shadow-inner relative">
            {transcripts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-sm">Conversation history will appear here</p>
                </div>
            )}
            
            {transcripts.map((item, index) => (
                <div 
                    key={`${item.id}-${index}`} 
                    className={`flex flex-col max-w-[90%] ${item.source === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                >
                    <div className={`px-5 py-3 rounded-2xl text-base md:text-lg leading-relaxed shadow-sm ${
                        item.source === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
                    }`}>
                        {item.text}
                        {!item.isComplete && <span className="animate-pulse ml-1">▋</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">
                        {item.source === 'user' ? sourceLang : 'Gemini'}
                    </span>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
            </div>
        )}
      </main>

      {/* Bottom Controls */}
      <footer className="flex-none p-3 flex justify-center z-10 w-full bg-slate-950/80 backdrop-blur-xl border-t border-slate-800">
        <button
            onClick={toggleConnection}
            className={`
                group relative flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95
                ${isConnected 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400/30'
                }
            `}
        >
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-white'}`} />
            {isConnected ? 'Stop' : 'Start Interpretation'}
        </button>
      </footer>
    </div>
  );
};

export default App;