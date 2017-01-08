import {Stream} from "./stream";
import {Behavior} from "./behavior";

export * from "./behavior";
export * from "./stream";
export * from "./future";
export * from "./now";

/**
 * Map a function over a behavior. This means that if at some point in
 * time the value of `b` is `bVal` then the value of the returned
 * behavior is `fn(bVal)`.
 */

export function map<A, B>(fn: (a: A) => B , stream: Stream<A>): Stream<B>;
export function map<A, B>(fn: (a: A) => B , behavior: Behavior<A>): Behavior<B>;
export function map<A, B>(fn: (a: A) => B , b: any): any {
  return b.map(fn);
}
