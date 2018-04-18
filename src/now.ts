import { IO, runIO, Monad, monad } from "@funkia/jabz";
import { placeholder, Placeholder } from "./placeholder";
import { State, Time } from "./common";
import { Future, fromPromise, sinkFuture } from "./future";
import { Node } from "./datastructures";
import { Behavior, at } from "./behavior";
import { ActiveStream, Stream } from "./stream";

@monad
export abstract class Now<A> implements Monad<A> {
  // Impurely run the now computation
  isNow: true;
  constructor() {
    this.isNow = true;
  }
  static is(a: any): a is Now<any> {
    return typeof a === "object" && a.isNow === true;
  }
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
  run(): A {
    return this.value;
  }
  test(mocks: any[], _: Time): { value: A; mocks: any[] } {
    return { value: this.value, mocks };
  }
}

class ChainNow<A, B> extends Now<B> {
  constructor(private first: Now<A>, private f: (a: A) => Now<B>) {
    super();
  }
  run(): B {
    return this.f(this.first.run()).run();
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
  run(): A {
    return at(this.b);
  }
  test(mocks: any[], t: Time): { value: A; mocks: any[] } {
    return { value: this.b.semantic()(t), mocks };
  }
}

export function sample<A>(b: Behavior<A>): Now<A> {
  return new SampleNow(b);
}

class PerformNow<A> extends Now<Future<A>> {
  constructor(private comp: IO<A>) {
    super();
  }
  run(): Future<A> {
    return fromPromise(runIO(this.comp));
  }

  test([value, ...mocks]: any[], t: Time): { value: Future<A>; mocks: any[] } {
    return { value: fromPromise(Promise.resolve(value)), mocks };
  }
}

export function perform<A>(comp: IO<A>): Now<Future<A>> {
  return new PerformNow(comp);
}

class PerformIOStream<A> extends ActiveStream<A> {
  node = new Node(this);
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this.node);
    this.state = State.Push;
  }
  push(io: IO<A>): void {
    runIO(io).then((a: A) => {
      this.pushToChildren(a);
    });
  }
}

class PerformStreamNow<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOStream(this.s);
  }

  test([value, ...mocks]: any[], _: Time): { value: Stream<A>; mocks } {
    return { value, mocks };
  }
}

export function performStream<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return new PerformStreamNow(s);
}

class PerformIOStreamLatest<A> extends ActiveStream<A> {
  private node = new Node(this);
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this.node);
  }
  next: number = 0;
  newest: number = 0;
  running: number = 0;
  push(io: IO<A>): void {
    const time = ++this.next;
    this.running++;
    runIO(io).then((a: A) => {
      this.running--;
      if (time > this.newest) {
        if (this.running === 0) {
          this.next = 0;
          this.newest = 0;
        } else {
          this.newest = time;
        }
        this.pushToChildren(a);
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
  return new PerformStreamNowLatest(s);
}

class PerformIOStreamOrdered<A> extends ActiveStream<A> {
  private node = new Node(this);
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this.node);
  }
  nextId: number = 0;
  next: number = 0;
  buffer: { value: A }[] = []; // Object-wrapper to support a result as undefined
  push(io: IO<A>): void {
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
      const { value } = this.buffer.shift();
      this.pushToChildren(value);
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

  test(mocks: any[], t: Time): { value: Future<A>; mocks: any[] } {
    throw new Error("The PlanNow computation does not support testing yet");
  }
}

export function plan<A>(future: Future<Now<A>>): Now<Future<A>> {
  return new PlanNow(future);
}

export function runNow<A>(now: Now<Future<A>>): Promise<A> {
  return new Promise((resolve, reject) => {
    now.run().subscribe(resolve);
  });
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
  run(): A {
    let placeholderObject: any;
    if (this.placeholderNames === undefined) {
      placeholderObject = new Proxy({}, placeholderProxyHandler);
    } else {
      placeholderObject = {};
      for (const name of this.placeholderNames) {
        placeholderObject[name] = placeholder();
      }
    }

    const result = this.fn(placeholderObject).run();
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
