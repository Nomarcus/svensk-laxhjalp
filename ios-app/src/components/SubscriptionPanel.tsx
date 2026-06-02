import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserSubscription } from '../types';
import { loadSubscriptionProducts, purchaseSubscription, restoreLatestSubscription, type StoreProduct } from '../services/iap';

export function SubscriptionPanel({ subscription, onChange }: { subscription: UserSubscription | null; onChange: (next: UserSubscription) => void }) {
  const [products, setProducts] = React.useState<StoreProduct[]>([]);
  const [busy, setBusy] = React.useState(false);
  const paid = subscription?.status === 'active' || subscription?.status === 'trialing';

  React.useEffect(() => {
    loadSubscriptionProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  const buy = async (productId: string) => {
    setBusy(true);
    try {
      onChange(await purchaseSubscription(productId));
      Alert.alert('Klart', 'Din Apple-prenumeration är kopplad till kontot.');
    } catch (error) {
      Alert.alert('Köp misslyckades', error instanceof Error ? error.message : 'Försök igen.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      onChange(await restoreLatestSubscription());
      Alert.alert('Återställt', 'Din Apple-prenumeration är återställd.');
    } catch (error) {
      Alert.alert('Kunde inte återställa', error instanceof Error ? error.message : 'Försök igen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>{paid ? 'Abonnemang aktivt' : 'Abonnemang'}</Text>
      <Text style={styles.copy}>
        iOS-appen använder Apple In-App Purchase. Webben kan fortsätta använda Stripe, men båda uppdaterar samma konto.
      </Text>
      {products.map((product) => (
        <Pressable disabled={busy} key={product.productId} onPress={() => buy(product.productId)} style={styles.button}>
          <Text style={styles.buttonText}>{product.localizedPrice || 'Prenumerera'} · {product.title || product.productId}</Text>
        </Pressable>
      ))}
      <Pressable disabled={busy} onPress={restore} style={styles.restoreButton}>
        <Text style={styles.restoreText}>Återställ köp</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderRadius: 22, borderWidth: 1, gap: 10, padding: 16 },
  heading: { color: '#064e3b', fontSize: 18, fontWeight: '800' },
  copy: { color: '#047857', lineHeight: 20 },
  button: { alignItems: 'center', backgroundColor: '#059669', borderRadius: 14, padding: 13 },
  buttonText: { color: '#fff', fontWeight: '800' },
  restoreButton: { alignItems: 'center', padding: 8 },
  restoreText: { color: '#047857', fontWeight: '700' },
});
