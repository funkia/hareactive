import {IO, runIO} from "jabz/io";
import {Monad} from "jabz/monad";

import {Future, fromPromise, sink} from "./Future";
import {Behavior, at} from "./Behavior";

/**
 * The Now monad represents a computation that takes place in a given
 * momemt and where the moment will always be now.
 */

export abstract class Now<A> {//implements Monad<A> {
  // Impurely run the now computation
  abstract run(): A;
  public of<B>(b: B): Now<B> {
    return new OfNow(b);
  }
  static of<B>(b: B): Now<B> {
    return new OfNow(b);
  }
  public chain<B>(f: (a: A) => Now<B>): Now<B> {
    return new ChainNow(this, f);
  }
  public flatten<B>(now: Now<Now<A>>): Now<A> {
    return now.chain((n: Now<A>) => n);
  }
  map<B>(f: (a: A) => B): Now<B> {
    return this.chain((a: A) => this.of(f(a)));
  }
  mapTo<B>(b: B): Now<B> {
    return this.chain((_) => this.of(b));
  }
  lift<T1, R>(f: (t: T1) => R, m: Now<T1>): Now<R>;
  lift<T1, T2, R>(f: (t: T1, u: T2) => R, m1: Now<T1>, m2: Now<T2>): Now<R>;
  lift<T1, T2, T3, R>(f: (t1: T1, t2: T2, t3: T3) => R, m1: Now<T1>, m2: Now<T2>, m3: Now<T3>): Now<R>;
  lift(f: Function, ...ms: any[]): Now<any> {
    const {of} = ms[0];
    switch (f.length) {
    case 1:
      return ms[0].map(f);
    case 2:
      return ms[0].chain((a: any) => ms[1].chain((b: any) => of(f(a, b))));
    case 3:
      return ms[0].chain((a: any) => ms[1].chain((b: any) => ms[2].chain((c: any) => of(f(a, b, c)))));
    }
  }
}

class OfNow<A> extends Now<A> {
  constructor(private value: A) {
    super();
  }
  public run() {
    return this.value;
  }
}

class ChainNow<B> extends Now<B> {
  constructor(private first: Now<any>, private f: (a: any) => Now<B>) {
    super();
  }
  public run() {
    return this.f(this.first.run()).run();
  }
}

class AsyncNow<A> extends Now<Future<A>> {
  constructor(private comp: IO<A>) {
    super();
  }
  public run(): Future<A> {
    return fromPromise<A>(runIO(this.comp));
  }
}

export function async<A>(comp: IO<A>): Now<Future<A>> {
  return new AsyncNow(comp);
}

class SampleNow<A> extends Now<A> {
  constructor(private b: Behavior<A>) {
    super();
  }
  public run(): A {
    return at(this.b);
  }
}

export function sample<A>(b: Behavior<A>): Now<A> {
  return new SampleNow(b);
}

function run<A>(now: Now<A>): A {
  return now.run();
}

class PlanNow<A> extends Now<Future<A>> {
  constructor(private future: Future<Now<A>>) {
    super();
  }
  public run(): Future<A> {
    return this.future.map(run);
  }
}

export function plan<A>(future: Future<Now<A>>): Now<Future<A>> {
  return new PlanNow(future);
}

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
