import { Time, State } from "./common";
import { cons } from "./datastructures";
import { Stream, SemanticStream } from "./stream";
import { Behavior, fromFunction } from "./behavior";

/*
 * Time related behaviors and functions
 */
export class DelayStream<A> extends Stream<A> {
  constructor(parent: Stream<A>, private ms: number) {
    super();
    this.parents = cons(parent);
  }
  semantic(): SemanticStream<A> {
    const s = (<Stream<A>>this.parents.value).semantic();
    return s.map(({ time, value }) => ({ time: time + this.ms, value }));
  }
  pushS(t: number, a: A): void {
    setTimeout(() => {
      this.pushSToChildren(t, a);
    }, this.ms);
  }
}

export function delay<A>(ms: number, stream: Stream<A>): Stream<A> {
  return new DelayStream(stream, ms);
}

class ThrottleStream<A> extends Stream<A> {
  constructor(parent: Stream<A>, private ms: number) {
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

export function throttle<A>(ms: number, stream: Stream<A>): Stream<A> {
  return new ThrottleStream<A>(stream, ms);
}

class DebounceStream<A> extends Stream<A> {
  constructor(parent: Stream<A>, private ms: number) {
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

export function debounce<A>(ms: number, stream: Stream<A>): Stream<A> {
  return new DebounceStream<A>(stream, ms);
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
export const timeFrom = time.map((from) => time.map((t) => t - from));

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
    const deltaSeconds = (currentPullTime - this.lastPullTime) / 1000;
    const value = this.last + deltaSeconds * this.parent.last;
    this.lastPullTime = currentPullTime;
    return value;
  }
}

export function integrate(
  behavior: Behavior<number>
): Behavior<Behavior<number>> {
  return fromFunction((t) => new IntegrateBehavior(behavior, t));
}
