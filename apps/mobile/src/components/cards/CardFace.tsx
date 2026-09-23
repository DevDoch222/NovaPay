import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, StatusPill } from '@/components/ui';
import type { NovaCard } from '@/lib/cards-api';
import {
  CARD_DESIGNS,
  getCardDesign,
  type CardDesignId,
} from '@/lib/card-designs';
import { radii, shadows, space } from '@/theme';

type Props = {
  card: NovaCard;
  compact?: boolean;
  designId?: CardDesignId | string | null;
  showStatus?: boolean;
};

function statusTone(status: NovaCard['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'frozen') return 'warning' as const;
  return 'neutral' as const;
}

/** Product face — glass edge, embossed feel, selectable design. */
export function CardFace({
  card,
  compact,
  designId,
  showStatus = true,
}: Props) {
  const design = getCardDesign(designId);
  const muted = card.status !== 'active';

  return (
    <View
      style={[
        styles.shell,
        shadows.depth,
        muted && styles.muted,
        compact && styles.compactShell,
      ]}
    >
      <LinearGradient
        colors={design.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.face, { borderColor: design.border }, compact && styles.compact]}
      >
        <View style={styles.glassSheen} pointerEvents="none" />
        <View style={[styles.orb, { backgroundColor: design.chip }]} pointerEvents="none" />

        <View style={styles.top}>
          <View style={[styles.brandChip, { backgroundColor: design.chip }]}>
            <Text variant="caption" color={design.textMuted}>
              NovaPay · {card.form === 'physical' ? 'Physical' : 'Virtual'}
            </Text>
          </View>
          {showStatus ? (
            <StatusPill label={card.status} tone={statusTone(card.status)} />
          ) : null}
        </View>

        <View style={[styles.contactless, { backgroundColor: design.chip }]} />

        <Text
          variant="h2"
          color={design.textPrimary}
          style={styles.pan}
        >
          ••••  ••••  ••••  {card.last4}
        </Text>

        <View style={styles.bottom}>
          <View>
            <Text variant="caption" color={design.textMuted}>
              {card.label || card.brand.toUpperCase()}
            </Text>
            <Text variant="caption" color={design.textPrimary}>
              {card.currency}
            </Text>
          </View>
          <View style={styles.exp}>
            <Text variant="caption" color={design.textMuted}>
              Exp
            </Text>
            <Text variant="caption" color={design.textPrimary}>
              {card.expMonth}/{card.expYear.slice(-2)}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

type PickerProps = {
  value: CardDesignId;
  onChange: (id: CardDesignId) => void;
};

export function CardDesignPicker({ value, onChange }: PickerProps) {
  return (
    <View style={styles.picker}>
      <Text variant="bodyMedium">Card design</Text>
      <Text variant="caption" color="#6B7280" style={{ marginBottom: space.xs }}>
        {getCardDesign(value).blurb}
      </Text>
      <View style={styles.pickerRow}>
        {CARD_DESIGNS.map((d) => {
          const selected = d.id === value;
          return (
            <Pressable
              key={d.id}
              onPress={() => onChange(d.id)}
              style={[styles.swatchWrap, selected && styles.swatchOn]}
            >
              <LinearGradient
                colors={d.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.swatch}
              />
              <Text variant="caption" style={styles.swatchLabel}>
                {d.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.xl,
  },
  compactShell: {},
  face: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: space.md,
    minHeight: 196,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  compact: { minHeight: 160 },
  muted: { opacity: 0.78 },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: -20,
    width: '70%',
    height: '55%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-18deg' }],
  },
  orb: {
    position: 'absolute',
    right: -30,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  brandChip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radii.full,
  },
  contactless: {
    width: 28,
    height: 22,
    borderRadius: 4,
    marginTop: space.sm,
    opacity: 0.85,
  },
  pan: {
    marginVertical: space.md,
    letterSpacing: 2.5,
    zIndex: 1,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  exp: { alignItems: 'flex-end', gap: 2 },
  picker: { gap: space.xs },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  swatchWrap: {
    width: '30%',
    minWidth: 96,
    alignItems: 'center',
    gap: space.xxs,
    padding: space.xxs,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: {
    borderColor: '#1A73C1',
    backgroundColor: 'rgba(26,115,193,0.08)',
  },
  swatch: {
    width: '100%',
    height: 44,
    borderRadius: radii.sm,
  },
  swatchLabel: { textAlign: 'center' },
});
