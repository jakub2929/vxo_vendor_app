// TODO: Fields per Ryan's spec but not in Figma — collect in Profile tab later:
//   - address (TEXT)
//   - phone (TEXT, mandatory for PM contact)
//   - trip_charge / dispatch_fee (NUMERIC)
//   - radius_miles (NUMERIC)
// vendors table has columns for these; just not in this screen's design.
//
// TODO: upload files to Supabase Storage bucket 'job-photos' on submit, store
// URIs in vendors row. For now AvatarPicker / UploadField store local URIs only.
//
// TODO: when Alfred approves via Telegram, push notification triggers and routes
// user to (tabs) home. Real-time subscription to vendors.status would also work.

import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Calendar, CheckCircle2, ChevronLeft, Mail } from 'lucide-react-native';
import { z } from 'zod';
import {
  AttachmentBottomSheet,
  type AttachmentSource,
} from '@/components/AttachmentBottomSheet';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import {
  type Trade,
  TradeServicesPicker,
  tradesToLabel,
} from '@/features/profile/TradeServicesPicker';
import { UploadField } from '@/features/profile/UploadField';
import { supabase } from '@/lib/supabase';
import { clearVendorCache } from '@/lib/vendorCache';
import { colors, radius, spacing, typography } from '@/theme';

type UploadTarget = 'avatar' | 'coi' | 'w9';

