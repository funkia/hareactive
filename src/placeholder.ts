import { Reactive, State } from "./common";
import { Behavior, ConstantBehavior, isBehavior, MapBehavior } from "./behavior";
import { Stream , MapToStream} from "./stream";

export class Placeholder<A> extends Behavior<A> {
  source: Reactive<A>;
  replaceWith(parent: Reactive<A>): void {
    this.source = parent;
    if (this.child !== undefined) {
      this.activate();
      if (isBehavior(parent) && this.state === State.Push) {
        this.push(parent.at());
      }
    }
  }
  push(a: any): void {
    this.last = a;
    this.child.push(a);
  }
  pull(): A {
    return (<any>this.source).pull();
  }
  activate(): void {
    if (this.source !== undefined) {
      this.source.addListener(this);
      this.state = this.source.state;
      this.changeStateDown(this.state);
    }
  }
  map<B>(fn: (a: A) => B): Behavior<B> {
    return new MapPlaceholder<A, B>(this, fn);
  }
  mapTo<B>(b: B): Behavior<B> {
    return <any>(new MapToPlaceholder<A, B>(b));
  }
}

class MapPlaceholder<A, B> extends MapBehavior<A, B> {
}

class MapToPlaceholder<A, B> extends ConstantBehavior<B> {
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
  return (<any>new Placeholder());
}
