import { Cons, cons } from "./linkedlist";
import { Behavior } from "./behavior";

export type Time = number;

function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && ("at" in b);
}

export const enum State {
  // Values are pushed to listeners
  Push,
  // Values should be pulled by listeners
  Pull,
  // Values should be pulled and the reactive will _never_ switch
  // state to `Push`
  OnlyPull,
  // Most, but not all, reactives start in this state
  Inactive,
  // The reactive value will never update again
  Done
}

export interface Observer<A> {
  push(a: A): void;
  changeStateDown(state: State): void;
}

export class PushOnlyObserver<A> {
  constructor(private callback: (a: A) => void, private source: Reactive<A>) {
    source.addListener(this);
    if (isBehavior(source) && source.state === State.Push) {
      callback(source.at());
    }
  }
  push(a: any): void {
    this.callback(a);
  }
  deactivate(): void {
    this.source.removeListener(this);
  }
  changeStateDown(state: State): void { }
}

export class MultiObserver<A> implements Observer<A> {
  listeners: Observer<A>[];
  constructor(c1: Observer<A>, c2: Observer<A>) {
    this.listeners = [c1, c2];
  }
  push(a: A): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].push(a);
    }
  }
  changeStateDown(state: State): void {
    for (let i = 0; i < this.listeners.length; ++i) {
      this.listeners[i].changeStateDown(state);
    }
  }
}

export interface Subscriber<A> extends Observer<A> {
  deactivate(): void;
}

export function addListenerParents(
  child: Observer<any>, parents: Cons<Reactive<any>>, state: State
): State {
  const parentState = parents.value.addListener(child);
  const newState = parentState !== State.Push ? parentState : state;
  if (parents.tail !== undefined) {
    return addListenerParents(child, parents.tail, newState);
  } else {
    return newState;
  }
}

export function removeListenerParents(
  child: Observer<any>, parents: Cons<Reactive<any>>
): void {
  parents.value.removeListener(child);
  if (parents.tail !== undefined) {
    removeListenerParents(child, parents.tail);
  }
}

export function changePullersParents(n: number, parents: Cons<Reactive<any>>): void {
  if (isBehavior(parents.value)) {
    parents.value.changePullers(n);
  }
  if (parents.tail !== undefined) {
    changePullersParents(n, parents.tail);
  }
}

export abstract class Reactive<A> implements Observer<any> {
  child: Observer<A>;
  nrOfListeners: number;
  state: State;
  parents: Cons<Reactive<any>>;
  constructor() {
    this.state = State.Inactive;
    this.nrOfListeners = 0;
  }
  addListener(c: Observer<A>): State {
    const nr = ++this.nrOfListeners;
    if (nr === 1) {
      this.child = c;
      this.activate();
    } else if (nr === 2) {
      this.child = new MultiObserver(this.child, c);
    } else {
      (<MultiObserver<A>>this.child).listeners.push(c);
    }
    return this.state;
  }
  removeListener(listener: Observer<any>): void {
    const nr = --this.nrOfListeners;
    if (nr === 0) {
      this.child = undefined;
      if (this.state !== State.Done) {
        this.deactivate();
      }
    } else if (nr === 1) {
      const l = (<MultiObserver<A>>this.child).listeners;
      this.child = l[l[0] === listener ? 1 : 0];
    } else {
      const l = (<MultiObserver<A>>this.child).listeners;
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
  changeStateDown(state: State): void {
    if (this.child !== undefined) {
      this.child.changeStateDown(state);
    }
  }
  subscribe(callback: (a: A) => void): Subscriber<A> {
    return new PushOnlyObserver(callback, this);
  }
  observe(
    push: (a: A) => void,
    beginPulling: () => void,
    endPulling: () => void
  ): CbObserver<A> {
    return new CbObserver(push, beginPulling, endPulling, this);
  }
  abstract push(a: any): void;
  activate(): void {
    this.state = addListenerParents(this, this.parents, State.Push);
  }
  deactivate(done = false): void {
    removeListenerParents(this, this.parents);
    this.state = done === true ? State.Done : State.Inactive;
  }
}

export class CbObserver<A> implements Observer<A> {
  constructor(
    private _push: (a: A) => void,
    private _beginPulling: () => void,
    private _endPulling: () => void,
    private source: Reactive<A>
  ) {
    source.addListener(this);
    if (source.state === State.Pull || source.state === State.OnlyPull) {
      _beginPulling();
    } else if (isBehavior(source) && source.state === State.Push) {
      _push(source.last);
    }
  }
  push(a: A): void {
    this._push(a);
  }
  changeStateDown(state: State): void {
    if (state === State.Pull || state === State.OnlyPull) {
      this._beginPulling();
    } else {
      this._endPulling();
    }
  }
}

/**
 * Observe a behavior for the purpose of running side-effects based on
 * the value of the behavior.
 * @param push Called with all values that the behavior pushes
 * through.
 * @param beginPulling Called when the consumer should begin pulling
 * values from the behavior.
 * @param endPulling Called when the consumer should stop pulling.
 * @param behavior The behavior to consume.
 */
export function observe<A>(
  push: (a: A) => void,
  beginPulling: () => void,
  endPulling: () => void,
  behavior: Behavior<A>
): CbObserver<A> {
  return behavior.observe(push, beginPulling, endPulling);
}
