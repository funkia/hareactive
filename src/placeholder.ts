import { Reactive, State, SListener, BListener } from "./common";
import { Behavior, isBehavior, MapBehavior } from "./behavior";
import { Node } from "./datastructures";
import { Stream, MapToStream } from "./stream";
import { tick } from "./timestamp";

class SamplePlaceholderError {
  message: string = "Attempt to sample non-replaced placeholder";
  constructor(public placeholder: Placeholder<any>) {}
  toString(): string {
    return this.message;
  }
}

export class Placeholder<A> extends Behavior<A> {
  source: Reactive<A, SListener<A> | SListener<A> | BListener>;
  private node = new Node(this);
  replaceWith(
    parent: Reactive<A, SListener<A> | SListener<A> | BListener>
  ): void {
    this.source = parent;
    if (this.children.head !== undefined) {
      this.activate();
      if (isBehavior(parent) && this.state === State.Push) {
        const t = tick();
        this.pushB(t);
      }
    }
    if (isBehavior(parent)) {
      parent.changePullers(this.nrOfPullers);
    }
  }
  pushB(t: number): void {
    this.last = (<Behavior<A>>this.source).last;
    for (const child of this.children) {
      child.pushB(t);
    }
  }
  pushS(t: number, a: A) {
    for (const child of this.children) {
      (<any>child).pushS(t, a);
    }
  }
  pull(t: number) {
    if (this.source === undefined) {
      throw new SamplePlaceholderError(this);
    } else if (isBehavior(this.source)) {
      this.source.pull(t);
      this.last = this.source.last;
    } else {
      throw new Error("Unsupported pulling on placeholder");
    }
  }
  update(t: number): A {
    throw new Error("Update should never be called on a placeholder.");
  }
  activate(): void {
    if (this.source !== undefined) {
      this.source.addListener(this.node);
      this.state = this.source.state;
      this.changeStateDown(this.state);
    }
  }
  deactivate(done = false): void {
    this.state = State.Inactive;
    if (this.source !== undefined) {
      this.source.removeListener(this.node);
    }
  }
  changePullers(n: number): void {
    this.nrOfPullers += n;
    if (this.source !== undefined) {
      (<Behavior<any>>this.source).changePullers(n);
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
  pushS(t: number, a: A) {
    // @ts-ignore
    this.pushSToChildren(t, this.f(a));
  }
}

class MapToPlaceholder<A, B> extends MapToStream<A, B> {
  last: B;
  update() {
    return (<any>this).b;
  }
  pull() {}
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
  MapPlaceholder.prototype.map = <any>Placeholder.prototype.map;
  MapPlaceholder.prototype.mapTo = <any>Placeholder.prototype.mapTo;
  MapToPlaceholder.prototype.map = <any>Placeholder.prototype.map;
  MapToPlaceholder.prototype.mapTo = <any>Placeholder.prototype.mapTo;
  install(MapPlaceholder, Stream);
  install(MapToPlaceholder, Behavior);
}

export function placeholder<A>(): Placeholder<A> & Stream<A> {
  if ((<any>Placeholder).prototype.scanS === undefined) {
    // The methods are installed lazily when the placeholder is first
    // used. This avoids a top-level impure expression that would
    // prevent tree-shaking.
    installMethods();
  }
  return <any>new Placeholder();
}
