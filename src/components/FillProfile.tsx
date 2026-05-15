// TODO: Fields per Ryan's spec but not in Figma — collect in Profile tab later:
//   - address (TEXT)
//   - phone (TEXT, mandatory for PM contact)
//   - trip_charge / dispatch_fee (NUMERIC)
//   - radius_miles (NUMERIC)
// vendors table has columns for these; just not in this screen's design.
//
// TODO: when Alfred approves via Telegram, push notification triggers and routes
// user to (tabs) home. Real-time subscription to vendors.status would also work.
//
// Two-step submit: upsert vendors row to get id → upload files to Storage
// scoped by that id → update row with returned paths. RLS for the buckets
// resolves the vendor id from auth.jwt()->>'email', so the row must exist
// before any upload.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
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
import {
  alertCopyFor,
  type FileKind,
  kindLabel,
  shortReasonFor,
  UploadError,
} from '@/lib/uploadError';
import { refreshVendorCache, setCachedVendor } from '@/lib/vendorCache';
import {
  uploadVendorAvatar,
  uploadVendorDocument,
  validateAsset,
} from '@/lib/vendorStorage';
import type { Database } from '@/types/database';
import { colors, radius, spacing, typography } from '@/theme';

type UploadTarget = 'avatar' | 'coi' | 'w9';

