import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Korean is the primary/default market; English and Japanese are also offered.
  locales: ['ko-KR', 'en-US', 'ja-JP'],
  defaultLocale: 'ko-KR',
});
