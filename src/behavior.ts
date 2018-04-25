import { Cons, cons, DoubleLinkedList, Node } from "./datastructures";
import { Monad, monad } from "@funkia/jabz";
import {
  Observer,
  State,
  Reactive,
  Time,
  changePullersParents
} from "./common";
import { Future, BehaviorFuture } from "./future";
import * as F from "./future";
import { Stream } from "./stream";

/**
 * A behavior is a value that changes over time. Conceptually it can
 * be thought of as a function from time to a value. I.e. `type
 * Behavior<A> = (t: Time) => A`.
 */
export type SemanticBehavior<A> = (time: Time) => A;

@monad
export abstract class Behavior<A> extends Reactive<A>
  implements Observer<A>, Monad<A> {
  // Push behaviors cache their last value in `last`.
  // Pull behaviors do not use `last`.
  last: A;
  nrOfListeners: number;
  // The streams and behaviors that this behavior depends upon
  dependencies: Cons<Reactive<any>>;
  // Amount of nodes that wants to pull the behavior without actively
  // listening for updates
  nrOfPullers: number;

  constructor() {
    super();
    this.nrOfPullers = 0;
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
  flatten: <B>() => Behavior<B>;
  at(): A {
    return this.state === State.Push ? this.last : this.pull();
  }
  push(a: any): void {
    this.last = this.pull();
    this.pushToChildren(this.last);
  }
  pull(): A {
    return this.last;
  }
  activate(): void {
    super.activate();
    if (this.state === State.Push) {
      this.last = this.pull();
    }
  }
  changePullers(n: number): void {
    this.nrOfPullers += n;
    changePullersParents(n, this.parents);
  }
  semantic(): SemanticBehavior<A> {
    throw new Error("The behavior does not have a semantic representation");
  }
  log(prefix?: string): Behavior<A> {
    this.subscribe((a) => console.log(`${prefix || ""} `, a));
    return this;
  }
}

export function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && "at" in b;
}

export abstract class ProducerBehavior<A> extends Behavior<A> {
  push(a: A): void {
    const changed = a !== this.last;
    this.last = a;
    if (this.state === State.Push && changed) {
      for (const child of this.children) {
        child.push(this.last);
      }
    }
  }
  changePullers(n: number): void {
    this.nrOfPullers += n;
    if (this.nrOfPullers > 0 && this.state === State.Inactive) {
      this.state = State.Pull;
      this.activateProducer();
    } else if (this.nrOfPullers === 0 && this.state === State.Pull) {
      this.deactivateProducer();
    }
  }
  activate(): void {
    if (this.state === State.Inactive) {
      this.activateProducer();
    }
    this.state = State.Push;
  }
  deactivate(): void {
    if (this.nrOfPullers === 0) {
      this.state = State.Inactive;
      this.deactivateProducer();
    } else {
      this.state = State.Pull;
    }
  }
  abstract activateProducer(): void;
  abstract deactivateProducer(): void;
}

export type ProducerBehaviorFunction<A> = (push: (a: A) => void) => () => void;

class ProducerBehaviorFromFunction<A> extends ProducerBehavior<A> {
  constructor(
    private activateFn: ProducerBehaviorFunction<A>,
    private initial: A
  ) {
    super();
    this.last = initial;
  }
  deactivateFn: () => void;
  activateProducer(): void {
    this.state = State.Push;
    this.deactivateFn = this.activateFn(this.push.bind(this));
  }
  deactivateProducer(): void {
    this.state = State.Inactive;
    this.deactivateFn();
  }
}

export function producerBehavior<A>(
  activate: ProducerBehaviorFunction<A>,
  initial: A
): Behavior<A> {
  return new ProducerBehaviorFromFunction(activate, initial);
}

