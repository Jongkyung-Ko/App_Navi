import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type PromptProps = {
  visible: boolean;
  installing?: boolean;
  isIos?: boolean;
  onInstall: () => void;
  onDismiss: () => void;
};

export function PwaInstallPrompt({
  visible,
  installing,
  isIos,
  onInstall,
  onDismiss,
}: PromptProps) {
  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>App Navi</Text>
          <Text style={styles.title}>홈 화면에 바로가기를 추가할까요?</Text>
          <Text style={styles.body}>
            {isIos
              ? '한 번 추가해 두면 앱처럼 빠르게 열 수 있습니다. Safari 공유 → 홈 화면에 추가로 저장됩니다.'
              : '한 번 추가해 두면 앱처럼 빠르게 열 수 있습니다. 매매·전세 시세를 바로 확인하세요.'}
          </Text>
          <Pressable
            style={[styles.primary, installing && styles.disabled]}
            disabled={installing}
            onPress={onInstall}
          >
            <Text style={styles.primaryText}>
              {installing ? '추가하는 중…' : '바로가기 추가'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onDismiss} disabled={installing}>
            <Text style={styles.secondaryText}>나중에</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type ButtonProps = {
  visible?: boolean;
  installing?: boolean;
  installed?: boolean;
  onPress: () => void;
};

export function PwaInstallButton({
  visible = true,
  installing,
  installed,
  onPress,
}: ButtonProps) {
  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <Pressable
      style={[styles.homeBtn, (installing || installed) && styles.disabled]}
      disabled={installing || installed}
      onPress={onPress}
    >
      <Text style={styles.homeBtnText}>
        {installed ? '바로가기 추가됨' : installing ? '추가하는 중…' : '바로가기 추가'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 35, 50, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e4d5c5',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#c45c26',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a2332',
    lineHeight: 28,
  },
  body: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 21,
    color: '#5c6670',
  },
  primary: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondary: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#6b7580',
    fontWeight: '600',
    fontSize: 14,
  },
  homeBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a2332',
    paddingVertical: 13,
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#1a2332',
    fontWeight: '800',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.55,
  },
});
