// Vendor-facing edit view for the vendors row created during Profile Setup.
// Visual language follows Figma node 4:10190 (frame "13_Light_fill your
// profile filled form"). The Figma frame shows 5 inputs; we additionally
// render COI / W-9 upload fields under the bio because Phase 2 introduced
// vendor-documents storage and the user wants them editable here.
//
// Diff vs FillProfile.tsx (onboarding):
//   - Adds an "edit existing row" prefill from useVendor()
//   - Email is read-only (auth identity)
//   - Save = supabase update().eq('email', vendor.email), no status change
//   - Only uploads files that changed (form has a new Asset, not just an
//     existing path on the row)
//
// Path-vs-uri rendering for the upload fields:
//   - If the user just picked a new file, render asset.fileName / asset.uri
//   - Else if vendor.{coi,w9}_path exists, label as "Uploaded" + offer View
//     (lazy signed URL via vendorStorage)
//   - Else show empty Upload UI
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { router } from 'expo-router';
import { Calendar, Mail, Minus, Plus, Star } from 'lucide-react-native';
import { z } from 'zod';
import {
  AttachmentBottomSheet,
  type AttachmentSource,
} from '@/components/AttachmentBottomSheet';
import { GradientHeader } from '@/components/GradientHeader';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import {
  type Trade,
  TradeServicesPicker,
  tradesToLabel,
} from '@/features/profile/TradeServicesPicker';
import { UploadField } from '@/features/profile/UploadField';
import { useVendorJobsCompleted } from '@/features/profile/useVendorJobsCompleted';
import { useVendor } from '@/hooks/useVendor';
import { supabase } from '@/lib/supabase';
import { setCachedVendor } from '@/lib/vendorCache';
import { showToast } from '@/components/Toast';
import {
  alertCopyFor,
  type FileKind,
  kindLabel,
  shortReasonFor,
  UploadError,
} from '@/lib/uploadError';
import {
  getVendorAvatarUrl,
  getVendorDocumentSignedUrl,
  uploadVendorAvatar,
  uploadVendorDocument,
  validateAsset,
} from '@/lib/vendorStorage';
import { colors, radius, spacing, typography } from '@/theme';
import type { Database } from '@/types/database';
import { formatPhoneInput, phoneDigitsOnly } from '@/utils/formatters';

const TRADES = ['hvac', 'plumbing', 'handyman', 'electrical'] as const;

