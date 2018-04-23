export class Cons<A> {
  constructor(public readonly value: A, public tail: Cons<A> | undefined) {}
  *[Symbol.iterator](): IterableIterator<A> {
    let head: Cons<A> = this;
    while (head !== undefined) {
      yield head.value;
      head = head.tail;
    }
  }
}

export function cons<A>(value: A, tail?: Cons<A>): Cons<A> {
  return new Cons(value, tail);
}

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
  append(node: Node<A>): DoubleLinkedList<A> {
    if (this.head === undefined) {
      this.head = node;
    }
    node.prev = this.tail;
    node.next = undefined;
    if (this.tail !== undefined) {
      this.tail.next = node;
    }
    this.tail = node;
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
    return this;
  }
  *[Symbol.iterator](): IterableIterator<A> {
    let { head } = this;
    while (head !== undefined) {
      yield head.value;
      head = head.next;
    }
  }
}
export class Node<A> {
  public prev: Node<A> | undefined;
  public next: Node<A> | undefined;
  constructor(public readonly value: A) {}
}
