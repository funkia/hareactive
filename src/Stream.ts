import {
  MapFunction,
  SubscribeFunction,
  ScanFunction,
  FilterFunction,
  Consumer
} from "./frp-common";

import {Behavior, at, scan} from "./Behavior";

export abstract class Stream<A> {
  public eventListeners: Consumer<A>[] = [];
  private cbListeners: ((a: A) => void)[] = [];

  public publish(a: A): void {
    for (let i = 0, l = this.cbListeners.length; i < l; i++) {
      this.cbListeners[i](a);
    }
    for (let i = 0, l = this.eventListeners.length; i < l; i++) {
      this.eventListeners[i].push(a);
    }
  };

  set def(stream: Stream<any>) {
    stream.cbListeners.push(...this.cbListeners);
    stream.eventListeners.push(...this.eventListeners);
    this.cbListeners = stream.cbListeners;
    this.eventListeners = stream.eventListeners;
  }

  public subscribe(fn: SubscribeFunction<A>): void {
    this.cbListeners.push(fn);
  }

  public abstract push(a: any): void;

  public map<B>(fn: MapFunction<A, B>): MapStream<A, B> {
    const e = new MapStream(fn);
    this.eventListeners.push(e);
    return e;
  }

  public mapTo<B>(val: B): Stream<B> {
    const s = new MapToStream(val);
    this.eventListeners.push(s);
    return s;
  }

  public merge<B>(otherStream: Stream<B>): Stream<(A|B)> {
    const e = new SinkStream<(A|B)>();
    this.eventListeners.push(e);
    otherStream.eventListeners.push(e);
    return e;
  }

  public filter(fn: FilterFunction<A>): FilterStream<A> {
    const e = new FilterStream<A>(fn);
    this.eventListeners.push(e);
    return e;
  }

  public scan<B>(fn: ScanFunction<A, B>, init: B): Behavior<Behavior<B>> {
    return scan(fn, init, this);
  }
}

export class SinkStream<A> extends Stream<A> {
  public push(a: A): void {
    this.publish(a);
  }
}

class MapStream<A, B> extends Stream<B> {
  constructor(private fn: MapFunction<A, B>) {
    super();
  }
  public push(a: A): void {
    this.publish(this.fn(a));
  }
}

class MapToStream<A> extends Stream<A> {
  constructor(private val: A) { super(); }
  public push(a: any): void {
    this.publish(this.val);
  }
}

class FilterStream<A> extends Stream<A> {
  constructor(private fn: FilterFunction<A>) {
    super();
  }

  public push(a: A): void {
    if (this.fn(a)) {
      this.publish(a);
    }
  }
}

class SnapshotStream<A, B> extends Stream<[A, B]> {
  constructor(private behavior: Behavior<B>, stream: Stream<A>) {
    super();
    stream.eventListeners.push(this);
  }
  public push(a: A): void {
    this.publish([a, at(this.behavior)]);
  }
}

export function snapshot<A, B>(behavior: Behavior<B>, stream: Stream<A>): Stream<[A, B]> {
  return new SnapshotStream(behavior, stream);
}

class SnapshotWithStream<A, B, C> extends Stream<C> {
  constructor(
    private fn: (a: A, b: B) => C,
    private behavior: Behavior<B>,
    stream: Stream<A>
  ) {
    super();
    stream.eventListeners.push(this);
  }

  public push(a: A): void {
    this.publish(this.fn(a, at(this.behavior)));
  }
}

export function snapshotWith<A, B, C>(
  fn: (a: A, b: B) => C,
  behavior: Behavior<B>,
  stream: Stream<A>
): Stream<C> {
  return new SnapshotWithStream(fn, behavior, stream);
}

export function empty<A>(): Stream<A> {
  return new SinkStream<A>();
}

export function subscribe<A>(fn: SubscribeFunction<A>, stream: Stream<A>): void {
  stream.subscribe(fn);
}

export function publish<A>(a: A, stream: Stream<A>): void {
  stream.publish(a);
}

export function merge<A, B>(a: Stream<A>, b: Stream<B>): Stream<(A|B)> {
  return a.merge(b);
}

export function map<A, B>(fn: MapFunction<A, B> , stream: Stream<A>): MapStream<A, B> {
  return stream.map(fn);
}

export function filter<A>(fn: FilterFunction<A>, stream: Stream<A>): FilterStream<A> {
  return stream.filter(fn);
}

export function isStream(obj: any): boolean {
  return (obj instanceof Stream);
}
