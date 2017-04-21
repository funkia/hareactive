import { Observer, Reactive, State, Time } from "./common";
import { Behavior, fromFunction, scan } from "./behavior";

export type Occurrence<A> = {
  time: Time,
  value: A
};

export type SemanticStream<A> = Occurrence<A>[];

/**
 * A stream is a list of occurrences over time. Each occurrence
 * happens at a discrete point in time and has an associated value.
 * Semantically it is a list `type Stream<A> = [Time, A]`.
 */
export abstract class Stream<A> extends Reactive<A> {
  constructor() {
    super();
  }
  combine<B>(stream: Stream<B>): Stream<A | B> {
    return new CombineStream(stream, this);
  }
  map<B>(f: (a: A) => B): Stream<B> {
    return new MapReactive(this, f);
  }
  mapTo<B>(b: B): Stream<B> {
    return new MapToReactive(this, b);
  }
  filter(fn: (a: A) => boolean): Stream<A> {
    return new FilterStream<A>(this, fn);
  }
  scanS<B>(fn: (a: A, b: B) => B, startingValue: B): Behavior<Stream<B>> {
    return fromFunction(() => new ScanStream(fn, startingValue, this));
  }
  scan<B>(fn: (a: A, b: B) => B, init: B): Behavior<Behavior<B>> {
    return scan(fn, init, this);
  }
  delay(ms: number): Stream<A> {
    return new DelayStream<A>(this, ms);
  }
  throttle(ms: number): Stream<A> {
    return new ThrottleStream<A>(this, ms);
  }
  debounce(ms: number): Stream<A> {
    return new DebounceStream<A>(this, ms);
  }
  activate(): void {
    throw new Error("The stream can't activate");
  }
  deactivate(): void {
    throw new Error("The stream can't deactivate");
  }
  semantic(): SemanticStream<A> {
    throw new Error("The stream does not have a semantic representation");
  }
  // abstract semantic(): SemanticStream<A>;
}

class EmptyStream extends Stream<any> {
  constructor() {
    super();
  }
  semantic(): SemanticStream<any> {
    return [];
  }
  /* istanbul ignore next */
  activate(): void { }
  /* istanbul ignore next */
  deactivate(): void { }
  /* istanbul ignore next */
  push(a: any): void {
    throw new Error("You cannot push to an empty stream");
  }
}

export const empty: Stream<any> = new EmptyStream();

/** For pure combinators with a single parent */
abstract class PureStream<A> extends Stream<A> {
  abstract parent: Reactive<any>;
  activate(): State {
    return this.parent.addListener(this);
  }
  deactivate(): void {
    this.parent.removeListener(this);
  }
}

/** For stateful streams that are always active */
export abstract class ActiveStream<A> extends Stream<A> {
  activate() { }
  deactivate() { }
}

export class MapReactive<A, B> extends PureStream<B> {
  constructor(public parent: Reactive<A>, private f: (a: A) => B) {
    super();
  }
  semantic(): SemanticStream<B> {
    const s = (<Stream<A>>this.parent).semantic();
    return s.map(({ time, value }) => ({ time, value: this.f(value) }));
  }
  push(a: A): void {
    this.child.push(this.f(a));
  }
}

export class MapToReactive<A, B> extends PureStream<B> {
  constructor(public parent: Reactive<A>, private b: B) {
    super();
  }
  semantic(): SemanticStream<B> {
    const s = (<Stream<A>>this.parent).semantic();
    return s.map(({ time }) => ({ time, value: this.b }));
  }
  push(a: A): void {
    this.child.push(this.b);
  }
}

class FilterStream<A> extends PureStream<A> {
  constructor(
    public parent: Reactive<any>,
    private fn: (a: A) => boolean
    ) {
    super();
  }
  push(a: A): void {
    if (this.fn(a) === true) {
      this.child.push(a);
    }
  }
}

