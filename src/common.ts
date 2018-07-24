import { Cons, cons, DoubleLinkedList, Node } from "./datastructures";
import { Behavior } from "./behavior";
import { tick } from "./timestamp";

export type Time = number;

function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && "at" in b;
}

export type PullHandler = (pull: (t?: number) => void) => () => void;

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

export interface Parent<C> {
  addListener(node: Node<C>, t: number): State;
  removeListener(node: Node<C>): void;
  state: State;
}

export interface Child {
  changeStateDown(state: State): void;
}

export interface BListener extends Child {
  pushB(t: number): void;
}

export interface SListener<A> extends Child {
  pushS(t: number, value: A): void;
}

export class PushOnlyObserver<A> implements BListener, SListener<A> {
  node = new Node(this);
  constructor(private callback: (a: A) => void, private source: Parent<Child>) {
    source.addListener(this.node, tick());
    if (isBehavior(source) && source.state === State.Push) {
      callback(source.at());
    }
  }
  pushB(t: number): void {
    this.callback((this.source as any).last);
  }
  pushS(t: number, value: A) {
    this.callback(value);
  }
  deactivate(): void {
    this.source.removeListener(this.node);
  }
  changeStateDown(state: State): void {}
}

export function changePullersParents(
  n: number,
  parents: Cons<Parent<any>>
): void {
  if (parents === undefined) {
    return;
  }
  if (isBehavior(parents.value)) {
    parents.value.changePullers(n);
  }
  changePullersParents(n, parents.tail);
}

export type NodeParentPair = {
  parent: Parent<any>;
  node: Node<any>;
};

export abstract class Reactive<A, C extends Child> implements Child {
  nrOfListeners: number;
  state: State;
  parents: Cons<Parent<any>>;
  listenerNodes: Cons<NodeParentPair> | undefined;
  children: DoubleLinkedList<C> = new DoubleLinkedList();
  constructor() {
    this.state = State.Inactive;
    this.nrOfListeners = 0;
  }
  addListener(node: Node<C>, t: number): State {
    const firstChild = this.children.head === undefined;
    this.children.prepend(node);
    if (firstChild) {
      this.activate(t);
    }
    return this.state;
  }
  removeListener(node: Node<C>): void {
    this.children.remove(node);
    if (this.children.head === undefined && this.state !== State.Done) {
      this.deactivate();
    }
  }
  changeStateDown(state: State): void {
    this.state = state;
    for (const child of this.children) {
      child.changeStateDown(state);
    }
  }
  subscribe(callback: (a: A) => void) {
    return new PushOnlyObserver(callback, this);
  }
  observe(push: (a: A) => void, handlePulling: PullHandler): CbObserver<A> {
    return new CbObserver(push, handlePulling, this);
  }

  activate(t: number): void {
    for (const parent of this.parents) {
      const node = new Node(this);
      this.listenerNodes = cons({ node, parent }, this.listenerNodes);
      parent.addListener(node as any, t);
      const parentState = parent.state;
      if (parentState !== State.Push || this.state === State.Inactive) {
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

export class CbObserver<A> implements BListener, SListener<A> {
  private endPulling = () => {};
  node: Node<CbObserver<A>> = new Node(this);
  constructor(
    private callback: (a: A) => void,
    private handlePulling: PullHandler,
    private source: Parent<Child>
  ) {
    source.addListener(this.node, tick());
    if (source.state === State.Pull || source.state === State.OnlyPull) {
      this.endPulling = handlePulling(this.pull.bind(this));
    } else if (isBehavior(source) && source.state === State.Push) {
      callback(source.last);
    }
  }
  pull(t: number = tick()) {
    if (
      isBehavior(this.source) &&
      (this.source.state === State.Pull || this.source.state === State.OnlyPull)
    ) {
      this.source.pull(t);
      this.callback(this.source.last);
    }
  }
  pushB(t: number): void {
    this.callback((this.source as any).last);
  }
  pushS(t: number, value: A): void {
    this.callback(value);
  }
  changeStateDown(state: State): void {
    if (state === State.Pull || state === State.OnlyPull) {
      this.endPulling = this.handlePulling(this.endPulling.bind(this));
    } else {
      this.endPulling();
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
  handlePulling: PullHandler,
  behavior: Behavior<A>
): CbObserver<A> {
  return behavior.observe(push, handlePulling);
}
