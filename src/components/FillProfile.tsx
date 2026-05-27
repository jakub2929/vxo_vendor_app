// TODO: Fields per Ryan's spec but not in Figma — collect in Profile tab later:
//   - trip_charge / dispatch_fee (NUMERIC)
//   - radius_miles (NUMERIC)
// vendors table has columns for these; just not in this screen's design.
// (phone, address, zip_code are now collected here — see Personal Info /
// Service Area sections below.)
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Calendar, CheckCircle2, ChevronLeft, Mail, Minus, Plus } from 'lucide-react-native';
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
import { formatPhoneInput, phoneDigitsOnly } from '@/utils/formatters';

type UploadTarget = 'avatar' | 'coi' | 'w9';

const assetSchema = z
  .object({
    uri: z.string(),
    mimeType: z.string(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
  })
  .optional();

// Phase 5: vendor_profiles splits the legacy single-line `address` into
// state/city/zipcode and renames zip_code → zipcode. Form field names track
// DB columns 1:1.
const schema = z.object({
  fullName: z.string().min(2, 'Required'),
  businessName: z.string().min(2, 'Required'),
  trades: z
    .array(z.enum(['hvac', 'plumbing', 'handyman', 'electrical']))
    .min(1, 'Select at least one'),
  email: z.string().email(),
  // Phone is stored formatted in form state (mask runs on every keystroke);
  // validation strips back to digits to enforce exactly 10.
  phone: z
    .string()
    .refine(
      (v) => phoneDigitsOnly(v).length === 10,
      'Enter a 10-digit US phone number',
    ),
  state: z.string().trim().min(2, 'State is required'),
  city: z.string().trim().min(2, 'City is required'),
  zipcode: z.string().regex(/^\d{5}$/, 'Enter a 5-digit ZIP code'),
  about: z.string().optional(),
  insured: z.boolean(),
  radius_miles: z
    .number()
    .int('Whole miles only')
    .min(5, 'Min 5 miles')
    .max(100, 'Max 100 miles'),
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
      phone: '',
      state: '',
      city: '',
      zipcode: '',
      about: '',
      insured: false,
      radius_miles: 25,
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
      const userId = userRes.user?.id;

      // Step 1: upsert the vendor_profiles row. We need vendor.id back to
      // namespace Storage paths and satisfy bucket RLS (which subselects
      // vendor_profiles by auth.jwt() email — the row must exist before
      // uploads).
      //
      // Phase 5 hotfix: vendor_profiles no longer carries a `status` column;
      // approval lifecycle moved to profiles.status (Step 1b below). The
      // legacy vendor_status_change_guard trigger guarded transitions on the
      // dropped column and is also gone in Ryan's prod.
      const { data: existing } = await supabase
        .from('vendor_profiles')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();

      type VendorInsert = Database['public']['Tables']['vendor_profiles']['Insert'];
      const upsertPayload: VendorInsert = {
        email: userEmail,
        name: values.fullName,
        business_name: values.businessName,
        service_categories: values.trades,
        about: values.about ?? null,
        // Stripped to digits-only on submit; UI keeps the formatted form.
        phone: phoneDigitsOnly(values.phone),
        state: values.state.trim(),
        city: values.city.trim(),
        zipcode: values.zipcode,
        insured: values.insured,
        radius_miles: values.radius_miles,
      };

      const { data: vendorRow, error: upsertError } = await supabase
        .from('vendor_profiles')
        .upsert(upsertPayload, { onConflict: 'email' })
        .select()
        .single();

      if (upsertError) throw new Error(upsertError.message);
      if (!vendorRow) throw new Error('Vendor upsert returned no row.');

      // Step 1b: mark the profiles row as awaiting approval. Only runs on
      // first FillProfile submit (when `existing` was null) — re-running
      // the form for an already-approved vendor must not knock them back
      // to 'pending'. The profiles row itself is presumed to exist (it's
      // created by Ryan's auth trigger on signup); we UPDATE rather than
      // UPSERT so a missing row surfaces as a 0-row update we can log
      // rather than masking the trigger failure.
      if (!existing && userId) {
        const { data: profileUpdate, error: profileError } = await supabase
          .from('profiles')
          .update({ status: 'pending' })
          .eq('id', userId)
          .select('id');
        if (profileError) {
          console.warn(
            '[FillProfile] profiles.status=pending update failed',
            profileError.message,
          );
        } else if (!profileUpdate || profileUpdate.length === 0) {
          console.warn(
            '[FillProfile] profiles.status=pending matched 0 rows for',
            userId,
            "— auth trigger may not have created the profile row yet",
          );
        }
      }

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
      const pathPatch: Database['public']['Tables']['vendor_profiles']['Update'] = {};
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
          .from('vendor_profiles')
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
      // approval_status='pending' immediately on the (tabs) replace below —
      // otherwise it would re-fetch and, on a slow network, briefly observe
      // a stale null and bounce the vendor back to fill-profile.
      //
      // Phase 5 hotfix: the cache shape includes approval_status (joined
      // from profiles.status). On a true insert we just wrote 'pending'
      // there in Step 1b; on a re-submit we preserve the prior approval
      // value. The follow-up refreshVendorCache() reconciles either way.
      setCachedVendor({
        ...vendorRow,
        approval_status: existing ? null : 'pending',
      });
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
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Personal Info</Text>

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
              name="phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <FieldShell error={errors.phone?.message}>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(text) => onChange(formatPhoneInput(text))}
                    onBlur={onBlur}
                    placeholder="(555) 555-5555"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="phone-pad"
                    // "(555) 555-5555" is 14 chars — caps paste & mask runaway.
                    maxLength={14}
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
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
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Service Area</Text>

            <Controller
              control={control}
              name="state"
              render={({ field: { value, onChange, onBlur } }) => (
                <FieldShell error={errors.state?.message}>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="State"
                    placeholderTextColor={colors.text.tertiary}
                    autoComplete="postal-address-region"
                    textContentType="addressState"
                    autoCapitalize="words"
                  />
                </FieldShell>
              )}
            />

            <Controller
              control={control}
              name="city"
              render={({ field: { value, onChange, onBlur } }) => (
                <FieldShell error={errors.city?.message}>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="City"
                    placeholderTextColor={colors.text.tertiary}
                    autoComplete="postal-address-locality"
                    textContentType="addressCity"
                    autoCapitalize="words"
                  />
                </FieldShell>
              )}
            />

            <Controller
              control={control}
              name="zipcode"
              render={({ field: { value, onChange, onBlur } }) => (
                <FieldShell error={errors.zipcode?.message}>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(text) =>
                      onChange(text.replace(/\D/g, '').slice(0, 5))
                    }
                    onBlur={onBlur}
                    placeholder="ZIP Code"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="number-pad"
                    maxLength={5}
                    autoComplete="postal-code"
                    textContentType="postalCode"
                  />
                </FieldShell>
              )}
            />

            <Controller
              control={control}
              name="radius_miles"
              render={({ field: { value, onChange } }) => (
                <RadiusStepper
                  value={value}
                  onChange={onChange}
                  error={errors.radius_miles?.message}
                />
              )}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Business</Text>

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
              name="insured"
              render={({ field: { value, onChange } }) => (
                <InsuredToggle value={value} onChange={onChange} />
              )}
            />
          </View>

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

// Mirror of the ProfileScreen stepper. Kept inline here (no shared component)
// because the two screens are intentionally divergent — ProfileScreen edits a
// vendors row already keyed by email, FillProfile is the upsert/onboarding
// path. A shared component would couple them in a way we've otherwise avoided.
function RadiusStepper({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (n: number) => void;
  error?: string;
}) {
  const dec = () => onChange(Math.max(5, value - 5));
  const inc = () => onChange(Math.min(100, value + 5));
  return (
    <View>
      <Text style={styles.fieldLabel}>Service area radius</Text>
      <View style={styles.stepper}>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
          onPress={dec}
          disabled={value <= 5}
          accessibilityRole="button"
          accessibilityLabel="Decrease radius"
          accessibilityValue={{ text: `${value} miles` }}
        >
          <Minus size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.stepperValue}>{value} mi</Text>
        <Pressable
          style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
          onPress={inc}
          disabled={value >= 100}
          accessibilityRole="button"
          accessibilityLabel="Increase radius"
          accessibilityValue={{ text: `${value} miles` }}
        >
          <Plus size={20} color={colors.text.primary} />
        </Pressable>
      </View>
      <Text style={styles.helper}>How far you’ll accept jobs (miles)</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function InsuredToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.fieldLabel}>I am insured</Text>
        <Text style={styles.helper}>Required for many job assignments</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.divider.soft, true: colors.brand.primary }}
        thumbColor="#ffffff"
        ios_backgroundColor={colors.divider.soft}
        accessibilityLabel="Insured"
      />
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
  // Three sections (Personal Info / Service Area / Business) sit inside the
  // `fields` container, so the outer gap:lg separates sections and the inner
  // gap:lg keeps field-to-field spacing identical to the pre-section design.
  section: {
    gap: spacing.lg,
  },
  sectionHeader: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
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
  fieldLabel: {
    ...typography.bodySmall,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  helper: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 6,
  },
  stepper: {
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.base,
  },
  stepBtnPressed: {
    opacity: 0.6,
  },
  stepperValue: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.text.primary,
  },
  toggleRow: {
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
});
