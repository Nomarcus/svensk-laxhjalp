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

function splitIntoChunks(text: string): string[] {
  const plain = stripMarkdown(text);
  return plain
    .split(/\n\n+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const chunksRef = useRef<string[]>([]);
  const langRef = useRef<string>('sv');
  const pausedMidChunkRef = useRef(false);
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speakChunk = useCallback((index: number) => {
    if (!isSupported || index >= chunksRef.current.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentChunk(0);
      setTotalChunks(0);
      chunksRef.current = [];
      return;
    }

    window.speechSynthesis.cancel();
    pausedMidChunkRef.current = false;

    const utterance = new SpeechSynthesisUtterance(chunksRef.current[index]);
    const targetLang = LANG_MAP[langRef.current] || LANG_MAP.sv;
    utterance.lang = targetLang;
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setCurrentChunk(index);
    };

    utterance.onend = () => {
      // Auto-pause after each chunk — user clicks "Fortsätt" for next
      pausedMidChunkRef.current = false;
      setIsSpeaking(false);
      if (index + 1 < chunksRef.current.length) {
        setIsPaused(true);
        setCurrentChunk(index);
      } else {
        // Last chunk done
        setIsPaused(false);
        setCurrentChunk(0);
        setTotalChunks(0);
        chunksRef.current = [];
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const speak = useCallback((text: string, lang: string = 'sv') => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();

    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) return;

    chunksRef.current = chunks;
    langRef.current = lang;
    setTotalChunks(chunks.length);
    setCurrentChunk(0);
    setIsPaused(false);
    pausedMidChunkRef.current = false;
    speakChunk(0);
  }, [isSupported, speakChunk]);

  const next = useCallback(() => {
    if (!isSupported) return;
    const nextIndex = currentChunk + 1;
    if (nextIndex < chunksRef.current.length) {
      speakChunk(nextIndex);
    }
  }, [isSupported, currentChunk, speakChunk]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    pausedMidChunkRef.current = true;
    setIsPaused(true);
    setIsSpeaking(false);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    if (pausedMidChunkRef.current) {
      // Resume mid-chunk
      window.speechSynthesis.resume();
      pausedMidChunkRef.current = false;
      setIsPaused(false);
      setIsSpeaking(true);
    } else {
      // Paused between chunks — play next chunk
      next();
    }
  }, [isSupported, next]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    pausedMidChunkRef.current = false;
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunk(0);
    setTotalChunks(0);
    chunksRef.current = [];
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return { speak, stop, pause, resume, next, isSpeaking, isPaused, isSupported, currentChunk, totalChunks };
}
