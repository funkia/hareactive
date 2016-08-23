import {Consumer} from "./frp-common";
import {Behavior} from "./Behavior";

/**
 * A future is a thing that occurs at some point in time with a value.
 * It can be understood as a pair consisting of the time the future
 * occurs and its associated value. It is quite like a JavaScript
 * promise.
 */
export abstract class Future<A> implements Consumer<any> {
  // Flag indicating wether or not this future has occured.
  public occured: boolean;
  // The value of the future. Often `undefined` until occurence.
  public value: A;
  // The consumers that depends on this producer. These should be
  // notified when the producer has a value.
  protected listeners: Consumer<A>[];
  constructor() {
    this.listeners = [];
  }
  public listen(o: Consumer<A>): void {
    if (this.occured !== true) {
      this.listeners.push(o);
    } else {
      o.push(this.value);
    }
  }
  public subscribe(f: (a: A) => void): Subscribtion<A> {
    return new Subscribtion(f, this);
  }
  // `push` is called by the parent of a future once it resolves with
  // a value.
  public abstract push(val: any): void;
  public resolve(val: A): void {
    this.occured = true;
    this.value = val;
    const listeners = this.listeners;
    for (let i = 0, l = listeners.length; i < l; ++i) {
      listeners[i].push(val);
    }
  }
  // A future is a functor, when the future occurs we can feed is't
  // result through the mapping function
  public map<B>(f: (a: A) => B): Future<B> {
    return new MapFuture(f, this);
  }
  public mapTo<B>(b: B): Future<B> {
    return new MapToFuture<B>(b, this);
  }
  // A future is an applicative. `of` gives a future that has always
  // occured at all points in time.
  public static of<B>(b: B): Future<B> {
    return new PureFuture(b);
  }
  public of<B>(b: B): Future<B> {
    return new PureFuture(b);
  }
  public static lift<T1, R>(f: (t: T1) => R, m: Future<T1>): Future<R>;
  public static lift<T1, T2, R>(f: (t: T1, u: T2) => R, m1: Future<T1>, m2: Future<T2>): Future<R>;
  public static lift<T1, T2, T3, R>(f: (t1: T1, t2: T2, t3: T3) => R, m1: Future<T1>, m2: Future<T2>, m3: Future<T3>): Future<R>;
  public static lift(f: any, ...args: Future<any>[]): any {
    return f.length === 1 ? new MapFuture(f, args[0])
                          : new LiftFuture(f, args);
  }
  // A future is a monad. Once the first future occurs `chain` passes
  // its value through the chain function and the future it returns is
  // the one returned by `chain`.
  public chain<B>(f: (a: A) => Future<B>): Future<B> {
    return new ChainFuture(f, this);
  }
}

class MapFuture<A, B> extends Future<B> {
  constructor(private f: (a: A) => B, private parent: Future<A>) {
    super();
    parent.listen(this);
  }
  public push(val: any): void {
    this.resolve(this.f(val));
  }
}

class MapToFuture<A> extends Future<A> {
  constructor(public value: A, private parent: Future<any>) {
    super();
    parent.listen(this);
  }
  public push(_: any): void {
    this.resolve(this.value);
  }
}

class PureFuture<A> extends Future<A> {
  constructor(public value: A) {
    super();
    this.occured = true;
  }
  public push(_: any): void {
    throw new Error("A PureFuture should never be pushed to.");
  }
}

class LiftFuture<A> extends Future<A> {
  private delivered: number = 0;
  private dependencies: number;
  constructor(private f: Function, private futures: Future<any>[]) {
    super();
    const l = this.dependencies = futures.length;
    for (let i = 0; i < l; ++i) {
      futures[i].listen(this);
    }
  }
  public push(_: any): void {
    const l = this.dependencies;
    if (++this.delivered === l) {
      // All the dependencies have occurred.
      for (let i = 0; i < l; ++i) {
        this.futures[i] = this.futures[i].value;
      }
      this.resolve(this.f.apply(undefined, this.futures));
    }
  }
}

class ChainFuture<A, B> extends Future<B> {
  private parentOccurred: boolean = false;
  constructor(private f: (a: A) => Future<B>, private parent: Future<A>) {
    super();
    parent.listen(this);
  }
  public push(val: any): void {
    if (this.parentOccurred === false) {
      // The first future occured. We can now call `f` with it's value
      // and listen to the future it returns.
      this.parentOccurred = true;
      const newFuture = this.f(val);
      newFuture.listen(this);
    } else {
      this.resolve(val);
    }
  }
}

// I Sink is a producer that one can imperatively resolve.
class Sink<A> extends Future<A> {
  public push(val: any): void {
    throw new Error("A sink should never be pushed to.");
  }
}

export function sink<A>(): Future<A> {
  return new Sink<A>();
}

// A subscribtion is a consumer that performs a side
class Subscribtion<A> implements Consumer<A> {
  constructor(private f: (a: A) => void, private parent: Future<A>) {
    parent.listen(this);
  }
  public push(a: A): void {
    this.f(a); // let `f` perform its side-effect.
  }
}

export function fromPromise<A>(p: Promise<A>): Future<A> {
  const future = sink<A>();
  p.then(future.push.bind(future));
  return future;
}

/**
 * Create a future from a pushing behavior. The future occurs when the
 * behavior pushes it's next value. Constructing a BehaviorFuture is
 * impure and should not be done direcly.
 * @private
 */
export class BehaviorFuture<A> extends Future<A> {
  constructor(private b: Behavior<A>) {
    super();
    b.listen(this);
  }
  public push(a: A): void {
    this.b.unlisten(this);
    this.resolve(a);
  }
}

export const of = Future.of;

export const lift = Future.lift;
