import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  NativeSyntheticEvent,
  Text,
  View,
} from 'react-native';
import { colors, radius, typography } from '@/theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
};

// Box styling mirrors Figma node 4:10251 — bg #fafafa, 1px #eee border,
// radius 16, digit Urbanist Bold 24 #212121. Active state (node 4:10253):
// bg #246bfd14 (~8% alpha), border 1px brand.primary.
//
// Figma shows 4 boxes (83×61, gap 16) on a 380px content row. Supabase requires
// a 6-digit email OTP, so we render 6 boxes — re-fit to the same 380px row by
// shrinking width to 55 with a 10px gap (6×55 + 5×10 = 380). Height stays 61.
const BOX_WIDTH = 55;
const BOX_HEIGHT = 61;
const BOX_GAP = 10;
const ACTIVE_BG = '#246bfd14';

export function OTPInput({
  value,
  onChange,
  length = 6,
  onComplete,
  autoFocus = true,
}: Props) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const digits = useMemo(() => {
    const cleanValue = value.replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, index) => cleanValue[index] ?? '');
  }, [value, length]);

  useEffect(() => {
    if (onComplete && digits.every((digit) => digit !== '')) {
      onComplete(digits.join(''));
    }
  }, [digits, onComplete]);

  useEffect(() => {
    if (autoFocus) {
      // Defer one tick so the underlying TextInput refs are populated.
      const id = setTimeout(() => inputRefs.current[0]?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [autoFocus]);

  const updateAtIndex = (index: number, digit: string) => {
    const next = [...digits];
    next[index] = digit;
    onChange(next.join(''));
  };

  const handleChangeAtIndex = (index: number, text: string) => {
    const nextDigit = text.replace(/\D/g, '').slice(-1);
    updateAtIndex(index, nextDigit);

    if (nextDigit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key !== 'Backspace') {
      return;
    }

    if (digits[index] !== '') {
      updateAtIndex(index, '');
      return;
    }

    if (index > 0) {
      updateAtIndex(index - 1, '');
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => {
        const active = focusedIndex === index;

        return (
          <Pressable
            key={index}
            onPress={() => inputRefs.current[index]?.focus()}
            style={[styles.box, active && styles.boxActive]}
          >
            {digit ? (
              <Text style={styles.digit} allowFontScaling={false}>
                {digit}
              </Text>
            ) : null}
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={digit}
              onChangeText={(text) => handleChangeAtIndex(index, text)}
              onKeyPress={(event) => handleKeyPress(index, event)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex((prev) => (prev === index ? null : prev))}
              keyboardType="number-pad"
              maxLength={1}
              style={styles.hiddenInput}
              caretHidden
              autoFocus={autoFocus && index === 0}
              importantForAccessibility={Platform.OS === 'android' ? 'no' : undefined}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BOX_GAP,
  },
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    borderWidth: 1,
    borderColor: colors.divider.soft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxActive: {
    backgroundColor: ACTIVE_BG,
    borderColor: colors.brand.primary,
  },
  digit: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    textAlign: 'center',
  },
});
