/** @module hareactive/behavior */

import {Monad, monad} from "jabz/monad";
import {
  Consumer, Reactive, Observer, MultiObserver, noopObserver
} from "./frp-common";

import {Future, BehaviorFuture} from "./future";
import * as F from "./future";
import {Stream} from "./stream";

class IncompleteObserver<A> implements Observer<A> {
  beginPulling(): void {
    throw new Error("beginPulling not implemented");
  }
  endPulling(): void {
    throw new Error("beginPushing not implemented");
  }
  push(a: A): void {
    throw new Error("push not implemented");
  }
}

class OnlyPushObserver<A> implements Observer<A> {
  constructor(private cb: (a: A) => void) {};
  beginPulling(): void {}
  endPulling(): void {}
  push(a: A): void {
    this.cb(a);
  }
}

/**
 * A behavior is a value that changes over time. Conceptually it can
 * be though of as a function from time to a value. I.e. `type
 * Behavior<A> = (t: Time) => A`.
 */
@monad
export abstract class Behavior<A> implements Observer<A>, Monad<A> {
  // Behaviors that a pushing caches their last value in `last`. For
  // behaviors that pull `last` is unused.
  pushing: boolean;
  last: A;
  nrOfListeners: number;
  child: Observer<any>;

  abstract push(a: any): void;
  abstract pull(): A;

  constructor() {
    this.child = noopObserver;
    this.nrOfListeners = 0;
  }
  map<B>(fn: (a: A) => B): Behavior<B> {
    const newB = new MapBehavior<A, B>(this, fn);
    this.addListener(newB);
    return newB;
  }
  mapTo<A>(v: A): Behavior<A> {
    return of(v);
  }
  of<A>(v: A): Behavior<A> {
    return of(v);
  }
  static of<A>(v: A): Behavior<A> {
    return of(v);
  };
  ap<B>(f: Behavior<(a: A) => B>): Behavior<B> {
    const newB = new ApBehavior<A, B>(f, this);
    f.addListener(newB);
    this.addListener(newB);
    return newB;
  }
  lift<T1, R>(f: (t: T1) => R, m: Behavior<T1>): Behavior<R>;
  lift<T1, T2, R>(f: (t: T1, u: T2) => R, m1: Behavior<T1>, m2: Behavior<T2>): Behavior<R>;
  lift<T1, T2, T3, R>(f: (t1: T1, t2: T2, t3: T3) => R, m1: Behavior<T1>, m2: Behavior<T2>, m3: Behavior<T3>): Behavior<R>;
  lift(/* arguments */): any {
    // TODO: Experiment with faster specialized `lift` implementation
    const f = arguments[0];
    switch (arguments.length - 1) {
    case 1:
      return arguments[1].map(f);
    case 2:
      return arguments[2].ap(arguments[1].map((a: any) => (b: any) => f(a, b)));
    case 3:
      return arguments[3].ap(arguments[2].ap(arguments[1].map(
        (a: any) => (b: any) => (c: any) => f(a, b, c)
      )));
    }
  }
  chain<B>(fn: (a: A) => Behavior<B>): Behavior<B> {
    return new ChainBehavior<A, B>(this, fn);
  }
  flatten: <B>() => Behavior<B>;
  endPulling(): void {
    this.pushing = true;
    this.child.endPulling();
  }
  beginPulling(): void {
    this.pushing = false;
    this.child.beginPulling();
  }
  subscribe(cb: (a: A) => void): Observer<A> {
    const listener = new OnlyPushObserver(cb);
    this.addListener(listener);
    return listener;
  }
  addListener(c: Observer<A>): void {
    const nr = ++this.nrOfListeners;
    if (nr === 1) {
      this.child = c;
    } else if (nr === 2) {
      this.child = new MultiObserver(this.child, c);
    } else {
      (<MultiObserver<A>>this.child).listeners.push(c);
    }
  }
  removeListener(listener: Observer<any>): void {
    const nr = --this.nrOfListeners;
    if (nr === 0) {
      this.child = noopObserver;
    } else if (nr === 1) {
      const l = (<MultiObserver<A>>this.child).listeners;
      this.child = l[l[0] === listener ? 1 : 0];
    } else {
      const l = (<MultiObserver<A>>this.child).listeners;
      // The indexOf here is O(n), where n is the number of listeners,
      // if using a linked list it should be possible to perform the
      // unsubscribe operation in constant time.
      const idx = l.indexOf(listener);
      if (idx !== -1) {
        if (idx !== l.length - 1) {
          l[idx] = l[l.length - 1];
        }
        l.length--; // remove the last element of the list
      }
    }
  }
  static multi = false;
  multi = false;
}

