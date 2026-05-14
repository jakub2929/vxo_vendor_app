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
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Calendar, Mail } from 'lucide-react-native';
import { z } from 'zod';
import {
  AttachmentBottomSheet,
  type AttachmentSource,
} from '@/components/AttachmentBottomSheet';
import { GradientHeader } from '@/components/GradientHeader';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import {
  type Trade,
  TradeServicesPicker,
  tradesToLabel,
} from '@/features/profile/TradeServicesPicker';
import { UploadField } from '@/features/profile/UploadField';
import { useVendor } from '@/hooks/useVendor';
import { supabase } from '@/lib/supabase';
import { clearVendorCache } from '@/lib/vendorCache';
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

const TRADES = ['hvac', 'plumbing', 'handyman', 'electrical'] as const;

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
  trades: z.array(z.enum(TRADES)).min(1, 'Select at least one'),
  about: z.string().optional(),
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

export function ProfileScreen() {
  const { vendor, loading, refresh } = useVendor();
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      businessName: '',
      trades: [],
      about: '',
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
      businessName: vendor.business ?? '',
      trades: parseTrades(vendor.trades),
      about: vendor.bio ?? '',
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
    if (target === 'avatar') setValue('avatar', asset);
    if (target === 'coi') setValue('coi', asset);
    if (target === 'w9') setValue('w9', asset);
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

      const patch: Database['public']['Tables']['vendors']['Update'] = {
        name: values.fullName,
        business: values.businessName,
        trades: values.trades,
        bio: values.about ?? null,
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

      // Filter by email to match the vendors RLS USING clause exactly (see
      // supabase/migrations/003_rls_policies.sql). .select() exposes the row
      // count so we fail loudly if RLS silently filters the update.
      const { data, error } = await supabase
        .from('vendors')
        .update(patch)
        .eq('email', vendor.email)
        .select();

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error('Update returned no rows. RLS may be filtering this vendor.');
      }

      clearVendorCache();
      await refresh();

      const kinds: FileKind[] = ['avatar', 'coi', 'w9'];
      const failures = uploads
        .map((r, i) => ({ r, kind: kinds[i] }))
        .filter(
          (x): x is { r: PromiseRejectedResult; kind: FileKind } =>
            x.r.status === 'rejected',
        );

      if (failures.length > 0) {
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
        Alert.alert('Profile updated');
      }
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !vendor) {
    return (
      <View style={styles.centered}>
        <Text style={typography.body}>Loading…</Text>
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

  const avatarUri = avatar?.uri ?? getVendorAvatarUrl(vendor.avatar_path) ?? undefined;
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
          style={[styles.cta, submitting && styles.ctaDisabled]}
          disabled={submitting}
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
        onChange={(next) => setValue('trades', next as Trade[])}
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
});
