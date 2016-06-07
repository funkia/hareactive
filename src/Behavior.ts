import {
  MapFunction,
  SubscribeFunction
} from "./frp-common";

export abstract class Behavior<A> {
  public cbListeners: ((b: A) => void)[] = [];
  public eventListeners: Behavior<any>[] = [];
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
    l = this.eventListeners.length;
    for (; i < l; i++) {
      this.eventListeners[i].push(b);
    }
  };

  public abstract push(a: any): void;

  public abstract pull(): A;

  set def(b: Behavior<A>) {
    b.cbListeners.push(...this.cbListeners);
    b.eventListeners.push(...this.eventListeners);
    this.cbListeners = b.cbListeners;
    this.eventListeners = b.eventListeners;
  }

  public clear(): void {
    if (this.last !== undefined) {
      this.last = undefined;
      for (let i = 0; i < this.eventListeners.length; ++i) {
        this.eventListeners[i].clear();
      }
    }
  };

  public map<B>(fn: MapFunction<A, B>): Behavior<B> {
    const newB = new MapBehavior<A, B>(this, fn);
    this.eventListeners.push(newB);
    return newB;
  };

  public of: <A>(v: A) => Behavior<A> = of;
}

export function of<B>(val: B): Behavior<B> {
  return new ConstantBehavior(val);
}

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
  fnB.eventListeners.push(newB);
  valB.eventListeners.push(newB);
  return newB;
}

export function isBehavior(b: any): b is Behavior<any> {
  return b instanceof Behavior;
}
