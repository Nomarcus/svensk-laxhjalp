import * as AppleAuthentication from 'expo-apple-authentication';
import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ensureUserDocument, signInWithAppleIdentityToken, signInWithEmail, signUpWithEmail } from '../firebase';

export function AuthScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const run = async (mode: 'login' | 'signup') => {
    setBusy(true);
    try {
      const result = mode === 'login' ? await signInWithEmail(email.trim(), password) : await signUpWithEmail(email.trim(), password);
      await ensureUserDocument(result.user);
    } catch (error) {
      Alert.alert('Inloggning misslyckades', error instanceof Error ? error.message : 'Försök igen.');
    } finally {
      setBusy(false);
    }
  };

  const appleLogin = async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
      if (!credential.identityToken) throw new Error('Apple returnerade ingen identitetstoken.');
      await signInWithAppleIdentityToken(credential.identityToken);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple-inloggning misslyckades', error instanceof Error ? error.message : 'Försök igen.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Föräldrahjälpen</Text>
        <Text style={styles.title}>Logga in med samma konto som på webben</Text>
        <Text style={styles.copy}>Dina barnprofiler, historik och abonnemang hämtas från samma Firebase-konto och API.</Text>

        <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="E-post" style={styles.input} value={email} />
        <TextInput onChangeText={setPassword} placeholder="Lösenord" secureTextEntry style={styles.input} value={password} />

        <Pressable disabled={busy} onPress={() => run('login')} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{busy ? 'Vänta…' : 'Logga in'}</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => run('signup')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Skapa konto</Text>
        </Pressable>

        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            cornerRadius={12}
            onPress={appleLogin}
            style={styles.appleButton}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 28, padding: 24, gap: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20 },
  eyebrow: { color: '#059669', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#1c1917', fontSize: 30, fontWeight: '700', lineHeight: 36 },
  copy: { color: '#78716c', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  input: { backgroundColor: '#f5f5f4', borderColor: '#e7e5e4', borderRadius: 14, borderWidth: 1, fontSize: 16, padding: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 16, padding: 15 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: '#d6d3d1', borderRadius: 16, borderWidth: 1, padding: 15 },
  secondaryText: { color: '#44403c', fontSize: 16, fontWeight: '700' },
  appleButton: { height: 50, marginTop: 4 },
});
