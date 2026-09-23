import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Button } from '@/components/ui';
import { colors, radii, space } from '@/theme';

const SLIDES = [
  {
    key: '1',
    title: 'Hold Africa and the world in one balance',
    body: 'Multi-currency wallets with clear fees before you commit.',
  },
  {
    key: '2',
    title: 'Send with confidence',
    body: 'Bank or mobile money — rates and arrival windows shown up front.',
  },
  {
    key: '3',
    title: 'Spend anywhere',
    body: 'Virtual USD cards funded from your balance — designs you choose.',
  },
];

const WIDTH = Dimensions.get('window').width - space.md * 2;

export default function WelcomeScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % SLIDES.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
    setIndex(i);
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.brandBlock}>
        <Image
          source={require('../../assets/novapay.jpeg')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="NovaPay"
        />
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: WIDTH }]}>
            <View style={styles.slideWash} />
            <Text variant="h2" style={styles.slideTitle}>
              {item.title}
            </Text>
            <Text variant="secondary">{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => {
              setIndex(i);
              listRef.current?.scrollToIndex({ index: i, animated: true });
            }}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.cta}>
        <Button
          label="Continue with phone"
          fullWidth
          onPress={() => router.push('/(auth)/phone')}
        />
        <Text variant="caption" color={colors.textMuted} style={styles.legal}>
          By continuing you agree to NovaPay’s Terms and Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingBottom: space.xl },
  brandBlock: {
    marginTop: space.md,
    marginBottom: space.sm,
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    maxWidth: 260,
    height: 160,
  },
  carousel: { flexGrow: 0 },
  slide: {
    paddingVertical: space.xl,
    paddingRight: space.md,
    gap: space.sm,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  slideWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: space.md,
    bottom: space.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySoft,
    opacity: 0.7,
  },
  slideTitle: { maxWidth: 300 },
  dots: {
    flexDirection: 'row',
    gap: space.xs,
    marginBottom: space.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.hairline,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.accent,
  },
  cta: { gap: space.md },
  legal: { textAlign: 'center' },
});
