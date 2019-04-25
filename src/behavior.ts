import { cons, DoubleLinkedList, Node, fromArray } from "./datastructures";
import { combine } from "./index";
import { State, Reactive, Time, BListener, Parent, SListener } from "./common";
import { Future, BehaviorFuture } from "./future";
import * as F from "./future";
import { Stream } from "./stream";
import { tick, getTime } from "./clock";
import { sample, Now } from "./now";

export type MapBehaviorTuple<A> = { [K in keyof A]: Behavior<A[K]> };

/**
 * A behavior is a value that changes over time. Conceptually it can
 * be thought of as a function from time to a value. I.e. `type
 * Behavior<A> = (t: Time) => A`.
 */
export abstract class Behavior<A> extends Reactive<A, BListener>
  implements Parent<BListener> {
  // Behaviors cache their last value in `last`.
  last: A;
  children: DoubleLinkedList<BListener> = new DoubleLinkedList();
  pulledAt: number | undefined;
  changedAt: number | undefined;

  constructor() {
    super();
  }
  static is(a: any): a is Behavior<any> {
    return isBehavior(a);
  }
  map<B>(fn: (a: A) => B): Behavior<B> {
    return new MapBehavior<A, B>(this, fn);
  }
  mapTo<B>(v: B): Behavior<B> {
    return new ConstantBehavior(v);
  }
  static of<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  of<B>(v: B): Behavior<B> {
    return new ConstantBehavior(v);
  }
  ap<B>(f: Behavior<(a: A) => B>): Behavior<B> {
    return new ApBehavior<A, B>(f, this);
  }
  lift<A extends any[], R>(
    f: (...args: A) => R,
    ...args: MapBehaviorTuple<A>
  ): Behavior<R> {
    return new LiftBehavior(f, args);
  }
  static multi: boolean = true;
  multi: boolean = true;
  flatMap<B>(fn: (a: A) => Behavior<B>): Behavior<B> {
    return new FlatMapBehavior(this, fn);
  }
  chain<B>(fn: (a: A) => Behavior<B>): Behavior<B> {
    return new FlatMapBehavior(this, fn);
  }
  flatten<B>(this: Behavior<Behavior<B>>): Behavior<B> {
    return new FlatMapBehavior(this, (a) => a);
  }
  at(t?: number): A {
    if (this.state !== State.Push) {
      const time = t === undefined ? tick() : t;
      this.pull(time);
    }
    return this.last;
  }
  abstract update(t: number): A;
  pushB(t: number): void {
    if (this.state === State.Push) {
      const newValue = this.update(t);
      this.pulledAt = t;
      if (this.last !== newValue) {
        this.changedAt = t;
        this.last = newValue;
        pushToChildren(t, this);
      }
    }
  }
  pull(t: number): void {
    if (this.pulledAt === undefined || this.pulledAt < t) {
      this.pulledAt = t;
      let shouldRefresh = this.changedAt === undefined;
      for (const parent of this.parents) {
        if (isBehavior(parent)) {
          if (parent.state !== State.Push && parent.pulledAt !== t) {
            parent.pull(t);
          }
          shouldRefresh = shouldRefresh || parent.changedAt > this.changedAt;
        }
      }
      if (shouldRefresh) {
        refresh(this, t);
      }
    }
  }
  activate(t: number): void {
    super.activate(t);
    if (this.state === State.Push) {
      refresh(this, t);
    }
  }
  log(prefix?: string, ms: number = 100): Behavior<A> {
    this.observe(
      (a) => (prefix !== undefined ? console.log(prefix, a) : console.log(a)),
      (pull) => {
        let stop = false;
        (function repeat() {
          if (!stop) {
            pull();
            setTimeout(repeat, ms);
          }
        })();
        return () => {
          stop = true;
        };
      }
    );
    return this;
  }
}

export function pushToChildren(t: number, b: Behavior<any>): void {
  for (const child of b.children) {
    child.pushB(t);
  }
}

function refresh<A>(b: Behavior<A>, t: number): void {
  const newValue = b.update(t);
  if (newValue !== b.last) {
    b.changedAt = t;
    b.last = newValue;
  }
}

export function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && "at" in b;
}