const assetSchema = z
  .object({
    uri: z.string(),
    mimeType: z.string(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
  })
  .optional();

// Phase 5: vendor_profiles splits the legacy single-line `address` into
// state/city/zipcode and renames zip_code → zipcode. Form names track DB
// columns 1:1 so the submit handler stays a straight passthrough.
const schema = z.object({
  fullName: z.string().min(2, 'Required'),
  businessName: z.string().min(2, 'Required'),
  trades: z.array(z.enum(TRADES)).min(1, 'Select at least one'),
  // Phone is held formatted in form state (mask runs on every keystroke);
  // submit strips back to digits via phoneDigitsOnly. Mirrors FillProfile.
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
type UploadTarget = 'avatar' | 'coi' | 'w9';

function parseTrades(raw: unknown): Trade[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is Trade =>
    (TRADES as readonly string[]).includes(t as string),
  );
}

// vendor_profiles.service_categories is text[] on Ryan's schema. JSON-array
// fallback covers a legacy null/jsonb shape if Supabase typing relaxes back
// to Json in a future regen.

export function ProfileScreen() {
  const { vendor, loading, refresh } = useVendor();
  const { data: jobsCompleted, isLoading: jobsCompletedLoading } =
    useVendorJobsCompleted(vendor?.id);
  const [submitting, setSubmitting] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [tradePickerOpen, setTradePickerOpen] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      businessName: '',
      trades: [],
      phone: '',
      state: '',
      city: '',
      zipcode: '',
      about: '',
      insured: false,
      radius_miles: 25,
      avatar: undefined,
      coi: undefined,
      w9: undefined,
    },
  });

  // Prefill once the vendor row arrives. Asset fields stay undefined — they
  // only populate when the user picks a new file. Existing paths are read
  // from `vendor` directly in the render path below.
  useEffect(() => {
    if (!vendor) return;
    reset({
      fullName: vendor.name ?? '',
      businessName: vendor.business_name ?? '',
      trades: parseTrades(vendor.service_categories),
      // DB stores digits-only; re-run the mask so the input shows
      // "(555) 123-4567" on first render. Empty/null vendors get '' and the
      // refine() error will surface on first save attempt.
      phone: formatPhoneInput(vendor.phone ?? ''),
      state: vendor.state ?? '',
      city: vendor.city ?? '',
      zipcode: vendor.zipcode ?? '',
      about: vendor.about ?? '',
      insured: vendor.insured ?? false,
      radius_miles: vendor.radius_miles ?? 25,
      avatar: undefined,
      coi: undefined,
      w9: undefined,
    });
  }, [vendor, reset]);

  const avatar = watch('avatar');
  const coi = watch('coi');
  const w9 = watch('w9');
  const trades = watch('trades');

  const pickerBusy = useRef(false);
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

  const setForTarget = (target: UploadTarget, asset: Asset) => {
    // shouldDirty: true so the Save button enables on a new asset pick. The
    // default setValue path bypasses dirty tracking, which would leave the
    // CTA greyed out even after the user picked a new file.
    if (target === 'avatar') setValue('avatar', asset, { shouldDirty: true });
    if (target === 'coi') setValue('coi', asset, { shouldDirty: true });
    if (target === 'w9') setValue('w9', asset, { shouldDirty: true });
  };

  // Pre-upload validation, run at pick time so bad files never reach the
  // form state. Mirrors the server-side bucket limits for snappy UX.
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

  const openSheetFor = (target: UploadTarget) => {
    setUploadTarget(target);
    setSheetVisible(true);
  };

  // Strict reject on missing MIME — see FillProfile picker callbacks for the
  // rationale (honest "unsupported type" Alert beats a guessed MIME that
  // surprises later).
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

  const viewDocument = async (kind: 'coi' | 'w9') => {
    const path = kind === 'coi' ? vendor?.coi_path : vendor?.w9_path;
    if (!path) return;
    const url = await getVendorDocumentSignedUrl(path, `${kind}.pdf`);
    if (!url) {
      Alert.alert('Unable to open file', 'Please try again.');
      return;
    }
    void Linking.openURL(url);
  };

  const onSubmit = async (values: FormValues) => {
    if (!vendor || !vendor.email) return;
    setSubmitting(true);
    try {
      // Upload only the assets the user newly picked. Existing paths on the
      // vendor row stay as-is unless overwritten. fileSize is passed for an
      // early size check inside the helper; the helper still re-checks the
      // actual bytes read.
      const uploads = await Promise.allSettled([
        values.avatar
          ? uploadVendorAvatar(
              vendor.id,
              values.avatar.uri,
              values.avatar.mimeType,
              values.avatar.fileSize,
            )
          : Promise.resolve(null),
        values.coi
          ? uploadVendorDocument(
              vendor.id,
              'coi',
              values.coi.uri,
              values.coi.mimeType,
              values.coi.fileSize,
            )
          : Promise.resolve(null),
        values.w9
          ? uploadVendorDocument(
              vendor.id,
              'w9',
              values.w9.uri,
              values.w9.mimeType,
              values.w9.fileSize,
            )
          : Promise.resolve(null),
      ]);
      const [avatarRes, coiRes, w9Res] = uploads;

      const patch: Database['public']['Tables']['vendor_profiles']['Update'] = {
        name: values.fullName,
        business_name: values.businessName,
        service_categories: values.trades,
        // Stripped to digits-only on submit; UI keeps the formatted form.
        phone: phoneDigitsOnly(values.phone),
        state: values.state.trim(),
        city: values.city.trim(),
        zipcode: values.zipcode,
        about: values.about ?? null,
        insured: values.insured,
        radius_miles: values.radius_miles,
      };
      if (avatarRes.status === 'fulfilled' && avatarRes.value) {
        patch.avatar_path = avatarRes.value;
      }
      if (coiRes.status === 'fulfilled' && coiRes.value) {
        patch.coi_path = coiRes.value;
      }
      if (w9Res.status === 'fulfilled' && w9Res.value) {
        patch.w9_path = w9Res.value;
      }

      // Filter by email to match the vendor_profiles RLS USING clause exactly
      // (see supabase/migrations/003_rls_policies.sql). `.single()` surfaces
      // the no-rows case as PGRST116 error, so RLS-silent-filter still fails
      // loud.
      const { data, error } = await supabase
        .from('vendor_profiles')
        .update(patch)
        .eq('email', vendor.email)
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error('Update returned no row. RLS may be filtering this vendor.');
      }

      // Optimistic local cache update with the row we just got back — avoids
      // the full `clearVendorCache + refresh` round-trip that caused the
      // visible "refresh flicker" between save and confirmation.
      //
      // Phase 5 hotfix: the cache type carries approval_status (denormalized
      // from profiles.status). The Profile screen never edits approval, so
      // preserve whatever the cache currently holds.
      setCachedVendor({
        ...data,
        approval_status: vendor.approval_status,
      });

      // Mark the current form values as the new clean baseline so isDirty
      // flips back to false and the Save button greys out. Using the user-
      // facing form values (formatted phone, etc.) keeps the input visually
      // identical to the post-save state.
      reset(values);

      const kinds: FileKind[] = ['avatar', 'coi', 'w9'];
      const failures = uploads
        .map((r, i) => ({ r, kind: kinds[i] }))
        .filter(
          (x): x is { r: PromiseRejectedResult; kind: FileKind } =>
            x.r.status === 'rejected',
        );

      if (failures.length > 0) {
        // Partial-failure path: text fields saved but a file didn't upload.
        // User needs the detail, so keep the blocking Alert here.
        const lines = failures.map((f) => {
          const code =
            f.r.reason instanceof UploadError ? f.r.reason.code : 'UPLOAD_FAILED';
          return `${kindLabel(f.kind)} — ${shortReasonFor(code)}.`;
        });
        Alert.alert(
          'Profile saved',
          `Other changes were saved. Some files didn't upload:\n\n${lines.join('\n')}`,
        );
      } else {
        showToast({
          title: 'Profile updated',
          body: 'Your changes have been saved.',
        });
      }
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !vendor) {
    return (
      <View style={styles.flex}>
        <GradientHeader title="Profile" onBack={() => router.back()} />
        <View style={styles.loadingWrap}>
          <View style={styles.loadingAvatar}>
            <Skeleton width={120} height={120} borderRadius={1000} />
          </View>
          <SkeletonCard height={56} />
          <SkeletonCard height={56} />
          <SkeletonCard height={56} />
          <SkeletonCard height={96} />
        </View>
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>Profile unavailable.</Text>
        <Pressable style={styles.cta} onPress={() => void refresh()}>
          <Text style={styles.ctaLabel}>Reload</Text>
        </Pressable>
      </View>
    );
  }

  const avatarUri =
    avatar?.uri ??
    getVendorAvatarUrl(vendor.avatar_path, vendor.updated_at) ??
    undefined;
  const coiDisplay = coi?.fileName ?? (vendor.coi_path ? 'Uploaded' : undefined);
  const w9Display = w9?.fileName ?? (vendor.w9_path ? 'Uploaded' : undefined);

  return (
    <View style={styles.flex}>
      <GradientHeader title="Profile" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarBlock}>
          <AvatarPicker
            uri={avatarUri}
            onPress={() => openSheetFor('avatar')}
          />
          <RatingRow
            rating={vendor.rating}
            jobsCompleted={jobsCompleted}
            jobsCompletedLoading={jobsCompletedLoading}
          />
        </View>

        <View style={styles.fields}>
          {/* Order mirrors FillProfile: Name, Email, Phone, Address, ZIP,
              Business, Trades, Bio, then documents. Keeps onboarding and
              profile edit visually consistent. */}
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

          {/* Email is the auth identity — changing it requires re-OTP, out of
              scope here. Render as a non-editable styled row. */}
          <View style={styles.readonlyField}>
            <Text
              style={[styles.input, !vendor.email && styles.placeholder]}
              numberOfLines={1}
            >
              {vendor.email ?? 'Email'}
            </Text>
            <Mail size={20} color={colors.text.tertiary} />
          </View>

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
                  maxLength={14}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              </FieldShell>
            )}
          />

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

          <Controller
            control={control}
            name="insured"
            render={({ field: { value, onChange } }) => (
              <InsuredToggle value={value} onChange={onChange} />
            )}
          />

          <UploadField
            label="Upload COI for Larger Jobs :  (Optional)"
            fileName={coiDisplay}
            onPress={() => openSheetFor('coi')}
            onView={vendor.coi_path && !coi ? () => void viewDocument('coi') : undefined}
          />

          <UploadField
            label="Upload W-9 to Verify Account : Optional"
            fileName={w9Display}
            onPress={() => openSheetFor('w9')}
            onView={vendor.w9_path && !w9 ? () => void viewDocument('w9') : undefined}
          />
        </View>

        <Pressable
          style={[
            styles.cta,
            (!isDirty || submitting) && styles.ctaDisabled,
          ]}
          disabled={!isDirty || submitting}
          onPress={handleSubmit(onSubmit)}
        >
          <Text style={styles.ctaLabel}>{submitting ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>

      <AttachmentBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={handleAttachmentSelect}
      />

      <TradeServicesPicker
        visible={tradePickerOpen}
        selected={trades}
        onClose={() => setTradePickerOpen(false)}
        onChange={(next) =>
          setValue('trades', next as Trade[], { shouldDirty: true })
        }
      />
    </View>
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

// Read-only star rating + numeric + job count under the avatar. Star icon
// uses colors.status.warning (#fbbc05) since that's the canonical "amber"
// in the theme — brand.primary blue reads wrong for stars.
function RatingRow({
  rating,
  jobsCompleted,
  jobsCompletedLoading,
}: {
  rating: number | null | undefined;
  jobsCompleted: number | undefined;
  jobsCompletedLoading: boolean;
}) {
  if (rating == null) {
    return <Text style={styles.ratingEmpty}>No ratings yet</Text>;
  }
  const rounded = Math.round(rating);
  // While the count query is in flight, hide the "(N jobs)" suffix entirely
  // — better than showing "(0 jobs)" then snapping to the real number.
  let countSuffix = '';
  if (!jobsCompletedLoading && jobsCompleted !== undefined) {
    countSuffix =
      jobsCompleted === 0 ? ' (no jobs yet)' : ` (${jobsCompleted} jobs)`;
  }
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={16}
          color={i <= rounded ? colors.status.warning : colors.divider.base}
          fill={i <= rounded ? colors.status.warning : 'transparent'}
        />
      ))}
      <Text style={styles.ratingText}>
        {rating.toFixed(1)} / 5.0{countSuffix}
      </Text>
    </View>
  );
}

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
  readonlyField: {
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 0.7,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: spacing.md,
    backgroundColor: colors.surface.base,
  },
  loadingWrap: {
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 16,
  },
  loadingAvatar: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  ratingText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  ratingEmpty: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 8,
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
