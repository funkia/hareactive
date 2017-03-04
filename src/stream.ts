/** @module hareactive/stream */

import {Consumer, Reactive, Observer} from "./frp-common";

import {Behavior, at, scan, fromFunction} from "./behavior";

/**
 * A stream is a list of occurences over time. Each occurence happens
 * at a discrete point in time and has an associated value.
 * Semantically it is a list `type Stream<A> = [Time, A]`.
 */
export abstract class Stream<A> extends Reactive<A> {
  constructor() {
    super();
  }

  abstract push(a: any): void;

  map<B>(fn: (a: A) => B): Stream<B> {
    const s = new MapStream(fn);
    this.addListener(s);
    return s;
  }
  mapTo<B>(val: B): Stream<B> {
    const s = new MapToStream(val);
    this.addListener(s);
    return s;
  }
  combine<B>(otherStream: Stream<B>): Stream<(A|B)> {
    const s = new SinkStream<(A|B)>();
    this.addListener(s);
    otherStream.addListener(s);
    return s;
  }
  filter(fn: (a: A) => boolean): Stream<A> {
    const s = new FilterStream<A>(fn);
    this.addListener(s);
    return s;
  }
  scanS<B>(fn: (a: A, b: B) => B, startingValue: B): Behavior<Stream<B>> {
    return fromFunction(() => new ScanStream(fn, startingValue, this));
  }
  scan<B>(fn: (a: A, b: B) => B, init: B): Behavior<Behavior<B>> {
    return scan(fn, init, this);
  }
  delay(ms: number): Stream<A> {
    const s = new DelayStream<A>(ms);
    this.addListener(s);
    return s;
  }
  throttle(ms: number): Stream<A> {
    const s = new ThrottleStream<A>(ms);
    this.addListener(s);
    return s;
  }
}

/** @private */
export class SinkStream<A> extends Stream<A> {
  push(a: A): void {
    this.child.push(a);
  }
}

class MapStream<A, B> extends Stream<B> {
  constructor(private fn: (a: A) => B) {
    super();
  }
  push(a: A): void {
    this.child.push(this.fn(a));
  }
}

class MapToStream<A> extends Stream<A> {
  constructor(private val: A) { super(); }
  push(a: any): void {
    this.child.push(this.val);
  }
}

class FilterStream<A> extends Stream<A> {
  constructor(private fn: (a: A) => boolean) {
    super();
  }
  push(a: A): void {
    if (this.fn(a) === true) {
      this.child.push(a);
    }
  }
}

class DelayStream<A> extends Stream<A> {
  constructor(private ms: number) {
    super();
  }
  push(a: A): void {
    setTimeout(() => this.child.push(a), this.ms);
  }
}

class ThrottleStream<A> extends Stream<A> {
  constructor(private ms: number) {
    super();
  }
  private isSilenced: boolean = false;
  push(a: A): void {
    if (!this.isSilenced) {
      this.child.push(a);
      this.isSilenced = true;
      setTimeout(() => {
	this.isSilenced = false;
      }, this.ms)
    }
  }
}

export function throttle<A>(ms: number, stream: Stream<A>) {
  return stream.throttle(ms);
}

export function delay<A>(ms: number, stream: Stream<A>) {
  return stream.delay(ms);
}

export function apply<A, B>(behavior: Behavior<(a: A) => B>, stream: Stream<A>): Stream<B> {
  return stream.map((a: A) => at(behavior)(a));
}

/**
 * @param fn A predicate function that returns a boolean for `A`.
 * @param stream The stream to filter.
 * @returns Stream that only contains the occurences from `stream`
 * for which `fn` returns true.
 */
export function filter<A>(predicate: (a: A) => boolean, s: Stream<A>): Stream<A> {
  return s.filter(predicate);
}

export function split<A>(predicate: (a: A) => boolean, stream: Stream<A>): [Stream<A>, Stream<A>] {
  // It should be possible to implement this in a faster way where
  // `predicate` is only called once for each occurrence
  return [stream.filter(predicate), stream.filter((a) => !predicate(a))];
}

export function filterApply<A>(predicate: Behavior<(a: A) => boolean>, stream: Stream<A>): Stream<A> {
  return stream.filter((a: A) => at(predicate)(a));
}

export function keepWhen<A>(stream: Stream<A>, behavior: Behavior<boolean>): Stream<A> {
  return stream.filter((_) => at(behavior));
}