export abstract class ProducerBehavior<A> extends Behavior<A> {
  newValue(a: A): void {
    const changed = a !== this.last;
    if (changed) {
      const t = tick();
      this.last = a;
      this.changedAt = t;
      if (this.state === State.Push) {
        this.pulledAt = t;
        pushToChildren(t, this);
      }
    }
  }
  pull(t: number): void {
    this.last = this.update(t);
  }
  activate(): void {
    if (this.state === State.Inactive) {
      this.activateProducer();
    }
    this.state = State.Push;
  }
  deactivate(): void {
    this.state = State.Inactive;
    this.deactivateProducer();
  }
  abstract activateProducer(): void;
  abstract deactivateProducer(): void;
}

export type ProducerBehaviorFunction<A> = (push: (a: A) => void) => () => void;

class ProducerBehaviorFromFunction<A> extends ProducerBehavior<A> {
  constructor(
    private activateFn: ProducerBehaviorFunction<A>,
    readonly update: (t: number) => A
  ) {
    super();
  }
  deactivateFn: () => void;
  activateProducer(): void {
    this.state = State.Push;
    this.deactivateFn = this.activateFn(this.newValue.bind(this));
  }
  deactivateProducer(): void {
    this.state = State.Inactive;
    this.deactivateFn();
  }
}

export function producerBehavior<A>(
  activate: ProducerBehaviorFunction<A>,
  getValue: (t: number) => A
): Behavior<A> {
  return new ProducerBehaviorFromFunction(activate, getValue);
}

export class SinkBehavior<A> extends ProducerBehavior<A> {
  constructor(public last: A) {
    super();
  }
  push(a: A): void {
    if (this.last !== a) {
      const t = tick();
      this.last = a;
      this.changedAt = t;
      this.pulledAt = t;
      pushToChildren(t, this);
    }
  }
  update(): A {
    return this.last;
  }
  activateProducer(): void {}
  deactivateProducer(): void {}
}

/**
 * Creates a behavior for imperative pushing.
 */
export function sinkBehavior<A>(initial: A): SinkBehavior<A> {
  return new SinkBehavior<A>(initial);
}

/**
 * Impure function that gets the current value of a behavior. For a
 * pure variant see `sample`.
 */
export function at<B>(b: Behavior<B>, t?: number): B {
  return b.at(t);
}

export class MapBehavior<A, B> extends Behavior<B> {
  constructor(private parent: Behavior<any>, private f: (a: A) => B) {
    super();
    this.parents = cons(parent);
  }
  update(_t: number): B {
    return this.f(this.parent.last);
  }
}

class ApBehavior<A, B> extends Behavior<B> {
  constructor(private fn: Behavior<(a: A) => B>, private val: Behavior<A>) {
    super();
    this.parents = cons<any>(fn, cons(val));
  }
  update(_t: number): B {
    return this.fn.last(this.val.last);
  }
}

/**
 * Apply a function valued behavior to a value behavior.
 *
 * @param fnB behavior of functions from `A` to `B`
 * @param valB A behavior of `A`
 * @returns Behavior of the function in `fnB` applied to the value in `valB`
 */
export function ap<A, B>(
  fnB: Behavior<(a: A) => B>,
  valB: Behavior<A>
): Behavior<B> {
  return valB.ap(fnB);
}

export class LiftBehavior<A extends any[], R> extends Behavior<R> {
  constructor(private f: (...as: A) => R, private bs: MapBehaviorTuple<A>) {
    super();
    this.parents = fromArray(bs);
  }
  update(_t: number): R {
    return this.f(...(this.bs.map((b) => b.last) as any));
  }
}

class FlatMapBehavior<A, B> extends Behavior<B> {
  // The last behavior returned by the chain function
  private innerB: Behavior<B>;
  private innerNode: Node<this> = new Node(this);
  constructor(private outer: Behavior<A>, private fn: (a: A) => Behavior<B>) {
    super();
    this.parents = cons(this.outer);
  }
  pushB(t: number): void {
    const newValue = this.update(t);
    this.pulledAt = t;
    if (this.last !== newValue) {
      this.changedAt = t;
      this.last = newValue;
      if (this.state === State.Push) {
        pushToChildren(t, this);
      }
    }
  }
  update(t: number): B {
    const outerChanged = this.outer.changedAt > this.changedAt;
    if (outerChanged || this.changedAt === undefined) {
      if (this.innerB !== undefined) {
        this.innerB.removeListener(this.innerNode);
      }
      this.innerB = this.fn(this.outer.last);
      this.innerB.addListener(this.innerNode, t);
      if (this.state !== this.innerB.state) {
        this.changeStateDown(this.innerB.state);
      }
      this.parents = cons<Parent<BListener>>(this.outer, cons(this.innerB));
      if (this.innerB.state !== State.Push) {
        this.innerB.pull(t);
      }
    }
    return this.innerB.last;
  }
}