const schema = z.object({
  fullName: z.string().min(2, 'Required'),
  businessName: z.string().min(2, 'Required'),
  trades: z
    .array(z.enum(['hvac', 'plumbing', 'handyman', 'electrical']))
    .min(1, 'Select at least one'),
  email: z.string().email(),
  about: z.string().optional(),
  avatarUri: z.string().optional(),
  coiUri: z.string().optional(),
  w9Uri: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  initialEmail?: string;
  initiallySubmitted?: boolean;
  onBack?: () => void;
};

export function FillProfile({ initialEmail, initiallySubmitted = false, onBack }: Props) {
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [submitting, setSubmitting] = useState(false);
  // uploadTarget tracks which slot the picker result will fill; sheetVisible
  // is independent so closing the sheet doesn't drop the target before the
  // picker callback fires.
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [tradePickerOpen, setTradePickerOpen] = useState(false);

  const openSheetFor = (target: UploadTarget) => {
    setUploadTarget(target);
    setSheetVisible(true);
  };

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      businessName: '',
      trades: [],
      email: initialEmail ?? '',
      about: '',
    },
  });

  useEffect(() => {
    if (initialEmail) setValue('email', initialEmail);
  }, [initialEmail, setValue]);

  const avatarUri = watch('avatarUri');
  const coiUri = watch('coiUri');
  const w9Uri = watch('w9Uri');
  const trades = watch('trades');

  const setForTarget = (target: UploadTarget, uri: string, fileName?: string) => {
    if (target === 'avatar') setValue('avatarUri', uri);
    if (target === 'coi') setValue('coiUri', fileName ?? uri);
    if (target === 'w9') setValue('w9Uri', fileName ?? uri);
  };

  const pickerBusy = useRef(false);

  // Wraps picker invocations with a JS-side lock (prevents double-tap from
  // running two pickers in parallel — that's what produces the native
  // "Different document picking in progress" error) and a try/catch so
  // module errors surface as a soft alert instead of a Metro red screen.
  const withPickerLock = async (fn: () => Promise<void>) => {
    if (pickerBusy.current) return;
    pickerBusy.current = true;
    try {
      await fn();
    } catch (err) {
      console.error('[picker]', err);
      Alert.alert(
        'Couldn\'t open the picker',
        'Please try again in a moment.',
      );
    } finally {
      pickerBusy.current = false;
    }
  };

  const handleDocument = (target: UploadTarget) =>
    withPickerLock(async () => {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setForTarget(target, a.uri, a.name);
      }
    });

  const handleCamera = (target: UploadTarget) =>
    withPickerLock(async () => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera permission needed',
          'Enable camera access in Settings to take a photo.',
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setForTarget(target, a.uri, a.fileName ?? 'photo.jpg');
      }
    });

  const handleGallery = (target: UploadTarget) =>
    withPickerLock(async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photo library permission needed',
          'Enable photos access in Settings to pick an image.',
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) {
        const a = res.assets[0];
        setForTarget(target, a.uri, a.fileName ?? 'image.jpg');
      }
    });

  const handleAttachmentSelect = (source: AttachmentSource) => {
    const target = uploadTarget;
    if (!target) return;
    if (source === 'document') void handleDocument(target);
    else if (source === 'camera') void handleCamera(target);
    else void handleGallery(target);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userEmail = userRes.user?.email ?? values.email;

      const { error } = await supabase
        .from('vendors')
        .upsert(
          {
            email: userEmail,
            name: values.fullName,
            business: values.businessName,
            trades: values.trades,
            bio: values.about ?? null,
            status: 'pending',
          },
          { onConflict: 'email' },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);

      clearVendorCache();
      setSubmitted(true);
    } catch (err) {
      Alert.alert('Submission failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.successWrap}>
        <CheckCircle2 size={120} color={colors.brand.primary} strokeWidth={1.5} />
        <Text style={styles.successTitle}>Application Submitted</Text>
        <Text style={styles.successBody}>
          Your profile is being reviewed. We&apos;ll notify you when you&apos;re approved and can
          start receiving jobs.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Back">
              <ChevronLeft size={28} color={colors.text.primary} />
            </Pressable>
          ) : null}
          <Text style={styles.title}>Fill Your Profile</Text>
        </View>

        <View style={styles.avatarBlock}>
          <AvatarPicker uri={avatarUri} onPress={() => openSheetFor('avatar')} />
        </View>

        <View style={styles.fields}>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { value, onChange, onBlur } }) => (
              <FieldShell error={errors.fullName?.message}>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Full Name"
                  placeholderTextColor={colors.text.tertiary}
                />
              </FieldShell>
            )}
          />

          <Controller
            control={control}
            name="businessName"
            render={({ field: { value, onChange, onBlur } }) => (
              <FieldShell error={errors.businessName?.message}>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Business Name"
                  placeholderTextColor={colors.text.tertiary}
                />
              </FieldShell>
            )}
          />

          <Pressable onPress={() => setTradePickerOpen(true)}>
            <FieldShell error={errors.trades?.message as string | undefined}>
              <Text
                style={[styles.input, trades.length === 0 && styles.placeholder]}
                numberOfLines={1}
              >
                {trades.length > 0 ? tradesToLabel(trades) : 'Trade & Services'}
              </Text>
              <Calendar size={20} color={colors.text.tertiary} />
            </FieldShell>
          </Pressable>

          <Controller
            control={control}
            name="email"
            render={({ field: { value } }) => (
              <FieldShell error={errors.email?.message}>
                <Text
                  style={[styles.input, !value && styles.placeholder]}
                  numberOfLines={1}
                >
                  {value || 'Email'}
                </Text>
                <Mail size={20} color={colors.text.tertiary} />
              </FieldShell>
            )}
          />

          <Controller
            control={control}
            name="about"
            render={({ field: { value, onChange, onBlur } }) => (
              <FieldShell error={undefined} multiline>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Tell us about yourself"
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </FieldShell>
            )}
          />

          <UploadField
            label="Upload COI for Larger Jobs :  (Optional)"
            fileName={coiUri}
            onPress={() => openSheetFor('coi')}
          />

          <UploadField
            label="Upload W-9 to Verify Account : Optional"
            fileName={w9Uri}
            onPress={() => openSheetFor('w9')}
          />
        </View>

        <Pressable
          style={[styles.cta, submitting && styles.ctaDisabled]}
          disabled={submitting}
          onPress={handleSubmit(onSubmit)}
        >
          <Text style={styles.ctaLabel}>{submitting ? 'Submitting…' : 'Continue'}</Text>
        </Pressable>
      </ScrollView>

      <AttachmentBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={handleAttachmentSelect}
      />

      <TradeServicesPicker
        visible={tradePickerOpen}
        selected={trades}
        onClose={() => setTradePickerOpen(false)}
        onChange={(next) => setValue('trades', next as Trade[])}
      />
    </KeyboardAvoidingView>
  );
}

function FieldShell({
  children,
  error,
  multiline,
}: {
  children: React.ReactNode;
  error?: string;
  multiline?: boolean;
}) {
  return (
    <View>
      <View style={[styles.field, multiline && styles.fieldMultiline]}>{children}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 48,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
  },
  avatarBlock: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  fields: {
    gap: spacing.lg,
  },
  field: {
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldMultiline: {
    minHeight: 120,
    paddingVertical: 16,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text.primary,
    padding: 0,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  placeholder: {
    color: colors.text.tertiary,
  },
  error: {
    ...typography.caption,
    color: colors.status.danger,
    marginTop: 4,
    marginLeft: 4,
  },
  cta: {
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    shadowColor: colors.brand.primary,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 4, height: 8 },
    elevation: 6,
  },
  ctaDisabled: {
    backgroundColor: '#3062c8',
  },
  ctaLabel: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
    color: colors.surface.base,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: spacing.md,
    backgroundColor: colors.surface.base,
  },
  successTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  successBody: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
});
