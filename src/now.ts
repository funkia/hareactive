import { IO, runIO } from "@funkia/io";
import { placeholder } from "./placeholder";
import { Time, SListener } from "./common";
import { Future, fromPromise, mapCbFuture } from "./future";
import { Node } from "./datastructures";
import { Behavior } from "./behavior";
import { ActiveStream, Stream, mapCbStream, isStream } from "./stream";
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
  static multi: boolean = false;
  multi: boolean = false;
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
  flatten<B>(this: Now<Now<B>>): Now<B> {
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
  constructor(private cb: () => A) {
    super();
  }
  run(): A {
    return this.cb();
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

export function performStream<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return perform(() =>
    mapCbStream<IO<A>, A>((io, cb) => runIO(io).then(cb), s)
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

class PerformIOLatestStream<A> extends ActiveStream<A>
  implements SListener<IO<A>> {
  private node: Node<this> = new Node(this);
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this.node, tick());
  }
  next: number = 0;
  newest: number = 0;
  running: number = 0;
  pushS(_t: number, io: IO<A>): void {
    const time = ++this.next;
    this.running++;
    runIO(io).then((a: A) => {
      this.running--;
      if (time > this.newest) {
        const t = tick();
        if (this.running === 0) {
          this.next = 0;
          this.newest = 0;
        } else {
          this.newest = time;
        }
        this.pushSToChildren(t, a);
      }
    });
  }
}

export class PerformStreamLatestNow<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOLatestStream(this.s);
  }
}

export function performStreamLatest<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return perform(() => new PerformIOLatestStream(s));
}

class PerformIOStreamOrdered<A> extends ActiveStream<A> {
  private node: Node<this> = new Node(this);
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this.node, tick());
  }
  nextId: number = 0;
  next: number = 0;
  buffer: { value: A }[] = []; // Object-wrapper to support a result as undefined
  pushS(_t: number, io: IO<A>): void {
    const id = this.nextId++;
    runIO(io).then((a: A) => {
      if (id === this.next) {
        this.buffer[0] = { value: a };
        this.pushFromBuffer();
      } else {
        this.buffer[id - this.next] = { value: a };
      }
    });
  }
  pushFromBuffer(): void {
    while (this.buffer[0] !== undefined) {
      const t = tick();
      const { value } = this.buffer.shift();
      this.pushSToChildren(t, value);
      this.next++;
    }
  }
}

export class PerformStreamOrderedNow<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOStreamOrdered(this.s);
  }
}

export function performStreamOrdered<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return new PerformStreamOrderedNow(s);
}

class PlanNow<A> extends Now<Future<A>> {
  constructor(private future: Future<Now<A>>) {
    super();
  }
  run(time: Time): Future<A> {
    return this.future.map((n) => n.run(time));
  }
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
    const returned: (keyof A)[] = <any>Object.keys(result);
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
