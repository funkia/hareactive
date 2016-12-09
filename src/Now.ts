import {IO, runIO} from "jabz/io";
import {Monad, monad} from "jabz/monad";

import {Future, fromPromise, sink} from "./Future";
import {Behavior, at} from "./Behavior";
import {Stream} from "./Stream";

/**
 * The Now monad represents a computation that takes place in a given
 * moment and where the moment will always be now when the computation
 * is run.
 */
@monad
export abstract class Now<A> implements Monad<A> {
  // Impurely run the now computation
  abstract run(): A;
  of<B>(b: B): Now<B> {
    return new OfNow(b);
  }
  static of<B>(b: B): Now<B> {
    return new OfNow(b);
  }
  chain<B>(f: (a: A) => Now<B>): Now<B> {
    return new ChainNow(this, f);
  }
  static multi = false;
  multi = false;
  // Definitions below are inserted by Jabz
  flatten: <B>() => Now<B>;
  map: <B>(f: (a: A) => B) => Now<B>;
  mapTo: <B>(b: B) => Now<B>;
  ap: <B>(a: Now<(a: A) => B>) => Now<B>;
  lift: (f: Function, ...ms: any[]) => Now<any>;
}

class OfNow<A> extends Now<A> {
  constructor(private value: A) {
    super();
  }
  run() {
    return this.value;
  }
}

class ChainNow<B> extends Now<B> {
  constructor(private first: Now<any>, private f: (a: any) => Now<B>) {
    super();
  }
  run() {
    return this.f(this.first.run()).run();
  }
}

class AsyncNow<A> extends Now<Future<A>> {
  constructor(private comp: IO<A>) {
    super();
  }
  run(): Future<A> {
    return fromPromise<A>(runIO(this.comp));
  }
}

/**
 * Run an asynchronous IO action and return a future in the Now monad
 * that resolves with the eventual result of the IO action once it
 * completes. This function is what allows the Now monad to execute
 * imperative actions in a way that is pure and integrated with FRP.
 */
export function async<A>(comp: IO<A>): Now<Future<A>> {
  return new AsyncNow(comp);
}

class SampleNow<A> extends Now<A> {
  constructor(private b: Behavior<A>) {
    super();
  }
  run(): A {
    return at(this.b);
  }
}

/**
 * Returns the current value of a behavior in the Now monad. This is
 * possible because computations in the Now monad have an associated
 * point in time.
 */
export function sample<A>(b: Behavior<A>): Now<A> {
  return new SampleNow(b);
}

class PerformIOStream<A> extends Stream<A> {
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this);
  }
  push(io: IO<A>): void {
    runIO(io).then((a: A) => this.child.push(a));
  }
}

class PerformStreamNow<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOStream(this.s);
  }
}

/**
 * Takes a stream of `IO` actions and return a stream in a now
 * computation. When run the now computation executes each `IO` action
 * and delivers their result into the created stream.
 */
export function performStream<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return new PerformStreamNow(s);
}

function run<A>(now: Now<A>): A {
  return now.run();
}

class PlanNow<A> extends Now<Future<A>> {
  constructor(private future: Future<Now<A>>) {
    super();
  }
  run(): Future<A> {
    return this.future.map(run);
  }
}

/**
 * Convert a future now computation into a now computation of a
 * future. This function is what allows a Now-computation to reach
 * beyond the current moment that it is running in.
 */
export function plan<A>(future: Future<Now<A>>): Now<Future<A>> {
  return new PlanNow(future);
}

/**
 * Run the given Now-computation. The returned promise resolves once
 * the future that is the result of running the now computation
 * occurs. This is an impure function and should not be used in normal
 * application code.
 */
export function runNow<A>(now: Now<Future<A>>): Promise<A> {
  return new Promise((resolve, reject) => {
    now.run().subscribe(resolve);
  });
}