export function of<B>(val: B): Behavior<B> {
  return new ConstantBehavior(val);
}

/*
 * Impure function that gets the current value of a behavior. For a
 * pure variant see `sample`.
 */
export function at<B>(b: Behavior<B>): B {
  return b.pushing === true ? b.last : b.pull();
}

/** @private */
class ConstantBehavior<A> extends Behavior<A> {
  constructor(public last: A) {
    super();
    this.pushing = true;
  }
  push(): void {
    throw new Error("Cannot push a value to a constant behavior");
  }
  pull(): A {
    return this.last;
  }
}

/** @private */
class MapBehavior<A, B> extends Behavior<B> {
  constructor(
    private parent: Behavior<any>,
    private fn: (a: A) => B
  ) {
    super();
    this.pushing = parent.pushing;
    if (this.pushing === true) {
      this.last = fn(at(parent));
    }
  }
  push(a: A): void {
    this.last = this.fn(a);
    this.child.push(this.last);
  }
  pull(): B {
    return this.fn(at(this.parent));
  }
}

/**
 * Map a function over a behavior. This means that if at some point in
 * time the value of `b` is `bVal` then the value of the returned
 * behavior is `fn(bVal)`.
 */
export function map<A, B>(fn: (a: A) => B , b: Behavior<A>): Behavior<B> {
  return b.map(fn);
}

/** @private */
class ChainOuter<A> extends IncompleteObserver<A> {
  constructor(private chainB: ChainBehavior<A, any>) {
    super();
  };
  push(a: A): void {
    this.chainB.pushOuter(a);
  }
}

/** @private */
class ChainBehavior<A, B> extends Behavior<B> {
  // The last behavior returned by the chain function
  private innerB: Behavior<B>;
  private outerConsumer: Observer<A>;
  // private innerConsumer: Consumer<B>;
  constructor(
    private outer: Behavior<A>,
    private fn: (a: A) => Behavior<B>
  ) {
    super();
    // Create the outer consumers
    this.outerConsumer = new ChainOuter(this);
    this.innerB = this.fn(at(this.outer));
    this.pushing = this.innerB.pushing;
    // Make the consumers listen to inner and outer behavior
    outer.addListener(this.outerConsumer);
    this.innerB.addListener(this);
    this.last = at(this.innerB);
  }

  pushOuter(a: A): void {
    // The outer behavior has changed. This means that we will have to
    // call our function, which will result in a new inner behavior.
    // We therefore stop listening to the old inner behavior and begin
    // listening to the new one.
    this.innerB.removeListener(this);
    const newInner = this.innerB = this.fn(a);
    newInner.addListener(this);
    this.push(at(newInner));
  }

  push(b: B): void {
    this.last = b;
    this.child.push(b);
  }

  pull(): B {
    return at(this.fn(at(this.outer)));
  }
}

/** @private */
class FunctionBehavior<A> extends Behavior<A> {
  constructor(private fn: () => A) {
    super();
    this.pushing = false;
  }

  push(v: A): void {
    throw new Error("Cannot push to a FunctionBehavior");
  }

  pull(): A {
    return this.fn();
  }
}

/** @private */
class ApBehavior<A, B> extends Behavior<B> {
  last: B;

  constructor(
    private fn: Behavior<(a: A) => B>,
    private val: Behavior<A>
  ) {
    super();
    this.pushing = fn.pushing && val.pushing;
    this.last = at(fn)(at(val));
  }

  push(): void {
    const fn = at(this.fn);
    const val = at(this.val);
    this.last = fn(val);
    this.child.push(this.last);
  }

  pull(): B {
    return at(this.fn)(at(this.val));
  }
}

/**
 * Apply a function valued behavior to a value behavior.
 *
 * @param fnB behavior of functions from `A` to `B`
 * @param valB A behavior of `A`
 * @returns Behavior of the function in `fnB` applied to the value in `valB`
 */
export function ap<A, B>(fnB: Behavior<(a: A) => B>, valB: Behavior<A>): Behavior<B> {
  return valB.ap(fnB);
}

/** @private */
class SinkBehavior<B> extends Behavior<B> {
  constructor(public last: B) {
    super();
    this.pushing = true;
  }
  push(v: B): void {
    if (this.last !== v) {
      this.last = v;
      this.child.push(v);
    }
  }
  pull(): B {
    return this.last;
  }
}

