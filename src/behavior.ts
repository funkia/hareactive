import { Cons, cons, DoubleLinkedList, Node } from "./datastructures";
import { Monad, monad, combine } from "@funkia/jabz";
import { State, Reactive, Time, BListener, Parent, SListener } from "./common";
import { Future, BehaviorFuture } from "./future";
import * as F from "./future";
import { Stream } from "./stream";
import { tick } from "./clock";

/**
 * A behavior is a value that changes over time. Conceptually it can
 * be thought of as a function from time to a value. I.e. `type
 * Behavior<A> = (t: Time) => A`.
 */
export type SemanticBehavior<A> = (time: Time) => A;

@monad
export abstract class Behavior<A> extends Reactive<A, BListener>
  implements Parent<BListener>, Monad<A> {
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
  mapTo<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  static of<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  of<A>(v: A): Behavior<A> {
    return new ConstantBehavior(v);
  }
  ap<B>(f: Behavior<(a: A) => B>): Behavior<B> {
    return new ApBehavior<A, B>(f, this);
  }
  lift<T1, R>(f: (t: T1) => R, m: Behavior<T1>): Behavior<R>;
  lift<T1, T2, R>(
    f: (t: T1, u: T2) => R,
    m1: Behavior<T1>,
    m2: Behavior<T2>
  ): Behavior<R>;
  lift<T1, T2, T3, R>(
    f: (t1: T1, t2: T2, t3: T3) => R,
    m1: Behavior<T1>,
    m2: Behavior<T2>,
    m3: Behavior<T3>
  ): Behavior<R>;
  lift(/* arguments */): any {
    // TODO: Experiment with faster specialized `lift` implementation
    const f = arguments[0];
    switch (arguments.length - 1) {
      case 1:
        return arguments[1].map(f);
      case 2:
        return arguments[2].ap(
          arguments[1].map((a: any) => (b: any) => f(a, b))
        );
      case 3:
        return arguments[3].ap(
          arguments[2].ap(
            arguments[1].map((a: any) => (b: any) => (c: any) => f(a, b, c))
          )
        );
    }
  }
  static multi: boolean = true;
  multi: boolean = true;
  chain<B>(fn: (a: A) => Behavior<B>): Behavior<B> {
    return new ChainBehavior<A, B>(this, fn);
  }
  flatten: <B>(this: Behavior<Behavior<B>>) => Behavior<B>;
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
    this.pulledAt = t;
  }
  activate(t: number): void {
    super.activate(t);
    if (this.state === State.Push) {
      refresh(this, t);
    }
  }
  semantic(): SemanticBehavior<A> {
    throw new Error("The behavior does not have a semantic representation");
  }
  log(prefix?: string): Behavior<A> {
    this.subscribe((a) => console.log(`${prefix || ""} `, a));
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
  pull(_t: number): void {
    this.last = this.getValue();
  }
  update(_t: number): A {
    throw new Error("A producer behavior does not have an update method");
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
  abstract getValue(): A;
  abstract activateProducer(): void;
  abstract deactivateProducer(): void;
}

export type ProducerBehaviorFunction<A> = (push: (a: A) => void) => () => void;

class ProducerBehaviorFromFunction<A> extends ProducerBehavior<A> {
  constructor(
    private activateFn: ProducerBehaviorFunction<A>,
    readonly getValue: () => A
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
  getValue: () => A
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
  getValue(): A {
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
  update(t: number): B {
    return this.f(this.parent.last);
  }
  semantic(): SemanticBehavior<B> {
    const g = this.parent.semantic();
    return (t) => this.f(g(t));
  }
}

class ApBehavior<A, B> extends Behavior<B> {
  constructor(private fn: Behavior<(a: A) => B>, private val: Behavior<A>) {
    super();
    this.parents = cons<any>(fn, cons(val));
  }
  update(t: number): B {
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

class ChainBehavior<A, B> extends Behavior<B> {
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
        this.state = this.innerB.state;
        this.changeStateDown(this.state);
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
  update(t: number): Future<{}> {
    return this.parent.last === true
      ? Future.of({})
      : new BehaviorFuture(this.parent);
  }
}

export function when(b: Behavior<boolean>): Behavior<Future<{}>> {
  return new WhenBehavior(b);
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
  update(t: Time): Future<A> {
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
    this.changedAt = tick();
  }
  update(_t: number): A {
    return this.last;
  }
  semantic(): SemanticBehavior<A> {
    return (_) => this.last;
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
    if (this.state === State.Push) {
      this.last = at(b);
    }
    next.addListener(this.nNode, t);
  }
  update(t: number): A {
    return this.b.last;
  }
  pushS(t: number, value: Behavior<A>): void {
    this.doSwitch(t, value);
  }
  changeStateDown(state: State): void {
    for (const child of this.children) {
      child.changeStateDown(state);
    }
  }
  private doSwitch(t: number, newB: Behavior<A>): void {
    this.b.removeListener(this.bNode);
    this.b = newB;
    this.parents = cons(newB);
    newB.addListener(this.bNode, t);
    const newState = newB.state;
    if (newState !== this.state) {
      this.state = newState;
      this.changeStateDown(this.state);
    }
    this.pushB(t);
  }
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

export function switcher<A>(
  init: Behavior<A>,
  stream: Stream<Behavior<A>>
): Behavior<Behavior<A>> {
  return fromFunction((t) => new SwitcherBehavior(init, stream, t));
}

export function freezeTo<A>(
  init: Behavior<A>,
  freezeValue: Future<A>
): Behavior<A> {
  return switchTo(init, freezeValue.map(Behavior.of));
}

export function freezeAt<A>(
  behavior: Behavior<A>,
  shouldFreeze: Future<any>
): Behavior<Behavior<A>> {
  return snapshotAt(behavior, shouldFreeze).map((f) => freezeTo(behavior, f));
}

class TestBehavior<A> extends Behavior<A> {
  constructor(private semanticBehavior: SemanticBehavior<A>) {
    super();
  }
  update(_t: number): A {
    throw new Error("Test behavior never updates");
  }
  semantic(): SemanticBehavior<A> {
    return this.semanticBehavior;
  }
}

export function testBehavior<A>(b: SemanticBehavior<A>): Behavior<A> {
  return new TestBehavior(b);
}

/** @private */
class ActiveScanBehavior<A, B> extends ActiveBehavior<B>
  implements SListener<A> {
  private node: Node<this> = new Node(this);
  constructor(
    private f: (a: A, b: B) => B,
    public last: B,
    private parent: Stream<A>,
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
  pull(t: number): void {}
  update(t: number): B {
    throw new Error("Update should never be called.");
  }
  changeStateDown(state: State): void {
    // No-op as an `ActiveScanBehavior` is always in `Push` state
  }
}

class ScanBehavior<A, B> extends ActiveBehavior<Behavior<B>> {
  constructor(private f: any, private b: any, private c: any) {
    super();
    this.state = State.Pull;
  }
  update(t: number): Behavior<B> {
    return new ActiveScanBehavior(this.f, this.b, this.c, t);
  }
  pull(t: Time): void {
    this.last = this.update(t);
    this.changedAt = t;
    this.pulledAt = t;
  }
  semantic(): SemanticBehavior<Behavior<B>> {
    const stream = this.c.semantic();
    return (t1) =>
      testBehavior<B>((t2) =>
        stream
          .filter(({ time }) => t1 <= time && time <= t2)
          .map((o) => o.value)
          .reduce((acc, cur) => this.f(cur, acc), this.b)
      );
  }
}

export function scan<A, B>(
  f: (a: A, b: B) => B,
  initial: B,
  source: Stream<A>
): Behavior<Behavior<B>> {
  return new ScanBehavior<A, B>(f, initial, source);
}

export type ScanPair<A> = [Stream<any>, (a: any, b: A) => A];

function scanPairToApp<A>([stream, fn]: ScanPair<A>): Stream<(a: A) => A> {
  return stream.map((a) => (b: A) => fn(a, b));
}

export function scanCombine<B>(
  pairs: ScanPair<B>[],
  initial: B
): Behavior<Behavior<B>> {
  return scan((a, b) => a(b), initial, combine(...pairs.map(scanPairToApp)));
}

const firstArg = (a, b) => a;

/**
 * Creates a Behavior whose value is the last occurrence in the stream.
 * @param initial - the initial value that the behavior has
 * @param steps - the stream that will change the value of the behavior
 */
export function stepper<B>(
  initial: B,
  steps: Stream<B>
): Behavior<Behavior<B>> {
  return scan(firstArg, initial, steps);
}

/**
 *
 * @param initial the initial value
 * @param turnOn the streams that turn the behavior on
 * @param turnOff the streams that turn the behavior off
 */
export function toggle(
  initial: boolean,
  turnOn: Stream<any>,
  turnOff: Stream<any>
): Behavior<Behavior<boolean>> {
  return stepper(initial, turnOn.mapTo(true).combine(turnOff.mapTo(false)));
}

export type SampleAt = <B>(b: Behavior<B>) => B;

class MomentBehavior<A> extends Behavior<A> {
  private sampleBound: SampleAt;
  private currentSampleTime: Time;
  constructor(private f: (at: SampleAt) => A) {
    super();
    this.sampleBound = (b) => this.sample(b);
  }
  activate(): void {
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
    b.pull(this.currentSampleTime);
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
    private behaviors: Behavior<string | number>[]
  ) {
    super();
    let parents = undefined;
    for (const b of behaviors) {
      parents = cons(b, parents);
    }
    this.parents = parents;
  }
  update(t: number): string {
    let resultString = this.strings[0];
    for (let i = 0; i < this.behaviors.length; ++i) {
      resultString += this.behaviors[i].last + this.strings[i + 1];
    }
    return resultString;
  }
}

export function format(
  strings: TemplateStringsArray,
  ...behaviors: Behavior<string | number>[]
): Behavior<string> {
  return new FormatBehavior(strings, behaviors);
}
