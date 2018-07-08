import { monad, Monad, Semigroup } from "@funkia/jabz";
import { State, SListener, Parent, BListener } from "./common";
import { Reactive } from "./common";
import { cons, fromArray, Node } from "./datastructures";
import { Behavior } from "./behavior";
import { tick } from "./timestamp";

/**
 * A future is a thing that occurs at some point in time with a value.
 * It can be understood as a pair consisting of the time the future
 * occurs and its associated value. It is quite like a JavaScript
 * promise.
 */
@monad
export abstract class Future<A> extends Reactive<A, SListener<A>>
  implements Semigroup<Future<A>>, Monad<A>, Parent<SListener<any>> {
  // The value of the future. Often `undefined` until occurrence.
  value: A;
  constructor() {
    super();
  }
  abstract pushS(t: number, val: any): void;
  pull(): A {
    throw new Error("Pull not implemented on future");
  }
  resolve(val: A, t = tick()): void {
    this.deactivate(true);
    this.value = val;
    this.pushSToChildren(t, val);
  }
  pushSToChildren(t: number, val: A) {
    for (const child of this.children) {
      child.pushS(t, val);
    }
  }
  addListener(node: Node<SListener<A>>): State {
    if (this.state === State.Done) {
      node.value.pushS(0, this.value);
      return State.Done;
    } else {
      return super.addListener(node);
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
  ap: <B>(f: Future<(a: A) => B>) => Future<B>;
  lift<T1, R>(f: (t: T1) => R, m: Future<T1>): Future<R>;
  lift<T1, T2, R>(
    f: (t: T1, u: T2) => R,
    m1: Future<T1>,
    m2: Future<T2>
  ): Future<R>;
  lift<T1, T2, T3, R>(
    f: (t1: T1, t2: T2, t3: T3) => R,
    m1: Future<T1>,
    m2: Future<T2>,
    m3: Future<T3>
  ): Future<R>;
  lift(f: any, ...args: Future<any>[]): any {
    return f.length === 1 ? new MapFuture(f, args[0]) : new LiftFuture(f, args);
  }
  static multi: false;
  multi: false = false;
  // A future is a monad. Once the first future occurs `chain` passes
  // its value through the chain function and the future it returns is
  // the one returned by `chain`.
  chain<B>(f: (a: A) => Future<B>): Future<B> {
    return new ChainFuture(f, this);
  }
  flatten: <B>() => Future<B>;
}

class CombineFuture<A> extends Future<A> {
  constructor(private future1: Future<A>, private future2: Future<A>) {
    super();
    this.parents = cons(future1, cons(future2));
  }
  pushS(t: number, val: A): void {
    this.resolve(val);
  }
}

class MapFuture<A, B> extends Future<B> {
  constructor(private f: (a: A) => B, parent: Future<A>) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, val: A): void {
    this.resolve(this.f(val), t);
  }
}

class MapToFuture<A> extends Future<A> {
  constructor(public value: A, parent: Future<any>) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: any, _val: any): void {
    this.resolve(this.value, t);
  }
}

class OfFuture<A> extends Future<A> {
  constructor(public value: A) {
    super();
    this.state = State.Done;
  }
  /* istanbul ignore next */
  pushS(_: any): void {
    throw new Error("A PureFuture should never be pushed to.");
  }
}

class LiftFuture<A> extends Future<A> {
  private missing: number;
  constructor(private f: Function, private futures: Future<any>[]) {
    super();
    this.missing = futures.length;
    this.parents = fromArray(futures);
  }
  pushS(t: number, _val: any): void {
    if (--this.missing === 0) {
      // All the dependencies have occurred.
      for (let i = 0; i < this.futures.length; ++i) {
        this.futures[i] = this.futures[i].value;
      }
      this.resolve(this.f.apply(undefined, this.futures), t);
    }
  }
}

class ChainFuture<A, B> extends Future<B> implements SListener<A> {
  private parentOccurred: boolean = false;
  private node = new Node(this);
  constructor(private f: (a: A) => Future<B>, private parent: Future<A>) {
    super();
    this.parents = cons(parent);
  }
  pushS(t: number, val: any): void {
    if (this.parentOccurred === false) {
      // The first future occurred. We can now call `f` with its value
      // and listen to the future it returns.
      this.parentOccurred = true;
      const newFuture = this.f(val);
      newFuture.addListener(this.node);
    } else {
      this.resolve(val, t);
    }
  }
}

/**
 * A Sink is a producer that one can imperatively resolve.
 * @private
 */
export class SinkFuture<A> extends Future<A> {
  /* istanbul ignore next */
  pushS(t: number, val: any): void {
    throw new Error("A sink should not be pushed to.");
  }
  activate(): void {}
  deactivate(): void {}
}

export function sinkFuture<A>(): Future<A> {
  return new SinkFuture<A>();
}

export function fromPromise<A>(p: Promise<A>): Future<A> {
  const future = sinkFuture<A>();
  p.then(future.resolve.bind(future));
  return future;
}

/**
 * Create a future from a pushing behavior. The future occurs when the
 * behavior pushes its next value. Constructing a BehaviorFuture is
 * impure and should not be done directly.
 * @private
 */
export class BehaviorFuture<A> extends SinkFuture<A> implements BListener {
  node = new Node(this);
  constructor(private b: Behavior<A>) {
    super();
    b.addListener(this.node);
  }
  /* istanbul ignore next */
  changeStateDown(state: State): void {
    throw new Error("Behavior future does not support pulling behavior");
  }
  pushB(t: number): void {
    this.b.removeListener(this.node);
    this.resolve(this.b.last, t);
  }
}
