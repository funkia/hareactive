// An occurence is a thing that occurs at some point in time with a
// value. It can be understood as a pair consisting of the time the
// occurence occurs and its associated value. In a sense it is quite
// like a JavaScript promise

interface Consumer<A> {
  push(a: A): void;
}

export abstract class Occurence<A> implements Consumer<any> {
  // Flag indicating wether or not this occurence has occured.
  protected occured: boolean;
  // The value of the occurence. `undefined` until occurence.
  protected value: A;
  // The consumers that depends on this producer. These should be
  // notified when the producer has a value.
  protected listeners: Consumer<A>[];
  constructor() {
    this.listeners = [];
  }
  public listen(o: Consumer<A>): void {
    if (this.occured !== true) {
      this.listeners.push(o);
    } else {
      o.push(this.value);
    }
  }
  public subscribe(f: (a: A) => void): Subscribtion<A> {
    return new Subscribtion(f, this);
  }
  // `push` is called by the parent of an occurence once it resolves
  // with a value.
  public abstract push(val: any): void;
  public resolve(val: A): void {
    this.occured = true;
    const listeners = this.listeners;
    for (let i = 0, l = listeners.length; i < l; ++i) {
      listeners[i].push(val);
    }
  }
  // An occurence is a functor, when the occurence occurs we can feed
  // is't result through the mapping function
  public map<B>(f: (a: A) => B): Occurence<B> {
    return new MapOccurence(f, this);
  }
  public mapTo<B>(b: B): Occurence<B> {
    return new MapToOccurence<B>(b, this);
  }
}

class MapOccurence<A, B> extends Occurence<B> {
  constructor(private f: (a: A) => B, private parent: Occurence<A>) {
    super();
    parent.listen(this);
  }
  public push(val: any): void {
    this.resolve(this.f(val));
  }
}

class MapToOccurence<A> extends Occurence<A> {
  constructor(protected value: A, private parent: Occurence<any>) {
    super();
    parent.listen(this);
  }
  public push(_: any): void {
    this.resolve(this.value);
  }
}

// I Sink is a producer that one can imperatively resolve.
class Sink<A> extends Occurence<A> {
  public push(val: any): void {
    throw new Error("A sink should never be pushed");
  }
}

// A subscribtion is a consumer that performs a side
class Subscribtion<A> implements Consumer<A> {
  constructor(private f: (a: A) => void, private parent: Occurence<A>) {
    parent.listen(this);
  }
  public push(a: A): void {
    this.f(a); // let `f` perform its side-effect.
  }
}

export function sink<A>(): Sink<A> {
  return new Sink<A>();
}
