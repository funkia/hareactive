import { monad, Monad, Semigroup } from "@funkia/jabz";
import { State } from "./common";
import { Observer, Reactive } from "./common";
import { cons, fromArray, Node } from "./datastructures";
import { Behavior } from "./behavior";

export interface Consumer<A> {
  push(a: A): void;
}

export type SemanticFuture<A> = { time: number; value: A };

/**
 * A future is a thing that occurs at some point in time with a value.
 * It can be understood as a pair consisting of the time the future
 * occurs and its associated value. It is quite like a JavaScript
 * promise.
 */
@monad
export abstract class Future<A> extends Reactive<A>
  implements Semigroup<Future<A>>, Monad<A> {
  // The value of the future. Often `undefined` until occurrence.
  value: A;
  constructor() {
    super();
  }
  abstract push(val: any): void;
  pull(): A {
    throw new Error("Pull not implemented on future");
  }
  resolve(val: A): void {
    this.deactivate(true);
    this.value = val;
    this.pushToChildren(val);
  }
  addListener(node: Node<Observer<A>>): State {
    if (this.state === State.Done) {
      node.value.push(this.value);
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
  abstract semantic(): SemanticFuture<A>;
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
  push(val: A): void {
    this.resolve(val);
  }
  semantic(): SemanticFuture<A> {
    const a = this.future1.semantic();
    const b = this.future2.semantic();
    return a.time <= b.time ? a : b;
  }
}

class MapFuture<A, B> extends Future<B> {
  constructor(private f: (a: A) => B, private parent: Future<A>) {
    super();
    this.parents = cons(parent);
  }
  push(val: any): void {
    this.resolve(this.f(val));
  }
  semantic(): SemanticFuture<B> {
    const { time, value } = this.parent.semantic();
    return { time, value: this.f(value) };
  }
}

class MapToFuture<A> extends Future<A> {
  constructor(public value: A, private parent: Future<any>) {
    super();
    this.parents = cons(parent);
  }
  push(_: any): void {
    this.resolve(this.value);
  }
  semantic(): SemanticFuture<A> {
    const { time } = this.parent.semantic();
    return { time, value: this.value };
  }
}

class OfFuture<A> extends Future<A> {
  constructor(public value: A) {
    super();
    this.state = State.Done;
  }
  /* istanbul ignore next */
  push(_: any): void {
    throw new Error("A PureFuture should never be pushed to.");
  }
  semantic(): SemanticFuture<A> {
    return { time: -Infinity, value: this.value };
  }
}

class LiftFuture<A> extends Future<A> {
  private missing: number;
  constructor(private f: Function, private futures: Future<any>[]) {
    super();
    this.missing = futures.length;
    this.parents = fromArray(futures);
  }
  push(_: any): void {
    if (--this.missing === 0) {
      // All the dependencies have occurred.
      for (let i = 0; i < this.futures.length; ++i) {
        this.futures[i] = this.futures[i].value;
      }
      this.resolve(this.f.apply(undefined, this.futures));
    }
  }
  semantic(): SemanticFuture<A> {
    const sems = this.futures.map((f) => f.semantic());
    const time = Math.max(...sems.map((s) => s.time));
    return { time, value: this.f(...sems.map((s) => s.value)) };
  }
}

class ChainFuture<A, B> extends Future<B> {
  private parentOccurred: boolean = false;
  private node = new Node(this);
  constructor(private f: (a: A) => Future<B>, private parent: Future<A>) {
    super();
    this.parents = cons(parent);
  }
  push(val: any): void {
    if (this.parentOccurred === false) {
      // The first future occurred. We can now call `f` with its value
      // and listen to the future it returns.
      this.parentOccurred = true;
      const newFuture = this.f(val);
      newFuture.addListener(this.node);
    } else {
      this.resolve(val);
    }
  }
  semantic(): SemanticFuture<B> {
    const a = this.parent.semantic();
    const b = this.f(a.value).semantic();
    return { time: Math.max(a.time, b.time), value: b.value };
  }
}

/**
 * A Sink is a producer that one can imperatively resolve.
 * @private
 */
export class SinkFuture<A> extends Future<A> {
  /* istanbul ignore next */
  push(val: any): void {
    throw new Error("A sink should not be pushed to.");
  }
  activate(): void {}
  deactivate(): void {}
  semantic(): never {
    throw new Error("The SinkFuture does not have a semantic representation");
  }
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
export class BehaviorFuture<A> extends SinkFuture<A> implements Observer<A> {
  node = new Node(this);
  constructor(private b: Behavior<A>) {
    super();
    b.addListener(this.node);
  }
  /* istanbul ignore next */
  changeStateDown(): void {
    throw new Error("Behavior future does not support pushing behavior");
  }
  push(a: A): void {
    this.b.removeListener(this.node);
    this.resolve(a);
  }
  semantic(): never {
    throw new Error(
      "The BehaviorFuture does not have a semantic representation"
    );
  }
}
