import {
  Reactive,
  Body,
  MapFunction,
  SubscribeFunction,
  ScanFunction,
  FilterFunction
} from "./frp-common";

export class Events<A> implements Reactive<A> {
  private cbListeners: ((a: A) => void)[] = [];
  public eventListeners: Events<any>[] = [];
  public last: A;
  public body: Body;

  set def(events: Events<any>){
    events.cbListeners.push(...this.cbListeners);
    events.eventListeners.push(...this.eventListeners);
    this.cbListeners = events.cbListeners;
    this.eventListeners = events.eventListeners;
  }

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

  public subscribe(fn: SubscribeFunction<A>): void {
    this.cbListeners.push(fn);
  }

  public merge<B>(otherEvents: Events<B>): Events<(A|B)> {
    const e = new Events<(A|B)>();
    e.body = new NoopBody(e);
    this.eventListeners.push(e);
    otherEvents.eventListeners.push(e);
    return e;
  }

  public map<B>(fn: MapFunction<A, B>): Events<B> {
    const e = new Events<B>();
    e.body = new MapBody<A, B>(fn, e, this);
    this.eventListeners.push(e);
    return e;
  }

  public filter(fn: FilterFunction<A>): Events<A> {
    const e = new Events<A>();
    e.body = new FilterBody(fn, e, this);
    this.eventListeners.push(e);
    return e;
  }

  public scan<B>(fn: ScanFunction<A, B>, startingValue: B): Events<B> {
    const e = new Events<B>();
    e.last = startingValue;
    e.body = new ScanBody(fn, e, this);
    this.eventListeners.push(e);
    return e;
  }
}

class MapBody<A, B> implements Body {
  private fn: MapFunction<A, B>;
  private source: Events<A>;  // srcE
  private target: Events<B>;   // ev

  constructor(fn: MapFunction<A, B>, target: Events<B>, source: Events<A>) {
    this.fn = fn;
    this.target = target;
    this.source = source;
  }

  public run: ((a: A) => void) = a => {
    this.target.publish(this.fn(a));
  }

  public pull: (() => B) = () => {
    return this.fn(((this.source.last !== undefined) ? this.source.last : this.source.body.pull()));
  }
}

class NoopBody<A> implements Body {
  private source: Events<A>;

  constructor(source: Events<A>) {
    this.source = source;
  }

  public run: ((a: A) => void) = a => {
    this.source.publish(a);
  }

  public pull: (() => A) = () => {
    return (this.source.last !== undefined) ? this.source.last : this.source.body.pull();
  }
}

class FilterBody<A> implements Body {
  private fn: FilterFunction<A>;
  private source: Events<A>;  // srcE
  private target: Events<A>;   // ev

  constructor(fn: FilterFunction<A>, target: Events<A>, source: Events<A>) {
    this.fn = fn;
    this.target = target;
    this.source = source;
  }

  public run: ((a: A) => void) = a => {
    if (this.fn(a)) {
      this.target.publish(a);
    }
  }

  public pull: (() => A) = () => {
    let a = (this.source.last !== undefined) ? this.source.last : this.source.body.pull();
    return this.fn(a) ? a : undefined;
  }
}

class ScanBody<A, B> implements Body {
  private fn: ScanFunction<A, B>;
  private source: Events<A>;  // srcE
  private target: Events<B>;   // ev

  constructor(fn: ScanFunction<A, B>, target: Events<B>, source: Events<A>) {
    this.fn = fn;
    this.target = target;
    this.source = source;
  }

  public run: ((a: A) => void) = a => {
    this.target.publish(this.fn(this.target.last, a));
  }

  public pull: (() => A) = () => {
    return (this.source.last !== undefined) ? this.source.last : this.source.body.pull();
  }
}

export function empty<A>(): Events<A> {
  return new Events<A>();
}

export function subscribe<A>(fn: SubscribeFunction<A>, events: Events<A>): void {
  events.subscribe(fn);
}

export function publish<A>(a: A, events: Events<A>): void {
  events.publish(a);
}

export function merge<A, B>(a: Events<A>, b: Events<B>): Events<(A|B)> {
  return a.merge(b);
}

export function map<A, B>(fn: MapFunction<A, B> , events: Events<A>): Events<B> {
  return events.map(fn);
}

export function filter<A>(fn: FilterFunction<A>, events: Events<A>): Events<A> {
  return events.filter(fn);
}

export function scan<A, B>(fn: ScanFunction<A, B>, startingValue: B, events: Events<A>): Events<B> {
  return events.scan(fn, startingValue);
}

export function isEvents(obj: any): boolean {
  return (obj instanceof Events);
}
