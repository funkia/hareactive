import {IO, runIO} from "jabz/io";

import {Future, fromPromise} from "./Future";
import {Behavior} from "./Behavior";

/**
 * The Now monad represents a computation that takes place in a given
 * momemt and where the moment will always be now.
 */
// class Now<A> {
//   public operations: NowOperation<any>[] = [];
//   constructor() {}
// }

export abstract class Now<A> {
  // Impurely run the now computation
  abstract run(): A;
  static of<B>(a: B): Now<B> {
    return new OfOperation(a);
  }
  public chain<B>(f: (a: A) => Now<B>): Now<B> {
    return new ChainOperation(this, f);
  }
}

class OfOperation<A> extends Now<A> {
  constructor(private value: A) {
    super();
  }
  public run() {
    return this.value;
  }
}

class ChainOperation<B> extends Now<B> {
  constructor(private first: Now<any>, private f: (a: any) => Now<B>) {
    super();
  }
  public run() {
    return this.f(this.first.run()).run();
  }
}

class AsyncOperation<A> extends Now<Future<A>> {
  constructor(private comp: IO<A>) {
    super();
  }
  public run() {
    return fromPromise<A>(runIO(this.comp));
  }
}

export function async<A>(comp: IO<A>): Now<Future<A>> {
  return new AsyncOperation(comp);
}

// export function sample<A>(b: Behavior<A>): A {
// }

// export function plan<A>(b: Future<Now<A>>): Now<Future<A>> {
// }

/**
 * Run the given now computation. The returned promise resolves once
 * the future that is the result of running the now computation
 * occurs.
 */
export function runNow<A>(now: Now<Future<A>>): Promise<A> {
  return new Promise((resolve, reject) => {
    now.run().subscribe(resolve);
  });
}
