import { Cons, cons, DoubleLinkedList, Node } from "./datastructures";
import { Behavior } from "./behavior";
import { tick } from "./clock";

export type Time = number;

function isBehavior(b: any): b is Behavior<any> {
  return typeof b === "object" && "at" in b;
}

export type PullHandler = (pull: (t?: number) => void) => () => void;

/**
 * The various states that a reactive can be in. The order matters here: Done <
 * Push < Pull < Inactive. The idea is that a reactive can calculate its current
 * state by taking the maximum of its parents states.
 */
export const enum State {
  Done = 0, // The reactive value will never update again
  Push = 1, // Values are pushed to listeners
  Pull = 2, // Values should be pulled by listeners
  Inactive = 3 // Most, but not all, reactives start in this state
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
  node: Node<this> = new Node(this);
  constructor(private callback: (a: A) => void, private source: Parent<Child>) {
    source.addListener(this.node, tick());
    if (isBehavior(source) && source.state === State.Push) {
      callback(source.at());
    }
  }
  pushB(t: number): void {
    const b = <Behavior<A>>this.source;
    b.pull(t);
    this.callback(b.last);
  }
  pushS(t: number, value: A): void {
    this.callback(value);
  }
  deactivate(): void {
    this.source.removeListener(this.node);
  }
  changeStateDown(state: State): void {}
}

export type NodeParentPair = {
  parent: Parent<any>;
  node: Node<any>;
};

export abstract class Reactive<A, C extends Child> implements Child {
  state: State;
  parents: Cons<Parent<any>>;
  listenerNodes: Cons<NodeParentPair> | undefined;
  children: DoubleLinkedList<C> = new DoubleLinkedList();
  constructor() {
    this.state = State.Inactive;
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
    if (this.state !== state) {
      this.state = state;
      for (const child of this.children) {
        child.changeStateDown(state);
      }
    }
  }
  subscribe(callback: (a: A) => void): PushOnlyObserver<A> {
    return new PushOnlyObserver(callback, this);
  }
  observe(push: (a: A) => void, handlePulling: PullHandler): CbObserver<A> {
    return new CbObserver(push, handlePulling, this);
  }
  activate(t: number): void {
    let newState = State.Done;
    for (const parent of this.parents) {
      const node = new Node(this);
      this.listenerNodes = cons({ node, parent }, this.listenerNodes);
      parent.addListener(node as any, t);
      newState = Math.max(newState, parent.state);
    }
    if (this.state === State.Inactive) {
      this.state = newState;
    }
  }
  deactivate(done: Boolean = false): void {
    if (this.listenerNodes !== undefined) {
      for (const { node, parent } of this.listenerNodes) {
        parent.removeListener(node);
      }
    }
    this.state = done === true ? State.Done : State.Inactive;
  }
}

export class CbObserver<A> implements BListener, SListener<A> {
  private endPulling: () => void;
  node: Node<CbObserver<A>> = new Node(this);
  constructor(
    private callback: (a: A) => void,
    private handlePulling: PullHandler,
    private source: Parent<Child>
  ) {
    source.addListener(this.node, tick());
    if (source.state === State.Pull) {
      this.endPulling = handlePulling(this.pull.bind(this));
    } else if (isBehavior(source) && source.state === State.Push) {
      callback(source.last);
    }
  }
  pull(t: number = tick()): void {
    if (isBehavior(this.source) && this.source.state === State.Pull) {
      this.source.pull(t);
      this.callback(this.source.last);
    }
  }
  pushB(t: number): void {
    const b = <Behavior<A>>this.source;
    b.pull(t);
    this.callback(b.last);
  }
  pushS(t: number, value: A): void {
    this.callback(value);
  }
  changeStateDown(state: State): void {
    if (state === State.Pull) {
      this.endPulling = this.handlePulling(this.pull.bind(this));
    } else if (this.endPulling !== undefined) {
      // We where pulling before but are no longer pulling
      this.endPulling();
      this.endPulling = undefined;
    }
  }
}

/**
 * Observe a behavior for the purpose of running side-effects based on the value
 * of the behavior.
 * @param push Called with all values that the behavior pushes through.
 * @param handlePulling Called when the consumer should begin pulling values
 * from the behavior. The function should return a callback that will be invoked
 * once pulling should stop.
 * @param behavior The behavior to observe.
 */
export function observe<A>(
  push: (a: A) => void,
  handlePulling: PullHandler,
  behavior: Behavior<A>
): CbObserver<A> {
  return behavior.observe(push, handlePulling);
}