export class SinkBehavior<A> extends ProducerBehavior<A> {
  constructor(public last: A) {
    super();
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
export function at<B>(b: Behavior<B>): B {
  return b.at();
}

export class MapBehavior<A, B> extends Behavior<B> {
  private oldVal: A;
  private cached: B;
  constructor(private parent: Behavior<any>, private f: (a: A) => B) {
    super();
    this.parents = cons(parent);
  }
  push(a: A): void {
    this.last = this.f(a);
    this.pushToChildren(this.last);
  }
  pull(): B {
    const newVal = this.parent.at();
    if (this.oldVal !== newVal) {
      this.oldVal = newVal;
      this.cached = this.f(newVal);
    }
    return this.cached;
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
  push(): void {
    const fn = at(this.fn);
    const val = at(this.val);
    this.last = fn(val);
    this.pushToChildren(this.last);
  }
  pull(): B {
    return this.fn.at()(this.val.at());
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

class ChainOuter<A> extends Behavior<A> {
  node = new Node(this);
  constructor(
    public child: ChainBehavior<A, any>,
    public parent: Behavior<any>
  ) {
    super();
    this.parents = cons(parent);
  }
  push(a: A): void {
    this.child.pushOuter(a);
  }
}

class ChainBehavior<A, B> extends Behavior<B> {
  // The last behavior returned by the chain function
  private innerB: Behavior<B>;
  private innerNode = new Node(this);
  private outerConsumer: ChainOuter<A>;
  constructor(private outer: Behavior<A>, private fn: (a: A) => Behavior<B>) {
    super();
    // Create the outer consumer
    this.outerConsumer = new ChainOuter(this, outer);
    this.parents = cons(this.outerConsumer);
  }
  activate(): void {
    // Make the consumers listen to inner and outer behavior
    this.outer.addListener(this.outerConsumer.node);
    if (this.outer.state === State.Push) {
      this.innerB = this.fn(this.outer.at());
      this.innerB.addListener(this.innerNode);
      this.state = this.innerB.state;
      this.last = at(this.innerB);
    }
  }
  pushOuter(a: A): void {
    // The outer behavior has changed. This means that we will have to
    // call our function, which will result in a new inner behavior.
    // We therefore stop listening to the old inner behavior and begin
    // listening to the new one.
    if (this.innerB !== undefined) {
      this.innerB.removeListener(this.innerNode);
    }
    const newInner = (this.innerB = this.fn(a));
    newInner.addListener(this.innerNode);
    this.state = newInner.state;
    this.changeStateDown(this.state);
    if (this.state === State.Push) {
      this.push(newInner.at());
    }
  }
  push(b: B): void {
    this.last = b;
    this.pushToChildren(this.last);
  }
  pull(): B {
    return this.fn(this.outer.at()).at();
  }
}

/** @private */
class WhenBehavior extends Behavior<Future<{}>> {
  constructor(private parent: Behavior<boolean>) {
    super();
    this.push(at(parent));
  }
  push(val: boolean): void {
    if (val === true) {
      this.last = Future.of({});
    } else {
      this.last = new BehaviorFuture(this.parent);
    }
  }
  pull(): Future<{}> {
    return this.last;
  }
}

export function when(b: Behavior<boolean>): Behavior<Future<{}>> {
  return new WhenBehavior(b);
}

// FIXME: This can probably be made less ugly.
/** @private */
class SnapshotBehavior<A> extends Behavior<Future<A>> {
  private afterFuture: boolean;
  private node = new Node(this);
  constructor(private parent: Behavior<A>, future: Future<any>) {
    super();
    if (future.state === State.Done) {
      // Future has occurred at some point in the past
      this.afterFuture = true;
      this.state = parent.state;
      parent.addListener(this.node);
      this.last = Future.of(at(parent));
    } else {
      this.afterFuture = false;
      this.state = State.Push;
      this.last = F.sinkFuture<A>();
      future.addListener(this.node);
    }
  }
  push(val: any): void {
    if (this.afterFuture === false) {
      // The push is coming from the Future, it has just occurred.
      this.afterFuture = true;
      this.last.resolve(at(this.parent));
      this.parent.addListener(this.node);
    } else {
      // We are receiving an update from `parent` after `future` has
      // occurred.
      this.last = Future.of(val);
    }
  }
  pull(): Future<A> {
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
  changePullers(): void {}
}

export abstract class StatefulBehavior<A> extends ActiveBehavior<A> {
  constructor(protected a: any, protected b?: any, protected c?: any) {
    super();
    this.state = State.OnlyPull;
  }
}

export class ConstantBehavior<A> extends ActiveBehavior<A> {
  constructor(public last: A) {
    super();
    this.state = State.Push;
  }
  semantic(): SemanticBehavior<A> {
    return (_) => this.last;
  }
}

/** @private */
export class FunctionBehavior<A> extends ActiveBehavior<A> {
  constructor(private fn: () => A) {
    super();
    this.state = State.OnlyPull;
  }
  pull(): A {
    return this.fn();
  }
}

export function fromFunction<B>(fn: () => B): Behavior<B> {
  return new FunctionBehavior(fn);
}

/** @private */
class SwitcherBehavior<A> extends ActiveBehavior<A> {
  node = new Node(this);
  constructor(
    private b: Behavior<A>,
    next: Future<Behavior<A>> | Stream<Behavior<A>>
  ) {
    super();
    b.addListener(this.node);
    this.state = b.state;
    if (this.state === State.Push) {
      this.last = at(b);
    }
    // FIXME: Using `bind` is hardly optimal for performance.
    next.subscribe(this.doSwitch.bind(this));
  }
  push(val: A): void {
    this.last = val;
    this.pushToChildren(this.last);
  }
  pull(): A {
    return at(this.b);
  }
  private doSwitch(newB: Behavior<A>): void {
    this.b.removeListener(this.node);
    this.b = newB;
    newB.addListener(this.node);
    const newState = newB.state;
    if (newState === State.Push) {
      this.push(newB.at());
    }
    this.state = newState;
    this.changeStateDown(this.state);
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
  return new SwitcherBehavior(init, next);
}

export function switcher<A>(
  init: Behavior<A>,
  stream: Stream<Behavior<A>>
): Behavior<Behavior<A>> {
  return fromFunction(() => new SwitcherBehavior(init, stream));
}

class TestBehavior<A> extends Behavior<A> {
  constructor(private semanticBehavior: SemanticBehavior<A>) {
    super();
  }
  semantic(): SemanticBehavior<A> {
    return this.semanticBehavior;
  }
}

export function testBehavior<A>(b: SemanticBehavior<A>): Behavior<A> {
  return new TestBehavior(b);
}

/** @private */
class ActiveScanBehavior<A, B> extends ActiveBehavior<B> {
  node = new Node(this);
  constructor(
    private f: (a: A, b: B) => B,
    public last: B,
    private parent: Stream<A>
  ) {
    super();
    this.state = State.Push;
    parent.addListener(this.node);
  }
  push(val: A): void {
    this.last = this.f(val, this.last);
    this.pushToChildren(this.last);
  }
}

class ScanBehavior<A, B> extends StatefulBehavior<Behavior<B>> {
  pull(): Behavior<B> {
    return new ActiveScanBehavior(this.a, this.b, this.c);
  }
  semantic(): SemanticBehavior<Behavior<B>> {
    const stream = this.c.semantic();
    return (t1) =>
      testBehavior<B>((t2) =>
        stream
          .filter(({ time }) => t1 <= time && time <= t2)
          .map((o) => o.value)
          .reduce((acc, cur) => this.a(cur, acc), this.b)
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

class IndexReactive<A> extends Reactive<A> {
  constructor(private index: number, parent: Reactive<A>) {
    super();
    this.parents = cons(parent);
  }
  push(a: A): void {
    for (const child of this.children) {
      (<any>child).pushIdx(a, this.index);
    }
  }
}

class ActiveScanCombineBehavior<A> extends ActiveBehavior<A> {
  private nodes: Node<any>[] = [];
  private accumulators: ((a: any, b: A) => A)[];
  constructor(streams: ScanPair<A>[], public last: A) {
    super();
    this.state = State.Push;
    this.accumulators = [];
    for (let i = 0; i < streams.length; ++i) {
      const [s, f] = streams[i];
      this.accumulators.push(f);
      const node = new Node(this);
      this.nodes.push(node);
      const indexReactive = new IndexReactive(i, s);
      indexReactive.addListener(node);
      this.parents = cons(indexReactive, this.parents);
    }
  }
  pushIdx(a: A, index: number): void {
    this.last = this.accumulators[index](a, this.last);
    this.pushToChildren(this.last);
  }
}

class ScanCombineBehavior<B> extends StatefulBehavior<Behavior<B>> {
  pull(): Behavior<B> {
    return new ActiveScanCombineBehavior(this.a, this.b);
  }
}

export type ScanPair<A> = [Stream<any>, (a: any, b: A) => A];

export function scanCombine<B>(
  pairs: ScanPair<B>[],
  initial: B
): Behavior<Behavior<B>> {
  return new ScanCombineBehavior<B>(pairs, initial);
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
  push(): void {
    if (this.listenerNodes !== undefined) {
      for (const { node, parent } of this.listenerNodes) {
        parent.removeListener(node);
      }
    }
    this.parents = undefined;
    this.last = this.f(this.sampleBound);
    this.pushToChildren(this.last);
  }
  sample<B>(b: Behavior<B>): B {
    const node = new Node(this);
    this.listenerNodes = cons({ node, parent: b }, this.listenerNodes);
    b.addListener(node);

    this.parents = cons(b, this.parents);
    return b.at();
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
  pull(): string {
    let resultString = this.strings[0];
    for (let i = 0; i < this.behaviors.length; ++i) {
      resultString += at(this.behaviors[i]) + this.strings[i + 1];
    }
    return (this.last = resultString);
  }
}

export function format(
  strings: TemplateStringsArray,
  ...behaviors: Behavior<string | number>[]
): Behavior<string> {
  return new FormatBehavior(strings, behaviors);
}
