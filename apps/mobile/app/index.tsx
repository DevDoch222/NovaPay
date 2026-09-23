import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';

/**
 * Auth gate — use router.replace (stable deps) instead of <Redirect>.
 * Expo Router's Redirect re-fires on every render via useFocusEffect,
 * which loops when Auth/Wallets context updates during boot.
 */
export default function Index() {
  const router = useRouter();
  const { ready, user, pinSet, unlocked, kycSkipped } = useAuth();

  const target = useMemo((): Href | null => {
    if (!ready) return null;
    if (!user) return '/(auth)/welcome';
    if (!pinSet) return '/(auth)/pin-setup';
    if (!unlocked) return '/(auth)/pin-unlock';
    if (user.kycTier === 'tier_0' && !kycSkipped) return '/(auth)/kyc';
    return '/(tabs)';
  }, [ready, user, pinSet, unlocked, kycSkipped]);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return (
    <View style={styles.boot}>
      <Image
        source={require('../assets/novapay.jpeg')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="NovaPay"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 48,
  },
  logo: {
    width: '100%',
    maxWidth: 280,
    height: 220,
  },
});
