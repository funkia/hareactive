import * as assert from "assert";
import { Stream, SemanticStream } from "./stream";
import {
  Behavior,
  MapBehavior,
  ScanBehavior,
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
  NextOccurenceFuture
} from "./future";
import { Occurrence } from "./stream";
import { Time } from "./common";
import { SampleNow } from "./now";
import { time } from "./time";

// Future

declare module "./future" {
  interface Future<A> {
    test(): SemanticFuture<A>;
  }
}

export const neverOccurringFuture = {
  time: "infinity" as "infinity",
  value: undefined as undefined
};

export type SemanticFuture<A> = Occurrence<A> | typeof neverOccurringFuture;

export function doesOccur<A>(
  future: SemanticFuture<A>
): future is Occurrence<A> {
  return future.time !== "infinity";
}

CombineFuture.prototype.test = function() {
  const a = this.future1.test();
  const b = this.future2.test();
  return a.time <= b.time ? a : b;
};

MapFuture.prototype.test = function() {
  const p = this.parent.test();
  return doesOccur(p)
    ? { time: p.time, value: this.f(p.value) }
    : neverOccurringFuture;
};

MapToFuture.prototype.test = function() {
  const p = this.parent.test();
  return doesOccur(p)
    ? { time: p.time, value: this.value }
    : neverOccurringFuture;
};

OfFuture.prototype.test = function() {
  return { time: -Infinity, value: this.value };
};

NeverFuture.prototype.test = function() {
  return neverOccurringFuture;
};

LiftFuture.prototype.test = function() {
  const sems = this.futures.map((f) => f.test());
  const time = Math.max(...sems.map((s) => (doesOccur(s) ? s.time : Infinity)));
  return time !== Infinity
    ? { time, value: this.f(...sems.map((s) => s.value)) }
    : neverOccurringFuture;
};

FlatMapFuture.prototype.test = function() {
  const a = this.parent.test();
  if (doesOccur(a)) {
    const b = this.f(a.value).test();
    if (doesOccur(b)) {
      return { time: Math.max(a.time, b.time), value: b.value };
    }
  }
  return neverOccurringFuture;
};

NextOccurenceFuture.prototype.test = function() {
  const occ = this.s.semantic().find((o) => o.time > this.time);
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
  test(): SemanticFuture<A> {
    return this.semanticFuture;
  }
  /* istanbul ignore next */
  push(_a: A): void {
    throw new Error("You cannot push to a TestFuture");
  }
}

export function testFuture<A>(time: number, value: A): Future<A> {
  return new TestFuture({ time, value });
}

export function assertFutureEqual<A>(
  future1: Future<A>,
  future2: Future<A>
): void {
  const a = future1.test();
  const b = future2.test();
  assert.deepEqual(a, b);
}

// Stream

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
  pushS(_t: number, _a: A): void {
    throw new Error("You cannot push to a TestStream");
  }
}

export function testStreamFromArray<A>(array: A[]): Stream<A> {
  const semanticStream = array.map((value, time) => ({ value, time }));
  return new TestStream(semanticStream);
}

export function testStreamFromObject<A>(object: {
  [time: number]: A;
}): Stream<A> {
  const semanticStream = Object.keys(object).map((key) => ({
    time: parseFloat(key),
    value: object[key]
  }));
  return new TestStream(semanticStream);
}

// Behavior

/**
 * A behavior is a value that changes over time. Conceptually it can
 * be thought of as a function from time to a value. I.e. `type
 * Behavior<A> = (t: Time) => A`.
 */
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

ScanBehavior.prototype.model = function<A, B>(this: ScanBehavior<A, B>) {
  const stream = this.source.semantic();
  return (t1) =>
    testBehavior<B>((t2) =>
      stream
        .filter(({ time }) => t1 <= time && time <= t2)
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

// * Now

SampleNow.prototype.test = function<A>(
  mocks: any[],
  t: Time
): { value: A; mocks: any[] } {
  return { value: testAt(t, this.b), mocks };
};
