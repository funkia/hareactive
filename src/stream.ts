import { Reactive, State, Time, SListener, Parent, BListener } from "./common";
import { cons, Node, DoubleLinkedList } from "./datastructures";
import { Behavior, fromFunction, scan } from "./behavior";
import { tick } from "./clock";

export type Occurrence<A> = {
  time: Time;
  value: A;
};

export type SemanticStream<A> = Occurrence<A>[];

/**
 * A stream is a list of occurrences over time. Each occurrence
 * happens at a point in time and has an associated value.
 */
export abstract class Stream<A> extends Reactive<A, SListener<A>>
  implements Parent<SListener<any>> {
  constructor() {
    super();
  }
  children: DoubleLinkedList<SListener<A>> = new DoubleLinkedList();
  state: State;
  combine<B>(stream: Stream<B>): Stream<A | B> {
    return new CombineStream(stream, this);
  }
  map<B>(f: (a: A) => B): Stream<B> {
    return new MapStream(this, f);
  }
  mapTo<B>(b: B): Stream<B> {
    return new MapToStream(this, b);
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
  log(prefix?: string): Stream<A> {
    this.subscribe((a) => console.log(`${prefix || ""} `, a));
    return this;
  }
  /* istanbul ignore next */
  semantic(): SemanticStream<A> {
    throw new Error("The stream does not have a semantic representation");
  }
  abstract pushS(t: number, value: any): void;
  pushSToChildren(t: number, value: any) {
    for (const child of this.children) {
      child.pushS(t, value);
    }
  }
  pull(t: number): void {
    throw new Error("Pull not implemented on stream");
  }
  // abstract semantic(): SemanticStream<A>;
}

export class MapStream<A, B> extends Stream<B> {
  constructor(private parent: Stream<A>, private f: (a: A) => B) {
    super();
    this.parents = cons(parent);
  }
  semantic(): SemanticStream<B> {
    const s = (<Stream<A>>this.parents.value).semantic();
    return s.map(({ time, value }) => ({ time, value: this.f(value) }));
  }
  pushS(t: number, v: A): void {
    this.pushSToChildren(t, this.f(v));
  }
}

export class MapToStream<A, B> extends Stream<B> {
  constructor(parent: Stream<A>, private readonly b: B) {
    super();
    this.parents = cons(parent);
  }
  semantic(): SemanticStream<B> {
    const s = (<Stream<A>>this.parents.value).semantic();
    return s.map(({ time }) => ({ time, value: this.b }));
  }
  pushS(t: number, _v: A): void {
    this.pushSToChildren(t, this.b);
  }
}

class FilterStream<A> extends Stream<A> {
  constructor(readonly parent: Stream<A>, private fn: (a: A) => boolean) {
    super();
    this.parents = cons(parent);
  }
  semantic(): SemanticStream<A> {
    const s = (<Stream<A>>this.parent).semantic();
    return s.filter(({ value }) => this.fn(value));
  }
  pushS(t: number, v: A): void {
    if (this.fn(v) === true) {
      this.pushSToChildren(t, v);
    }
  }
}

export function apply<A, B>(
  behavior: Behavior<(a: A) => B>,
  stream: Stream<A>
): Stream<B> {
  return stream.map((a: A) => behavior.at()(a));
}

/**
 * @param fn A predicate function that returns a boolean for `A`.
 * @param stream The stream to filter.
 * @returns Stream that only contains the occurrences from `stream`
 * for which `fn` returns true.
 */
export function filter<A>(
  predicate: (a: A) => boolean,
  s: Stream<A>
): Stream<A> {
  return s.filter(predicate);
}

export function split<A>(
  predicate: (a: A) => boolean,
  stream: Stream<A>
): [Stream<A>, Stream<A>] {
  // It should be possible to implement this in a faster way where
  // `predicate` is only called once for each occurrence
  return [stream.filter(predicate), stream.filter((a) => !predicate(a))];
}

export function filterApply<A>(
  predicate: Behavior<(a: A) => boolean>,
  stream: Stream<A>
): Stream<A> {
  return stream.filter((a: A) => predicate.at()(a));
}

export function keepWhen<A>(
  stream: Stream<A>,
  behavior: Behavior<boolean>
): Stream<A> {
  return stream.filter((_) => behavior.at());
}

/** For stateful streams that are always active */
export abstract class ActiveStream<A> extends Stream<A> {
  activate(): void {}
  deactivate(): void {}
}

class EmptyStream extends ActiveStream<any> {
  constructor() {
    super();
  }
  semantic(): SemanticStream<any> {
    return [];
  }
  /* istanbul ignore next */
  pushS(t: number): void {
    throw new Error("You cannot push to an empty stream");
  }
}

export const empty: Stream<any> = new EmptyStream();

class ScanStream<A, B> extends ActiveStream<B> {
  private node = new Node(this);
  constructor(
    private fn: (a: A, b: B) => B,
    public last: B,
    public parent: Stream<A>
  ) {
    super();
    this.parents = cons(parent);
    parent.addListener(this.node, tick());
  }
  semantic(): SemanticStream<B> {
    const s = this.parent.semantic();
    let acc = this.last;
    return s.map(({ time, value }) => {
      acc = this.fn(value, acc);
      return { time, value: acc };
    });
  }
  pushS(t: number, a: A): void {
    this.last = this.fn(a, this.last);
    this.pushSToChildren(t, this.last);
  }
}

/**
 * The returned  initially has the initial value, on each occurrence
 * in `source` the function is applied to the current value of the
 * behavior and the value of the occurrence, the returned value
 * becomes the next value of the behavior.
 */
export function scanS<A, B>(
  fn: (a: A, b: B) => B,
  startingValue: B,
  stream: Stream<A>
): Behavior<Stream<B>> {
  return stream.scanS(fn, startingValue);
}

class SwitchBehaviorStream<A> extends Stream<A> implements BListener {
  private bNode = new Node(this);
  private sNode = new Node(this);
  private currentSource: Stream<A>;
  constructor(private b: Behavior<Stream<A>>) {
    super();
  }
  activate(t: number): void {
    this.b.addListener(this.bNode, t);
    this.currentSource = this.b.last;
    this.currentSource.addListener(this.sNode, t);
  }
  deactivate(): void {
    this.b.removeListener(this.bNode);
    this.currentSource.removeListener(this.sNode);
  }
  pushB(t: number): void {
    const newStream = this.b.last;
    this.currentSource.removeListener(this.sNode);
    newStream.addListener(this.sNode, t);
    this.currentSource = newStream;
  }
  pushS(t: number, a: A): void {
    this.pushSToChildren(t, a);
  }
}

/**
 * @param b A Behavior of streams
 * @returns Stream that only contains the occurrences from `stream`
 * the current stream in the behavior.
 */

export function switchStream<A>(b: Behavior<Stream<A>>): Stream<A> {
  return new SwitchBehaviorStream(b);
}

class ChangesStream<A> extends Stream<A> implements BListener {
  constructor(private parent: Behavior<A>) {
    super();
    this.parents = cons(parent);
  }
  changeStateDown(state: State): void {
    throw new Error("Method not implemented.");
  }
  pushB(t: number): void {
    this.pushSToChildren(t, this.parent.last);
  }
  pushS(t: number, a: A): void {
    this.pushSToChildren(t, a);
  }
}

export function changes<A>(b: Behavior<A>): Stream<A> {
  return new ChangesStream(b);
}

class CombineStream<A, B> extends Stream<A | B> {
  constructor(private s1: Stream<A>, private s2: Stream<B>) {
    super();
    this.parents = cons<Stream<A | B>>(s1, cons(s2));
  }
  semantic(): SemanticStream<A | B> {
    const result: Occurrence<A | B>[] = [];
    const a = this.s1.semantic();
    const b = this.s2.semantic();
    for (let i = 0, j = 0; i < a.length || j < b.length; ) {
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
  pushS(t: number, a: A | B): void {
    this.pushSToChildren(t, a);
  }
}

export abstract class ProducerStream<A> extends Stream<A> {
  constructor() {
    super();
    this.state = State.Push;
  }
  /* istanbul ignore next */
  semantic(): SemanticStream<A> {
    throw new Error(
      "A producer stream does not have a semantic representation"
    );
  }
  pushS(t: number = tick(), a: A): void {
    this.pushSToChildren(t, a);
  }
}

export type ProducerStreamFunction<A> = (
  push: (a: A, t?: number) => void
) => () => void;

class ProducerStreamFromFunction<A> extends ProducerStream<A> {
  constructor(private activateFn: ProducerStreamFunction<A>) {
    super();
  }
  deactivateFn: () => void;
  publish(a: A, t: number = tick()) {
    this.pushS(t, a);
  }
  activate(): void {
    this.state = State.Push;
    this.deactivateFn = this.activateFn(this.publish.bind(this));
  }
  deactivate(): void {
    this.state = State.Inactive;
    this.deactivateFn();
  }
}

export function producerStream<A>(
  activate: ProducerStreamFunction<A>
): Stream<A> {
  return new ProducerStreamFromFunction(activate);
}

export class SinkStream<A> extends ProducerStream<A> {
  private pushing: boolean;
  constructor() {
    super();
    this.pushing = false;
  }
  pushS(t: number, a: A): void {
    if (this.pushing === true) {
      this.pushSToChildren(t, a);
    }
  }
  push(a: A): void {
    const t = tick();
    this.pushSToChildren(t, a);
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
  private node = new Node(this);
  constructor(private behavior: Behavior<B>, private stream: Stream<any>) {
    super();
    this.parents = cons(stream);
  }
  pushS(t: number, a: any): void {
    const b = this.behavior.at(t);
    this.pushSToChildren(t, b);
  }
  activate(t: number): void {
    this.behavior.changePullers(1);
    this.stream.addListener(this.node, t);
  }
  deactivate(): void {
    this.behavior.changePullers(-1);
    this.stream.removeListener(this.node);
  }
  semantic(): SemanticStream<B> {
    const b = this.behavior.semantic();
    return this.stream.semantic().map(({ time }) => ({ time, value: b(time) }));
  }
}

export function snapshot<B>(b: Behavior<B>, s: Stream<any>): Stream<B> {
  return new SnapshotStream(b, s);
}

class SnapshotWithStream<A, B, C> extends Stream<C> {
  private node = new Node(this);
  constructor(
    private fn: (a: A, b: B) => C,
    private behavior: Behavior<B>,
    private stream: Stream<A>
  ) {
    super();
  }
  pushS(t: number, a: A): void {
    const c = this.fn(a, this.behavior.at(t));
    this.pushSToChildren(t, c);
  }
  activate(t: number): void {
    this.stream.addListener(this.node, t);
  }
  deactivate(): void {
    this.stream.removeListener(this.node);
  }
}

export function snapshotWith<A, B, C>(
  f: (a: A, b: B) => C,
  b: Behavior<B>,
  s: Stream<A>
): Stream<C> {
  return new SnapshotWithStream(f, b, s);
}

export function combine<A>(...streams: Stream<A>[]): Stream<A> {
  // FIXME: More performant implementation with benchmark
  return streams.reduce((s1, s2) => s1.combine(s2), empty);
}

export function isStream(s: any): s is Stream<any> {
  return typeof s === "object" && "scanS" in s;
}

class PerformCbStream<A, B> extends ActiveStream<B> implements SListener<A> {
  node = new Node(this);
  doneCb = (result: B): void => this.pushSToChildren(tick(), result);
  constructor(
    private cb: (value: A, done: (result: B) => void) => void,
    s: Stream<A>
  ) {
    super();
    s.addListener(this.node, tick());
  }
  pushS(_: number, value: A): void {
    this.cb(value, this.doneCb);
  }
}

/**
 * Invokes the callback for each occurrence on the given stream.
 *
 * This function is intended to be a low-level function used as the
 * basis for other operators.
 */
export function performCb<A, B>(
  cb: (value: A, done: (result: B) => void) => void,
  s: Stream<A>
): Stream<B> {
  return new PerformCbStream(cb, s);
}
