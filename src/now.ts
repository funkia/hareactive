import {IO, runIO} from "jabz/io";
import {Monad, monad} from "jabz/monad";

import {Future, fromPromise, sinkFuture} from "./future";
import {Behavior, at} from "./behavior";
import {Stream} from "./stream";

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

export function performStream<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return new PerformStreamNow(s);
}

class PerformIOStreamLatest<A> extends Stream<A> {
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this);
  }
  id: number = 0;
  latest: number = 0;
  push(io: IO<A>): void {
    const id = this.id++;
    runIO(io).then((a: A) => {
      if (id > this.latest) {
	this.latest = id;
	this.child.push(a);
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
}

export function performStreamLatest<A>(s: Stream<IO<A>>): Now<Stream<A>> {
  return new PerformStreamNowLatest(s);
}

class PerformIOStreamOrdered<A> extends Stream<A> {
  constructor(s: Stream<IO<A>>) {
    super();
    s.addListener(this);
  }
  id: number = 0;
  next: number = 0;
  storedResults: A[] = [];
  push(io: IO<A>): void {
    const id = this.id++;
    runIO(io).then((a: A) => {
      if (id === this.next) {
	this.next++;
	this.child.push(a);
	while (this.storedResults[this.next] !== undefined) {
	  this.child.push(this.storedResults[this.next]);
	  this.next++;
	}
      } else {
	this.storedResults[id] = a;
      }
    });
  }
}

class PerformStreamNowOrdered<A> extends Now<Stream<A>> {
  constructor(private s: Stream<IO<A>>) {
    super();
  }
  run(): Stream<A> {
    return new PerformIOStreamOrdered(this.s);
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
}

export function plan<A>(future: Future<Now<A>>): Now<Future<A>> {
  return new PlanNow(future);
}

export function runNow<A>(now: Now<Future<A>>): Promise<A> {
  return new Promise((resolve, reject) => {
    now.run().subscribe(resolve);
  });
}
