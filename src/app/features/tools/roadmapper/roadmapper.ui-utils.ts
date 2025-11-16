export function getRemInPx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize);
}

export function getEmInPxFromParent(child: Element): number {
  const parent = child.parentElement!;
  return parseFloat(getComputedStyle(parent).fontSize);
}

export function getEmInPxFromSelf(child: Element): number {
  return parseFloat(getComputedStyle(child).fontSize);
}
