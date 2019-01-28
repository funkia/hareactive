import { Stream, SinkStream } from "./stream";
import { Behavior, SinkBehavior, MapBehaviorTuple } from "./behavior";
import { Future, MapFutureTuple } from "./future";

export * from "./common";
export * from "./behavior";
export * from "./stream";
export * from "./future";
export * from "./now";
export * from "./dom";
export * from "./time";
export * from "./placeholder";
export * from "./animation";
export * from "./test";

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

export function push<A>(a: A, sink: SinkBehavior<A> | SinkStream<A>): void {
  sink.push(a);
}
