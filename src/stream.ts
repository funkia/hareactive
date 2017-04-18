export type Time = number;

export type Occurrence<A> = {
  time: Time,
  value: A
}

export type SemanticStream<A> = Occurrence<A>[];

const enum PState {
  Push, Pull, Inactive
}

export interface Observer<A> {
  push(a: A): void;
}

export interface Subscriber<A> extends Observer<A> {
  deactivate(): void;
}

class PushOnlyObserver<A> {
  constructor(private callback: (a: A) => void, private stream: Reactive<A>) {
    stream.addListener(this);
  }
  push(a: any): void {
    this.callback(a);
  }
  deactivate(): void {
    this.stream.removeListener(this);
  }
}

export class MultiObserver<A> implements Observer<A> {
  listeners: Observer<A>[];
  constructor(c1: Observer<A>, c2: Observer<A>) {
    this.listeners = [c1, c2];
  }
  push(a: A): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].push(a);
    }
  }
}

export abstract class Reactive<A> implements Observer<any> {
  child: Observer<A>;
  nrOfListeners: number;
  state: PState;
  constructor() {
    this.nrOfListeners = 0;
  }
  addListener(c: Observer<A>): void {
    const nr = ++this.nrOfListeners;
    if (nr === 1) {
      this.child = c;
      this.activate();
    } else if (nr === 2) {
      this.child = new MultiObserver(this.child, c);
    } else {
      (<MultiObserver<A>>this.child).listeners.push(c);
    }
  }
  removeListener(listener: Observer<any>): void {
    const nr = --this.nrOfListeners;
    if (nr === 0) {
      this.child = undefined;
      this.deactivate();
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
  subscribe(callback: (a: A) => void): Subscriber<A> {
    return new PushOnlyObserver(callback, this);
  }
  abstract push(a: any): void;
  abstract deactivate(): void;
  abstract activate(): void;
  abstract map<B>(f: (a: A) => B): Reactive<B>;
}

/**
 * A stream is a list of occurrences over time. Each occurrence
 * happens at a discrete point in time and has an associated value.
 * Semantically it is a list `type Stream<A> = [Time, A]`.
 */
export abstract class Stream<A> extends Reactive<A> {
  isStream: true;
  constructor() {
    super();
    this.isStream = true;
  }
  combine<B>(stream: Stream<B>): Stream<A | B> {
    return new CombineStream(stream, this);
  }
  map<B>(f: (a: A) => B): Stream<B> {
    return new MapReactive(this, f);
  }
  mapTo<B>(b: B): Stream<B> {
    return new MapToReactive(this, b);
  }
  abstract semantic(): SemanticStream<A>;
}

export class MapReactive<A, B> extends Stream<B> {
  constructor(
    private parent: Reactive<A>,
    private f: (a: A) => B
  ) {
    super();
  }
  semantic(): SemanticStream<B> {
    const s = (<Stream<A>>this.parent).semantic();
    return s.map(({ time, value }) => ({ time, value: this.f(value) }));
  }
  activate(): void {
    this.parent.addListener(this);
  }
  deactivate(): void {
    this.parent.removeListener(this);
  }
  push(a: A): void {
    this.child.push(this.f(a));
  }
}

export class MapToReactive<A, B> extends Stream<B> {
  constructor(
    private parent: Reactive<A>,
    private b: B
  ) {
    super();
  }
  semantic(): SemanticStream<B> {
    const s = (<Stream<A>>this.parent).semantic();
    return s.map(({ time }) => ({ time, value: this.b }));
  }
  activate(): void {
    this.parent.addListener(this);
  }
  deactivate(): void {
    this.parent.removeListener(this);
  }
  push(a: A): void {
    this.child.push(this.b);
  }
}

class TestStream<A> extends Stream<A> {
  constructor(private semanticStream: SemanticStream<A>) {
    super();
  }
  semantic(): SemanticStream<A> {
    return this.semanticStream;
  }
  /* istanbul ignore next */
  activate(): SemanticStream<A> {
    throw new Error("You cannot activate a TestStream");
  }
  /* istanbul ignore next */
  deactivate(): SemanticStream<A> {
    throw new Error("You cannot deactivate a TestStream");
  }
  /* istanbul ignore next */
  push(a: A): void {
    throw new Error("You cannot push to a TestStream");
  }
}

export function testStreamFromArray<A>(array: A[]): Stream<A> {
  const semanticStream = array.map((value, time) => ({ value, time }));
  return new TestStream(semanticStream);
}

export function testStreamFromObject<A>(object: { [time: number]: A }): Stream<A> {
  const semanticStream =
    Object.keys(object).map((key) => ({ time: parseFloat(key), value: object[key] }));
  return new TestStream(semanticStream);
}

class EmptyStream extends Stream<any> {
  constructor() {
    super();
  }
  semantic(): SemanticStream<any> {
    return [];
  }
  /* istanbul ignore next */
  activate(): void { }
  /* istanbul ignore next */
  deactivate(): void { }
  /* istanbul ignore next */
  push(a: any): void {
    throw new Error("You cannot push to an empty stream");
  }
}

export const empty: Stream<any> = new EmptyStream();

class CombineStream<A, B> extends Stream<A | B> {
  constructor(private s1: Stream<A>, private s2: Stream<B>) {
    super();
  }
  semantic(): SemanticStream<A | B> {
    const result = [];
    const a = this.s1.semantic();
    const b = this.s2.semantic();
    for (let i = 0, j = 0; i < a.length || j < b.length;) {
      if (j === b.length || (i < a.length && a[i].time <= b[j].time)) {
        result.push(a[i]);
        i++;
      } else {
        result.push(b[j]);
        j++;
      }
    }
    return result;
  }
  activate(): void {
    this.s1.addListener(this);
    this.s2.addListener(this);
  }
  deactivate(): void {
    this.s1.removeListener(this);
    this.s2.removeListener(this);
  }
  push(a: A | B): void {
    this.child.push(a);
  }
}

export abstract class ProducerStream<A> extends Stream<A> {
  /* istanbul ignore next */
  semantic(): SemanticStream<A> {
    throw new Error("A producer stream does not have a semantic representation");
  }
  push(a: A): void {
    this.child.push(a);
  }
}

export class SinkStream<A> extends ProducerStream<A> {
  private pushing: boolean;
  constructor() {
    super();
    this.pushing = false;
  }
  push(a: A): void {
    if (this.pushing === true) {
      this.child.push(a);
    }
  }
  activate(): void {
    this.pushing = true;
  }
  deactivate(): void {
    this.pushing = false;
  }
}

export function sinkStream<A>(): SinkStream<A> {
  return new SinkStream<A>();
}

export function subscribe<A>(fn: (a: A) => void, stream: Stream<A>): void {
  stream.subscribe(fn);
}

export function isStream(s: any): s is Stream<any> {
  return typeof s === "object" && s.isStream === true;
}
