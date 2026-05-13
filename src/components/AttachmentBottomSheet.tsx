// Shared bottom sheet for picking an attachment source — Document, Camera, or
// Gallery. Visual 1:1 with Figma node 4:10066 (chat) and the onboarding avatar
// picker; they were identical so this is a pure extraction.
//
// Picker invocation is the caller's responsibility — this component is UI only
// and emits `onSelect(source)`. Onboarding writes the result to form state;
// chat appends a vendor message bubble. Keeping the side-effects out keeps
// the component reusable.
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

// Close-then-call ordering matters: UIImagePickerController (camera) and
// UIDocumentPickerViewController (document) cannot be presented while this
// sheet's Modal is mid-dismiss — they silently fail. PHPickerViewController
// (gallery) is out-of-process so it survives, which is why gallery worked
// while camera/document did not. Defer onSelect past the slide animation so
// the host view controller is settled before the picker tries to present.
const DISMISS_ANIMATION_MS = 300;

export function AttachmentBottomSheet({ visible, onClose, onSelect }: Props) {
  const handlePress = (source: AttachmentSource) => {
    onClose();
    setTimeout(() => onSelect(source), DISMISS_ANIMATION_MS);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
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
