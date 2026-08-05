import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AuthScreen } from './src/components/AuthScreen';
import { HomeScreen } from './src/components/HomeScreen';
import { auth, ensureUserDocument } from './src/firebase';

export default function App() {
  const [user, setUser] = React.useState<User | null>(auth.currentUser);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (nextUser) await ensureUserDocument(nextUser);
    setLoading(false);
  }), []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#059669" size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <>
      {user ? <HomeScreen /> : <AuthScreen />}
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: '#F5F5F0', flex: 1, justifyContent: 'center' },
});
