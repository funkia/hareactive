// An occurence is a thing that occurs at some point in time with a
// value. It can be understood as a pair consisting of the time the
// occurence occurs and its associated value. In a sense it is quite
// like a regular JavaScript promise

interface Consumer<A> {
  push(a: A): void;
}

abstract class Producer<A> {
  protected listeners: Consumer<A>[];
  constructor() {
    this.listeners = [];
  }
  public listen(o: Consumer<A>): void {
    this.listeners.push(o);
  }
  public subscribe(f: (a: A) => void): Subscribtion<A> {
    return new Subscribtion(f, this);
  }
}

export abstract class Occurence<A> extends Producer<A> implements Consumer<any> {
  // An occurence is a functor, when the occurence occurs we can feed
  // is't result through the mapping function
  // public map(f: (a: A) => B): Occurence<B> {}

  // The Occurences that depends on this occurence. These should be
  // notified when this occurence is resolved.
  protected listeners: Consumer<A>[];
  // `push` is called by the parent of an occurence once it resolves
  // with a value.
  public abstract push(val: any): void;
  public listen(o: Consumer<A>): void {
    this.listeners.push(o);
  }
  public subscribe(f: (a: A) => void): Subscribtion<A> {
    return new Subscribtion(f, this);
  }
}

// I SinkOccurence is an occurence that one can imperatively resolve.
class Sink<A> extends Producer<A> {
  protected listeners: Consumer<A>[];
  public push(val: A): void {
    throw new Error("Cannot push to a SinkOccurence");
  }
  public listen(o: Consumer<A>): void {
    this.listeners.push(o);
  }
  public subscribe(f: (a: A) => void): Subscribtion<A> {
    return new Subscribtion(f, this);
  }
  public resolve(val: A): void {
    // Imperatively resolve the sink with a value
    const listeners = this.listeners;
    for (let i = 0, l = listeners.length; i < l; ++i) {
      listeners[i].push(val);
    }
  }
}

class Subscribtion<A> implements Consumer<A> {
  constructor(private f: (a: A) => void, private parent: Producer<A>) {
    parent.listen(this);
  }
  public push(a: A): void {
    this.f(a); // let `f` perform its side-effect.
  }
}

export function sink<A>(): Sink<A> {
  return new Sink();
}
