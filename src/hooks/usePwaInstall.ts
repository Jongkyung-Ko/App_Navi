import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROMPT_SEEN_KEY = 'appnavi.pwa.promptSeen.v2';

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
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  // Real Safari on iOS — not Chrome/Firefox/Edge iOS wrappers.
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  return iOS && webkit && !otherBrowser;
}

function isIosDevice(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Kakao/Naver/Facebook in-app browsers block beforeinstallprompt. */
function isInAppBrowser(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /KAKAOTALK|NAVER\(inapp|FBAN|FBAV|Instagram|Line\//i.test(ua);
}

export type PwaInstallState = {
  ready: boolean;
  isWeb: boolean;
  isInstalled: boolean;
  canPromptNative: boolean;
  isIos: boolean;
  isInAppBrowser: boolean;
  showFirstVisit: boolean;
  installing: boolean;
  waitingForPrompt: boolean;
  message: string | null;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable' | 'ios-guide' | 'pending'>;
  dismissFirstVisit: () => Promise<void>;
  clearMessage: () => void;
};

export function usePwaInstall(): PwaInstallState {
  const [ready, setReady] = useState(!isWeb());
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [waitingForPrompt, setWaitingForPrompt] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [inApp, setInApp] = useState(false);
  const pendingInstall = useRef(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isWeb() || typeof window === 'undefined') return;

    setIsIos(isIosDevice());
    setInApp(isInAppBrowser());
    setIsInstalled(isStandaloneDisplay());

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => reg.update().catch(() => undefined))
        .catch(() => undefined);
    }

    const runNativePrompt = async (event: BeforeInstallPromptEvent) => {
      setInstalling(true);
      try {
        await event.prompt();
        const choice = await event.userChoice;
        deferredRef.current = null;
        setDeferred(null);
        await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
        setShowFirstVisit(false);
        setWaitingForPrompt(false);
        pendingInstall.current = false;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setMessage('홈 화면에 App Navi가 추가되었습니다.');
        } else {
          setMessage('설치가 취소되었습니다. 상단 "설치" 버튼으로 다시 추가할 수 있습니다.');
        }
      } catch {
        setMessage('바로가기 추가에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        pendingInstall.current = false;
        setWaitingForPrompt(false);
      } finally {
        setInstalling(false);
      }
    };

    const onBip = (event: Event) => {
      event.preventDefault();
      const bip = event as BeforeInstallPromptEvent;
      deferredRef.current = bip;
      setDeferred(bip);
      if (pendingInstall.current) {
        void runNativePrompt(bip);
      }
    };
    const onInstalled = () => {
      setIsInstalled(true);
      deferredRef.current = null;
      setDeferred(null);
      setShowFirstVisit(false);
      setWaitingForPrompt(false);
      pendingInstall.current = false;
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
    setWaitingForPrompt(false);
    pendingInstall.current = false;
    await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
  }, []);

  const install = useCallback(async () => {
    if (!isWeb()) return 'unavailable' as const;
    if (isStandaloneDisplay()) {
      setIsInstalled(true);
      setMessage('이미 홈 화면에 추가되어 있습니다.');
      return 'unavailable' as const;
    }

    if (isInAppBrowser()) {
      setMessage(
        '카카오톡·인앱 브라우저에서는 설치할 수 없습니다. 우측 상단 메뉴에서 "Chrome으로 열기"(또는 Safari)로 연 뒤 다시 시도해 주세요.',
      );
      return 'unavailable' as const;
    }

    if (isIosDevice()) {
      if (isIosSafari()) {
        setMessage(
          'Safari 하단(또는 상단) 공유 버튼(□↑) → "홈 화면에 추가"를 선택하세요.',
        );
      } else {
        setMessage(
          'iPhone/iPad에서는 Safari로 이 사이트를 연 다음, 공유 → "홈 화면에 추가"로 설치할 수 있습니다.',
        );
      }
      await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
      setShowFirstVisit(false);
      return 'ios-guide' as const;
    }

    const bip = deferredRef.current ?? deferred;
    if (!bip) {
      // Don't mark as seen — BIP often arrives after SW activates.
      pendingInstall.current = true;
      setWaitingForPrompt(true);
      setMessage('설치를 준비하는 중입니다. 잠시만 기다려 주세요…');
      // Give Chrome a moment; if still nothing, guide to browser menu.
      window.setTimeout(() => {
        if (!pendingInstall.current || deferredRef.current) return;
        setWaitingForPrompt(false);
        pendingInstall.current = false;
        setMessage(
          '브라우저 메뉴(⋮)에서 "앱 설치" 또는 "홈 화면에 추가"를 선택해 주세요. Chrome/Edge에서 가장 잘 됩니다.',
        );
      }, 8000);
      return 'pending' as const;
    }

    setInstalling(true);
    try {
      await bip.prompt();
      const choice = await bip.userChoice;
      deferredRef.current = null;
      setDeferred(null);
      await AsyncStorage.setItem(PROMPT_SEEN_KEY, '1');
      setShowFirstVisit(false);
      setWaitingForPrompt(false);
      pendingInstall.current = false;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setMessage('홈 화면에 App Navi가 추가되었습니다.');
      } else {
        setMessage('설치가 취소되었습니다. 상단 "설치" 버튼으로 다시 추가할 수 있습니다.');
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
    isInAppBrowser: inApp,
    showFirstVisit: showFirstVisit && !isInstalled,
    installing,
    waitingForPrompt,
    message,
    install,
    dismissFirstVisit,
    clearMessage: () => setMessage(null),
  };
}
