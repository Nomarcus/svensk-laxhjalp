import { auth } from '../firebase';

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Inte inloggad.');
  return user.getIdToken();
}

async function apiRequest(endpoint: string, body: object): Promise<any> {
  const token = await getAuthToken();
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Nätverksfel' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function generateHomeworkHelp(
  prompt: string,
  history: { role: 'user' | 'model'; content: string }[] = [],
  imageBase64?: string
): Promise<string> {
  const data = await apiRequest('chat', { prompt, history, imageBase64 });
  return data.text;
}

export async function generateImage(prompt: string): Promise<string | null> {
  const data = await apiRequest('image', { prompt });
  return data.imageData;
}

export async function analyzeHomeworkImage(
  imageBase64: string,
  prompt: string = 'Analysera denna läxa och förklara för mig som förälder hur jag kan hjälpa mitt barn.'
): Promise<string> {
  return generateHomeworkHelp(prompt, [], imageBase64);
}
