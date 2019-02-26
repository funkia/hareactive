import { Reactive, State, Time, SListener, Parent, BListener } from "./common";
import { cons, Node, DoubleLinkedList } from "./datastructures";
import {
  Behavior,
  fromFunction,
  accumFrom,
  at,
  stepperFrom,
  accum
} from "./behavior";
import { tick } from "./clock";
import { Now, sample } from "./now";

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
  scan<B>(fn: (a: A, b: B) => B, startingValue: B): Now<Stream<B>> {
    return scan(fn, startingValue, this);
  }
  scanFrom<B>(fn: (a: A, b: B) => B, startingValue: B): Behavior<Stream<B>> {
    return fromFunction((t) => new ScanStream(fn, startingValue, this, t));
  }
  accum<B>(fn: (a: A, b: B) => B, init: B): Now<Behavior<B>> {
    return accum(fn, init, this);
  }
  accumFrom<B>(fn: (a: A, b: B) => B, init: B): Behavior<Behavior<B>> {
    return accumFrom(fn, init, this);
  }
  log(prefix?: string): Stream<A> {
    this.subscribe((a) => console.log(`${prefix || ""} `, a));
    return this;
  }
  abstract pushS(t: number, value: any): void;
  pushSToChildren(t: number, value: any): void {
    for (const child of this.children) {
      child.pushS(t, value);
    }
  }
}

export class MapStream<A, B> extends Stream<B> {
  constructor(readonly parent: Stream<A>, readonly f: (a: A) => B) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, v: A): void {
    this.pushSToChildren(t, this.f(v));
  }
}

export class MapToStream<A, B> extends Stream<B> {
  constructor(readonly parent: Stream<A>, readonly b: B) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, _v: A): void {
    this.pushSToChildren(t, this.b);
  }
}

export class FilterStream<A> extends Stream<A> {
  constructor(readonly parent: Stream<A>, readonly fn: (a: A) => boolean) {
    super();
    this.parents = cons(parent);
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
  // FIXME: The implementation here should propagate clock
  return stream.map((a: A) => behavior.at()(a));
}

/**
 * @param predicate A predicate function that returns a boolean for `A`.
 * @param s The stream to filter.
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
  // FIXME: The implementation here should propagate clock
  return stream.filter((a: A) => predicate.at()(a));
}

export function keepWhen<A>(
  stream: Stream<A>,
  behavior: Behavior<boolean>
): Stream<A> {
  // FIXME: The implementation here should propagate clock
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
  /* istanbul ignore next */
  pushS(_t: number): void {
    throw new Error("You cannot push to an empty stream");
  }
}

export const empty: Stream<any> = new EmptyStream();

export class ScanStream<A, B> extends ActiveStream<B> {
  private node: Node<this> = new Node(this);
  constructor(
    readonly f: (a: A, b: B) => B,
    public last: B,
    readonly parent: Stream<A>,
    readonly t: Time
  ) {
    super();
    this.parents = cons(parent);
    parent.addListener(this.node, t);
  }
  pushS(t: number, a: A): void {
    this.last = this.f(a, this.last);
    this.pushSToChildren(t, this.last);
  }
}

/**
 * The returned  initially has the initial value, on each occurrence
 * in `source` the function is applied to the current value of the
 * behavior and the value of the occurrence, the returned value
 * becomes the next value of the behavior.
 */
export function scanFrom<A, B>(
  fn: (a: A, b: B) => B,
  startingValue: B,
  stream: Stream<A>
): Behavior<Stream<B>> {
  return stream.scanFrom(fn, startingValue);
}

export function scan<A, B>(
  f: (a: A, b: B) => B,
  initial: B,
  source: Stream<A>
): Now<Stream<B>> {
  return sample(scanFrom(f, initial, source));
}

class SwitchBehaviorStream<A> extends Stream<A> implements BListener {
  private bNode: Node<this> = new Node(this);
  private sNode: Node<this> = new Node(this);
  private currentSource: Stream<A>;
  constructor(private b: Behavior<Stream<A>>) {
    super();
  }
  activate(t: number): void {
    this.b.addListener(this.bNode, t);
    if (this.b.state !== State.Inactive) {
      this.currentSource = this.b.last;
      this.currentSource.addListener(this.sNode, t);
    }
  }
  deactivate(): void {
    this.b.removeListener(this.bNode);
    this.currentSource.removeListener(this.sNode);
  }
  pushB(t: number): void {
    const newStream = this.b.last;
    if (this.currentSource !== undefined) {
      this.currentSource.removeListener(this.sNode);
    }
    newStream.addListener(this.sNode, t);
    this.currentSource = newStream;
  }
  pushS(t: number, a: A): void {
    this.pushSToChildren(t, a);
  }
}

