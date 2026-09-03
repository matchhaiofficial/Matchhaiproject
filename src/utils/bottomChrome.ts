export function getSystemBottomInset(bottomInset: number) {
  return bottomInset;
}

export function getBottomChromeClearance({
  bottomInset,
  tabBarHeight = 0,
}: {
  bottomInset: number;
  tabBarHeight?: number;
}) {
  return Math.max(getSystemBottomInset(bottomInset), tabBarHeight);
}
