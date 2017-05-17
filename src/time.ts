import { Time, State } from "./common";
import { cons } from "./linkedlist";
import { Stream, SemanticStream } from "./stream";
import { Behavior, SemanticBehavior, FunctionBehavior, fromFunction } from "./behavior";

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
  push(a: A): void {
    setTimeout(() => this.child.push(a), this.ms);
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
  push(a: A): void {
    if (!this.isSilenced) {
      this.child.push(a);
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
  private timer: number = undefined;
  push(a: A): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.child.push(a);
    }, this.ms);
  }
}

export function debounce<A>(ms: number, stream: Stream<A>): Stream<A> {
  return new DebounceStream<A>(stream, ms);
}

class TimeFromBehavior extends Behavior<Time> {
  private startTime: Time;
  constructor() {
    super();
    this.startTime = Date.now();
    this.state = State.Pull;
  }
  pull(): Time {
    return Date.now() - this.startTime;
  }
}

class TimeBehavior extends FunctionBehavior<Time> {
  constructor() {
    super(Date.now);
  }
  semantic(): SemanticBehavior<Time> {
    return (time: Time) => time;
  }
}

/**
 * A behavior whose value is the number of milliseconds elapsed in
 * UNIX epoch. I.e. its current value is equal to the value got by
 * calling `Date.now`.
 */
export const time: Behavior<Time> = new TimeBehavior();

/**
 * A behavior giving access to continuous time. When sampled the outer
 * behavior gives a behavior with values that contain the difference
 * between the current sample time and the time at which the outer
 * behavior was sampled.
 */
export const timeFrom: Behavior<Behavior<Time>>
  = fromFunction(() => new TimeFromBehavior());

class IntegrateBehavior extends Behavior<number> {
  private lastPullTime: Time;
  private value: number;
  constructor(private parent: Behavior<number>) {
    super();
    this.lastPullTime = Date.now();
    this.state = State.Pull;
    this.value = 0;
  }
  pull(): Time {
    const currentPullTime = Date.now();
    const deltaSeconds = (currentPullTime - this.lastPullTime) / 1000;
    this.value += deltaSeconds * this.parent.at();
    this.lastPullTime = currentPullTime;
    return this.value;
  }
}

export function integrate(behavior: Behavior<number>): Behavior<Behavior<number>> {
  return fromFunction(() => new IntegrateBehavior(behavior));
}
