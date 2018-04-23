import { Cons, cons, DoubleLinkedList, Node } from "./datastructures";
import { Behavior } from "./behavior";

export type Time = number;

function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && "at" in b;
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
  node = new Node(this);
  constructor(private callback: (a: A) => void, private source: Reactive<A>) {
    source.addListener(this.node);
    if (isBehavior(source) && source.state === State.Push) {
      callback(source.at());
    }
  }
  push(a: any): void {
    this.callback(a);
  }
  deactivate(): void {
    this.source.removeListener(this.node);
  }
  changeStateDown(state: State): void {}
}

export interface Subscriber<A> extends Observer<A> {
  deactivate(): void;
}

export function changePullersParents(
  n: number,
  parents: Cons<Reactive<any>>
): void {
  if (parents === undefined) {
    return;
  }
  if (isBehavior(parents.value)) {
    parents.value.changePullers(n);
  }
  changePullersParents(n, parents.tail);
}

type NodeParentPair = {
  parent: Reactive<any>;
  node: Node<any>;
};

export abstract class Reactive<A> implements Observer<any> {
  nrOfListeners: number;
  state: State;
  children: DoubleLinkedList<Observer<A>> = new DoubleLinkedList();
  parents: Cons<Reactive<any>>;
  listenerNodes: Cons<NodeParentPair> | undefined;
  constructor() {
    this.state = State.Inactive;
    this.nrOfListeners = 0;
  }
  addListener(node: Node<Observer<any>>): State {
    const firstChild = this.children.head === undefined;
    this.children.append(node);
    if (firstChild) {
      this.activate();
    }
    return this.state;
  }
  removeListener(node: Node<Observer<any>>): void {
    this.children.remove(node);
    if (this.children.head === undefined && this.state !== State.Done) {
      this.deactivate();
    }
  }
  changeStateDown(state: State): void {
    for (const child of this.children) {
      child.changeStateDown(state);
    }
  }
  subscribe(callback: (a: A) => void) {
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
    this.state = State.Push;
    for (const parent of this.parents) {
      const node = new Node(this);
      this.listenerNodes = cons({ node, parent }, this.listenerNodes);
      parent.addListener(node);
      const parentState = parent.state;
      if (parentState !== State.Push) {
        this.state = parentState;
      }
    }
  }
  deactivate(done = false): void {
    if (this.listenerNodes !== undefined) {
      for (const { node, parent } of this.listenerNodes) {
        parent.removeListener(node);
      }
    }
    this.state = done === true ? State.Done : State.Inactive;
  }
}

export class CbObserver<A> implements Observer<A> {
  node: Node<Observer<A>> = new Node(this);
  constructor(
    private _push: (a: A) => void,
    private _beginPulling: () => void,
    private _endPulling: () => void,
    private source: Reactive<A>
  ) {
    source.addListener(this.node);
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
