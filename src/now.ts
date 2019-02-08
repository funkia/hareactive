import { IO, runIO, Monad, monad } from "@funkia/jabz";
import { placeholder } from "./placeholder";
import { Time, SListener } from "./common";
import { Future, fromPromise, mapCbFuture } from "./future";
import { Node } from "./datastructures";
import { Behavior, at } from "./behavior";
import { ActiveStream, Stream, mapCbStream, empty, isStream } from "./stream";
import { tick } from "./clock";

@monad
export abstract class Now<A> implements Monad<A> {
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
  flatMap<B>(f: (a: A) => Now<B>): Now<B> {
    return new FlatMapNow(this, f);
  }
  chain<B>(f: (a: A) => Now<B>): Now<B> {
    return new FlatMapNow(this, f);
  }
  static multi: boolean = false;
  multi: boolean = false;

  abstract test(mocks: any[], t: Time): { value: A; mocks: any[] };

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
  run(_: Time): A {
    return this.value;
  }
  test(mocks: any[], _: Time): { value: A; mocks: any[] } {
    return { value: this.value, mocks };
  }
}

class FlatMapNow<A, B> extends Now<B> {
  constructor(private first: Now<A>, private f: (a: A) => Now<B>) {
    super();
  }
  run(t: Time): B {
    return this.f(this.first.run(t)).run(t);
  }
  test(mocks: any[], t: Time): { value: B; mocks: any[] } {
    const { value, mocks: m } = this.first.test(mocks, t);
    return this.f(value).test(m, t);
  }
}

class SampleNow<A> extends Now<A> {
  constructor(private b: Behavior<A>) {
    super();
  }
  run(t: Time): A {
    return this.b.at(t);
  }
  test(mocks: any[], t: Time): { value: A; mocks: any[] } {
    return { value: this.b.semantic()(t), mocks };
  }
}

export function sample<A>(b: Behavior<A>): Now<A> {
  return new SampleNow(b);
}

class PerformNow<A> extends Now<A> {
  constructor(private cb: () => A) {
    super();
  }
  run(): A {
    return this.cb();
  }

  test([value, ...mocks]: any[], t: Time): { value: A; mocks: any[] } {
    return { value, mocks };
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

class PerformMapNow<A, B> extends Now<Stream<B> | Future<B>> {
  constructor(private cb: (a: A) => B, private s: Stream<A> | Future<A>) {
    super();
  }
  run(): Stream<B> | Future<B> {
    return isStream(this.s)
      ? mapCbStream((value, done) => done(this.cb(value)), this.s)
      : mapCbFuture((value, done) => done(this.cb(value)), this.s);
  }

  test(
    [value, ...mocks]: any[],
    _: Time
  ): { value: Stream<B> | Future<B>; mocks } {
    return { value, mocks };
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
  return perform(
    () =>
      isStream(s)
        ? mapCbStream((value, done) => done(cb(value)), s)
        : mapCbFuture((value, done) => done(cb(value)), s)
  );
}

class PerformIOStreamLatest<A> extends ActiveStream<A>
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

class PerformStreamNowLatest<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOStreamLatest(this.s);
  }

  test([value, ...mocks]: any[], _: Time): { value: Stream<A>; mocks } {
    return { value, mocks };
  }
}

export function performStreamLatest<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return perform(() => new PerformIOStreamLatest(s));
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
  pushS(t: number, io: IO<A>): void {
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

class PerformStreamNowOrdered<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOStreamOrdered(this.s);
  }

  test([value, ...mocks]: any[], _: Time): { value: Stream<A>; mocks } {
    return { value, mocks };
  }
}

export function performStreamOrdered<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return new PerformStreamNowOrdered(s);
}

class PlanNow<A> extends Now<Future<A>> {
  constructor(private future: Future<Now<A>>) {
    super();
  }
  run(time: Time): Future<A> {
    return this.future.map((n) => n.run(time));
  }

  test(mocks: any[], t: Time): { value: Future<A>; mocks: any[] } {
    throw new Error("The PlanNow computation does not support testing yet");
  }
}

export function plan<A>(future: Future<Now<A>>): Now<Future<A>> {
  return performMap<Now<A>, A>(runNow, future);
}

export function runNow<A>(now: Now<A>, time: Time = tick()): A {
  return now.run(time);
}

/**
 * Test run a now computation without executing its side-effects.
 * @param now The now computation to test.
 * @param time The point in time at which the now computation should
 * be run. Defaults to 0.
 */
export function testNow<A>(now: Now<A>, mocks: any[] = [], time: Time = 0): A {
  return now.test(mocks, time).value;
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

  test(mocks: any[], t: Time): { value: A; mocks: any[] } {
    throw new Error("The LoopNow computation does not support testing yet");
  }
}

export function loopNow<A extends ReactivesObject>(
  fn: (a: A) => Now<A>,
  names?: string[]
): Now<A> {
  return new LoopNow(fn, names);
}