/** @private */
class WhenBehavior extends Behavior<Future<{}>> {
  constructor(private parent: Behavior<boolean>) {
    super();
    this.parents = cons(parent);
  }
  update(_t: number): Future<{}> {
    return this.parent.last === true
      ? Future.of({})
      : new BehaviorFuture(this.parent);
  }
}

export function whenFrom(b: Behavior<boolean>): Behavior<Future<{}>> {
  return new WhenBehavior(b);
}

export function when(b: Behavior<boolean>): Now<Future<{}>> {
  return sample(whenFrom(b));
}

class SnapshotBehavior<A> extends Behavior<Future<A>> implements SListener<A> {
  private afterFuture: boolean;
  private node: Node<this> = new Node(this);
  constructor(private parent: Behavior<A>, future: Future<any>) {
    super();
    if (future.state === State.Done) {
      // Future has occurred at some point in the past
      this.afterFuture = true;
      this.state = parent.state;
      this.parents = cons(parent);
      this.last = Future.of(at(parent));
    } else {
      this.afterFuture = false;
      this.state = State.Push;
      this.last = F.sinkFuture<A>();
      future.addListener(this.node, tick());
    }
  }
  pushS(t: number, val: A): void {
    if (this.afterFuture === false) {
      // The push is coming from the Future, it has just occurred.
      this.afterFuture = true;
      this.last.resolve(at(this.parent));
      this.parent.addListener(this.node, t);
    } else {
      // We are receiving an update from `parent` after `future` has
      // occurred.
      this.last = Future.of(val);
    }
  }
  update(_t: Time): Future<A> {
    return this.last;
  }
}

export function snapshotAt<A>(
  b: Behavior<A>,
  f: Future<any>
): Behavior<Future<A>> {
  return new SnapshotBehavior(b, f);
}

/** Behaviors that are always active */
export abstract class ActiveBehavior<A> extends Behavior<A> {
  // noop methods, behavior is always active
  activate(): void {}
  deactivate(): void {}
}

export class ConstantBehavior<A> extends ActiveBehavior<A> {
  constructor(public last: A) {
    super();
    this.state = State.Push;
    this.changedAt = getTime();
  }
  update(_t: number): A {
    return this.last;
  }
}

/** @private */
export class FunctionBehavior<A> extends ActiveBehavior<A> {
  constructor(private f: (t: Time) => A) {
    super();
    this.state = State.Pull;
  }
  pull(t: Time): void {
    if (this.pulledAt !== t) {
      refresh(this, t);
      this.pulledAt = t;
    }
  }
  update(t: Time): A {
    return this.f(t);
  }
}

export function fromFunction<B>(f: (t: Time) => B): Behavior<B> {
  return new FunctionBehavior(f);
}

/** @private */
class SwitcherBehavior<A> extends ActiveBehavior<A>
  implements BListener, SListener<Behavior<A>> {
  private bNode: Node<this> = new Node(this);
  private nNode: Node<this> = new Node(this);
  constructor(
    private b: Behavior<A>,
    next: Future<Behavior<A>> | Stream<Behavior<A>>,
    t: Time
  ) {
    super();
    this.parents = cons(b);
    b.addListener(this.bNode, t);
    this.state = b.state;
    this.last = b.last;
    next.addListener(this.nNode, t);
  }
  update(_t: number): A {
    return this.b.last;
  }
  pushS(t: number, value: Behavior<A>): void {
    this.doSwitch(t, value);
  }
  private doSwitch(t: number, newB: Behavior<A>): void {
    this.b.removeListener(this.bNode);
    this.b = newB;
    this.parents = cons(newB);
    newB.addListener(this.bNode, t);
    const newState = newB.state;
    if (newState !== this.state) {
      this.changeStateDown(newState);
    }
    this.pushB(t);
  }
}

