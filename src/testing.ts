import * as assert from "assert";
import {
  Stream,
  MapStream,
  MapToStream,
  FilterStream,
  empty,
  ScanStream,
  CombineStream,
  SnapshotStream,
  isStream,
  FlatFutures,
  FlatFuturesOrdered,
  FlatFuturesLatest
} from "./stream";
import {
  Behavior,
  MapBehavior,
  AccumBehavior,
  FunctionBehavior,
  ConstantBehavior
} from "./behavior";
import {
  Future,
  CombineFuture,
  NeverFuture,
  MapFuture,
  MapToFuture,
  OfFuture,
  LiftFuture,
  FlatMapFuture,
  NextOccurrenceFuture
} from "./future";
import { Time } from "./common";
import {
  SampleNow,
  OfNow,
  FlatMapNow,
  PerformNow,
  PerformMapNow,
  Now,
  MapNow,
  InstantNow,
  InstantRun
} from "./now";
import { time, DelayStream } from "./time";
import { ConsValue } from "./datastructures";

// Future

declare module "./future" {
  interface Future<A> {
    model(): SemanticFuture<A>;
  }
}

export interface Occurrence<A> {
  tag: "Occurrence";
  time: Time;
  value: A;
}

export const occurrence = <A>(time: Time, value: A): Occurrence<A> => ({
  tag: "Occurrence",
  time,
  value
});

export interface NeverOccurringFuture {
  readonly tag: "NeverOccurringFuture";
}

export const neverOccurringFuture: NeverOccurringFuture = {
  tag: "NeverOccurringFuture"
};

export type SemanticFuture<A> = Occurrence<A> | NeverOccurringFuture;

export function doesOccur<A>(
  future: SemanticFuture<A>
): future is Occurrence<A> {
  return future.tag === "Occurrence";
}

CombineFuture.prototype.model = function() {
  const a = this.parentA.model();
  const b = this.parentB.model();
  return a.time <= b.time ? a : b;
};

MapFuture.prototype.model = function() {
  const p = this.parent.model();
  return doesOccur(p)
    ? occurrence(p.time, this.f(p.value))
    : neverOccurringFuture;
};

MapToFuture.prototype.model = function() {
  const p = this.parent.model();
  return doesOccur(p) ? occurrence(p.time, this.value) : neverOccurringFuture;
};

OfFuture.prototype.model = function() {
  return occurrence(-Infinity, this.value);
};

NeverFuture.prototype.model = function() {
  return neverOccurringFuture;
};

const allOccurred = <A>(fs: SemanticFuture<A>[]): fs is Occurrence<A>[] =>
  fs.every((f) => f.tag === "Occurrence");

LiftFuture.prototype.model = function() {
  const sems = (this.futures as Future<unknown>[]).map((f) => f.model());
  const time = Math.max(...sems.map((s) => (doesOccur(s) ? s.time : Infinity)));
  return time !== Infinity && allOccurred(sems)
    ? occurrence(time, this.f(...sems.map((s) => s.value)))
    : neverOccurringFuture;
};

FlatMapFuture.prototype.model = function() {
  const a = this.parent.model();
  if (doesOccur(a)) {
    const b = this.f(a.value).model();
    if (doesOccur(b)) {
      return occurrence(Math.max(a.time, b.time), b.value);
    }
  }
  return neverOccurringFuture;
};

NextOccurrenceFuture.prototype.model = function<A>(
  this: NextOccurrenceFuture<A>
) {
  const occ = this.s.model().find((o) => o.time > this.time);
  return occ !== undefined ? occ : neverOccurringFuture;
};

class TestFuture<A> extends Future<A> {
  constructor(private semanticFuture: SemanticFuture<A>) {
    super();
  }
  /* istanbul ignore next */
  pushS(_t: number, _val: A): void {
    throw new Error("You cannot push to a TestFuture");
  }
  model(): SemanticFuture<A> {
    return this.semanticFuture;
  }
  /* istanbul ignore next */
  push(_a: A): void {
    throw new Error("You cannot push to a TestFuture");
  }
}

export function testFuture<A>(time: number, value: A): Future<A> {
  return new TestFuture(occurrence(time, value));
}

export function assertFutureEqual<A>(
  future1: Future<A>,
  future2: Future<A>
): void {
  const a = future1.model();
  const b = future2.model();
  assert.deepEqual(a, b);
}

// Stream

export type StreamModel<A> = Occurrence<A>[];

declare module "./stream" {
  interface Stream<A> {
    model(): StreamModel<A>;
  }
}

