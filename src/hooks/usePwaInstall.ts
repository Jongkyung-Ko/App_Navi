import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROMPT_SEEN_KEY = 'appnavi.pwa.promptSeen.v1';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isWeb(): boolean {
  return Platform.OS === 'web';
}

function isStandaloneDisplay(): boolean {
  if (!isWeb() || typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return Boolean(mq || iosStandalone);
}

function isIosSafari(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chromeOrCriOS = /CriOS|FxiOS|EdgiOS|Chrome|Android/.test(ua);
  return iOS && webkit && !chromeOrCriOS;
}

export type PwaInstallState = {
  ready: boolean;
  isWeb: boolean;
  isInstalled: boolean;
  canPromptNative: boolean;
  isIos: boolean;
  showFirstVisit: boolean;
  installing: boolean;
  message: string | null;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable' | 'ios-guide'>;
  dismissFirstVisit: () => Promise<void>;
  clearMessage: () => void;
};

export function usePwaInstall(): PwaInstallState {
  const [ready, setReady] = useState(!isWeb());
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (!isWeb() || typeof window === 'undefined') return;

    setIsIos(isIosSafari());
    setIsInstalled(isStandaloneDisplay());

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
      setShowFirstVisit(false);
      setMessage('홈 화면에 App Navi가 추가되었습니다.');
    };

    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);

    void (async () => {
      try {
        const seen = await AsyncStorage.getItem(PROMPT_SEEN_KEY);
        const installed = isStandaloneDisplay();
        if (!installed && !seen) {
          setShowFirstVisit(true);
        }
      } finally {
        setReady(true);
      }
    })();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismissFirstVisit = useCallback(async () => {
    setShowFirstVisit(false);
    await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
  }, []);

  const install = useCallback(async () => {
    if (!isWeb()) return 'unavailable' as const;
    if (isStandaloneDisplay()) {
      setIsInstalled(true);
      setMessage('이미 홈 화면에 추가되어 있습니다.');
      return 'unavailable' as const;
    }

    if (isIosSafari()) {
      setMessage(
        'Safari에서 공유 버튼(□↑) → "홈 화면에 추가"를 선택하면 바로가기가 저장됩니다.',
      );
      await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
      setShowFirstVisit(false);
      return 'ios-guide' as const;
    }

    if (!deferred) {
      setMessage(
        '이 브라우저에서는 자동 설치를 지원하지 않습니다. 메뉴의 "앱 설치" 또는 "홈 화면에 추가"를 이용해 주세요.',
      );
      await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
      setShowFirstVisit(false);
      return 'unavailable' as const;
    }

    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
      setShowFirstVisit(false);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setMessage('홈 화면에 App Navi가 추가되었습니다.');
      } else {
        setMessage('설치가 취소되었습니다. 언제든 "바로가기 추가"로 다시 저장할 수 있습니다.');
      }
      return choice.outcome;
    } catch {
      setMessage('바로가기 추가에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      return 'unavailable' as const;
    } finally {
      setInstalling(false);
    }
  }, [deferred]);

  return {
    ready,
    isWeb: isWeb(),
    isInstalled,
    canPromptNative: Boolean(deferred),
    isIos,
    showFirstVisit: showFirstVisit && !isInstalled,
    installing,
    message,
    install,
    dismissFirstVisit,
    clearMessage: () => setMessage(null),
  };
}
