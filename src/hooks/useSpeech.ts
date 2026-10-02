import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPremiumTts } from '../services/geminiService';
import { PREMIUM_TTS_SAFE_CHAR_LIMIT, listeningText, stripMarkdownForListen } from '../utils/listeningPreview';
import { bumpUsageRefresh } from '../utils/usageRefresh';

const LANG_MAP: Record<string, string> = {
  sv: 'sv-SE',
  ar: 'ar-SA',
  en: 'en-US',
};

function splitIntoChunks(text: string): string[] {
  const plain = stripMarkdownForListen(text);
  return plain
    .split(/\n\n+/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
}

/**
 * Välj bästa röst för målspråket. getVoices() kan returnera [] innan voiceschanged hunnit
 * fyra upp listan — då får vi `undefined` här och speechSynthesis väljer systemets default.
 * Prioritet: exakt lang-matchning → prefix-matchning → default-voice med rätt språk → ingen.
 */
function pickVoice(voices: SpeechSynthesisVoice[], targetLang: string): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const exact = voices.find(v => v.lang === targetLang);
  if (exact) return exact;
  const prefix = targetLang.split('-')[0];
  const matches = voices.filter(v => v.lang.toLowerCase().startsWith(prefix.toLowerCase()));
  const preferred = matches.find(v => v.default) || matches.find(v => v.localService) || matches[0];
  return preferred;
}

type PlaybackKind = 'browser' | 'ai' | null;

/**
 * Ljudet spelas med Web Audio. Ett <audio>-element som startas först när servern
 * har svarat spärras av iOS, eftersom trycket då är "förbrukat". En AudioContext
 * som väcks i själva trycket får däremot spela upp ljud som kommer senare.
 */
type AudioCtx = AudioContext;
function createAudioContext(): AudioCtx | null {
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  return Ctor ? new Ctor() : null;
}

/** Session-cache: om servern svarat 503 (ej konfigurerad) — hoppa framtida premium-anrop direkt. */
let premiumUnavailableForSession = false;

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
  const ctxRef = useRef<AudioCtx | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // Varje nytt tryck eller stopp får ett nytt nummer. Ett svar från servern som kommer
  // efter att man tryckt igen spelas inte upp, så samma text läses inte flera gånger.
  const requestIdRef = useRef(0);

  const isSupported =
    typeof window !== 'undefined' &&
    (('speechSynthesis' in window && window.speechSynthesis != null) || typeof Audio !== 'undefined');

  // Warm voices: Chrome/iOS returnerar [] första gången getVoices() anropas. Lyssna på
  // voiceschanged så listan är färdigladdad redan när användaren trycker "Lyssna".
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) return;
    const refresh = () => {
      try { voicesRef.current = window.speechSynthesis.getVoices() || []; } catch { /* noop */ }
    };
    refresh();
    const synth = window.speechSynthesis;
    synth.addEventListener?.('voiceschanged', refresh);
    // Extra försök några tillfällen — vissa webbläsare fyller listan ~500 ms efter load.
    const t1 = window.setTimeout(refresh, 300);
    const t2 = window.setTimeout(refresh, 1500);
    return () => {
      synth.removeEventListener?.('voiceschanged', refresh);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const clearTtsNotice = useCallback(() => setTtsNotice(null), []);

  const cleanupAi = useCallback(() => {
    const src = sourceRef.current;
    if (src) {
      // onended kopplas loss först så att ett stopp inte räknas som "klar" eller fel.
      src.onended = null;
      try { src.stop(); } catch { /* redan stoppad */ }
      src.disconnect();
      sourceRef.current = null;
    }
    // En pausad (suspenderad) kontext måste igång igen inför nästa uppläsning.
    if (ctxRef.current?.state === 'suspended') void ctxRef.current.resume();
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

    // Använd cache-ad lista (uppdaterad via voiceschanged), annars fråga live som sista utväg.
    const voices = voicesRef.current.length > 0
      ? voicesRef.current
      : (window.speechSynthesis.getVoices() || []);
    const voice = pickVoice(voices, targetLang);
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
      const requestId = ++requestIdRef.current;
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

      const readableText = listeningText(text);
      if (!readableText.trim()) {
        setTtsNotice(t('chat.listenNothingToRead'));
        return;
      }

      const chunks = splitIntoChunks(readableText);
      if (chunks.length === 0) {
        setTtsNotice(t('chat.listenNothingToRead'));
        return;
      }

      // Premium-TTS på servern har en säker teckengräns. För längre svar använder vi
      // webbläsarens röst direkt så uppläsningen fortsätter genom hela texten.
      if (readableText.length > PREMIUM_TTS_SAFE_CHAR_LIMIT) {
        speakBrowser(readableText, lang);
        return;
      }

      // Om servern redan sagt "inte konfigurerad" i denna session — hoppa över onödig round-trip.
      if (premiumUnavailableForSession) {
        speakBrowser(readableText, lang);
        return;
      }

      // Väck ljudet och webbläsarens röst medan trycket pågår (krävs på iOS).
      if (!ctxRef.current) ctxRef.current = createAudioContext();
      const ctx = ctxRef.current;
      void ctx?.resume();
      if ('speechSynthesis' in window && window.speechSynthesis) {
        try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* noop */ }
      }

      try {
        if (!ctx) throw new Error('Ingen Web Audio');
        const resp = await requestPremiumTts(readableText, lang);
        if (requestId !== requestIdRef.current) return;
        if (resp.ok) {
          const data = await resp.arrayBuffer();
          if (requestId !== requestIdRef.current) return;
          bumpUsageRefresh();
          const buffer = await ctx.decodeAudioData(data);
          if (requestId !== requestIdRef.current) return;
          if (ctx.state === 'suspended') await ctx.resume();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          sourceRef.current = source;
          playbackKindRef.current = 'ai';
          chunksRef.current = [];
          langRef.current = lang;
          setTotalChunks(1);
          setCurrentChunk(0);
          setIsPaused(false);
          setIsSpeaking(true);
          source.onended = () => {
            sourceRef.current = null;
            playbackKindRef.current = null;
            setIsSpeaking(false);
            setIsPaused(false);
            setCurrentChunk(0);
            setTotalChunks(0);
          };
          source.start();
          return;
        }
        cleanupAi();

        if (resp.status === 403) {
          setTtsNotice(t('chat.aiVoiceDailyUsed'));
          speakBrowser(readableText, lang);
          return;
        }

        if (resp.status === 503) {
          // Premium-rösten är inte konfigurerad på servern — cacha i sessionen så vi slipper round-trip nästa gång.
          premiumUnavailableForSession = true;
        }

        speakBrowser(readableText, lang);
      } catch {
        if (requestId !== requestIdRef.current) return;
        cleanupAi();
        speakBrowser(readableText, lang);
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
      void ctxRef.current?.suspend();
      setIsSpeaking(false);
      setIsPaused(true);
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
      void ctxRef.current?.resume();
      setIsSpeaking(true);
      setIsPaused(false);
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
    requestIdRef.current += 1;
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
