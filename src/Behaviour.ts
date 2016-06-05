import {
  Reactive,
  Body,
  MapBody,
  MapFunction,
  SubscribeFunction
} from "./frp-common";

export class Behavior<A> implements Reactive<A> {
  public cbListeners: ((a: A) => void)[] = [];
  public eventListeners: Behavior<any>[] = [];
  public last: A;
  public body: Body;

  public publish(a: A): void {
    this.last = a;

    let i = 0;
    let l = this.cbListeners.length;
    for (; i < l; i++) {
      this.cbListeners[i](a);
    }

    i = 0;
    l = this.eventListeners.length;
    for (; i < l; i++) {
      this.eventListeners[i].body.run(a);
    }
  };

  public clear(): void {
    if (this.last !== undefined) {
      this.last = undefined;
      for (let i = 0; i < this.eventListeners.length; ++i) {
        this.eventListeners[i].clear();
      }
    }
  };

  public map<B>(fn: MapFunction<A, B>): Behavior<B> {
    const newB = new Behavior<B>();
    if (this.last !== undefined) {
      newB.last = fn(this.last);
    }
    newB.body = new MapBody(fn, newB, this);
    this.eventListeners.push(newB);
    return newB;
  };

  public of: <B>(v: B) => Behavior<B> = of;
}

export function of<B>(val: B): Behavior<B> {
  const newB = new Behavior<B>();
  newB.last = val;
  newB.body = new PullBody(
    newB,
    () => val // FIXME: create specific constant body
  );
  return newB;
}

export function at<A>(b: Behavior<A>): A {
  return b.last !== undefined ? b.last : b.body.pull();
}

// Behavior.prototype.ap = function(valB) {
//   if (!(valB instanceof Behavior)) valB = new Behavior(undefined, valB);
//   var fn = this.last, val = valB.last;
//   var newB = new Behavior(undefined, fn !== undefined && val !== undefined ? fn(val) : undefined);
//   newB.body = new ApBody(this, valB, newB);
//   this.eventListeners.push(newB);
//   valB.eventListeners.push(newB);
//   return newB;
// };

// Behavior.prototype.concat = function(b) {
//   var fst = this.last, snd = b.last;
//   var newB = new Behavior(undefined, fst !== undefined && snd !== undefined ? fst.concat(snd) : undefined);
//   newB.body = new ConcatBody(this, b, newB);
//   this.eventListeners.push(newB);
//   b.eventListeners.push(newB);
//   return newB;
// };

class PullBody<A> implements Body {
  constructor(private b: Behavior<A>, private fn: () => A) { }

  public run(v: A): void {
    this.b.publish(v);
  }

  public pull(): A {
    return this.fn();
  }
}

// Creates a pull Behavior from a continous function
export function fromFunction<A>(fn: () => A): Behavior<A> {
  const newB = new Behavior<A>();
  newB.body = new PullBody(newB, fn);
  return newB;
}

export function sink<A>(initialValue: A): Behavior<A> {
  const newB = new Behavior<A>();
  newB.last = initialValue;
  return newB;
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
