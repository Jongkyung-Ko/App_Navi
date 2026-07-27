import { Alert, Platform } from 'react-native';

export function confirmMapInvestigate(): Promise<boolean> {
  const title = '이 위치로 시세 조사';
  const message =
    '이곳이 속한 시군구(도시: 구, 지방: 시·군) 범위로 아파트 매매가를 다시 조사할까요?';

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: '아니오', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Yes', onPress: () => resolve(true) },
    ]);
  });
}
