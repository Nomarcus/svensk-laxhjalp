import React from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, logout } from '../firebase';
import { fetchSubscriptionStatus, sendChatMessage } from '../services/api';
import { createChild, ensureChatSession, listenChildren, listenMessages, saveMessage } from '../services/firestore';
import type { Child, ChatSession, Message, UserSubscription } from '../types';
import { SubscriptionPanel } from './SubscriptionPanel';

export function HomeScreen() {
  const user = auth.currentUser!;
  const [children, setChildren] = React.useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = React.useState<Child | null>(null);
  const [session, setSession] = React.useState<ChatSession | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [childName, setChildName] = React.useState('');
  const [childGrade, setChildGrade] = React.useState('');
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [subscription, setSubscription] = React.useState<UserSubscription | null>(null);

  React.useEffect(() => listenChildren(user.uid, (items) => {
    setChildren(items);
    setSelectedChild((current) => current || items[0] || null);
  }), [user.uid]);

  React.useEffect(() => {
    fetchSubscriptionStatus().then(setSubscription).catch(() => setSubscription({ tier: 'free', status: 'none' }));
  }, []);

  React.useEffect(() => {
    if (!selectedChild) {
      setSession(null);
      setMessages([]);
      return;
    }
    let unsubscribeMessages: (() => void) | undefined;
    ensureChatSession(user.uid, selectedChild.id).then((nextSession) => {
      setSession(nextSession);
      unsubscribeMessages = listenMessages(user.uid, selectedChild.id, nextSession.id, setMessages);
    }).catch((error) => Alert.alert('Historik kunde inte laddas', error instanceof Error ? error.message : 'Försök igen.'));
    return () => unsubscribeMessages?.();
  }, [selectedChild, user.uid]);

  const addChild = async () => {
    if (!childName.trim()) return;
    try {
      const childId = await createChild(user.uid, childName, childGrade);
      setChildName('');
      setChildGrade('');
      setSelectedChild({ id: childId, name: childName.trim(), grade: childGrade.trim(), ownerId: user.uid });
    } catch (error) {
      Alert.alert('Barnprofil kunde inte skapas', error instanceof Error ? error.message : 'Försök igen.');
    }
  };

  const send = async () => {
    if (!input.trim() || !selectedChild || !session) return;
    const prompt = input.trim();
    setInput('');
    setBusy(true);
    try {
      await saveMessage(user.uid, selectedChild.id, session.id, 'user', prompt);
      const answer = await sendChatMessage({
        prompt,
        history: messages.map((message) => ({ role: message.role, content: message.content })),
        childGrade: selectedChild.grade,
        language: 'sv',
      });
      await saveMessage(user.uid, selectedChild.id, session.id, 'model', answer);
      setSubscription(await fetchSubscriptionStatus());
    } catch (error) {
      Alert.alert('AI-chatten misslyckades', error instanceof Error ? error.message : 'Försök igen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Föräldrahjälpen iOS</Text>
            <Text style={styles.title}>Samma konto överallt</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
          <Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Logga ut</Text></Pressable>
        </View>

        <SubscriptionPanel subscription={subscription} onChange={setSubscription} />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Barnprofiler</Text>
          <FlatList
            data={children}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => setSelectedChild(item)} style={[styles.childPill, selectedChild?.id === item.id && styles.childPillActive]}>
                <Text style={[styles.childText, selectedChild?.id === item.id && styles.childTextActive]}>{item.name}</Text>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
          />
          <View style={styles.row}>
            <TextInput onChangeText={setChildName} placeholder="Namn" style={[styles.input, styles.flex]} value={childName} />
            <TextInput onChangeText={setChildGrade} placeholder="Åk" style={styles.gradeInput} value={childGrade} />
            <Pressable onPress={addChild} style={styles.addButton}><Text style={styles.addText}>+</Text></Pressable>
          </View>
        </View>

        <View style={styles.chatCard}>
          <Text style={styles.sectionTitle}>AI-chat {selectedChild ? `för ${selectedChild.name}` : ''}</Text>
          <View style={styles.messages}>
            {messages.length === 0 ? <Text style={styles.empty}>Skicka en fråga om läxan för att starta historiken.</Text> : null}
            {messages.map((message) => (
              <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.modelBubble]}>
                <Text style={styles.bubbleLabel}>{message.role === 'user' ? 'Du' : 'AI'}</Text>
                <Text style={styles.bubbleText}>{message.content}</Text>
              </View>
            ))}
          </View>
          <TextInput multiline onChangeText={setInput} placeholder="Skriv din läxfråga…" style={styles.chatInput} value={input} />
          <Pressable disabled={busy || !selectedChild || !session} onPress={send} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{busy ? 'Tänker…' : 'Skicka till samma API'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F0' },
  container: { gap: 16, padding: 18, paddingBottom: 36 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: '#059669', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#1c1917', fontSize: 28, fontWeight: '800' },
  email: { color: '#78716c', marginTop: 4 },
  logout: { borderColor: '#d6d3d1', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { color: '#57534e', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 22, gap: 12, padding: 16 },
  chatCard: { backgroundColor: '#fff', borderRadius: 22, gap: 12, padding: 16 },
  sectionTitle: { color: '#292524', fontSize: 19, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: { backgroundColor: '#f5f5f4', borderColor: '#e7e5e4', borderRadius: 14, borderWidth: 1, padding: 12 },
  gradeInput: { backgroundColor: '#f5f5f4', borderColor: '#e7e5e4', borderRadius: 14, borderWidth: 1, padding: 12, width: 70 },
  addButton: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 14, justifyContent: 'center', width: 48 },
  addText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  childPill: { backgroundColor: '#f5f5f4', borderRadius: 999, marginRight: 8, paddingHorizontal: 14, paddingVertical: 9 },
  childPillActive: { backgroundColor: '#059669' },
  childText: { color: '#57534e', fontWeight: '700' },
  childTextActive: { color: '#fff' },
  messages: { gap: 10, maxHeight: 420 },
  empty: { color: '#a8a29e', fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  bubble: { borderRadius: 16, gap: 4, padding: 12 },
  userBubble: { backgroundColor: '#dcfce7', marginLeft: 30 },
  modelBubble: { backgroundColor: '#f5f5f4', marginRight: 30 },
  bubbleLabel: { color: '#047857', fontSize: 12, fontWeight: '800' },
  bubbleText: { color: '#292524', lineHeight: 20 },
  chatInput: { backgroundColor: '#fafaf9', borderColor: '#e7e5e4', borderRadius: 16, borderWidth: 1, minHeight: 90, padding: 12, textAlignVertical: 'top' },
  primaryButton: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 16, padding: 15 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
