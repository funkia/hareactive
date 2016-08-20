import {
  MapFunction,
  SubscribeFunction
} from "./frp-common";

import {Stream} from "./Stream";

export abstract class Behavior<A> {
  public cbListeners: ((b: A) => void)[] = [];
  // The behaviors that depends on this one
  public listeners: Behavior<any>[] = [];
  public last: A;
  public pushing: boolean;

  public publish(b: A): void {
    this.last = b;

    let i = 0;
    let l = this.cbListeners.length;
    for (; i < l; i++) {
      this.cbListeners[i](b);
    }

    i = 0;
    l = this.listeners.length;
    for (; i < l; i++) {
      this.listeners[i].push(b, this);
    }
  };

  public abstract push(a: any, changed: Behavior<any>): void;

  public abstract pull(): A;

  set def(b: Behavior<A>) {
    b.cbListeners.push(...this.cbListeners);
    b.listeners.push(...this.listeners);
    this.cbListeners = b.cbListeners;
    this.listeners = b.listeners;
  }

  public map<B>(fn: MapFunction<A, B>): Behavior<B> {
    const newB = new MapBehavior<A, B>(this, fn);
    this.listeners.push(newB);
    return newB;
  };

  public of: <A>(v: A) => Behavior<A> = of;

  public chain<B>(fn: (a: A) => Behavior<B>): Behavior<B> {
    const newB = new ChainBehavior<A, B>(this, fn);
    this.listeners.push(newB);
    return newB;
  }

  public subscribe(listener: Behavior<any>): void {
    this.listeners.push(listener);
  }

  public unsubscribe(listener: Behavior<any>): void {
    // The indexOf here is O(n), where n is the number of listeners,
    // if using a linked list it should be possible to do the
    // unsubscribe operation in constant time
    const l = this.listeners;
    const idx = l.indexOf(listener);
    if (idx !== -1) {
      // if the subscriber is not at the end of the list we overwrite
      // it with the element at the end of the list
      if (idx !== l.length - 1) {
        l[idx] = l[l.length - 1];
      }
      l.length--; // remove the last element of the list
    }
  }
}

export function of<B>(val: B): Behavior<B> {
  return new ConstantBehavior(val);
}

// Impure function that gets the current value of a behavior.
export function at<B>(b: Behavior<B>): B {
  return b.pushing === true ? b.last : b.pull();
}

class ConstantBehavior<A> extends Behavior<A> {
  constructor(public last: A) {
    super();
    this.pushing = false;
  }

  public push(): void {
    throw new Error("Cannot push a value to a constant behavior");
  }

  public pull(): A {
    return this.last;
  }
}

class MapBehavior<A, B> extends Behavior<B> {
  constructor(
    private parent: Behavior<any>,
    private fn: MapFunction<A, B>
  ) {
    super();
    this.pushing = parent.pushing;
  }

  public push(a: any): void {
    this.last = this.fn(a);
    this.publish(this.last);
  }

  public pull(): B {
    return this.fn(at(this.parent));
  }
}

class ChainBehavior<A, B> extends Behavior<B> {
  // The last behavior returned by the chain function
  private innerB: Behavior<B>;
  constructor(
    private outer: Behavior<any>,
    private fn: (a: A) => Behavior<B>
  ) {
    super();
    this.innerB = this.fn(at(this.outer));
    this.pushing = outer.pushing && this.innerB.pushing;
    this.innerB.listeners.push(this);
    this.last = at(this.innerB);
  }

  public push(a: any, changed: Behavior<any>): void {
    if (changed === this.outer) {
      this.innerB.unsubscribe(this);
      const newInner = this.fn(at(this.outer));
      newInner.subscribe(this);
      this.innerB = newInner;
    }
    this.last = at(this.innerB);
    this.publish(this.last);
  }

  public pull(): B {
    return at(this.fn(at(this.outer)));
  }
}

class FunctionBehavior<A> extends Behavior<A> {
  constructor(private fn: () => A) {
    super();
    this.pushing = false;
  }

  public push(v: A): void {
    throw new Error("Cannot push to a FunctionBehavior");
  }

  public pull(): A {
    return this.fn();
  }
}

class ApBehavior<A, B> extends Behavior<B> {
  public last: B;

  constructor(
    private fn: Behavior<(a: A) => B>,
    private val: Behavior<A>
  ) {
    super();
    this.pushing = fn.pushing && val.pushing;
    this.last = at(fn)(at(val));
  }

  public push(): void {
    const fn = at(this.fn);
    const val = at(this.val);
    this.last = fn(val);
    this.publish(this.last);
  }

  public pull(): B {
    return at(this.fn)(at(this.val));
  }
}

class SinkBehavior<B> extends Behavior<B> {
  constructor(public last: B) {
    super();
    this.pushing = true;
  }

  public push(v: B): void {
    this.last = v;
    this.publish(v);
  }

  public pull(): B {
    return this.last;
  }
}

class StepperBehavior<B> extends Behavior<B> {
  constructor(initial: B, private steps: Stream<B>) {
    super();
    this.pushing = true;
    this.last = initial;
    steps.eventListeners.push(this);
  }

  public push(val: B): void {
    this.last = val;
    this.publish(val);
  }

  public pull(): B {
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

// Creates a pull Behavior from a continous function
export function fromFunction<A, B>(fn: () => B): Behavior<B> {
  return new FunctionBehavior(fn);
}

export function sink<A>(initialValue: A): Behavior<A> {
  return new SinkBehavior<A>(initialValue);
}

export function subscribe<A>(fn: SubscribeFunction<A>, b: Behavior<A>): void {
  b.cbListeners.push(fn);
}

export function publish<A>(a: A, b: Behavior<A>): void {
  b.publish(a);
}

export function map<A, B>(fn: MapFunction<A, B> , b: Behavior<A>): Behavior<B> {
  return b.map(fn);
}

export function ap<A, B>(fnB: Behavior<(a: A) => B>, valB: Behavior<A>): Behavior<B> {
  const newB = new ApBehavior<A, B>(fnB, valB);
  fnB.listeners.push(newB);
  valB.listeners.push(newB);
  return newB;
}

export function isBehavior(b: any): b is Behavior<any> {
  return b instanceof Behavior;
}
