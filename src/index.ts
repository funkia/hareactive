import { Now, MapNowTuple } from "./now";
import { Behavior, SinkBehavior, MapBehaviorTuple } from "./behavior";
import { Stream, SinkStream } from "./stream";
import { Future, MapFutureTuple } from "./future";

export * from "./common";
export * from "./now";
export * from "./behavior";
export * from "./stream";
export * from "./future";
export * from "./time";
export * from "./placeholder";
export * from "./animation";
export * from "./clock";

/**
 * Map a function over a behavior or stream. This means that if at some point in
 * time the value of `b` is `bVal` then the value of the returned
 * behavior is `fn(bVal)`.
 */
export function map<A, B>(fn: (a: A) => B, future: Future<A>): Future<B>;
export function map<A, B>(fn: (a: A) => B, stream: Stream<A>): Stream<B>;
export function map<A, B>(fn: (a: A) => B, behavior: Behavior<A>): Behavior<B>;
export function map<A, B>(fn: (a: A) => B, behavior: Now<A>): Now<B>;
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
export function lift<A extends any[], R>(
  f: (...args: A) => R,
  ...args: MapNowTuple<A>
): Now<R>;
export function lift<R>(f: (...args: any) => R, ...args: any): any {
  return args[0].lift(f, ...args);
}

export function flat<A>(b: Behavior<Behavior<A>>): Behavior<A>;
export function flat<A>(f: Future<Future<A>>): Future<A>;
export function flat<A>(n: Now<Now<A>>): Now<A>;
export function flat(o: { flat: () => any }): any {
  return o.flat();
}

export function push<A>(a: A, sink: SinkBehavior<A> | SinkStream<A>): void {
  sink.push(a);
}

export function combine<A>(...futures: Future<A>[]): Future<A>;
export function combine<A>(...streams: Stream<A>[]): Stream<A>;
export function combine<A>(
  ...values: Future<A>[] | Stream<A>[]
): Future<A> | Stream<A> {
  // FIXME: More performant implementation with benchmark
  return (values as any).reduce((a: any, b: any) => a.combine(b));
}