MapStream.prototype.model = function<A, B>(this: MapStream<A, B>) {
  const s = this.parent.model();
  return s.map(({ time, value }) => occurrence(time, this.f(value)));
};

MapToStream.prototype.model = function<A, B>(this: MapToStream<A, B>) {
  const s = (this.parents as ConsValue<Stream<A>>).value.model();
  return s.map(({ time }) => occurrence(time, this.b));
};

FilterStream.prototype.model = function<A>(this: FilterStream<A>) {
  const s = this.parent.model();
  return s.filter(({ value }) => this.fn(value));
};

empty.model = () => [];

ScanStream.prototype.model = function<A, B>(this: ScanStream<A, B>) {
  const s = this.parent.model();
  let acc = this.last;
  return s
    .filter((o) => this.t < o.time)
    .map(({ time, value }) => {
      acc = this.f(value, acc);
      return occurrence(time, acc);
    });
};

CombineStream.prototype.model = function<A, B>(this: CombineStream<A, B>) {
  const result: Occurrence<A | B>[] = [];
  const a = this.s1.model();
  const b = this.s2.model();
  for (let i = 0, j = 0; i < a.length || j < b.length; ) {
    if (j === b.length || (i < a.length && a[i].time <= b[j].time)) {
      result.push(a[i]);
      i++;
    } else {
      result.push(b[j]);
      j++;
    }
  }
  return result;
};

SnapshotStream.prototype.model = function<B, _>(this: SnapshotStream<B, _>) {
  return this.trigger
    .model()
    .map(({ time }) => occurrence(time, testAt(time, this.target)));
};

DelayStream.prototype.model = function<A>(this: DelayStream<A>) {
  const s = (this.parents as ConsValue<Stream<A>>).value.model();
  return s.map(({ time, value }) => occurrence(time + this.ms, value));
};

const flatFuture = <A>(o: Occurrence<Future<A>>): Occurrence<A>[] => {
  const f = o.value.model();
  if (f.tag === "NeverOccurringFuture") {
    return [];
  } else {
    return [occurrence(Math.max(o.time, f.time), f.value)];
  }
};

FlatFutures.prototype.model = function<A>(this: FlatFutures<A>) {
  return (this.parents as ConsValue<Stream<Future<A>>>).value
    .model()
    .flatMap(flatFuture)
    .sort((o, p) => o.time - p.time); // FIXME: Should use stable sort here
};

FlatFuturesOrdered.prototype.model = function<A>(this: FlatFuturesOrdered<A>) {
  return (this.parents as ConsValue<Stream<Future<A>>>).value
    .model()
    .flatMap(flatFuture)
    .reduce<Occurrence<A>[]>((acc, o) => {
      const last: Time =
        acc.length === 0 ? -Infinity : acc[acc.length - 1].time;
      return acc.concat([occurrence(Math.max(last, o.time), o.value)]);
    }, []);
};

FlatFuturesLatest.prototype.model = function<A>(this: FlatFuturesLatest<A>) {
  return (this.parents as ConsValue<Stream<Future<A>>>).value
    .model()
    .flatMap(flatFuture)
    .reduceRight<Occurrence<A>[]>((acc, o) => {
      const last = acc.length === 0 ? Infinity : acc[0].time;
      return last < o.time ? acc : [occurrence(o.time, o.value)].concat(acc);
    }, []);
};

class TestStream<A> extends Stream<A> {
  constructor(private streamModel: StreamModel<A>) {
    super();
  }
  model(): StreamModel<A> {
    return this.streamModel;
  }
  /* istanbul ignore next */
  activate(): void {
    // throw new Error("You cannot activate a TestStream");
  }
  /* istanbul ignore next */
  deactivate(): StreamModel<A> {
    throw new Error("You cannot deactivate a TestStream");
  }
  /* istanbul ignore next */
  pushS(_t: number, _a: A): void {
    throw new Error("You cannot push to a TestStream");
  }
}

export function testStreamFromArray<A>(array: ([Time, A])[]): Stream<A> {
  const semanticStream = array.map(([t, value]) => occurrence(t, value));
  return new TestStream(semanticStream);
}

export function testStreamFromObject<A>(object: Record<string, A>): Stream<A> {
  const semanticStream = Object.keys(object).map((key) =>
    occurrence(parseFloat(key), object[key])
  );
  return new TestStream(semanticStream);
}

