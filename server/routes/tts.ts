import { Router, Response } from 'express';
import admin from 'firebase-admin';
import { getServerFirestore } from '../lib/serverFirestore';
import { AuthenticatedRequest } from '../middleware/auth';
import { stripMarkdownForTts } from '../lib/stripForTts';
import { synthesizeMp3 } from '../lib/googleCloudTts';
import { enforceSubscriptionLimits } from '../subscriptionEnv';
import { FREE_AI_TTS_PER_DAY, isUnmeteredSubscription } from '../lib/freeTierLimits';

const router = Router();
const MAX_TTS_CHARS = 4500;

router.post('/tts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.uid;
    if (!uid) {
      res.status(401).json({ error: 'Inte autentiserad.' });
      return;
    }
    // Tom nyckel = servicekontot används (se googleCloudTts.ts).
    const apiKey = process.env.GOOGLE_TTS_API_KEY || '';
    const { text, lang = 'sv' } = req.body || {};
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text krävs.' });
      return;
    }
    const plain = stripMarkdownForTts(text).slice(0, MAX_TTS_CHARS);
    if (!plain.trim()) {
      res.status(400).json({ error: 'Ingen läsbar text efter formattering.' });
      return;
    }
    const userDoc = await getServerFirestore().doc(`users/${uid}`).get();
    const userData = userDoc.data();
    const pro = isUnmeteredSubscription(userData?.tier, userData?.subscriptionStatus);
    const today = new Date().toISOString().split('T')[0];
    const usageRef = getServerFirestore().doc(`users/${uid}/usage/${today}`);
    if (enforceSubscriptionLimits() && !pro) {
      const usageDoc = await usageRef.get();
      const usage = usageDoc.data() || {};
      const aiTtsCount = usage.aiTtsCount || 0;
      if (aiTtsCount >= FREE_AI_TTS_PER_DAY) {
        res.status(403).json({
          error: `Du har använt din premiumröst för idag (${FREE_AI_TTS_PER_DAY}/dag). Appen använder webbläsarens röst istället.`,
          code: 'tts_limit',
          limit: FREE_AI_TTS_PER_DAY,
          used: aiTtsCount,
        });
        return;
      }
    }
    const audio = await synthesizeMp3(apiKey, plain, typeof lang === 'string' ? lang : 'sv');
    if (!pro) {
      await usageRef.set(
        {
          aiTtsCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    res.setHeader('Cache-Control', 'private, no-store');
    // iOS-appen skickar fetch genom CapacitorHttp, som inte klarar binära svar:
    // MP3-filen kom fram trasig. Med format=base64 skickas ljudet som text i JSON.
    if (req.body?.format === 'base64') {
      res.json({ audio: audio.toString('base64'), mime: 'audio/mpeg' });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (error: unknown) {
    console.error('TTS error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Kunde inte skapa uppläsning. Försök igen.' });
  }
});

export { router as ttsRouter };
