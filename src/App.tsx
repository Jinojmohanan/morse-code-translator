/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Copy, 
  Trash2, 
  ArrowLeftRight, 
  Play, 
  Square,
  Keyboard,
  Type,
  Info,
  Languages as LanguagesIcon,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MORSE_CODE, REVERSE_MORSE, LANGUAGES } from './constants';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type Mode = 'text-to-morse' | 'morse-to-text';

export default function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<Mode>('text-to-morse');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Translation States
  const [targetLang, setTargetLang] = useState(LANGUAGES[0]); // Default to English
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Translation Logic (Morse <-> English)
  useEffect(() => {
    if (mode === 'text-to-morse') {
      const translated = input.toUpperCase().split('').map(char => {
        if (char === ' ') return '/';
        return MORSE_CODE[char] || '?';
      }).join(' ');
      setOutput(translated);
    } else {
      const sanitizedInput = input.toLowerCase()
        .replace(/d/g, '.')
        .replace(/h/g, '-');
      
      const words = sanitizedInput.split(' / ');
      const translated = words.map(word => {
        return word.split(' ').map(symbol => {
          return REVERSE_MORSE[symbol] || (symbol === '' ? '' : '?');
        }).join('');
      }).join(' ');
      setOutput(translated.toLowerCase());
    }
  }, [input, mode]);

  // Multilingual Translation Logic (English -> Target Language)
  useEffect(() => {
    const englishText = mode === 'text-to-morse' ? input : output;
    
    if (!englishText || englishText.trim() === '' || targetLang.code === 'en') {
      setTranslatedText(englishText);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslating(true);
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Translate the following English text to ${targetLang.name}. Provide only the translation, no extra text: "${englishText}"`,
        });
        setTranslatedText(response.text || '');
      } catch (error) {
        console.error("Translation error:", error);
        setTranslatedText("Translation failed. Please ensure your Gemini API key is configured correctly in the Secrets panel.");
      } finally {
        setIsTranslating(false);
      }
    }, 800); // Debounce translation

    return () => clearTimeout(timer);
  }, [input, output, mode, targetLang]);

  const toggleMode = () => {
    setMode(prev => prev === 'text-to-morse' ? 'morse-to-text' : 'text-to-morse');
    setInput(output);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setTranslatedText('');
  };

  // Audio Logic
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = 0;
    }
  };

  const playTone = (duration: number) => {
    return new Promise<void>((resolve) => {
      if (!audioContextRef.current || !gainNodeRef.current) return resolve();
      
      const osc = audioContextRef.current.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioContextRef.current.currentTime);
      osc.connect(gainNodeRef.current);
      
      gainNodeRef.current.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
      osc.start();
      
      setTimeout(() => {
        gainNodeRef.current?.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
        osc.stop();
        resolve();
      }, duration);
    });
  };

  const playMorse = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    initAudio();

    const dotTime = 100;
    const dashTime = dotTime * 3;
    const symbolSpace = dotTime;
    const letterSpace = dotTime * 3;
    const wordSpace = dotTime * 7;

    const morse = mode === 'text-to-morse' ? output : input;
    
    for (let i = 0; i < morse.length; i++) {
      if (!isPlayingRef.current) break;
      
      const char = morse[i];
      if (char === '.') {
        await playTone(dotTime);
        await new Promise(r => setTimeout(r, symbolSpace));
      } else if (char === '-' || char === 'h') {
        await playTone(dashTime);
        await new Promise(r => setTimeout(r, symbolSpace));
      } else if (char === ' ') {
        await new Promise(r => setTimeout(r, letterSpace));
      } else if (char === '/') {
        await new Promise(r => setTimeout(r, wordSpace));
      }
    }
    setIsPlaying(false);
  };

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const stopAudio = () => {
    setIsPlaying(false);
  };

  const speakText = (text: string, langCode: string) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#151619] text-[#FFFFFF] font-sans selection:bg-[#F27D26] selection:text-white pb-20">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#1A1B1E] px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F27D26] rounded flex items-center justify-center">
            <Keyboard className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-lg font-medium tracking-tight uppercase letter-spacing-0.05em">
            Morse Code <span className="text-[#F27D26]">Translator</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-white/40">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SYSTEM READY
          </span>
          <span className="hidden sm:inline">v1.1.0</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/60">
                {mode === 'text-to-morse' ? <Type className="w-4 h-4" /> : <Keyboard className="w-4 h-4" />}
                {mode === 'text-to-morse' ? 'Plain Text Input' : 'Morse Code Input'}
              </div>
              <button 
                onClick={toggleMode}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs font-mono uppercase"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#F27D26]" />
                Switch Mode
              </button>
            </div>
            
            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && mode === 'morse-to-text') {
                    e.preventDefault();
                    setInput(prev => prev + ' / ');
                  }
                }}
                placeholder={mode === 'text-to-morse' ? "Type text to translate..." : "Type morse (e.g. ... --- ...) or use 'd' for dot, 'h' for dash"}
                className="w-full h-64 bg-[#1A1B1E] border border-white/10 rounded-xl p-6 font-mono text-lg focus:outline-none focus:border-[#F27D26]/50 transition-all resize-none placeholder:text-white/20"
              />
              
              {/* Virtual Morse Keyboard */}
              {mode === 'morse-to-text' && (
                <div className="absolute bottom-16 left-4 right-4 flex flex-wrap gap-2 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/5">
                  <button 
                    onClick={() => setInput(prev => prev + '.')}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-md font-bold text-xl transition-all active:scale-95"
                  >
                    .
                  </button>
                  <button 
                    onClick={() => setInput(prev => prev + '-')}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-md font-bold text-xl transition-all active:scale-95"
                  >
                    -
                  </button>
                  <button 
                    onClick={() => setInput(prev => prev + ' ')}
                    className="flex-1 py-3 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/20 rounded-md font-mono text-xs uppercase tracking-widest transition-all active:scale-95"
                  >
                    Space
                  </button>
                  <button 
                    onClick={() => setInput(prev => prev + ' / ')}
                    className="flex-1 py-3 bg-[#F27D26]/30 hover:bg-[#F27D26]/40 text-[#F27D26] border border-[#F27D26]/50 rounded-md font-mono text-xs uppercase font-bold tracking-widest transition-all active:scale-95"
                  >
                    Tab (Word)
                  </button>
                  <button 
                    onClick={() => setInput(prev => prev.slice(0, -1))}
                    className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-md transition-all active:scale-95"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="absolute bottom-4 right-4 flex gap-2">
                <button 
                  onClick={handleClear}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                  title="Clear input"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </section>

          {/* Output Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/60">
                {mode === 'text-to-morse' ? <Keyboard className="w-4 h-4" /> : <Type className="w-4 h-4" />}
                {mode === 'text-to-morse' ? 'Morse Code Output' : 'Plain Text Output'}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleCopy(output)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs font-mono uppercase"
                >
                  <Copy className="w-3.5 h-3.5 text-[#F27D26]" />
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="w-full h-64 bg-[#1A1B1E] border border-white/10 rounded-xl p-6 font-mono text-lg overflow-auto break-all">
                {output || <span className="text-white/10 italic">Translation will appear here...</span>}
              </div>
              
              {/* Playback Controls */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                {mode === 'text-to-morse' ? (
                  <button 
                    onClick={isPlaying ? stopAudio : playMorse}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isPlaying 
                        ? 'bg-red-500/20 text-red-500 border border-red-500/50' 
                        : 'bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/50 hover:bg-[#F27D26]/30'
                    }`}
                  >
                    {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isPlaying ? 'Stop Beeps' : 'Play Beeps'}
                    </span>
                  </button>
                ) : (
                  <button 
                    onClick={() => speakText(output, 'en-US')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/50 hover:bg-[#F27D26]/30 transition-all"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Speak English</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Multilingual Translation Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/60">
              <LanguagesIcon className="w-4 h-4" />
              Multilingual Translation
            </div>
            <select 
              value={targetLang.code}
              onChange={(e) => setTargetLang(LANGUAGES.find(l => l.code === e.target.value) || LANGUAGES[0])}
              className="bg-[#1A1B1E] border border-white/10 rounded-md px-3 py-1.5 text-xs font-mono uppercase focus:outline-none focus:border-[#F27D26]/50 cursor-pointer"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <div className="w-full min-h-[120px] bg-[#1A1B1E] border border-white/10 rounded-xl p-6 font-sans text-xl leading-relaxed">
              {isTranslating ? (
                <div className="flex items-center gap-3 text-white/40 italic">
                  <Loader2 className="w-5 h-5 animate-spin text-[#F27D26]" />
                  Translating to {targetLang.name}...
                </div>
              ) : (
                translatedText || <span className="text-white/10 italic">Select a language to see translation...</span>
              )}
            </div>
            
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button 
                onClick={() => handleCopy(translatedText)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                title="Copy translation"
              >
                <Copy className="w-5 h-5" />
              </button>
              <button 
                onClick={() => speakText(translatedText, targetLang.code)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 hover:bg-emerald-500/30 transition-all"
              >
                <Volume2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Speak {targetLang.name}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Info / Reference Section */}
        <section className="mt-8">
          <div className="bg-[#1A1B1E] border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Info className="w-5 h-5 text-[#F27D26]" />
              <h2 className="text-sm font-mono uppercase tracking-widest text-white/80">Reference & Tips</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#F27D26] uppercase tracking-wider">Shortcuts</h3>
                <ul className="text-sm text-white/50 space-y-2 font-mono">
                  <li><span className="text-white/80">d</span> or <span className="text-white/80">.</span> = Dot</li>
                  <li><span className="text-white/80">h</span> or <span className="text-white/80">-</span> = Dash</li>
                  <li><span className="text-white/80">Space</span> = Letter gap</li>
                  <li><span className="text-white/80">/</span> = Word gap</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#F27D26] uppercase tracking-wider">Common Letters</h3>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/5 pb-1"><span>A</span> <span className="text-white/40">.-</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-1"><span>B</span> <span className="text-white/40">-...</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-1"><span>C</span> <span className="text-white/40">-.-.</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-1"><span>D</span> <span className="text-white/40">-..</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-1"><span>E</span> <span className="text-white/40">.</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-1"><span>F</span> <span className="text-white/40">..-.</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#F27D26] uppercase tracking-wider">About</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  Morse code is a method used in telecommunication to encode text characters as standardized sequences of two different signal durations, called dots and dashes.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/10 bg-[#1A1B1E] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white/20 text-xs font-mono">
            <span>© 2026 MORSE CODE TRANSLATOR</span>
            <span className="mx-2">|</span>
            <span>ENCRYPTION ACTIVE</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-xs font-mono text-white/40 hover:text-[#F27D26] transition-colors uppercase">Documentation</a>
            <a href="#" className="text-xs font-mono text-white/40 hover:text-[#F27D26] transition-colors uppercase">API Access</a>
            <a href="#" className="text-xs font-mono text-white/40 hover:text-[#F27D26] transition-colors uppercase">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