export function assertStreamEqual<A>(s1: Stream<A>, s2: Stream<A>): void;
export function assertStreamEqual<A>(
  s1: Stream<A>,
  s2: Record<number, A>
): void;
export function assertStreamEqual<A>(s1: Stream<A>, s2: ([Time, A])[]): void;
export function assertStreamEqual<A>(
  s1: Stream<A>,
  s2: Stream<A> | ([Time, A])[] | Record<number, A>
): void {
  const s2_ = isStream<A>(s2)
    ? s2
    : Array.isArray(s2)
    ? testStreamFromArray(s2)
    : testStreamFromObject(s2);
  assert.deepEqual(s1.model(), s2_.model());
}

// Behavior

export type BehaviorModel<A> = (time: Time) => A;

declare module "./behavior" {
  interface Behavior<A> {
    model(): BehaviorModel<A>;
  }
}

MapBehavior.prototype.model = function() {
  const g = this.parent.model();
  return (t) => this.f(g(t));
};

ConstantBehavior.prototype.model = function() {
  return (_) => this.last;
};

FunctionBehavior.prototype.model = function() {
  return (t: number) => this.f(t);
};

time.model = () => (t: Time) => t;

AccumBehavior.prototype.model = function<A, B>(this: AccumBehavior<A, B>) {
  const stream = this.source.model();
  return (t1) =>
    testBehavior<B>((t2) =>
      stream
        .filter(({ time }) => t1 <= time && time < t2)
        .map((o) => o.value)
        .reduce((acc, cur) => this.f(cur, acc), this.initial)
    );
};

class TestBehavior<A> extends Behavior<A> {
  constructor(private semanticBehavior: BehaviorModel<A>) {
    super();
  }
  /* istanbul ignore next */
  update(_t: number): A {
    throw new Error("Test behavior never updates");
  }
  model(): BehaviorModel<A> {
    return this.semanticBehavior;
  }
}

export function testBehavior<A>(b: (time: number) => A): Behavior<A> {
  return new TestBehavior(b);
}

/**
 * Takes a behavior created from test data, a point in timer and returns the
 * behaviors value at that point in time.
 */
export function testAt<A>(t: number, b: Behavior<A>): A {
  return b.model()(t);
}

export function assertBehaviorEqual<A>(
  b1: Behavior<A>,
  b2: {
    [time: number]: A;
  }
): void {
  const b = b1.model();
  for (const [t, v] of Object.entries(b2)) {
    assert.deepEqual(b(parseFloat(t)), v);
  }
}

// * Now

type NowModel<A> = { value: A; mocks: unknown[] };

declare module "./now" {
  interface Now<A> {
    model(mocks: unknown[], t: Time): NowModel<A>;
  }
}

OfNow.prototype.model = function<A>(mocks: unknown[], _t: Time): NowModel<A> {
  return { value: this.value, mocks };
};

MapNow.prototype.model = function<A>(mocks: unknown[], t: Time): NowModel<A> {
  const { value, mocks: m } = this.parent.model(mocks, t);
  return { value: this.f(value), mocks: m };
};

FlatMapNow.prototype.model = function<A>(
  mocks: unknown[],
  t: Time
): NowModel<A> {
  const { value, mocks: m } = this.first.model(mocks, t);
  return this.f(value).model(m, t);
};

interface TestInstanceNow<A> extends Now<A> {
  readonly fn: (run: InstantRun) => A;
}
InstantNow.prototype.model = function<A>(
  this: TestInstanceNow<A>,
  mocks: unknown[],
  t: Time
): NowModel<A> {
  let m = mocks;
  const value = this.fn((now) => {
    const r = now.model(m, t);
    m = r.mocks;
    return r.value;
  });
  return {
    value,
    mocks: m
  };
};

SampleNow.prototype.model = function<A>(
  mocks: unknown[],
  t: Time
): NowModel<A> {
  return { value: testAt(t, this.b), mocks };
};

PerformNow.prototype.model = function<A>(
  [value, ...mocks]: [A, ...unknown[]],
  _t: Time
): NowModel<A> {
  return { value, mocks };
};

PerformMapNow.prototype.model = function<A, B>(
  this: PerformMapNow<A, B>,
  [value, ...mocks]: [Stream<B> | Future<B>, ...unknown[]],
  _t: Time
): { value: Stream<B> | Future<B>; mocks: unknown[] } {
  return { value, mocks };
};

/**
 * Test run a now computation without executing its side-effects.
 * @param now The now computation to test.
 * @param mocks
 * @param time The point in time at which the now computation should
 * be run. Defaults to 0.
 */
export function testNow<A>(
  now: Now<A>,
  mocks: unknown[] = [],
  time: Time = 0
): A {
  return now.model(mocks, time).value;
}
