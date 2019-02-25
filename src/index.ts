import { Now } from "./now";
import { Stream, SinkStream } from "./stream";
import { Behavior, SinkBehavior, MapBehaviorTuple } from "./behavior";
import { Future, MapFutureTuple } from "./future";

export * from "./common";
export * from "./now";
export * from "./behavior";
export * from "./stream";
export * from "./future";
export * from "./dom";
export * from "./time";
export * from "./placeholder";
export * from "./animation";

/**
 * Map a function over a behavior or stream. This means that if at some point in
 * time the value of `b` is `bVal` then the value of the returned
 * behavior is `fn(bVal)`.
 */
export function map<A, B>(fn: (a: A) => B, future: Future<A>): Future<B>;
export function map<A, B>(fn: (a: A) => B, stream: Stream<A>): Stream<B>;
export function map<A, B>(fn: (a: A) => B, behavior: Behavior<A>): Behavior<B>;
export function map<A, B>(fn: (a: A) => B, b: any): any {
  return b.map(fn);
}

export function lift<A extends any[], R>(
  f: (...args: A) => R,
  ...args: MapFutureTuple<A>
): Future<R>;
export function lift<A extends any[], R>(
  f: (...args: A) => R,
  ...args: MapBehaviorTuple<A>
): Behavior<R>;
export function lift<R>(f: (...args: any) => R, ...args: any): any {
  return args[0].lift(f, ...args);
}

export function flatten<A>(b: Behavior<Behavior<A>>): Behavior<A>;
export function flatten<A>(f: Future<Future<A>>): Future<A>;
export function flatten<A>(n: Now<Now<A>>): Now<A>;
export function flatten(o: { flatten: () => any }): any {
  return o.flatten();
}

export function push<A>(a: A, sink: SinkBehavior<A> | SinkStream<A>): void {
  sink.push(a);
}

export function combine<A>(...streams: Future<A>[]): Future<A>;
export function combine<A>(...streams: Stream<A>[]): Stream<A>;
export function combine<A>(
  ...values: Future<A>[] | Stream<A>[]
): Future<A> | Stream<A> {
  // FIXME: More performant implementation with benchmark
  return (values as any).reduce((a: any, b: any) => a.combine(b));
}
