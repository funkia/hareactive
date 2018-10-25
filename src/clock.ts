let time = -1;

export function tick(): number {
  return ++time;
}

export function getTime(): number {
  return time;
}