/**
 * Takes a behavior of a stream and returns a stream that emits from the last
 * stream.
 */
export function switchStream<A>(b: Behavior<Stream<A>>): Stream<A> {
  return new SwitchBehaviorStream(b);
}

/**
 * Takes a stream of a stream and returns a stream that emits from the last
 * stream.
 */
export function switchStreamFrom<A>(s: Stream<Stream<A>>): Behavior<Stream<A>> {
  return stepperFrom(empty, s).map(switchStream);
}

class ChangesStream<A> extends Stream<A> implements BListener {
  last: A;
  constructor(
    readonly parent: Behavior<A>,
    readonly comparator: (v: A, u: A) => boolean
  ) {
    super();
    this.parents = cons(parent);
  }
  activate(t: Time): void {
    super.activate(t);
    this.last = at(this.parent, t);
  }
  pushB(t: number): void {
    if (!this.comparator(this.last, this.parent.last)) {
      this.pushSToChildren(t, this.parent.last);
      this.last = this.parent.last;
    }
  }
  pushS(_t: number, _a: A): void {}
}

export function changes<A>(
  b: Behavior<A>,
  comparator: (v: A, u: A) => boolean = (v, u) => v === u
): Stream<A> {
  return new ChangesStream(b, comparator);
}

export class CombineStream<A, B> extends Stream<A | B> {
  constructor(readonly s1: Stream<A>, readonly s2: Stream<B>) {
    super();
    this.parents = cons<Stream<A | B>>(s1, cons(s2));
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
  publish(a: A, t: number = tick()): void {
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

export class SnapshotStream<B> extends Stream<B> {
  private node: Node<this> = new Node(this);
  constructor(readonly target: Behavior<B>, readonly trigger: Stream<any>) {
    super();
    this.parents = cons(trigger);
  }
  pushS(t: number, _: any): void {
    const b = this.target.at(t);
    this.pushSToChildren(t, b);
  }
  activate(t: number): void {
    this.trigger.addListener(this.node, t);
  }
  deactivate(): void {
    this.trigger.removeListener(this.node);
  }
}

export function snapshot<B>(
  target: Behavior<B>,
  trigger: Stream<any>
): Stream<B> {
  return new SnapshotStream(target, trigger);
}

class SnapshotWithStream<A, B, C> extends Stream<C> {
  private node: Node<this> = new Node(this);
  constructor(
    private fn: (a: A, b: B) => C,
    private target: Behavior<B>,
    private trigger: Stream<A>
  ) {
    super();
  }
  pushS(t: number, a: A): void {
    const c = this.fn(a, this.target.at(t));
    this.pushSToChildren(t, c);
  }
  activate(t: number): void {
    this.trigger.addListener(this.node, t);
  }
  deactivate(): void {
    this.trigger.removeListener(this.node);
  }
}

export function snapshotWith<A, B, C>(
  f: (a: A, b: B) => C,
  target: Behavior<B>,
  trigger: Stream<A>
): Stream<C> {
  return new SnapshotWithStream(f, target, trigger);
}

export class SelfieStream<A> extends Stream<A> {
  constructor(parent: Stream<Behavior<A>>) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, target: Behavior<A>): void {
    this.pushSToChildren(t, at(target, t));
  }
}

/**
 * On each occurrence the behavior is sampled at the time of the occurrence.
 */
export function selfie<A>(stream: Stream<Behavior<A>>): Stream<A> {
  return new SelfieStream(stream);
}

export function isStream(s: any): s is Stream<any> {
  return typeof s === "object" && "scanFrom" in s;
}

class PerformCbStream<A, B> extends ActiveStream<B> implements SListener<A> {
  node: Node<this> = new Node(this);
  doneCb = (result: B): void => this.pushSToChildren(tick(), result);
  constructor(
    private cb: (value: A, done: (result: B) => void) => void,
    stream: Stream<A>
  ) {
    super();
    stream.addListener(this.node, tick());
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
export function mapCbStream<A, B>(
  cb: (value: A, done: (result: B) => void) => void,
  stream: Stream<A>
): Stream<B> {
  return new PerformCbStream(cb, stream);
}
