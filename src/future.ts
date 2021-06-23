import { State, SListener, Parent, BListener, Time, __UNSAFE_GET_LAST_BEHAVIOR_VALUE } from "./common";
import { Reactive } from "./common";
import { cons, fromArray, Node } from "./datastructures";
import {
  Behavior,
  FunctionBehavior
} from "./behavior";
import { tick } from "./clock";
import { Stream } from "./stream";
import { sample, Now } from "./now";

export type MapFutureTuple<A> = { [K in keyof A]: Future<A[K]> };

const __UNSAFE_GET_LAST_FUTURE_VALUE = <A>(f: Future<A>): A => {
  if (f.value === undefined) {
    // panic!
    throw new Error("Future#value should be defined");
  }
  return f.value;
};
/**
 * A future is a thing that occurs at some point in time with a value.
 * It can be understood as a pair consisting of the time the future
 * occurs and its associated value. It is quite like a JavaScript
 * promise.
 */
export abstract class Future<A> extends Reactive<A, SListener<A>>
  implements Parent<SListener<unknown>> {
  // The value of the future. Often `undefined` until occurrence.
  value?: A;
  constructor() {
    super();
  }
  abstract pushS(t: number, val: unknown): void;
  pull(): A {
    throw new Error("Pull not implemented on future");
  }
  resolve(val: A, t: Time = tick()): void {
    this.deactivate(true);
    this.value = val;
    this.pushSToChildren(t, val);
  }
  pushSToChildren(t: number, val: A): void {
    for (const child of this.children) {
      child.pushS(t, val);
    }
  }
  addListener(node: Node<SListener<A>>, t: number): State {
    if (this.state === State.Done) {
      node.value.pushS(t, __UNSAFE_GET_LAST_FUTURE_VALUE(this));
      return State.Done;
    } else {
      return super.addListener(node, t);
    }
  }
  combine(future: Future<A>): Future<A> {
    return new CombineFuture(this, future);
  }
  // A future is a functor, when the future occurs we can feed its
  // result through the mapping function
  map<B>(f: (a: A) => B): Future<B> {
    return new MapFuture(f, this);
  }
  mapTo<B>(b: B): Future<B> {
    return new MapToFuture<B>(b, this);
  }
  // A future is an applicative. `of` gives a future that has always
  // occurred at all points in time.
  static of<B>(b: B): Future<B> {
    return new OfFuture(b);
  }
  of<B>(b: B): Future<B> {
    return new OfFuture(b);
  }
  // ap: <B>(f: Future<(a: A) => B>) => Future<B>;
  lift<A extends unknown[], R>(
    f: (...args: A) => R,
    ...args: MapFutureTuple<A>
  ): Future<R> {
    return args.length === 1
      ? new MapFuture(f as any, args[0])
      : new LiftFuture(f, args);
  }
  static multi: false;
  multi: false = false;
  // A future is a monad. Once the first future occurs `flatMap` passes its
  // value through the function and the future it returns is the one returned by
  // `flatMap`.
  flatMap<B>(f: (a: A) => Future<B>): Future<B> {
    return new FlatMapFuture(f, this);
  }
  chain<B>(f: (a: A) => Future<B>): Future<B> {
    return new FlatMapFuture(f, this);
  }
  flat<B>(this: Future<Future<B>>): Future<B> {
    return new FlatMapFuture((f) => f, this);
  }
}

export function isFuture(a: unknown): a is Future<unknown> {
  return typeof a === "object" && a !== null && "resolve" in a;
}

export class CombineFuture<A> extends Future<A> {
  constructor(readonly parentA: Future<A>, readonly parentB: Future<A>) {
    super();
    this.parents = cons(parentA, cons(parentB));
  }
  pushS(t: number, val: A): void {
    this.resolve(val, t);
  }
}

export class MapFuture<A, B> extends Future<B> {
  constructor(private f: (a: A) => B, readonly parent: Future<A>) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, val: A): void {
    this.resolve(this.f(val), t);
  }
}

export class MapToFuture<A> extends Future<A> {
  constructor(public value: A, readonly parent: Future<unknown>) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: Time): void {
    this.resolve(this.value, t);
  }
}

export class OfFuture<A> extends Future<A> {
  constructor(public value: A) {
    super();
    this.state = State.Done;
  }
  /* istanbul ignore next */
  pushS(): void {
    throw new Error("A PureFuture should never be pushed to.");
  }
}

