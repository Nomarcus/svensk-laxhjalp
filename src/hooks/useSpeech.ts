import { useState, useEffect, useRef, useCallback } from 'react';

const LANG_MAP: Record<string, string> = {
  sv: 'sv-SE',
  ar: 'ar-SA',
  en: 'en-US',
};

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/_(.+?)_/g, '$1')       // italic underscore
    .replace(/`(.+?)`/g, '$1')       // inline code
    .replace(/^\s*[-*+]\s+/gm, '')   // list markers
    .replace(/^\s*\d+\.\s+/gm, '')   // numbered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
    .replace(/>\s+/g, '')            // blockquotes
    .replace(/---+/g, '')            // horizontal rules
    .replace(/📘.*$/gm, '')          // curriculum line (skip reading)
    .replace(/\n{3,}/g, '\n\n')      // collapse multiple newlines
    .trim();
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, [isSupported]);

  const speak = useCallback((text: string, lang: string = 'sv') => {
    if (!isSupported) return;

    // Stop any current speech first
    window.speechSynthesis.cancel();

    const plainText = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = LANG_MAP[lang] || LANG_MAP.sv;
    utterance.rate = 0.9;

    // Try to find a matching voice
    const voices = window.speechSynthesis.getVoices();
    const targetLang = LANG_MAP[lang] || LANG_MAP.sv;
    const voice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); utteranceRef.current = null; };
    utterance.onerror = () => { setIsSpeaking(false); utteranceRef.current = null; };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
