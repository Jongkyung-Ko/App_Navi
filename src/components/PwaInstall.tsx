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
  waitingForPrompt?: boolean;
  canPromptNative?: boolean;
  isIos?: boolean;
  isInAppBrowser?: boolean;
  onInstall: () => void;
  onDismiss: () => void;
};

export function PwaInstallPrompt({
  visible,
  installing,
  waitingForPrompt,
  canPromptNative,
  isIos,
  isInAppBrowser,
  onInstall,
  onDismiss,
}: PromptProps) {
  if (Platform.OS !== 'web') return null;

  const busy = Boolean(installing || waitingForPrompt);
  let body =
    '한 번 추가해 두면 앱처럼 빠르게 열 수 있습니다. 매매·전세 시세를 바로 확인하세요.';
  if (isInAppBrowser) {
    body =
      '지금 보시는 인앱 브라우저에서는 설치가 막혀 있습니다. Chrome/Safari로 연 다음 다시 추가해 주세요.';
  } else if (isIos) {
    body =
      'Safari 공유 버튼(□↑) → "홈 화면에 추가"를 누르면 저장됩니다. (Chrome 앱에서는 Safari로 열어 주세요.)';
  } else if (!canPromptNative && !busy) {
    body =
      '버튼을 누르면 설치 창이 뜹니다. 안 뜨면 브라우저 메뉴(⋮)의 "앱 설치"를 이용해 주세요.';
  }

  const primaryLabel = isInAppBrowser
    ? '설치 방법 보기'
    : isIos
      ? '설치 방법 보기'
      : busy
        ? waitingForPrompt
          ? '준비 중…'
          : '추가하는 중…'
        : '홈 화면에 추가';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>App Navi</Text>
          <Text style={styles.title}>홈 화면에 앱을 추가할까요?</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            disabled={busy}
            onPress={onInstall}
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onDismiss} disabled={busy}>
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
  waitingForPrompt?: boolean;
  installed?: boolean;
  compact?: boolean;
  onPress: () => void;
};

export function PwaInstallButton({
  visible = true,
  installing,
  waitingForPrompt,
  installed,
  compact = false,
  onPress,
}: ButtonProps) {
  if (Platform.OS !== 'web' || !visible) return null;

  const busy = Boolean(installing || waitingForPrompt);
  const label = installed ? '설치됨' : busy ? '…' : '설치';
  const fullLabel = installed ? '설치됨' : busy ? '설치 준비 중' : '앱 설치';

  return (
    <Pressable
      accessibilityLabel={installed ? '홈 화면 추가됨' : '앱 설치'}
      style={[
        compact ? styles.compactBtn : styles.homeBtn,
        installed && styles.installedBtn,
        busy && styles.disabled,
      ]}
      disabled={busy || installed}
      onPress={onPress}
    >
      <Text
        style={[
          compact ? styles.compactBtnText : styles.homeBtnText,
          installed && styles.installedBtnText,
        ]}
      >
        {compact ? label : fullLabel}
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
    backgroundColor: '#1a2332',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1a2332',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compactBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  installedBtn: {
    borderColor: '#9aa3ad',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  installedBtnText: {
    color: '#6b7580',
  },
  disabled: {
    opacity: 0.55,
  },
});
