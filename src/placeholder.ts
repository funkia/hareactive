import {Behavior, isBehavior, at} from "./behavior";
import {Stream, isStream} from "./stream";

export class Placeholder {
  source: any
  children: Placeholder[] = [];
  args: any[];

  constructor(private methodName?: string, ...args: any[]) {
    this.args = args;
  }
  replaceWith(parent: any) {
    this.source = this.methodName === undefined ? parent : parent[this.methodName](...this.args);
    for (const c of this.children) {
      c.replaceWith(this.source);
    }
    this.children = undefined;
  }
}

function definePlaceholderMethod (methodName: string) {
  return function (...args: any[]) {
    if (this.source !== undefined) {
      return this.source[methodName](...args);
    } else {
      const p = new Placeholder(methodName, ...args);
      this.children.push(p);
      return p;
    }
  }
}

const methods = [
  "map", "mapTo", "subscribe", // common
  "combine", "filter", "filterApply", "scanS", // stream
  "ap", "lift", "chain", "push", "addListener", "pull", "beginPulling", "endPulling", "observe", "at", "flatten" // behavior
];

for (const name of methods) {
  (<any>Placeholder).prototype[name] = definePlaceholderMethod(name);
}

export function placeholder(): any {
  return new Placeholder();
}
