// Shared line-items editor used by both the Invoice and Quote builder
// screens. Controlled component: parent owns the items array and validation;
// this file just renders the rows + add button and exposes the helpers
// (normalizeAmount, parseAmountSafe, isItemValid) the parents need to compute
// total + validity outside the component. formatMoney lives in @/utils/formatters
// and is re-exported here so existing importers keep working.
import { Plus, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, typography } from '@/theme';
export { formatMoney } from '@/utils/formatters';

export type ItemDraft = { description: string; amount: string };

// Allow only digits + at most one decimal point + at most 2 decimals after.
// No leading "$", no negatives, no scientific notation.
export function normalizeAmount(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) {
    s = parts[0] + '.' + parts.slice(1).join('');
  }
  const [intPart, dec] = s.split('.');
  if (dec !== undefined) {
    s = (intPart || '') + '.' + dec.slice(0, 2);
  }
  return s;
}

export function parseAmountSafe(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function isItemValid(it: ItemDraft): boolean {
  return it.description.trim().length > 0 && parseAmountSafe(it.amount) > 0;
}

type Props = {
  items: ItemDraft[];
  onChange: (next: ItemDraft[]) => void;
};

export function LineItemsInput({ items, onChange }: Props) {
  const update = (index: number, patch: Partial<ItemDraft>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addItem = () => {
    onChange([...items, { description: '', amount: '' }]);
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <View>
      {items.map((it, idx) => (
        <View key={idx} style={styles.itemRow}>
          <View style={styles.itemInputs}>
            <TextInput
              style={styles.descInput}
              value={it.description}
              onChangeText={(text) => update(idx, { description: text })}
              placeholder="Description (e.g. Labor 2h)"
              placeholderTextColor={colors.text.tertiary}
              multiline
            />
            <TextInput
              style={styles.amountInput}
              value={it.amount}
              onChangeText={(text) => update(idx, { amount: normalizeAmount(text) })}
              placeholder="0.00"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => removeItem(idx)}
            disabled={items.length === 1}
            accessibilityRole="button"
            accessibilityLabel={`Remove item ${idx + 1}`}
            style={({ pressed }) => [
              styles.removeBtn,
              items.length === 1 && styles.removeBtnDisabled,
              pressed && styles.removeBtnPressed,
            ]}
          >
            <X
              size={18}
              color={
                items.length === 1 ? colors.text.tertiary : colors.text.primary
              }
            />
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={addItem}
        accessibilityRole="button"
        accessibilityLabel="Add item"
        style={({ pressed }) => [
          styles.addItemBtn,
          pressed && styles.addItemBtnPressed,
        ]}
      >
        <Plus size={18} color={colors.brand.primary} />
        <Text style={styles.addItemText}>Add Item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  itemInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  descInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface.muted,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
    color: colors.text.primary,
  },
  amountInput: {
    width: 100,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface.muted,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: colors.text.primary,
    textAlign: 'right',
  },
  removeBtn: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  removeBtnDisabled: { opacity: 0.3 },
  removeBtnPressed: { backgroundColor: colors.surface.muted },

  addItemBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  addItemBtnPressed: { opacity: 0.7 },
  addItemText: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
});
