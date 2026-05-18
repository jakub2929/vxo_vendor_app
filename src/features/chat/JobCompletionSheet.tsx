// Job-completion bottom sheet — Phase 2 deliverable.
//
// Opens from the "Complete Job" action card in the on_site action stack.
// Lets the vendor stage 1–5 photos (camera / gallery / files), uploads each
// independently to Storage as it's picked, and on Mark Complete hands the
// final path array up to JobChatScreen which calls the complete_job RPC.
//
// Picker UX divergence from FillProfile: this sheet hosts inline Camera /
// Gallery / Files buttons rather than re-using AttachmentBottomSheet. Two
// reasons: (1) stacking a second Modal inside this Modal is RN-quirky and we
// want the picker to dismiss the picker, not this whole sheet; (2) the
// vendor-doc flow picks one file and you're done — this flow loops, so a
// persistent action bar is the right affordance.
//
// Cell lifecycle:
//   uploading → uploaded     (happy path)
//   uploading → error        (validation reject, network drop, etc.)
//   error      → uploading   (retry button re-fires the same source asset)
//   (any)      → removed     (X button — also deletes from Storage if uploaded)
//
// Mark Complete is gated by "exactly 1–5 photos AND all uploaded". An
// in-flight or errored cell blocks submission; the user must either retry or
// remove it.
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  File as FileIcon,
  Image as ImageIcon,
  RotateCcw,
  X,
} from 'lucide-react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { deleteJobPhoto, uploadJobPhoto } from '@/lib/jobPhotos';
import { alertCopyFor, UploadError } from '@/lib/uploadError';
import { colors, typography } from '@/theme';

const MAX_PHOTOS = 5;

// Picker sources used by the inline action bar. Mirrors AttachmentBottomSheet's
// shape so a future refactor that reuses that component is a near-no-op.
type PickerSource = 'camera' | 'gallery' | 'document';

type PickedAsset = {
  uri: string;
  mimeType: string;
  fileSize?: number;
};

type CellState =
  | { kind: 'uploading' }
  | { kind: 'uploaded'; path: string }
  | { kind: 'error'; message: string };

type PhotoCell = {
  id: string;
  asset: PickedAsset;
  state: CellState;
};

type Props = {
  visible: boolean;
  jobId: string;
  onClose: () => void;
  // Called when the vendor taps Mark Complete with all photos uploaded.
  // Parent owns the RPC (or mock) call and decides whether to close us.
  // Return `{ ok: true }` to dismiss the sheet; `{ ok: false }` to keep it
  // open (sheet shows nothing extra — parent surfaces the failure via toast
  // or Alert).
  onSubmit: (paths: string[]) => Promise<{ ok: boolean }>;
  // Skip real Storage uploads — drop in fake paths and resolve immediately.
  // Mirrors USE_MOCKS from useHomeData so the demo build keeps working.
  useMocks: boolean;
};

function generateCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fakeMockPath(jobId: string): string {
  return `${jobId}/mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
}

export function JobCompletionSheet({
  visible,
  jobId,
  onClose,
  onSubmit,
  useMocks,
}: Props) {
  const [cells, setCells] = useState<PhotoCell[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Re-entrancy guard: ImagePicker / DocumentPicker dislike concurrent
  // invocations. Same pattern as JobChatScreen's pickerBusy ref.
  const [pickerBusy, setPickerBusy] = useState(false);

  // Measured cell width — percentage widths + flexbox `gap` are unreliable in
  // RN (the gap is computed before the width pct, so 3 * 33.33% + gap
  // overflows). BottomSheet has paddingHorizontal: 24, so the content area is
  // window width minus 48. Divide the remainder evenly across CELL_COLUMNS
  // tiles + (CELL_COLUMNS - 1) gaps.
  const windowWidth = useWindowDimensions().width;
  const cellWidth = useMemo(() => {
    const usable = windowWidth - 48;
    return Math.floor((usable - CELL_GAP * (CELL_COLUMNS - 1)) / CELL_COLUMNS);
  }, [windowWidth]);

  const photoCount = cells.length;
  const allUploaded = cells.every((c) => c.state.kind === 'uploaded');
  const canSubmit =
    !submitting && photoCount >= 1 && photoCount <= MAX_PHOTOS && allUploaded;
  const canAddMore = photoCount < MAX_PHOTOS && !submitting;

  const updateCell = useCallback(
    (id: string, state: CellState) => {
      setCells((prev) =>
        prev.map((c) => (c.id === id ? { ...c, state } : c)),
      );
    },
    [],
  );

  const runUpload = useCallback(
    async (cellId: string, asset: PickedAsset) => {
      if (useMocks) {
        // Demo path: skip Storage entirely, return a fake path after a beat
        // so the UI exercises the uploading → uploaded transition.
        setTimeout(() => {
          updateCell(cellId, { kind: 'uploaded', path: fakeMockPath(jobId) });
        }, 350);
        return;
      }
      try {
        const { path } = await uploadJobPhoto(
          jobId,
          asset.uri,
          asset.mimeType,
          asset.fileSize,
        );
        updateCell(cellId, { kind: 'uploaded', path });
      } catch (err) {
        const code = err instanceof UploadError ? err.code : 'UPLOAD_FAILED';
        const detail = err instanceof UploadError ? err.detail : undefined;
        const [, message] = alertCopyFor(code, 'job-photo', detail);
        updateCell(cellId, { kind: 'error', message });
      }
    },
    [jobId, useMocks, updateCell],
  );

  const addAsset = useCallback(
    (asset: PickedAsset) => {
      const id = generateCellId();
      setCells((prev) => [
        ...prev,
        { id, asset, state: { kind: 'uploading' } },
      ]);
      void runUpload(id, asset);
    },
    [runUpload],
  );

  const handlePick = useCallback(
    async (source: PickerSource) => {
      if (pickerBusy || !canAddMore) return;
      setPickerBusy(true);
      try {
        if (source === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Camera permission needed',
              'Enable camera access in Settings to take a photo.',
            );
            return;
          }
          const res = await ImagePicker.launchCameraAsync({ quality: 1 });
          if (res.canceled || !res.assets[0]) return;
          const a = res.assets[0];
          addAsset({
            uri: a.uri,
            mimeType: a.mimeType ?? 'image/jpeg',
            fileSize: a.fileSize,
          });
          return;
        }

        if (source === 'gallery') {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Photo library permission needed',
              'Enable photos access in Settings to pick an image.',
            );
            return;
          }
          // quality:1 — we re-encode inside uploadJobPhoto, no point burning
          // quality twice. Picker's own resize is lossy.
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
          if (res.canceled || !res.assets[0]) return;
          const a = res.assets[0];
          addAsset({
            uri: a.uri,
            mimeType: a.mimeType ?? 'image/jpeg',
            fileSize: a.fileSize,
          });
          return;
        }

        // document
        const res = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          type: ['image/jpeg', 'image/png', 'image/webp'],
        });
        if (res.canceled || !res.assets[0]) return;
        const a = res.assets[0];
        addAsset({
          uri: a.uri,
          mimeType: a.mimeType ?? 'image/jpeg',
          fileSize: a.size,
        });
      } catch (err) {
        console.error('[JobCompletionSheet] picker error', err);
        Alert.alert(
          "Couldn't open the picker",
          'Please try again in a moment.',
        );
      } finally {
        setPickerBusy(false);
      }
    },
    [pickerBusy, canAddMore, addAsset],
  );

  const handleRetry = useCallback(
    (cellId: string) => {
      const cell = cells.find((c) => c.id === cellId);
      if (!cell) return;
      updateCell(cellId, { kind: 'uploading' });
      void runUpload(cellId, cell.asset);
    },
    [cells, runUpload, updateCell],
  );

  const handleRemove = useCallback((cellId: string) => {
    setCells((prev) => {
      const target = prev.find((c) => c.id === cellId);
      if (target?.state.kind === 'uploaded') {
        // Best-effort Storage cleanup. Failure is silent — the orphan can be
        // swept later via the DELETE policy.
        void deleteJobPhoto(target.state.path);
      }
      return prev.filter((c) => c.id !== cellId);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const paths: string[] = [];
    for (const c of cells) {
      if (c.state.kind === 'uploaded') paths.push(c.state.path);
    }
    setSubmitting(true);
    try {
      const result = await onSubmit(paths);
      if (result.ok) {
        setCells([]);
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, cells, onSubmit]);

  const grid = useMemo(() => {
    const tiles: Array<PhotoCell | 'add'> = [...cells];
    if (canAddMore) tiles.push('add');
    return tiles;
  }, [cells, canAddMore]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Complete job</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.headerCloseBtn}
        >
          <X size={24} color={colors.text.secondary} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Add up to {MAX_PHOTOS} photos of completed work. {photoCount}/{MAX_PHOTOS}
      </Text>

      <ScrollView
        contentContainerStyle={styles.gridScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {grid.map((tile) => {
            if (tile === 'add') {
              return (
                <View
                  key="add"
                  style={[styles.cellWrap, { width: cellWidth, height: cellWidth }]}
                >
                  <Pressable
                    onPress={() => handlePick('gallery')}
                    onLongPress={() => handlePick('camera')}
                    style={({ pressed }) => [
                      styles.cell,
                      styles.cellAdd,
                      pressed && styles.cellPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Add photo from gallery (long press for camera)"
                  >
                    <ImageIcon size={28} color={colors.text.tertiary} />
                    <Text style={styles.addCellLabel}>Add</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <PhotoTile
                key={tile.id}
                cell={tile}
                size={cellWidth}
                onRemove={() => handleRemove(tile.id)}
                onRetry={() => handleRetry(tile.id)}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.pickerRow}>
        <PickerButton
          label="Camera"
          Icon={Camera}
          color={colors.accent.teal}
          disabled={!canAddMore || pickerBusy}
          onPress={() => handlePick('camera')}
        />
        <PickerButton
          label="Gallery"
          Icon={ImageIcon}
          color={colors.accent.purple}
          disabled={!canAddMore || pickerBusy}
          onPress={() => handlePick('gallery')}
        />
        <PickerButton
          label="Files"
          Icon={FileIcon}
          color={colors.accent.orange}
          disabled={!canAddMore || pickerBusy}
          onPress={() => handlePick('document')}
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitBtn,
          !canSubmit && styles.submitBtnDisabled,
          pressed && canSubmit && styles.submitBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Mark job complete"
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>Mark Complete</Text>
        )}
      </Pressable>
    </BottomSheet>
  );
}

function PhotoTile({
  cell,
  size,
  onRemove,
  onRetry,
}: {
  cell: PhotoCell;
  size: number;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const isError = cell.state.kind === 'error';
  const isUploading = cell.state.kind === 'uploading';

  return (
    <View style={[styles.cellWrap, { width: size, height: size }]}>
      <View style={styles.cell}>
        <Image
          source={{ uri: cell.asset.uri }}
          style={styles.cellImage}
          resizeMode="cover"
        />
        {isUploading ? (
          <View style={styles.cellOverlay}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : null}
        {isError ? (
          <Pressable
            onPress={onRetry}
            style={styles.cellOverlay}
            accessibilityRole="button"
            accessibilityLabel="Retry upload"
          >
            <RotateCcw size={24} color="#FFFFFF" />
            <Text style={styles.cellOverlayText} numberOfLines={2}>
              Tap to retry
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={styles.cellRemoveBtn}
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
        >
          <X size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function PickerButton({
  label,
  Icon,
  color,
  disabled,
  onPress,
}: {
  label: string;
  Icon: typeof Camera;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pickerBtn,
        disabled && styles.pickerBtnDisabled,
        pressed && !disabled && styles.pickerBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.pickerBtnCircle, { backgroundColor: color }]}>
        <Icon size={22} color="#FFFFFF" />
      </View>
      <Text style={styles.pickerBtnLabel}>{label}</Text>
    </Pressable>
  );
}

const CELL_GAP = 12;
const CELL_COLUMNS = 3;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerCloseBtn: {
    padding: 4,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  gridScrollContent: {
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cellWrap: {
    // Width + height set inline per-cell from a useMemo'd cellWidth (the RN
    // `gap` + percentage-width combo is unreliable). Square by construction.
  },
  cell: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.surface.muted,
    overflow: 'hidden',
    position: 'relative',
  },
  cellPressed: { opacity: 0.85 },
  cellAdd: {
    borderWidth: 1.5,
    borderColor: colors.divider.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addCellLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  cellOverlayText: {
    ...typography.caption,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cellRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  pickerBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  pickerBtnDisabled: { opacity: 0.4 },
  pickerBtnPressed: { opacity: 0.85 },
  pickerBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 100,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.divider.base,
  },
  submitBtnPressed: { opacity: 0.9 },
  submitBtnText: {
    ...typography.bodyBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
});