export class NeverFuture extends Future<never> {
  constructor() {
    super();
    this.state = State.Done;
  }
  addListener(): State {
    return State.Done;
  }
  /* istanbul ignore next */
  pushS(): void {
    throw new Error("A NeverFuture should never be pushed to.");
  }
}

export const never = new NeverFuture();

/** For stateful futures that are always active */
export abstract class ActiveFuture<A> extends Future<A> {
  constructor() {
    super();
    this.state = State.Push;
  }
  activate(): void {}
}

export class LiftFuture<A> extends Future<A> {
  private missing: number;
  constructor(private f: Function, private futures: Future<any>[]) {
    super();
    this.missing = futures.length;
    this.parents = fromArray(futures);
  }
  pushS(t: Time): void {
    if (--this.missing === 0) {
      // All the dependencies have occurred.
      for (let i = 0; i < this.futures.length; ++i) {
        this.futures[i] = this.futures[i].value;
      }
      this.resolve(this.f.apply(undefined, this.futures), t);
    }
  }
}

export class FlatMapFuture<A, B> extends Future<B> implements SListener<A> {
  private parentOccurred = false;
  private node: Node<this> = new Node(this);
  constructor(private f: (a: A) => Future<B>, readonly parent: Future<A>) {
    super();
    this.parents = cons(parent);
  }
  //FIXME: remove any by splitting listeners to accept A and forward it to B through f
  pushS(t: number, val: any): void {
    if (this.parentOccurred === false) {
      // The first future occurred. We can now call `f` with its value
      // and listen to the future it returns.
      this.parentOccurred = true;
      const newFuture = this.f(val);
      newFuture.addListener(this.node, t);
    } else {
      this.resolve(val, t);
    }
  }
}

/**
 * A Sink is a producer that one can imperatively resolve.
 * @private
 */
export class SinkFuture<A> extends ActiveFuture<A> {
  /* istanbul ignore next */
  pushS(): void {
    throw new Error("A sink should not be pushed to.");
  }
}

export function sinkFuture<A>(): Future<A> {
  return new SinkFuture<A>();
}

export function fromPromise<A>(promise: Promise<A>): Future<A> {
  const future = sinkFuture<A>();
  promise.then(future.resolve.bind(future));
  return future;
}

export function toPromise<A>(future: Future<A>): Promise<A> {
  return new Promise((resolve, _reject) => {
    future.subscribe(resolve);
  });
}

/**
 * Create a future from a pushing behavior. The future occurs when the
 * behavior pushes its next value. Constructing a BehaviorFuture is
 * impure and should not be done directly.
 * @private
 */
export class BehaviorFuture<A> extends SinkFuture<A> implements BListener {
  node: Node<this> = new Node(this);
  constructor(private b: Behavior<A>) {
    super();
    b.addListener(this.node, tick());
  }
  /* istanbul ignore next */
  changeStateDown(_state: State): void {
    throw new Error("Behavior future does not support pulling behavior");
  }
  pushB(t: number): void {
    this.b.removeListener(this.node);
    this.resolve(__UNSAFE_GET_LAST_BEHAVIOR_VALUE(this.b), t);
  }
}

export class NextOccurrenceFuture<A> extends Future<A> implements SListener<A> {
  constructor(readonly s: Stream<A>, readonly time: Time) {
    super();
    this.parents = cons(s);
  }
  pushS(t: Time, val: A): void {
    this.resolve(val, t);
  }
}

export function nextOccurrenceFrom<A>(stream: Stream<A>): Behavior<Future<A>> {
  return new FunctionBehavior((t: Time) => new NextOccurrenceFuture(stream, t));
}

export function nextOccurrence<A>(stream: Stream<A>): Now<Future<A>> {
  return sample(nextOccurrenceFrom(stream));
}

class MapCbFuture<A, B> extends ActiveFuture<B> {
  node: Node<this> = new Node(this);
  doneCb = (result: B): void => this.resolve(result);
  constructor(
    private cb: (value: A, done: (result: B) => void) => void,
    parent: Future<A>
  ) {
    super();
    this.parents = cons(parent);
    parent.addListener(this.node, tick());
  }
  pushS(_: number, value: A): void {
    this.cb(value, this.doneCb);
  }
}

/**
 * Invokes the callback when the future occurs.
 *
 * This function is intended to be a low-level function used as the
 * basis for other operators.
 */
export function mapCbFuture<A, B>(
  cb: (value: A, done: (result: B) => void) => void,
  future: Future<A>
): Future<B> {
  return new MapCbFuture(cb, future);
}
