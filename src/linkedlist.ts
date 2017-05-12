export class Cons<A> {
  constructor(
    public value: A,
    public tail: Cons<A> | undefined
  ) { }
}

export function cons<A>(value: A, tail?: Cons<A>): Cons<A> {
  return new Cons(value, tail);
}

/**
 * A doubly linked list. Updates are done by mutating. Prepend, append
 * and remove all run in O(1) time.
 */
export class LinkedList<A> {
  size: number;
  head: Node<A> | undefined;
  tail: Node<A> | undefined;
  constructor() {
    this.size = 0;
  }
  append(a: A): LinkedList<A> {
    const tail = this.tail;
    const newNode = new Node(a, tail, undefined);
    tail.next = newNode;
    this.tail = newNode;
    this.size++;
    return this;
  }
  remove(node: Node<A>): LinkedList<A> {
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
}

export class Node<A> {
  constructor(
    public value: A,
    public prev: Node<A> | undefined,
    public next: Node<A> | undefined
  ) { }
}
