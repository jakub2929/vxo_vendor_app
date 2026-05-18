// Shared bottom sheet for picking an attachment source — Document, Camera, or
// Gallery. Visual 1:1 with Figma node 4:10066 (chat) and the onboarding avatar
// picker; they were identical so this is a pure extraction.
//
// Picker invocation is the caller's responsibility — this component is UI only
// and emits `onSelect(source)`. Onboarding writes the result to form state;
// chat appends a vendor message bubble. Keeping the side-effects out keeps
// the component reusable.
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, File as FileIcon, Image as ImageIcon } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { UploadActionChip } from './UploadActionChip';
import { colors } from '@/theme';

export type AttachmentSource = 'document' | 'camera' | 'gallery';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (source: AttachmentSource) => void;
};

// Why the indirection: UIImagePickerController (camera) and
// UIDocumentPickerViewController (document) cannot be presented while this
// sheet's Modal is mid-dismiss. They either silently no-op OR — worse for
// document — leave expo-document-picker's internal "picking in progress"
// lock held, which makes every subsequent getDocumentAsync call reject with
// "Different document picking in progress". So we defer onSelect until the
// sheet has actually finished dismissing.
//
// BottomSheet now fires onDismissed after the Modal has truly unmounted (+
// an iOS-only 100ms grace period for UIKit teardown), uniformly on both
// platforms — no more platform branching here.
export function AttachmentBottomSheet({ visible, onClose, onSelect }: Props) {
  const [pendingSource, setPendingSource] = useState<AttachmentSource | null>(null);

  const handlePress = (source: AttachmentSource) => {
    // Intra-sheet double-tap guard: if a pick is already queued, ignore.
    // Per-callsite (handler) guard against rapid re-opens is separate (see
    // FillProfile / JobChatScreen pickerBusy ref).
    if (pendingSource) return;
    setPendingSource(source);
    onClose();
  };

  // useCallback so the prop reference is stable across renders — keeps
  // BottomSheet's onDismissedRef from churning on every parent render.
  const flush = useCallback(() => {
    if (!pendingSource) return;
    const source = pendingSource;
    // Clear state BEFORE invoking onSelect — if onSelect throws (picker
    // module error, etc), the next handlePress still sees pendingSource as
    // null and can queue a fresh pick.
    setPendingSource(null);
    try {
      onSelect(source);
    } catch (err) {
      console.warn('[AttachmentBottomSheet] onSelect threw:', err);
    }
  }, [pendingSource, onSelect]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={flush}
    >
      <View style={styles.row}>
        <UploadActionChip
          label="Document"
          color={colors.accent.orange}
          Icon={FileIcon}
          onPress={() => handlePress('document')}
        />
        <UploadActionChip
          label="Camera"
          color={colors.accent.teal}
          Icon={Camera}
          onPress={() => handlePress('camera')}
        />
        <UploadActionChip
          label="Gallery"
          color={colors.accent.purple}
          Icon={ImageIcon}
          onPress={() => handlePress('gallery')}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
});
