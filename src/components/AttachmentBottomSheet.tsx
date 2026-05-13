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

export function AttachmentBottomSheet({ visible, onClose, onSelect }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.row}>
        <UploadActionChip
          label="Document"
          color={colors.accent.orange}
          Icon={FileIcon}
          onPress={() => onSelect('document')}
        />
        <UploadActionChip
          label="Camera"
          color={colors.accent.teal}
          Icon={Camera}
          onPress={() => onSelect('camera')}
        />
        <UploadActionChip
          label="Gallery"
          color={colors.accent.purple}
          Icon={ImageIcon}
          onPress={() => onSelect('gallery')}
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
