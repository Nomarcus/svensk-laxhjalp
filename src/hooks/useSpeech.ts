import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPremiumTts } from '../services/geminiService';

const LANG_MAP: Record<string, string> = {
  sv: 'sv-SE',
  ar: 'ar-SA',
  en: 'en-US',
};

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/>\s+/g, '')
    .replace(/---+/g, '')
    .replace(/📘.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoChunks(text: string): string[] {
  const plain = stripMarkdown(text);
  return plain
    .split(/\n\n+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
}

type PlaybackKind = 'browser' | 'ai' | null;

export function useSpeech() {
  const { t } = useTranslation();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);
  const chunksRef = useRef<string[]>([]);
  const langRef = useRef<string>('sv');
  const pausedMidChunkRef = useRef(false);
  const playbackKindRef = useRef<PlaybackKind>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    (('speechSynthesis' in window && window.speechSynthesis != null) || typeof Audio !== 'undefined');

  const clearTtsNotice = useCallback(() => setTtsNotice(null), []);

  const cleanupAi = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = '';
      audioRef.current = null;
    }
    const u = objectUrlRef.current;
    if (u) {
      URL.revokeObjectURL(u);
      objectUrlRef.current = null;
    }
    playbackKindRef.current = null;
  }, []);

  const speakChunk = useCallback((index: number) => {
    if (!('speechSynthesis' in window) || !window.speechSynthesis) {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentChunk(0);
      setTotalChunks(0);
      chunksRef.current = [];
      return;
    }
    if (index >= chunksRef.current.length) {
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
      pausedMidChunkRef.current = false;
      setIsSpeaking(false);
      if (index + 1 < chunksRef.current.length) {
        setIsPaused(true);
        setCurrentChunk(index);
      } else {
        setIsPaused(false);
        setCurrentChunk(0);
        setTotalChunks(0);
        chunksRef.current = [];
        playbackKindRef.current = null;
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speakBrowser = useCallback(
    (text: string, lang: string) => {
      if (!('speechSynthesis' in window) || !window.speechSynthesis) {
        setTtsNotice(t('chat.noSpeechInBrowser'));
        return;
      }
      window.speechSynthesis.cancel();
      const chunks = splitIntoChunks(text);
      if (chunks.length === 0) return;

      chunksRef.current = chunks;
      langRef.current = lang;
      playbackKindRef.current = 'browser';
      setTotalChunks(chunks.length);
      setCurrentChunk(0);
      setIsPaused(false);
      pausedMidChunkRef.current = false;
      speakChunk(0);
    },
    [speakChunk, t]
  );

  const speak = useCallback(
    async (text: string, lang: string = 'sv') => {
      clearTtsNotice();
      cleanupAi();
      if ('speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      pausedMidChunkRef.current = false;
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentChunk(0);
      setTotalChunks(0);
      chunksRef.current = [];
      playbackKindRef.current = null;

      const chunks = splitIntoChunks(text);
      if (chunks.length === 0) return;

      try {
        const resp = await requestPremiumTts(text, lang);
        if (resp.ok) {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          playbackKindRef.current = 'ai';
          chunksRef.current = [];
          langRef.current = lang;
          setTotalChunks(1);
          setCurrentChunk(0);
          setIsPaused(false);

          audio.onplay = () => {
            setIsSpeaking(true);
            setIsPaused(false);
          };
          audio.onpause = () => {
            if (!audio.ended) {
              setIsSpeaking(false);
              setIsPaused(true);
            }
          };
          audio.onended = () => {
            cleanupAi();
            setIsSpeaking(false);
            setIsPaused(false);
            setCurrentChunk(0);
            setTotalChunks(0);
          };
          audio.onerror = () => {
            cleanupAi();
            speakBrowser(text, lang);
          };

          await audio.play();
          return;
        }

        if (resp.status === 403) {
          setTtsNotice(t('chat.aiVoiceDailyUsed'));
          speakBrowser(text, lang);
          return;
        }

        speakBrowser(text, lang);
      } catch {
        speakBrowser(text, lang);
      }
    },
    [cleanupAi, clearTtsNotice, speakBrowser, t]
  );

  const next = useCallback(() => {
    if (playbackKindRef.current === 'ai') return;
    if (!('speechSynthesis' in window) || !window.speechSynthesis) return;
    const nextIndex = currentChunk + 1;
    if (nextIndex < chunksRef.current.length) {
      speakChunk(nextIndex);
    }
  }, [currentChunk, speakChunk]);

  const pause = useCallback(() => {
    if (playbackKindRef.current === 'ai') {
      audioRef.current?.pause();
      return;
    }
    if (!('speechSynthesis' in window) || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
    pausedMidChunkRef.current = true;
    setIsPaused(true);
    setIsSpeaking(false);
  }, []);

  const resume = useCallback(() => {
    if (playbackKindRef.current === 'ai') {
      void audioRef.current?.play();
      return;
    }
    if (!('speechSynthesis' in window) || !window.speechSynthesis) return;
    if (pausedMidChunkRef.current) {
      window.speechSynthesis.resume();
      pausedMidChunkRef.current = false;
      setIsPaused(false);
      setIsSpeaking(true);
    } else {
      next();
    }
  }, [next]);

  const stop = useCallback(() => {
    cleanupAi();
    if ('speechSynthesis' in window && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    pausedMidChunkRef.current = false;
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunk(0);
    setTotalChunks(0);
    chunksRef.current = [];
    playbackKindRef.current = null;
  }, [cleanupAi]);

  useEffect(() => {
    return () => {
      cleanupAi();
      if ('speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanupAi]);

  return {
    speak,
    stop,
    pause,
    resume,
    next,
    isSpeaking,
    isPaused,
    isSupported,
    currentChunk,
    totalChunks,
    ttsNotice,
    clearTtsNotice,
  };
}