/**
 * From an initial value and a future value, `stepTo` creates a new behavior
 * that has the initial value until `next` occurs, after which it has the value
 * of the future.
 */
export function stepTo<A>(init: A, next: Future<A>): Behavior<A> {
  return new SwitcherBehavior(Behavior.of(init), next.map(Behavior.of), tick());
}

/**
 * From an initial behavior and a future of a behavior, `switcher`
 * creates a new behavior that acts exactly like `initial` until
 * `next` occurs, after which it acts like the behavior it contains.
 */
export function switchTo<A>(
  init: Behavior<A>,
  next: Future<Behavior<A>>
): Behavior<A> {
  return new SwitcherBehavior(init, next, tick());
}

export function switcherFrom<A>(
  init: Behavior<A>,
  stream: Stream<Behavior<A>>
): Behavior<Behavior<A>> {
  return fromFunction((t) => new SwitcherBehavior(init, stream, t));
}

export function switcher<A>(
  init: Behavior<A>,
  stream: Stream<Behavior<A>>
): Now<Behavior<A>> {
  return sample(switcherFrom(init, stream));
}

export function freezeTo<A>(
  init: Behavior<A>,
  freezeValue: Future<A>
): Behavior<A> {
  return switchTo(init, freezeValue.map(Behavior.of));
}

export function freezeAtFrom<A>(
  behavior: Behavior<A>,
  shouldFreeze: Future<any>
): Behavior<Behavior<A>> {
  return snapshotAt(behavior, shouldFreeze).map((f) => freezeTo(behavior, f));
}

export function freezeAt<A>(
  behavior: Behavior<A>,
  shouldFreeze: Future<any>
): Now<Behavior<A>> {
  return sample(freezeAtFrom(behavior, shouldFreeze));
}

/** @private */
class ActiveAccumBehavior<A, B> extends ActiveBehavior<B>
  implements SListener<A> {
  private node: Node<this> = new Node(this);
  constructor(
    private f: (a: A, b: B) => B,
    public last: B,
    parent: Stream<A>,
    t: Time
  ) {
    super();
    this.state = State.Push;
    parent.addListener(this.node, t);
  }
  pushS(t: number, value: A): void {
    const newValue = this.f(value, this.last);
    if (newValue !== this.last) {
      this.changedAt = t;
      this.last = newValue;
      pushToChildren(t, this);
    }
  }
  pull(_t: number): void {}
  update(_t: number): B {
    throw new Error("Update should never be called.");
  }
  changeStateDown(_: State): void {
    // No-op as an `ActiveAccumBehavior` is always in `Push` state
  }
}

export class AccumBehavior<A, B> extends ActiveBehavior<Behavior<B>> {
  constructor(
    public f: (a: A, b: B) => B,
    public initial: B,
    public source: Stream<A>
  ) {
    super();
    this.state = State.Pull;
  }
  update(t: number): Behavior<B> {
    return new ActiveAccumBehavior(this.f, this.initial, this.source, t);
  }
  pull(t: Time): void {
    this.last = this.update(t);
    this.changedAt = t;
    this.pulledAt = t;
  }
}

export function accumFrom<A, B>(
  f: (a: A, b: B) => B,
  initial: B,
  source: Stream<A>
): Behavior<Behavior<B>> {
  return new AccumBehavior<A, B>(f, initial, source);
}

export function accum<A, B>(
  f: (a: A, b: B) => B,
  initial: B,
  source: Stream<A>
): Now<Behavior<B>> {
  return sample(accumFrom(f, initial, source));
}

export type AccumPair<A> = [Stream<any>, (a: any, b: A) => A];

function accumPairToApp<A>([stream, fn]: AccumPair<A>): Stream<(a: A) => A> {
  return stream.map((a) => (b: A) => fn(a, b));
}

export function accumCombineFrom<B>(
  pairs: AccumPair<B>[],
  initial: B
): Behavior<Behavior<B>> {
  return accumFrom(
    (a, b) => a(b),
    initial,
    combine(...pairs.map(accumPairToApp))
  );
}

export function accumCombine<B>(
  pairs: AccumPair<B>[],
  initial: B
): Now<Behavior<B>> {
  return sample(accumCombineFrom(pairs, initial));
}

const firstArg = <A>(a: A, _: any): A => a;

