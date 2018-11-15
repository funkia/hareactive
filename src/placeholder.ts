import { Reactive, State, SListener, BListener } from "./common";
import { Behavior, isBehavior, MapBehavior, pushToChildren } from "./behavior";
import { Node, cons } from "./datastructures";
import { Stream, MapToStream } from "./stream";
import { tick } from "./clock";
import { Future } from "./future";

class SamplePlaceholderError {
  message: string = "Attempt to sample non-replaced placeholder";
  constructor(public placeholder: Placeholder<any>) {}
  toString(): string {
    return this.message;
  }
}

export class Placeholder<A> extends Behavior<A> {
  source: Reactive<A, SListener<A> | SListener<A> | BListener>;
  private node: Node<this> = new Node(this);
  replaceWith(
    parent: Reactive<A, SListener<A> | SListener<A> | BListener>
  ): void {
    this.source = parent;
    this.parents = cons(parent);
    if (this.children.head !== undefined) {
      const t = tick();
      this.activate(t);
      if (isBehavior(parent) && this.state === State.Push) {
        pushToChildren(t, this);
      }
    }
  }
  pushS(t: number, a: A): void {
    for (const child of this.children) {
      (<any>child).pushS(t, a);
    }
  }
  pull(t: number): void {
    if (this.source === undefined) {
      throw new SamplePlaceholderError(this);
    } else if (isBehavior(this.source)) {
      super.pull(t);
    } else {
      throw new Error("Unsupported pulling on placeholder");
    }
  }
  update(_t: number): A {
    return (this.source as Behavior<A>).last;
  }
  activate(t: number): void {
    if (this.source !== undefined) {
      this.source.addListener(this.node, t);
      if (isBehavior(this.source)) {
        this.last = this.source.last;
        this.changedAt = this.source.changedAt;
        this.pulledAt = this.source.pulledAt;
      }
      this.state = this.source.state;
      this.changeStateDown(this.state);
    }
  }
  deactivate(_done: Boolean = false): void {
    this.state = State.Inactive;
    if (this.source !== undefined) {
      this.source.removeListener(this.node);
    }
  }
  map<B>(fn: (a: A) => B): Behavior<B> {
    return new MapPlaceholder<A, B>(this, fn);
  }
  mapTo<B>(b: B): Behavior<B> {
    return <any>new MapToPlaceholder<A, B>(<any>this, b);
  }
}

class MapPlaceholder<A, B> extends MapBehavior<A, B> {
  pushS(t: number, a: A): void {
    // @ts-ignore
    this.pushSToChildren(t, this.f(a));
  }
}

class MapToPlaceholder<A, B> extends MapToStream<A, B> {
  last: B;
  update(): B {
    return (<any>this).b;
  }
  pull(): void {}
}

function install(target: Function, source: Function): void {
  for (const key of Object.getOwnPropertyNames(source.prototype)) {
    if (target.prototype[key] === undefined) {
      target.prototype[key] = source.prototype[key];
    }
  }
}

function installMethods(): void {
  install(Placeholder, Stream);
  install(Placeholder, Future);
  MapPlaceholder.prototype.map = <any>Placeholder.prototype.map;
  MapPlaceholder.prototype.mapTo = <any>Placeholder.prototype.mapTo;
  MapToPlaceholder.prototype.map = <any>Placeholder.prototype.map;
  MapToPlaceholder.prototype.mapTo = <any>Placeholder.prototype.mapTo;
  install(MapPlaceholder, Stream);
  install(MapPlaceholder, Future);
  install(MapToPlaceholder, Behavior);
  install(MapPlaceholder, Future);
}

export function placeholder<A>(): Placeholder<A> & Stream<A> & Future<A> {
  if ((<any>Placeholder).prototype.scanS === undefined) {
    // The methods are installed lazily when the placeholder is first
    // used. This avoids a top-level impure expression that would
    // prevent tree-shaking.
    installMethods();
  }
  return <any>new Placeholder();
}
