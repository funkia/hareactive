import {Behavior, isBehavior, at, placeholder as bPlaceholder} from "./behavior";
import {Stream, isStream, placeholderStream} from "./stream";

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

function defineBehaviorMethod (methodName: string) {
  return function (...args: any[]) {
    if (this.source !== undefined) {
      return this.source[methodName](...args);
    } else {
      const p = <any> bPlaceholder();
      this.children.push(p);
      return p[methodName](...args);
    }
  }
}

function defineStreamMethod (methodName: string) {
  return function (...args: any[]) {
    if (this.source !== undefined) {
      return this.source[methodName](...args);
    } else {
      const p = <any> placeholderStream();
      this.children.push(p);
      return p[methodName](...args);
    }
  }
}

const commonMethods = [
  "map", "mapTo", "subscribe", "addListener"
];
const streamMethods = [
  "combine", "filter", "filterApply", "scanS", "delay", "throttle"
];
const behaviorMethods = [
  "ap", "lift", "chain", "push", "pull", "beginPulling", "endPulling",
  "observe", "at", "flatten"
];

for (const name of commonMethods) {
  (<any>Placeholder).prototype[name] = definePlaceholderMethod(name);
}
for (const name of streamMethods) {
  (<any>Placeholder).prototype[name] = defineStreamMethod(name);
}
for (const name of behaviorMethods) {
  (<any>Placeholder).prototype[name] = defineBehaviorMethod(name);
}

export function placeholder(): any {
  return new Placeholder();
}
