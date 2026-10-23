export const landingPackages = [
  { name: 'modal', title: 'Modal', en: 'Make room for the next decision.', ko: '다음 선택에 집중할 시간.' },
] as const;

export type LandingPackage = (typeof landingPackages)[number];

export function getLandingPackage(name: string) {
  return landingPackages.find(item => item.name === name);
}
