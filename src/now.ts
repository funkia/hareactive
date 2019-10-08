import { IO, runIO } from "@funkia/io";
import { placeholder } from "./placeholder";
import { Time } from "./common";
import { Future, fromPromise, mapCbFuture } from "./future";
import { Behavior } from "./behavior";
import { Stream, mapCbStream, isStream } from "./stream";
import { tick } from "./clock";

export type MapNowTuple<A> = { [K in keyof A]: Now<A[K]> };

export abstract class Now<A> {
  isNow: true;
  constructor() {
    this.isNow = true;
  }
  static is(a: any): a is Now<any> {
    return typeof a === "object" && a.isNow === true;
  }
  abstract run(time: Time): A;
  of<B>(b: B): Now<B> {
    return new OfNow(b);
  }
  static of<B>(b: B): Now<B> {
    return new OfNow(b);
  }
  static multi = false;
  multi = false;
  map<B>(f: (a: A) => B): Now<B> {
    return new MapNow(f, this);
  }
  mapTo<B>(b: B): Now<B> {
    return new MapNow((_) => b, this);
  }
  flatMap<B>(f: (a: A) => Now<B>): Now<B> {
    return new FlatMapNow(this, f);
  }
  chain<B>(f: (a: A) => Now<B>): Now<B> {
    return new FlatMapNow(this, f);
  }
  flat<B>(this: Now<Now<B>>): Now<B> {
    return new FlatMapNow(this, (n) => n);
  }
  ap<B>(a: Now<(a: A) => B>): Now<B> {
    return this.lift((f, a) => f(a), a, this);
  }
  lift<A extends any[], R>(
    f: (...args: A) => R,
    ...args: MapNowTuple<A>
  ): Now<R> {
    return args.length === 1
      ? new MapNow(f as any, args[0])
      : new LiftNow(f, args);
  }
}

export class OfNow<A> extends Now<A> {
  constructor(private value: A) {
    super();
  }
  run(_: Time): A {
    return this.value;
  }
}

export class MapNow<A, B> extends Now<B> {
  constructor(private f: (a: A) => B, private parent: Now<A>) {
    super();
  }
  run(t: Time): B {
    return this.f(this.parent.run(t));
  }
}

export class LiftNow<A extends any[], R> extends Now<R> {
  constructor(readonly f: Function, readonly parents: A) {
    super();
  }
  run(t: Time): R {
    return this.f(...this.parents.map((n) => n.run(t)));
  }
}

export class FlatMapNow<A, B> extends Now<B> {
  constructor(private first: Now<A>, private f: (a: A) => Now<B>) {
    super();
  }
  run(t: Time): B {
    return this.f(this.first.run(t)).run(t);
  }
}

export class SampleNow<A> extends Now<A> {
  constructor(private b: Behavior<A>) {
    super();
  }
  run(t: Time): A {
    return this.b.at(t);
  }
}

export function sample<A>(b: Behavior<A>): Now<A> {
  return new SampleNow(b);
}

export class PerformNow<A> extends Now<A> {
  constructor(private _run: () => A) {
    super();
  }
  run(): A {
    return this._run();
  }
}

/**
 * Create a now-computation that executes the effectful computation `cb` when it
 * is run.
 */
export function perform<A>(cb: () => A): Now<A> {
  return new PerformNow(cb);
}

export function performIO<A>(comp: IO<A>): Now<Future<A>> {
  return perform(() => fromPromise(runIO(comp)));
}

export function performStream<A>(s: Stream<IO<A>>): Now<Stream<Future<A>>> {
  return perform(() =>
    mapCbStream<IO<A>, Future<A>>((io, cb) => cb(fromPromise(runIO(io))), s)
  );
}

export class PerformMapNow<A, B> extends Now<Stream<B> | Future<B>> {
  constructor(private cb: (a: A) => B, private s: Stream<A> | Future<A>) {
    super();
  }
  run(): Stream<B> | Future<B> {
    return isStream(this.s)
      ? mapCbStream((value, done) => done(this.cb(value)), this.s)
      : mapCbFuture((value, done) => done(this.cb(value)), this.s);
  }
}

/**
 * Maps a function with side-effects over a future or stream.
 */
export function performMap<A, B>(cb: (a: A) => B, f: Future<A>): Now<Future<B>>;
export function performMap<A, B>(cb: (a: A) => B, s: Stream<A>): Now<Stream<B>>;
export function performMap<A, B>(
  cb: (a: A) => B,
  s: Stream<A> | Future<A>
): Now<Stream<B> | Future<B>> {
  return perform(() =>
    isStream(s)
      ? mapCbStream((value, done) => done(cb(value)), s)
      : mapCbFuture((value, done) => done(cb(value)), s)
  );
}

export function plan<A>(future: Future<Now<A>>): Now<Future<A>> {
  return performMap<Now<A>, A>(runNow, future);
}

export function runNow<A>(now: Now<A>, time: Time = tick()): A {
  return now.run(time);
}

export interface ReactivesObject {
  [a: string]: Behavior<any> | Stream<any>;
}

const placeholderProxyHandler = {
  get: function(target: any, name: string): Behavior<any> | Stream<any> {
    if (!(name in target)) {
      target[name] = placeholder();
    }
    return target[name];
  }
};

class LoopNow<A extends ReactivesObject> extends Now<A> {
  constructor(
    private fn: (a: A) => Now<A>,
    private placeholderNames?: string[]
  ) {
    super();
  }
  run(t: Time): A {
    let placeholderObject: any;
    if (this.placeholderNames === undefined) {
      placeholderObject = new Proxy({}, placeholderProxyHandler);
    } else {
      placeholderObject = {};
      for (const name of this.placeholderNames) {
        placeholderObject[name] = placeholder();
      }
    }
    const result = this.fn(placeholderObject).run(t);
    const returned: (keyof A)[] = Object.keys(result) as any;
    for (const name of returned) {
      placeholderObject[name].replaceWith(result[name]);
    }
    return result;
  }
}

export function loopNow<A extends ReactivesObject>(
  fn: (a: A) => Now<A>,
  names?: string[]
): Now<A> {
  return new LoopNow(fn, names);
}

export type InstantRun = <A>(now: Now<A>) => A;

export class InstantNow<A> extends Now<A> {
  constructor(private fn: (run: InstantRun) => A) {
    super();
  }
  run(t: Time): A {
    return this.fn((now) => now.run(t));
  }
}

export function instant<A>(fn: (run: InstantRun) => A): Now<A> {
  return new InstantNow(fn);
}
