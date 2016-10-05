export interface Consumer<A> {
  push(a: A, changed?: any): void;
}

export class NoopConsumer implements Consumer<any> {
  push(): void {};
}

export const noopConsumer = new NoopConsumer();

export class MultiConsumer<A> implements Consumer<A> {
  listeners: Consumer<A>[];
  constructor(c1: Consumer<A>, c2: Consumer<A>) {
    this.listeners = [c1, c2];
  }
  push(a: A): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].push(a);
    }
  }
}

export abstract class Reactive<A> {
  child: Consumer<A>;
  nrOfListeners: number;

  constructor() {
    this.child = noopConsumer;
    this.nrOfListeners = 0;
  }
  subscribe(fn: (a: A) => void): Consumer<A> {
    const listener = {push: fn};
    this.addListener(listener);
    return listener;
  }
  addListener(c: Consumer<A>): void {
    const nr = ++this.nrOfListeners;
    if (nr === 1) {
      this.child = c;
    } else if (nr === 2) {
      this.child = new MultiConsumer(this.child, c);
    } else {
      (<MultiConsumer<A>>this.child).listeners.push(c);
    }
  }
  removeListener(listener: Consumer<any>): void {
    const nr = --this.nrOfListeners;
    if (nr === 0) {
      this.child = noopConsumer;
    } else if (nr === 1) {
      const l = (<MultiConsumer<A>>this.child).listeners;
      this.child = l[l[0] === listener ? 1 : 0];
    } else {
      const l = (<MultiConsumer<A>>this.child).listeners;
      // The indexOf here is O(n), where n is the number of listeners,
      // if using a linked list it should be possible to perform the
      // unsubscribe operation in constant time.
      const idx = l.indexOf(listener);
      if (idx !== -1) {
        if (idx !== l.length - 1) {
          l[idx] = l[l.length - 1];
        }
        l.length--; // remove the last element of the list
      }
    }
  }
}

/**
 * Things capable of observing behaviors
 */
export interface Observer<A> {
  beginPulling(): void;
  endPulling(): void;
  push(a: A): void;
}

export class MultiObserver<A> implements Observer<A> {
  listeners: Observer<A>[];
  constructor(c1: Observer<A>, c2: Observer<A>) {
    this.listeners = [c1, c2];
  }
  beginPulling(): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].beginPulling();
    }
  }
  endPulling(): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].endPulling();
    }
  }
  push(a: A): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].push(a);
    }
  }
}

class NoopObserver<A> implements Observer<A> {
  beginPulling(): void {}
  endPulling(): void {}
  push(a: A): void {}
}

export const noopObserver: Observer<any> = new NoopObserver();