class ScanStream<A, B> extends Stream<B> {
  constructor(private fn: (a: A, b: B) => B, private last: B, source: Stream<A>) {
    super();
    source.addListener(this);
  }
  push(a: A): void {
    const val = this.last = this.fn(a, this.last);
    this.child.push(val);
  }
}

/**
 * The returned  initially has the initial value, on each
 * occurence in `source` the function is applied to the current value
 * of the behaviour and the value of the occurence, the returned value
 * becomes the next value of the behavior.
 */
export function scanS<A, B>(fn: (a: A, b: B) => B, startingValue: B, stream: Stream<A>): Behavior<Stream<B>> {
  return fromFunction(() => new ScanStream(fn, startingValue, stream));
}

class SnapshotStream<B> extends Stream<B> {
  constructor(private behavior: Behavior<B>, stream: Stream<any>) {
    super();
    stream.addListener(this);
  }
  push(a: any): void {
    this.child.push(at(this.behavior));
  }
}

export function snapshot<B>(b: Behavior<B>, s: Stream<any>): Stream<B> {
  return new SnapshotStream(b, s);
}

class SnapshotWithStream<A, B, C> extends Stream<C> {
  constructor(
    private fn: (a: A, b: B) => C,
    private behavior: Behavior<B>,
    stream: Stream<A>
  ) {
    super();
    stream.child = this;
  }
  push(a: A): void {
    this.child.push(this.fn(a, at(this.behavior)));
  }
}

export function snapshotWith<A, B, C>(
  f: (a: A, b: B) => C, b: Behavior<B>, s: Stream<A>
): Stream<C> {
  return new SnapshotWithStream(f, b, s);
}

/** @private */
class SwitchOuter<A> implements Observer<Stream<A>> {
  constructor(private s: SwitchBehaviorStream<A>) {};
  beginPulling(): void {
    throw new Error("not implemented");
  }
  endPulling(): void {
    throw new Error("not implemented");
  }
  push(a: Stream<A>): void {
    this.s.doSwitch(a);
  }
}

class SwitchBehaviorStream<A> extends Stream<A> {
  private currentSource: Stream<A>;
  private outerConsumer: Observer<Stream<A>>;
  constructor(private b: Behavior<Stream<A>>) {
    super();
    this.outerConsumer = new SwitchOuter(this);
    b.addListener(this.outerConsumer);
    const cur = this.currentSource = at(b);
    cur.addListener(this);
  }
  push(a: A): void {
    this.child.push(a);
  }
  public doSwitch(newStream: Stream<A>): void {
    this.currentSource.removeListener(this);
    newStream.addListener(this);
    this.currentSource = newStream;
  }
}

export function switchStream<A>(b: Behavior<Stream<A>>): Stream<A> {
  return new SwitchBehaviorStream(b);
}

class ChangesStream<A> extends Stream<A> {
  constructor(private b: Behavior<A>) {
    super();
    b.addListener(this);
  }
  push(a: A) {
    this.child.push(a);
  }
  beginPulling(): void {
    throw new Error("Cannot get changes from pulling behavior");
  }
  endPulling(): void {
    throw new Error("Cannot get changes from pulling behavior");
  }
}

export function changes<A>(b: Behavior<A>): Stream<A> {
  return new ChangesStream(b);
}

export class PlaceholderStream<B> extends Stream<B> {
  private source: Stream<B>;

  push(a: B): void {
    this.child.push(a);
  }

  replaceWith(s: Stream<B>): void {
    this.source = s;
    s.addListener(this);
  }
}

export function placeholderStream<A>(): PlaceholderStream<A> {
  return new PlaceholderStream<A>();
}

export function combineList<A>(ss: Stream<A>[]): Stream<A> {
  // FIXME: More performant implementation with benchmark
  return ss.reduce((s1, s2) => s1.combine(s2), empty());
}

/**
 * @returns A stream that never has any occurrences.
 */
export function empty<A>(): Stream<A> {
  return new SinkStream<A>();
}

export function subscribe<A>(fn: (a: A) => void, stream: Stream<A>): void {
  stream.subscribe(fn);
}

export function combine<A, B>(a: Stream<A>, b: Stream<B>): Stream<(A|B)> {
  return a.combine(b);
}

export function isStream(obj: any): boolean {
  return typeof obj === "object" && ("scanS" in obj);
}
