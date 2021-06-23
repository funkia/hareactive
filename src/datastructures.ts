export interface ConsNil {
  readonly isNil: true;
  [Symbol.iterator](): Generator<never, void, undefined>;
}

export interface ConsValue<A> {
  readonly isNil: false;
  readonly value: A;
  readonly tail: Cons<A>;
  [Symbol.iterator](): Generator<A, void, undefined>;
}

export type Cons<A> = ConsNil | ConsValue<A>;

function* generator<A>(this: Cons<A>) {
  let head: Cons<A> = this;
  while (!head.isNil) {
    const v = head.value;
    head = head.tail;
    yield v;
  }
}

export const nil: Cons<never> = {
  isNil: true,
  [Symbol.iterator]: generator
};

export const cons = <A>(value: A, tail: Cons<A> = nil): Cons<A> => {
  return {
    isNil: false,
    value,
    tail,
    [Symbol.iterator]: generator
  };
};

export function fromArray<A>(values: A[]): Cons<A> {
  let list = cons(values[0]);
  for (let i = 1; i < values.length; ++i) {
    list = cons(values[i], list);
  }
  return list;
}

/**
 * A double linked list. Updates are done by mutating. Prepend, append
 * and remove all run in O(1) time.
 */
export class DoubleLinkedList<A> {
  head: Node<A> | undefined;
  tail: Node<A> | undefined;
  prepend(node: Node<A>): DoubleLinkedList<A> {
    if (this.tail === undefined) {
      this.tail = node;
    }
    node.next = this.head;
    if (this.head !== undefined) {
      this.head.prev = node;
    }
    node.prev = undefined;
    this.head = node;
    return this;
  }
  remove(node: Node<A>): DoubleLinkedList<A> {
    if (node.next !== undefined) {
      node.next.prev = node.prev;
    }
    if (node.prev !== undefined) {
      node.prev.next = node.next;
    }
    if (this.head === node) {
      this.head = node.next;
    }
    if (this.tail === node) {
      this.tail = node.prev;
    }
    node.prev = undefined;
    node.next = undefined;
    return this;
  }
  *[Symbol.iterator](): IterableIterator<A> {
    let { head } = this;
    while (head !== undefined) {
      const v = head.value;
      head = head.next;
      yield v;
    }
  }
}
export class Node<A> {
  public prev: Node<A> | undefined;
  public next: Node<A> | undefined;
  constructor(public readonly value: A) {}
}
