import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  BottomSheet,
  Button,
  MoneyText,
  StatusPill,
  Text,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { isInbound, statusTone, txnTitle } from '@/lib/txn';
import type { Transaction } from '@/lib/money-types';
import { colors, radii, space } from '@/theme';

export function TxnRow({
  txn,
  onPress,
}: {
  txn: Transaction;
  onPress: () => void;
}) {
  const inbound = isInbound(txn.type);
  const amount = formatMoney(txn.amountMinor, txn.currency);
  return (
    <Pressable onPress={onPress} style={styles.txnRow}>
      <View style={styles.txnIcon}>
        <Text variant="bodyMedium" color={colors.primary}>
          {inbound ? '↓' : '↑'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{txnTitle(txn.type)}</Text>
        <Text variant="caption">{txn.status}</Text>
      </View>
      <MoneyText size="sm" color={inbound ? colors.success : colors.text}>
        {inbound ? `+${amount}` : `−${amount}`}
      </MoneyText>
    </Pressable>
  );
}

export function TxnDetailSheet({
  txn,
  onClose,
}: {
  txn: Transaction | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={Boolean(txn)} onClose={onClose} title="Transaction">
      {txn ? (
        <View style={{ gap: space.sm, paddingBottom: space.md }}>
          <StatusPill label={txn.status} tone={statusTone(txn.status)} />
          <MoneyText size="lg">
            {formatMoney(txn.amountMinor, txn.currency)}
          </MoneyText>
          <Detail label="Type" value={txnTitle(txn.type)} />
          <Detail label="Fee" value={formatMoney(txn.feeMinor, txn.currency)} />
          <Detail label="Currency" value={txn.currency} />
          <Detail
            label="When"
            value={new Date(txn.createdAt).toLocaleString()}
          />
          {txn.externalReference ? (
            <Detail label="Reference" value={txn.externalReference} />
          ) : null}
          {txn.failureReason ? (
            <Detail label="Failure" value={txn.failureReason} />
          ) : null}
          <Button label="Close" variant="secondary" fullWidth onPress={onClose} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption">{label}</Text>
      <Text variant="body" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
});
