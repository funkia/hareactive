/// <reference path="../typings/index.d.ts" />
import {suite} from "./default-suite";
import * as most from "most";
import * as $ from "../src/Events";
import * as $_old from "../src/Events_old";

const n  = 1000000;
let a = new Array(n);
for (let i = 0; i < a.length; ++i) {
  a[i] = i;
}

function pushArray(arr: number[], ev: any): void {
  for (let i = 0; i < arr.length; ++i) {
    ev.publish(arr[i]);
  }
}

function sum(c: number, b: number): number {
  return c + b;
}

function add1(x: number): number {
  return x + 1;
}

function even(x: number): boolean {
  return x % 2 === 0;
}

export default suite("filter-map-reduce")

  .add("Events", function(defered: any): void {
    let ev = new $.Events<number>();
    $.scan(sum, 0, $.map(add1, $.filter(even, ev)));
    pushArray(a, ev);
    defered.resolve();
  }, {defer: true})

  .add("Events_old", function(defered: any): void {
    let ev = new $_old.Events<number>();
    $_old.scan(sum, 0, $_old.map(add1, $_old.filter(even, ev)));
    pushArray(a, ev);
    defered.resolve();
  }, {defer: true})

  .add("most", function(defered: any): void {
    most
      .from(a)
      .filter(even)
      .map(add1)
      .reduce(sum, 0)
      .then(function(): void {
        defered.resolve();
      });
  }, {defer: true})
  .run({async: true});
