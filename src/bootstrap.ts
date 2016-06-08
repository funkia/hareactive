import {Events} from "./Events";
import {Behavior, sink} from "./Behavior";
import {Component} from "./DOMBuilder";

export function mount(sel: string, compFn: () => Component): void {
  const {elm} = compFn();
  document.querySelector(sel).appendChild(elm);
}

export function declareBehaviors(...initials: any[]): Behavior<any>[] {
  let behaviors = <any>[];
  for (const v of initials) {
    behaviors.push(sink(v));
  }
  return behaviors;
}