const assetSchema = z
  .object({
    uri: z.string(),
    mimeType: z.string(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
  })
  .optional();

const schema = z.object({
  fullName: z.string().min(2, 'Required'),
  businessName: z.string().min(2, 'Required'),
  trades: z
    .array(z.enum(['hvac', 'plumbing', 'handyman', 'electrical']))
    .min(1, 'Select at least one'),
  email: z.string().email(),
  about: z.string().optional(),
  avatar: assetSchema,
  coi: assetSchema,
  w9: assetSchema,
});

type FormValues = z.infer<typeof schema>;
type Asset = NonNullable<FormValues['avatar']>;

type Props = {
  initialEmail?: string;
  initiallySubmitted?: boolean;
  onBack?: () => void;
};

// Delay between rendering the success state and replacing the route to
// /(tabs). Long enough for the vendor to read the confirmation, short enough
// that nobody starts wondering whether the app is stuck.
const SUCCESS_HOLD_MS = 3000;

export function FillProfile({ initialEmail, initiallySubmitted = false, onBack }: Props) {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [submitting, setSubmitting] = useState(false);
  // Track the auto-advance timer so we can clean it up if the component
  // unmounts (vendor backgrounds the app, or AuthGate yanks them away).
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);
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

  const avatar = watch('avatar');
  const coi = watch('coi');
  const w9 = watch('w9');
  const trades = watch('trades');

  const setForTarget = (target: UploadTarget, asset: Asset) => {
    if (target === 'avatar') setValue('avatar', asset);
    if (target === 'coi') setValue('coi', asset);
    if (target === 'w9') setValue('w9', asset);
  };

  // Pre-upload validation, run at pick time so bad files never reach the
  // form state. Mirrors the server-side bucket limits (file_size_limit +
  // allowed_mime_types) for snappy UX. Returns true if the asset is OK.
  const validatePicked = (
    target: UploadTarget,
    mimeType: string | null | undefined,
    fileSize: number | null | undefined,
  ): boolean => {
    const err = validateAsset(target as FileKind, mimeType, fileSize);
    if (err) {
      Alert.alert(...alertCopyFor(err.code, target as FileKind, err.detail));
      return false;
    }
    return true;
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

  // DocumentPicker returns asset.mimeType (usually populated by the OS file
  // picker) and asset.size. Camera/Gallery (ImagePicker) return mimeType and
  // fileSize. We DO NOT fall back to a guessed MIME — task spec: strict
  // reject on missing MIME so users get an honest "unsupported type" Alert
  // instead of a server-side surprise.
  const handleDocument = (target: UploadTarget) =>
    withPickerLock(async () => {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (!validatePicked(target, a.mimeType, a.size)) return;
      setForTarget(target, {
        uri: a.uri,
        mimeType: a.mimeType as string,
        fileName: a.name,
        fileSize: a.size,
      });
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
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (!validatePicked(target, a.mimeType, a.fileSize)) return;
      setForTarget(target, {
        uri: a.uri,
        mimeType: a.mimeType as string,
        fileName: a.fileName ?? 'photo.jpg',
        fileSize: a.fileSize ?? undefined,
      });
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
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      if (!validatePicked(target, a.mimeType, a.fileSize)) return;
      setForTarget(target, {
        uri: a.uri,
        mimeType: a.mimeType as string,
        fileName: a.fileName ?? 'image.jpg',
        fileSize: a.fileSize ?? undefined,
      });
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

      // Step 1: upsert the vendor row. We need vendor.id back to namespace
      // Storage paths and satisfy bucket RLS (which subselects vendors by
      // auth.jwt() email — the row must exist before uploads).
      const { data: vendorRow, error: upsertError } = await supabase
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

      if (upsertError) throw new Error(upsertError.message);
      if (!vendorRow) throw new Error('Vendor upsert returned no row.');

      // Step 2: upload files in parallel. Each upload is fault-isolated —
      // a single failure doesn't drop the others or roll back the row.
      // fileSize is passed for an early size check inside the helper; the
      // helper still re-checks against the actual bytes read.
      const uploads = await Promise.allSettled([
        values.avatar
          ? uploadVendorAvatar(
              vendorRow.id,
              values.avatar.uri,
              values.avatar.mimeType,
              values.avatar.fileSize,
            )
          : Promise.resolve(null),
        values.coi
          ? uploadVendorDocument(
              vendorRow.id,
              'coi',
              values.coi.uri,
              values.coi.mimeType,
              values.coi.fileSize,
            )
          : Promise.resolve(null),
        values.w9
          ? uploadVendorDocument(
              vendorRow.id,
              'w9',
              values.w9.uri,
              values.w9.mimeType,
              values.w9.fileSize,
            )
          : Promise.resolve(null),
      ]);

      const [avatarRes, coiRes, w9Res] = uploads;
      const pathPatch: Database['public']['Tables']['vendors']['Update'] = {};
      if (avatarRes.status === 'fulfilled' && avatarRes.value) {
        pathPatch.avatar_path = avatarRes.value;
      }
      if (coiRes.status === 'fulfilled' && coiRes.value) {
        pathPatch.coi_path = coiRes.value;
      }
      if (w9Res.status === 'fulfilled' && w9Res.value) {
        pathPatch.w9_path = w9Res.value;
      }

      // Step 3: persist paths back to the row if we got any.
      if (Object.keys(pathPatch).length > 0) {
        const { error: patchError } = await supabase
          .from('vendors')
          .update(pathPatch)
          .eq('id', vendorRow.id);
        if (patchError) {
          console.warn('[FillProfile] path patch failed', patchError);
        }
      }

      const kinds: FileKind[] = ['avatar', 'coi', 'w9'];
      const failures = uploads
        .map((r, i) => ({ r, kind: kinds[i] }))
        .filter(
          (x): x is { r: PromiseRejectedResult; kind: FileKind } =>
            x.r.status === 'rejected',
        );

      // Seed the cache with the row we just upserted so AuthGate sees
      // status='pending' immediately on the (tabs) replace below — otherwise
      // it would re-fetch and, on a slow network, briefly observe a stale
      // null and bounce the vendor back to fill-profile. Then kick off a
      // background re-fetch so any patches landed in Step 3 (avatar_path /
      // coi_path / w9_path) make it into the cache too.
      setCachedVendor(vendorRow);
      void refreshVendorCache();
      setSubmitted(true);

      if (failures.length > 0) {
        const lines = failures.map((f) => {
          const code =
            f.r.reason instanceof UploadError ? f.r.reason.code : 'UPLOAD_FAILED';
          return `${kindLabel(f.kind)} — ${shortReasonFor(code)}.`;
        });
        Alert.alert(
          'Profile saved',
          `Some files didn't upload. You can re-try from the Profile screen.\n\n${lines.join('\n')}`,
        );
      }

      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        router.replace('/(tabs)');
      }, SUCCESS_HOLD_MS);
    } catch (err) {
      Alert.alert('Submission failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.successWrap}>
        <CheckCircle2 size={120} color={colors.status.success} strokeWidth={1.5} />
        <Text style={styles.successTitle}>Profile submitted!</Text>
        <Text style={styles.successBody}>
          Taking you to your dashboard…
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
          <AvatarPicker uri={avatar?.uri} onPress={() => openSheetFor('avatar')} />
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
            fileName={coi?.fileName}
            onPress={() => openSheetFor('coi')}
          />

          <UploadField
            label="Upload W-9 to Verify Account : Optional"
            fileName={w9?.fileName}
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
