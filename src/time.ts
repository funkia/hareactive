import { Time, State } from "./common";
import { cons } from "./datastructures";
import { Stream } from "./stream";
import { Behavior, fromFunction } from "./behavior";
import { sample, Now, perform } from "./now";

/*
 * Time related behaviors and functions
 */
export class DelayStream<A> extends Stream<A> {
  constructor(parent: Stream<A>, readonly ms: number) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, a: A): void {
    setTimeout(() => {
      this.pushSToChildren(t, a);
    }, this.ms);
  }
}

export function delay<A>(ms: number, stream: Stream<A>): Now<Stream<A>> {
  return perform(() => new DelayStream(stream, ms));
}

class ThrottleStream<A> extends Stream<A> {
  constructor(parent: Stream<A>, readonly ms: number) {
    super();
    this.parents = cons(parent);
  }
  private isSilenced: boolean = false;
  pushS(t: number, a: A): void {
    if (!this.isSilenced) {
      this.pushSToChildren(t, a);
      this.isSilenced = true;
      setTimeout(() => {
        this.isSilenced = false;
      }, this.ms);
    }
  }
}

export function throttle<A>(ms: number, stream: Stream<A>): Now<Stream<A>> {
  return perform(() => new ThrottleStream<A>(stream, ms));
}

class DebounceStream<A> extends Stream<A> {
  constructor(parent: Stream<A>, readonly ms: number) {
    super();
    this.parents = cons(parent);
  }
  private timer: any = undefined;
  pushS(t: number, a: A): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.pushSToChildren(t, a);
    }, this.ms);
  }
}

export function debounce<A>(ms: number, stream: Stream<A>): Now<Stream<A>> {
  return perform(() => new DebounceStream<A>(stream, ms));
}

/**
 * A behavior whose value is the number of milliseconds elapsed in
 * UNIX epoch. I.e. its current value is equal to the value got by
 * calling `Date.now`.
 */
export const time: Behavior<Time> = fromFunction((_) => Date.now());

/**
 * A behavior giving access to continuous time. When sampled the outer
 * behavior gives a behavior with values that contain the difference
 * between the current sample time and the time at which the outer
 * behavior was sampled.
 */
export const measureTimeFrom = time.map((from) => time.map((t) => t - from));

export const measureTime = sample(measureTimeFrom);

class IntegrateBehavior extends Behavior<number> {
  private lastPullTime: Time;
  constructor(private parent: Behavior<number>, t: number) {
    super();
    this.lastPullTime = time.at(t);
    this.state = State.Pull;
    this.last = 0;
    this.pulledAt = t;
    this.changedAt = t;
    this.parents = cons(parent, cons(time));
  }
  update(_t: Time): number {
    const currentPullTime = time.last;
    const deltaMs = currentPullTime - this.lastPullTime;
    const value = this.last + deltaMs * this.parent.last;
    this.lastPullTime = currentPullTime;
    return value;
  }
}

/**
 * Returns a `Now` computation of a behavior of the integral of the given behavior.
 */
export function integrate(behavior: Behavior<number>): Now<Behavior<number>> {
  return sample(integrateFrom(behavior));
}

/**
 * Integrate a behavior with respect to time.
 *
 * The value of the behavior is treated as a rate of change per millisecond.
 */
export function integrateFrom(
  behavior: Behavior<number>
): Behavior<Behavior<number>> {
  return fromFunction((t) => new IntegrateBehavior(behavior, t));
}
