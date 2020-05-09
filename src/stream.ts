import {
  Reactive,
  State,
  Time,
  SListener,
  Parent,
  BListener,
  __UNSAFE_GET_LAST_BEHAVIOR_VALUE
} from "./common";
import { cons, Node, DoubleLinkedList } from "./datastructures";
import {
  Behavior,
  fromFunction,
  accumFrom,
  at,
  stepper,
  stepperFrom,
  accum
} from "./behavior";
import { tick } from "./clock";
import { Now, sample } from "./now";
import { Future } from ".";

/**
 * A stream is a list of occurrences over time. Each occurrence
 * happens at a point in time and has an associated value.
 */
export abstract class Stream<A> extends Reactive<A, SListener<A>>
  implements Parent<SListener<unknown>> {
  children: DoubleLinkedList<SListener<A>> = new DoubleLinkedList();
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
    this.subscribe((a) =>
      prefix !== undefined ? console.log(prefix, a) : console.log(a)
    );
    return this;
  }
  abstract pushS(t: number, value: unknown): void;
  pushSToChildren(t: number, value: A): void {
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

class EmptyStream extends ActiveStream<unknown> {
  constructor() {
    super();
  }
  /* istanbul ignore next */
  pushS(): void {
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
 * For each occurrence on `stream` the function `f` is applied to its value. As
 * its second argument `f` initially receives `initial` and afterwards its own
 * previous return value. The returned stream has an occurrence with the result
 * of each call to `f`.
 */
export function scanFrom<A, B>(
  f: (a: A, b: B) => B,
  initial: B,
  stream: Stream<A>
): Behavior<Stream<B>> {
  return stream.scanFrom(f, initial);
}

export function scan<A, B>(
  f: (a: A, b: B) => B,
  initial: B,
  source: Stream<A>
): Now<Stream<B>> {
  return sample(scanFrom(f, initial, source));
}

class ShiftBehaviorStream<A> extends Stream<A> implements BListener {
  private bNode: Node<this> = new Node(this);
  private sNode: Node<this> = new Node(this);
  private currentSource?: Stream<A>;
  constructor(private b: Behavior<Stream<A>>) {
    super();
  }
  activate(t: number): void {
    this.b.addListener(this.bNode, t);
    if (this.b.state !== State.Inactive) {
      this.currentSource = __UNSAFE_GET_LAST_BEHAVIOR_VALUE(this.b);
      this.currentSource.addListener(this.sNode, t);
    }
  }
  deactivate(): void {
    this.b.removeListener(this.bNode);
    if (this.currentSource !== undefined) {
      this.currentSource.removeListener(this.sNode);
    }
  }
  pushB(t: number): void {
    const newStream = __UNSAFE_GET_LAST_BEHAVIOR_VALUE(this.b);
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
export function shiftCurrent<A>(b: Behavior<Stream<A>>): Stream<A> {
  return new ShiftBehaviorStream(b);
}

/**
 * Takes a stream of a stream and returns a stream that emits from the last
 * stream.
 */
export function shift<A>(s: Stream<Stream<A>>): Now<Stream<A>> {
  return stepper(empty, s).map(shiftCurrent);
}

/**
 * Takes a stream of a stream and returns a stream that emits from the last
 * stream.
 */
export function shiftFrom<A>(s: Stream<Stream<A>>): Behavior<Stream<A>> {
  return stepperFrom(empty, s).map(shiftCurrent);
}

class ChangesStream<A> extends Stream<A> implements BListener {
  last?: A;
  initialized: boolean;
  constructor(
    readonly parent: Behavior<A>,
    readonly comparator: (v: A, u: A) => boolean
  ) {
    super();
    this.parents = cons(parent);
    this.initialized = false;
  }
  activate(t: Time): void {
    super.activate(t);
    // The parent may be an unreplaced placeholder and in that case
    // we can't read its current value.
    if (this.parent.state === State.Push) {
      this.last = __UNSAFE_GET_LAST_BEHAVIOR_VALUE(this.parent);
      this.initialized = true;
    }
  }
  pushB(t: number): void {
    if (!this.initialized) {
      this.initialized = true;
      this.last = __UNSAFE_GET_LAST_BEHAVIOR_VALUE(this.parent);
    } else {
      const parentLast = __UNSAFE_GET_LAST_BEHAVIOR_VALUE(this.parent);
      if (this.last !== undefined && !this.comparator(this.last, parentLast)) {
        this.pushSToChildren(t, parentLast);
        this.last = parentLast;
      }
    }
  }
  pushS(_t: number, _a: A): void {}
}

export function changes<A>(
  b: Behavior<A>,
  comparator: (v: A, u: A) => boolean = (v, u) => v === u
): Stream<A> {
  if (b.state === State.Pull) {
    throw new Error(
      "You invoked changes on a pull behavior which is not supported."
    );
  }
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
  deactivateFn?: () => void;
  publish(a: A, t: number = tick()): void {
    this.pushS(t, a);
  }
  activate(): void {
    this.state = State.Push;
    this.deactivateFn = this.activateFn(this.publish.bind(this));
  }
  deactivate(): void {
    this.state = State.Inactive;
    if (this.deactivateFn !== undefined) {
      this.deactivateFn();
    }
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
  constructor(readonly target: Behavior<B>, readonly trigger: Stream<unknown>) {
    super();
    this.parents = cons(trigger);
  }
  pushS(t: Time): void {
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
  trigger: Stream<unknown>
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

export function isStream(s: unknown): s is Stream<unknown> {
  return typeof s === "object" && s !== null && "scanFrom" in s;
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
  pushS(_: Time, value: A): void {
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

export class FlatFutures<A> extends Stream<A> {
  constructor(stream: Stream<Future<A>>) {
    super();
    this.parents = cons(stream);
  }
  pushS(_t: number, fut: Future<A>): void {
    fut.subscribe((a) => this.pushSToChildren(tick(), a));
  }
}

export class FlatFuturesOrdered<A> extends Stream<A> {
  constructor(stream: Stream<Future<A>>) {
    super();
    this.parents = cons(stream);
  }
  nextId = 0;
  next = 0;
  buffer: { value: A }[] = []; // Object-wrapper to support a result as undefined
  pushS(_t: number, fut: Future<A>): void {
    const id = this.nextId++;
    fut.subscribe((a: A) => {
      if (id === this.next) {
        this.buffer[0] = { value: a };
        this.pushFromBuffer();
      } else {
        this.buffer[id - this.next] = { value: a };
      }
    });
  }
  pushFromBuffer(): void {
    let a = this.buffer.shift();
    while (a !== undefined) {
      const t = tick();
      this.pushSToChildren(t, a.value);
      this.next++;
      a = this.buffer.shift();
    }
  }
}

export class FlatFuturesLatest<A> extends Stream<A>
  implements SListener<Future<A>> {
  constructor(stream: Stream<Future<A>>) {
    super();
    this.parents = cons(stream);
  }
  next = 0;
  newest = 0;
  running = 0;
  pushS(_t: number, fut: Future<A>): void {
    const time = ++this.next;
    this.running++;
    fut.subscribe((a: A) => {
      this.running--;
      if (time > this.newest) {
        const t = tick();
        if (this.running === 0) {
          this.next = 0;
          this.newest = 0;
        } else {
          this.newest = time;
        }
        this.pushSToChildren(t, a);
      }
    });
  }
}