/**
 * Creates a behavior for imperative impure pushing.
 */
export function sink<A>(initialValue: A): Behavior<A> {
  return new SinkBehavior<A>(initialValue);
}

/**
 * A placeholder behavior is a behavior without any value. It is used
 * to do value recursion in `./framework.ts`.
 * @private
 */
export class PlaceholderBehavior<B> extends Behavior<B> {
  private source: Behavior<B>;

  constructor() {
    super();
    // `undefined` indicates that this behavior is neither pushing nor
    // pulling
    this.pushing = undefined;
  }
  push(v: B): void {
    this.last = v;
    this.child.push(v);
  }
  pull(): B {
    return this.source.pull();
  }
  replaceWith(b: Behavior<B>): void {
    this.source = b;
    b.addListener(this);
    this.pushing = b.pushing;
    if (b.pushing === true) {
      this.pushing = false;
      this.push(at(b));
    } else {
      this.beginPulling();
    }
  }
}

export function placeholder(): PlaceholderBehavior<any> {
  return new PlaceholderBehavior();
}

/** @private */
class WhenBehavior extends Behavior<Future<{}>> {
  constructor(private parent: Behavior<boolean>) {
    super();
    this.pushing = true;
    parent.addListener(this);
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

/**
 * Take a behavior `b` of booleans and return a behavior that for time
 * `t` contains a future that occurs when `b` is true after `t`.
 * @param b - A boolean valued behavior.
 */
export function when(b: Behavior<boolean>): Behavior<Future<{}>> {
  return new WhenBehavior(b);
}

// FIXME: This can probably be made less ugly.
/** @private */
class SnapshotBehavior<A> extends Behavior<Future<A>> {
  private afterFuture: boolean;
  constructor(private parent: Behavior<A>, future: Future<any>) {
    super();
    if (future.occured === true) {
      // Future has occurred at some point in the past
      this.afterFuture = true;
      this.pushing = parent.pushing;
      parent.addListener(this);
      this.last = Future.of(at(parent));
    } else {
      this.afterFuture = false;
      this.pushing = true;
      this.last = F.sink<A>();
      future.listen(this);
    }
  }
  push(val: any): void {
    if (this.afterFuture === false) {
      // The push is coming from the Future, it has just occurred.
      this.afterFuture = true;
      this.last.resolve(at(this.parent));
      this.parent.addListener(this);
    } else {
      // We are recieving an update from `parent` after `future` has
      // occurred.
      this.last = Future.of(val);
    }
  }
  pull(): Future<A> {
    return this.last;
  }
}

/**
 * Creates a future than on occurence samples the current value of the
 * behavior and occurs with that value. That is, the original value of
 * the future is overwritten with the behavior value at the time when
 * the future occurs.
 */
export function snapshot<A>(
  behavior: Behavior<A>,
  future: Future<any>
): Behavior<Future<A>> {
  return new SnapshotBehavior(behavior, future);
}

/** @private */
class SwitcherBehavior<A> extends Behavior<A> {
  constructor(private b: Behavior<A>, next: Future<Behavior<A>>) {
    super();
    this.pushing = b.pushing;
    if (this.pushing === true) {
      this.last = at(b);
    }
    b.addListener(this);
    // FIXME: Using `bind` is hardly optimal for performance.
    next.subscribe(this.doSwitch.bind(this));
  }
  push(val: A): void {
    this.last = val;
    this.child.push(val);
  }
  pull(): A {
    return at(this.b);
  }
  private doSwitch(newB: Behavior<A>): void {
    this.b.removeListener(this);
    this.b = newB;
    newB.addListener(this);
    if (newB.pushing === true) {
      if (this.pushing === false) {
        this.endPulling();
      }
      this.push(at(newB));
    } else if (this.pushing === true) {
      this.beginPulling();
    }
  }
}

/**
 * From an initial behavior and a future of a behavior `switcher`
 * creates a new behavior that acts exactly like `initial` until
 * `next` occurs after which it acts like the behavior it contains.
 */
export function switcher<A>(
  init: Behavior<A>,
  next: Future<Behavior<A>>
): Behavior<A> {
  return new SwitcherBehavior(init, next);
}

/** @private */
class StepperBehavior<B> extends Behavior<B> {
  constructor(initial: B, private steps: Stream<B>) {
    super();
    this.pushing = true;
    this.last = initial;
    steps.addListener(this);
  }

  push(val: B): void {
    this.last = val;
    this.child.push(val);
  }

  pull(): B {
    throw new Error("Cannot pull from StepperBehavior");
  }
}

/**
 * Creates a Behavior whose value is the last occurrence in the stream.
 * @param initial the initial value that the behavior has
 * @param steps the stream that will change the value of the behavior
 */
export function stepper<B>(initial: B, steps: Stream<B>): Behavior<B> {
  return new StepperBehavior(initial, steps);
}

/** @private */
class ScanBehavior<A, B> extends Behavior<B> {
  constructor(initial: B,
              private fn: (a: A, b: B) => B,
              private source: Stream<A>) {
    super();
    this.pushing = true;
    this.last = initial;
    source.addListener(this);
  }
  push(val: A): void {
    this.last = this.fn(val, this.last);
    this.child.push(this.last);
  }
  pull(): B {
    throw new Error("Cannot pull from Scan");
  }
}

/**
 * The returned behavior initially has the initial value, on each
 * occurence in `source` the function is applied to the current value
 * of the behaviour and the value of the occurence, the returned value
 * becomes the next value of the behavior.
 */
export function scan<A, B>(fn: (a: A, b: B) => B, init: B, source: Stream<A>): Behavior<Behavior<B>> {
  return fromFunction(() => new ScanBehavior(init, fn, source));
}

/**
 * This takes an impure function that varies over time and returns a
 * pull-driven behavior. This is particulairly useful if the function
 * is contionusly changing, like `Date.now`.
 */
export function fromFunction<B>(fn: () => B): Behavior<B> {
  return new FunctionBehavior(fn);
}

/**
 * Subscribe to a behavior in order to run imperative actions when the
 * value in the behavior changes.
 */
export function subscribe<A>(fn: (a: A) => void, b: Behavior<A>): void {
  b.subscribe(fn);
}

export class CbObserver<A> implements Observer<A> {
  constructor(
    private _push: (a: A) => void,
    private _beginPulling: () => void,
    private _endPulling: () => void,
    private source: Behavior<A>
  ) {
    source.addListener(this);
    // We explicitly checks for both `true` and `false` because
    // placeholder behavior is `undefined`
    if (source.pushing === false) {
      _beginPulling();
    } else if (source.pushing === true) {
      _push(source.last);
    }
  }
  push(a: A): void {
    this._push(a);
  }
  beginPulling(): void {
    this._beginPulling();
  }
  endPulling(): void {
    this._endPulling();
  }
}

/**
 * Observe a behavior for the purpose of executing imperative actions
 * based on the value of the behavior.
 */
export function observe<A>(
  push: (a: A) => void,
  beginPulling: () => void,
  endPulling: () => void,
  b: Behavior<A>
): CbObserver<A> {
  return new CbObserver(push, beginPulling, endPulling, b);
}

/**
 * Imperatively push a value into a behavior.
 */
export function publish<A>(a: A, b: Behavior<A>): void {
  b.push(a);
}

export function isBehavior(b: any): b is Behavior<any> {
  return b instanceof Behavior;
}

export type Time = number;

class TimeFromBehavior extends Behavior<Time> {
  private startTime: Time;
  constructor() {
    super();
    this.startTime = Date.now();
    this.pushing = false;
  }
  push(): void {
    throw new Error("Cannot push to TimeFromBehavior");
  }
  pull(): Time {
    return Date.now() - this.startTime;
  }
}

/**
 * A behavior whose value is the number of milliseconds elapsed win
 * UNIX epoch. I.e. its current value is equal to the value got by
 * calling `Date.now`.
 */
export const time: Behavior<Time> = fromFunction(Date.now);

/**
 * A behavior giving access to continous time. When sampled the outer
 * behavior gives a behavior with values that contain the difference
 * between the current sample time and the time at which the outer
 * behavior was sampled.
 */
export const timeFrom: Behavior<Behavior<Time>>
  = fromFunction(() => new TimeFromBehavior());

export function lift<T1, R>(f: (t: T1) => R, m: Behavior<T1>): Behavior<R>;
export function lift<T1, T2, R>(f: (t: T1, u: T2) => R, m1: Behavior<T1>, m2: Behavior<T2>): Behavior<R>;
export function lift<T1, T2, T3, R>(f: (t1: T1, t2: T2, t3: T3) => R, m1: Behavior<T1>, m2: Behavior<T2>, m3: Behavior<T3>): Behavior<R>;
export function lift(/* arguments */): any {
  return arguments[1].lift.apply(undefined, arguments);
}
