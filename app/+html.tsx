import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML for Expo Router web. Links PWA manifest / icons for installability.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <title>App Navi</title>
        <meta
          name="description"
          content="내 위치 주변 아파트 매매·전세 시세를 한눈에 확인하세요."
        />
        <meta name="theme-color" content="#1a2332" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="App Navi" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
