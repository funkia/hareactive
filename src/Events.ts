import {
  MapFunction,
  SubscribeFunction,
  ScanFunction,
  FilterFunction,
  Pushable
} from "./frp-common";

import {Behavior, at} from "./Behavior";

export abstract class Events<A> {
  public last: A;
  public eventListeners: Pushable<A>[] = [];
  private cbListeners: ((a: A) => void)[] = [];

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
      this.eventListeners[i].push(a);
    }
  };

  set def(events: Events<any>) {
    events.cbListeners.push(...this.cbListeners);
    events.eventListeners.push(...this.eventListeners);
    this.cbListeners = events.cbListeners;
    this.eventListeners = events.eventListeners;
  }

  public subscribe(fn: SubscribeFunction<A>): void {
    this.cbListeners.push(fn);
  }

  public abstract push(a: any): void;

  public map<B>(fn: MapFunction<A, B>): MapEvents<A, B> {
    const e = new MapEvents(fn);
    this.eventListeners.push(e);
    return e;
  }

  public merge<B>(otherEvents: Events<B>): Events<(A|B)> {
    const e = new SinkEvents<(A|B)>();
    this.eventListeners.push(e);
    otherEvents.eventListeners.push(e);
    return e;
  }

  public filter(fn: FilterFunction<A>): FilterEvents<A> {
    const e = new FilterEvents<A>(fn);
    this.eventListeners.push(e);
    return e;
  }

  public scan<B>(fn: ScanFunction<A, B>, startingValue: B): ScanEvents<A, B> {
    const e = new ScanEvents<A, B>(fn, startingValue);
    this.eventListeners.push(e);
    return e;
  }
}

export class SinkEvents<A> extends Events<A> {
  public push(a: A): void {
    this.publish(a);
  }
}

class MapEvents<A, B> extends Events<B> {
  constructor(private fn: MapFunction<A, B>) {
    super();
  }

  public push(a: A): void {
    this.publish(this.fn(a));
  }
}

class FilterEvents<A> extends Events<A> {
  constructor(private fn: FilterFunction<A>) {
    super();
  }

  public push(a: A): void {
    if (this.fn(a)) {
      this.publish(a);
    }
  }
}

class ScanEvents<A, B> extends Events<B> {
  constructor(private fn: ScanFunction<A, B>, public last: B) {
    super();
  }

  public push(a: A): void {
    this.publish(this.fn(a, this.last));
  }
}

class SnapshotEvents<A, B> extends Events<[A, B]> {
  constructor(private behavior: Behavior<B>, events: Events<A>) {
    super();
    events.eventListeners.push(this);
  }

  public push(a: A): void {
    this.publish([a, at(this.behavior)]);
  }
}

export function snapshot<A, B>(behavior: Behavior<B>, events: Events<A>): Events<[A, B]> {
  return new SnapshotEvents(behavior, events);
}

class SnapshotWithEvents<A, B, C> extends Events<C> {
  constructor(
    private fn: (a: A, b: B) => C,
    private behavior: Behavior<B>,
    events: Events<A>
  ) {
    super();
    events.eventListeners.push(this);
  }

  public push(a: A): void {
    this.publish(this.fn(a, at(this.behavior)));
  }
}

export function snapshotWith<A, B, C>(
  fn: (a: A, b: B) => C,
  behavior: Behavior<B>,
  events: Events<A>
): Events<C> {
  return new SnapshotWithEvents(fn, behavior, events);
}

export function empty<A>(): Events<A> {
  return new SinkEvents<A>();
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

export function map<A, B>(fn: MapFunction<A, B> , events: Events<A>): MapEvents<A, B> {
  return events.map(fn);
}

export function filter<A>(fn: FilterFunction<A>, events: Events<A>): FilterEvents<A> {
  return events.filter(fn);
}

export function scan<A, B>(fn: ScanFunction<A, B>, startingValue: B, events: Events<A>): ScanEvents<A, B> {
  return events.scan(fn, startingValue);
}

export function isEvents(obj: any): boolean {
  return (obj instanceof Events);
}