/**
 * Creates a Behavior whose value is the last occurrence in the stream.
 * @param initial - the initial value that the behavior has
 * @param steps - the stream that will change the value of the behavior
 */
export function stepperFrom<B>(
  initial: B,
  steps: Stream<B>
): Behavior<Behavior<B>> {
  return accumFrom(firstArg, initial, steps);
}

/**
 * Creates a Behavior whose value is the last occurrence in the stream.
 * @param initial - the initial value that the behavior has
 * @param steps - the stream that will change the value of the behavior
 */
export function stepper<B>(initial: B, steps: Stream<B>): Now<Behavior<B>> {
  return sample(stepperFrom(initial, steps));
}

/**
 * Creates a Behavior whose value is `true` after `turnOn` occurring and `false` after `turnOff` occurring.
 * @param initial the initial value
 * @param turnOn the streams that turn the behavior on
 * @param turnOff the streams that turn the behavior off
 */
export function toggleFrom(
  initial: boolean,
  turnOn: Stream<any>,
  turnOff: Stream<any>
): Behavior<Behavior<boolean>> {
  return stepperFrom(initial, turnOn.mapTo(true).combine(turnOff.mapTo(false)));
}

/**
 * Creates a Behavior whose value is `true` after `turnOn` occurring and `false` after `turnOff` occurring.
 * @param initial the initial value
 * @param turnOn the streams that turn the behavior on
 * @param turnOff the streams that turn the behavior off
 */
export function toggle(
  initial: boolean,
  turnOn: Stream<any>,
  turnOff: Stream<any>
): Now<Behavior<boolean>> {
  return sample(toggleFrom(initial, turnOn, turnOff));
}

export type SampleAt = <B>(b: Behavior<B>) => B;

class MomentBehavior<A> extends Behavior<A> {
  private sampleBound: SampleAt;
  private currentSampleTime: Time;
  constructor(private f: (at: SampleAt) => A) {
    super();
    this.sampleBound = (b) => this.sample(b);
  }
  activate(t: number): void {
    this.currentSampleTime = t;
    try {
      this.last = this.f(this.sampleBound);
      this.state = State.Push;
    } catch (error) {
      if ("placeholder" in error) {
        const placeholder = error.placeholder;
        if (this.listenerNodes !== undefined) {
          for (const { node, parent } of this.listenerNodes) {
            parent.removeListener(node);
          }
        }
        const node = new Node(this);
        this.listenerNodes = cons(
          { node, parent: placeholder },
          this.listenerNodes
        );
        placeholder.addListener(node);
        this.parents = cons(placeholder);
      } else {
        throw error;
      }
    }
  }
  pull(t: number): void {
    this.pulledAt = t;
    refresh(this, t);
  }
  update(t: number): A {
    this.currentSampleTime = t;
    if (this.listenerNodes !== undefined) {
      for (const { node, parent } of this.listenerNodes) {
        parent.removeListener(node);
      }
    }
    this.parents = undefined;
    const value = this.f(this.sampleBound);
    return value;
  }
  sample<B>(b: Behavior<B>): B {
    const node = new Node(this);
    this.listenerNodes = cons({ node, parent: b }, this.listenerNodes);
    b.addListener(node, this.currentSampleTime);
    b.at(this.currentSampleTime);
    this.parents = cons(b, this.parents);
    return b.last;
  }
}

export function moment<A>(f: (sample: SampleAt) => A): Behavior<A> {
  return new MomentBehavior(f);
}

class FormatBehavior extends Behavior<string> {
  constructor(
    private strings: TemplateStringsArray,
    private behaviors: Array<string | number | Behavior<string | number>>
  ) {
    super();
    let parents = undefined;
    for (const b of behaviors) {
      if (isBehavior(b)) {
        parents = cons(b, parents);
      }
    }
    this.parents = parents;
  }
  update(_t: number): string {
    let resultString = this.strings[0];
    for (let i = 0; i < this.behaviors.length; ++i) {
      const b = this.behaviors[i];
      const value = isBehavior(b) ? b.last : b;
      resultString += value + this.strings[i + 1];
    }
    return resultString;
  }
}

export function format(
  strings: TemplateStringsArray,
  ...behaviors: Array<string | number | Behavior<string | number>>
): Behavior<string> {
  return new FormatBehavior(strings, behaviors);
}