class ThrottleStream<A> extends ActiveStream<A> {
  constructor(parent: Stream<A>, private ms: number) {
    super();
    parent.addListener(this);
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

class DebounceStream<A> extends ActiveStream<A> {
  constructor(parent: Stream<A>, private ms: number) {
    super();
    parent.addListener(this);
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
  return stream.debounce(ms);
}

export function throttle<A>(ms: number, stream: Stream<A>): Stream<A> {
  return stream.throttle(ms);
}

export function delay<A>(ms: number, stream: Stream<A>): Stream<A> {
  return stream.delay(ms);
}

export function apply<A, B>(behavior: Behavior<(a: A) => B>, stream: Stream<A>): Stream<B> {
  return stream.map((a: A) => behavior.at()(a));
}

/**
 * @param fn A predicate function that returns a boolean for `A`.
 * @param stream The stream to filter.
 * @returns Stream that only contains the occurrences from `stream`
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
  return stream.filter((a: A) => predicate.at()(a));
}

export function keepWhen<A>(stream: Stream<A>, behavior: Behavior<boolean>): Stream<A> {
  return stream.filter((_) => behavior.at());
}

class ScanStream<A, B> extends ActiveStream<B> {
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
 * The returned  initially has the initial value, on each occurrence
 * in `source` the function is applied to the current value of the
 * behavior and the value of the occurrence, the returned value
 * becomes the next value of the behavior.
 */
export function scanS<A, B>(fn: (a: A, b: B) => B, startingValue: B, stream: Stream<A>): Behavior<Stream<B>> {
  return stream.scanS(fn, startingValue);
}

/** @private */
class SwitchOuter<A> implements Observer<Stream<A>> {
  constructor(private s: SwitchBehaviorStream<A>) { };
  beginPulling(): void {
    throw new Error("not implemented");
  }
  endPulling(): void {
    throw new Error("not implemented");
  }
  changeStateDown(state: State): void {
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
  }
  activate(): void {
    this.outerConsumer = new SwitchOuter(this);
    this.b.addListener(this.outerConsumer);
    const cur = this.currentSource = this.b.at();
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
  }
  push(a: A): void {
    this.child.push(a);
  }
  activate(): void {
    this.b.addListener(this);
  }
  deactivate(): void {
    this.b.removeListener(this);
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
  return ss.reduce((s1, s2) => s1.combine(s2), empty);
}

class TestStream<A> extends Stream<A> {
  constructor(private semanticStream: SemanticStream<A>) {
    super();
  }
  semantic(): SemanticStream<A> {
    return this.semanticStream;
  }
  /* istanbul ignore next */
  activate(): SemanticStream<A> {
    throw new Error("You cannot activate a TestStream");
  }
  /* istanbul ignore next */
  deactivate(): SemanticStream<A> {
    throw new Error("You cannot deactivate a TestStream");
  }
  /* istanbul ignore next */
  push(a: A): void {
    throw new Error("You cannot push to a TestStream");
  }
}

export function testStreamFromArray<A>(array: A[]): Stream<A> {
  const semanticStream = array.map((value, time) => ({ value, time }));
  return new TestStream(semanticStream);
}

export function testStreamFromObject<A>(object: { [time: number]: A }): Stream<A> {
  const semanticStream =
    Object.keys(object).map((key) => ({ time: parseFloat(key), value: object[key] }));
  return new TestStream(semanticStream);
}

class CombineStream<A, B> extends Stream<A | B> {
  constructor(private s1: Stream<A>, private s2: Stream<B>) {
    super();
  }
  semantic(): SemanticStream<A | B> {
    const result = [];
    const a = this.s1.semantic();
    const b = this.s2.semantic();
    for (let i = 0, j = 0; i < a.length || j < b.length;) {
      if (j === b.length || (i < a.length && a[i].time <= b[j].time)) {
        result.push(a[i]);
        i++;
      } else {
        result.push(b[j]);
        j++;
      }
    }
    return result;
  }
  activate(): void {
    this.s1.addListener(this);
    this.s2.addListener(this);
  }
  deactivate(): void {
    this.s1.removeListener(this);
    this.s2.removeListener(this);
  }
  push(a: A | B): void {
    this.child.push(a);
  }
}

export abstract class ProducerStream<A> extends Stream<A> {
  /* istanbul ignore next */
  semantic(): SemanticStream<A> {
    throw new Error("A producer stream does not have a semantic representation");
  }
  push(a: A): void {
    this.child.push(a);
  }
}

export class SinkStream<A> extends ProducerStream<A> {
  private pushing: boolean;
  constructor() {
    super();
    this.pushing = false;
  }
  push(a: A): void {
    if (this.pushing === true) {
      this.child.push(a);
    }
  }
  activate(): void {
    this.pushing = true;
  }
  deactivate(): void {
    this.pushing = false;
  }
}

export function sinkStream<A>(): SinkStream<A> {
  return new SinkStream<A>();
}

export function subscribe<A>(fn: (a: A) => void, stream: Stream<A>): void {
  stream.subscribe(fn);
}

class SnapshotStream<B> extends Stream<B> {
  constructor(private behavior: Behavior<B>, private stream: Stream<any>) {
    super();
  }
  push(a: any): void {
    this.child.push(this.behavior.at());
  }
  activate(): void {
    this.behavior.changePullers(1);
    this.stream.addListener(this);
  }
  deactivate(): void {
    this.stream.removeListener(this);
  }
  semantic(): SemanticStream<B> {
    throw new Error("No semantic representation");
  }
}

export function snapshot<B>(b: Behavior<B>, s: Stream<any>): Stream<B> {
  return new SnapshotStream(b, s);
}

class SnapshotWithStream<A, B, C> extends Stream<C> {
  constructor(
    private fn: (a: A, b: B) => C,
    private behavior: Behavior<B>,
    private stream: Stream<A>
  ) {
    super();
  }
  push(a: A): void {
    this.child.push(this.fn(a, this.behavior.at()));
  }
  activate(): void {
    this.stream.addListener(this);
  }
  deactivate(): void {
    this.stream.removeListener(this);
  }
  semantic(): SemanticStream<C> {
    throw new Error("No semantic representation");
  }
}

export function snapshotWith<A, B, C>(
  f: (a: A, b: B) => C, b: Behavior<B>, s: Stream<A>
): Stream<C> {
  return new SnapshotWithStream(f, b, s);
}

class DelayStream<A> extends PureStream<A> {
  constructor(public parent: Stream<A>, private ms: number) {
    super();
  }
  push(a: A): void {
    setTimeout(() => this.child.push(a), this.ms);
  }
}

export function combine<A, B>(a: Stream<A>, b: Stream<B>): Stream<(A | B)> {
  return a.combine(b);
}

export function isStream(s: any): s is Stream<any> {
  return typeof s === "object" && ("scanS" in s);
}
