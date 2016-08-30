import {
  MapFunction,
  SubscribeFunction,
  ScanFunction,
  FilterFunction,
  Consumer
} from "./frp-common";

import {Behavior, at, scan, fromFunction} from "./Behavior";

export abstract class Stream<A> implements Consumer<any> {
  eventListeners: Consumer<A>[] = [];
  private cbListeners: ((a: A) => void)[] = [];

  publish(a: A): void {
    for (let i = 0, l = this.cbListeners.length; i < l; ++i) {
      this.cbListeners[i](a);
    }
    for (let i = 0, l = this.eventListeners.length; i < l; ++i) {
      this.eventListeners[i].push(a);
    }
  };

  set def(stream: Stream<any>) {
    stream.cbListeners.push(...this.cbListeners);
    stream.eventListeners.push(...this.eventListeners);
    this.cbListeners = stream.cbListeners;
    this.eventListeners = stream.eventListeners;
  }

  subscribe(fn: SubscribeFunction<A>): void {
    this.cbListeners.push(fn);
  }

  abstract push(a: any, b: any): void;

  map<B>(fn: MapFunction<A, B>): Stream<B> {
    const e = new MapStream(fn);
    this.eventListeners.push(e);
    return e;
  }

  mapTo<B>(val: B): Stream<B> {
    const s = new MapToStream(val);
    this.eventListeners.push(s);
    return s;
  }

  merge<B>(otherStream: Stream<B>): Stream<(A|B)> {
    const e = new SinkStream<(A|B)>();
    this.eventListeners.push(e);
    otherStream.eventListeners.push(e);
    return e;
  }

  filter(fn: FilterFunction<A>): FilterStream<A> {
    const e = new FilterStream<A>(fn);
    this.eventListeners.push(e);
    return e;
  }

  scanS<B>(fn: ScanFunction<A, B>, startingValue: B): Stream<B> {
    const e = new ScanStream<A, B>(fn, startingValue);
    this.eventListeners.push(e);
    return e;
  }

  scan<B>(fn: ScanFunction<A, B>, init: B): Behavior<Behavior<B>> {
    return scan(fn, init, this);
  }

  unlisten(listener: Consumer<any>): void {
    const l = this.eventListeners;
    const idx = l.indexOf(listener);
    if (idx !== -1) {
      if (idx !== l.length - 1) {
        l[idx] = l[l.length - 1];
      }
      l.length--; // remove the last element of the list
    }
  }
}

export class SinkStream<A> extends Stream<A> {
  push(a: A): void {
    this.publish(a);
  }
}

class MapStream<A, B> extends Stream<B> {
  constructor(private fn: MapFunction<A, B>) {
    super();
  }
  push(a: A): void {
    this.publish(this.fn(a));
  }
}

class MapToStream<A> extends Stream<A> {
  constructor(private val: A) { super(); }
  push(a: any): void {
    this.publish(this.val);
  }
}

class FilterStream<A> extends Stream<A> {
  constructor(private fn: FilterFunction<A>) {
    super();
  }

  push(a: A): void {
    if (this.fn(a)) {
      this.publish(a);
    }
  }
}

class ScanStream<A, B> extends Stream<B> {
  constructor(private fn: ScanFunction<A, B>, private last: B) {
    super();
  }
  push(a: A): void {
    const val = this.last = this.fn(a, this.last);
    this.publish(val);
  }
}

export function scanS<A, B>(fn: ScanFunction<A, B>, startingValue: B, stream: Stream<A>): Behavior<Stream<B>> {
  return fromFunction(() => stream.scanS(fn, startingValue));
}

class SnapshotStream<A, B> extends Stream<[A, B]> {
  constructor(private behavior: Behavior<B>, stream: Stream<A>) {
    super();
    stream.eventListeners.push(this);
  }
  push(a: A): void {
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
  push(a: A): void {
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

class SwitchBehaviorStream<A> extends Stream<A> {
  private currentSource: Stream<A>;
  constructor(private b: Behavior<Stream<A>>) {
    super();
    b.addListener(this);
    const cur = this.currentSource = at(b);
    cur.eventListeners.push(this);
  }
  push(a: any, changer: any): void {
    if (changer === this.b) {
      this.doSwitch(a);
    } else {
      this.publish(a);
    }
  }
  private doSwitch(newStream: Stream<A>): void {
    this.currentSource.unlisten(this);
    newStream.eventListeners.push(this);
    this.currentSource = newStream;
  }
}

/**
 * Takes a stream valued behavior and returns at stream that emits
 * values from the current stream at the behavior.
 */
export function switchStream<A>(b: Behavior<Stream<A>>): Stream<A> {
  return new SwitchBehaviorStream(b);
}

export function mergeList<A>(ss: Stream<A>[]): Stream<A> {
  return ss.reduce((s1, s2) => s1.merge(s2), empty());
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

export function map<A, B>(fn: MapFunction<A, B> , stream: Stream<A>): Stream<B> {
  return stream.map(fn);
}

export function filter<A>(fn: FilterFunction<A>, stream: Stream<A>): FilterStream<A> {
  return stream.filter(fn);
}

export function isStream(obj: any): boolean {
  return (obj instanceof Stream);
}
