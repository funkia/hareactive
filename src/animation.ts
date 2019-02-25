import { go } from "@funkia/jabz";
import {
  Behavior,
  stepperFrom,
  time,
  accumFrom,
  Stream,
  snapshot,
  lift
} from ".";

export type TimingFunction = (t: number) => number;

export type TransitionConfig = {
  duration: number;
  timingFunction: TimingFunction;
  delay: number;
};

type Range = {
  from: number;
  to: number;
};

export function transitionBehavior(
  config: TransitionConfig,
  initial: number,
  triggerStream: Stream<number>,
  timeB: Behavior<number> = time
): Behavior<Behavior<number>> {
  return go(function*(): any {
    const rangeValueB: Behavior<Range> = yield accumFrom(
      (newV, prev) => ({ from: prev.to, to: newV }),
      { from: initial, to: initial },
      triggerStream
    );
    const initialStartTime: number = yield timeB;
    const startTimeB: Behavior<number> = yield stepperFrom(
      initialStartTime,
      snapshot(timeB, triggerStream)
    );
    const transition = lift(
      (range, startTime, now) => {
        const endTime = startTime + config.duration;
        const scaled = interpolate(
          startTime,
          endTime,
          0,
          1,
          capToRange(startTime, endTime, now - config.delay)
        );
        return interpolate(
          0,
          1,
          range.from,
          range.to,
          config.timingFunction(scaled)
        );
      },
      rangeValueB,
      startTimeB,
      timeB
    );
    return transition;
  });
}

export function interpolate(
  fromA: number,
  toA: number,
  fromB: number,
  toB: number,
  a: number
): number {
  if (a < fromA || a > toA) {
    throw `The number ${a} is not between the bounds [${fromA}, ${toA}]`;
  }
  const spanA = toA - fromA;
  const spanB = toB - fromB;
  const relationA = (a - fromA) / spanA;
  return relationA * spanB + fromB;
}

export function capToRange(lower: number, upper: number, a: number): number {
  return Math.min(Math.max(lower, a), upper);
}

export const linear = (t) => t;
export const easeIn = (p) => (t) => t ** p;
export const easeOut = (p) => (t) => 1 - (1 - t) ** p;
export const easeInOut = (p) => (t) =>
  t < 0.5 ? easeIn(p)(t * 2) / 2 : easeOut(p)(t * 2 - 1) / 2 + 0.5;
