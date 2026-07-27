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
  compact?: boolean;
  onPress: () => void;
};

export function PwaInstallButton({
  visible = true,
  installing,
  installed,
  compact = false,
  onPress,
}: ButtonProps) {
  if (Platform.OS !== 'web' || !visible) return null;

  const label = installed ? '추가됨' : installing ? '추가 중' : '바로가기';

  return (
    <Pressable
      accessibilityLabel={installed ? '바로가기 추가됨' : '바로가기 추가'}
      style={[
        compact ? styles.compactBtn : styles.homeBtn,
        installed && styles.installedBtn,
        installing && styles.disabled,
      ]}
      disabled={installing || installed}
      onPress={onPress}
    >
      <Text
        style={[
          compact ? styles.compactBtnText : styles.homeBtnText,
          installed && styles.installedBtnText,
        ]}
      >
        {label}
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
  compactBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1a2332',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compactBtnText: {
    color: '#1a2332',
    fontWeight: '700',
    fontSize: 11,
  },
  installedBtn: {
    borderColor: '#9aa3ad',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  installedBtnText: {
    color: '#6b7580',
  },
  disabled: {
    opacity: 0.55,
  },
});
