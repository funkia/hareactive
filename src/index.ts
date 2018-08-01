import { Stream, SinkStream } from "./stream";
import { Behavior, SinkBehavior } from "./behavior";

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
export function map<A, B>(fn: (a: A) => B, stream: Stream<A>): Stream<B>;
export function map<A, B>(fn: (a: A) => B, behavior: Behavior<A>): Behavior<B>;
export function map<A, B>(fn: (a: A) => B, b: any): any {
  return b.map(fn);
}

export function push<A>(a: A, sink: SinkBehavior<A> | SinkStream<A>): void {
  sink.push(a);
}
