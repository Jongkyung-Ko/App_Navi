import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

const KO_LANG = 'ko-KR';

function stopWebSpeech() {
  if (typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis) {
    globalThis.speechSynthesis.cancel();
  }
}

export function stopNarration() {
  Speech.stop();
  stopWebSpeech();
}

export function speakNarration(
  text: string,
  options?: { onDone?: () => void; onError?: (message: string) => void },
): void {
  stopNarration();

  if (Platform.OS === 'web' && typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis) {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = KO_LANG;
      utterance.rate = 0.95;
      utterance.onend = () => options?.onDone?.();
      utterance.onerror = () => options?.onError?.('음성 재생에 실패했습니다.');
      globalThis.speechSynthesis.speak(utterance);
      return;
    } catch {
      // fall through to expo-speech
    }
  }

  Speech.speak(text, {
    language: KO_LANG,
    rate: 0.95,
    onDone: options?.onDone,
    onError: () => options?.onError?.('음성 재생에 실패했습니다.'),
  });
}
