/// <reference path="../typings/index.d.ts" />
import {Suite} from "benchmark";

export function suite (name: string): any {
  return new Suite(name)

    .on("cycle", function (e: any): void {
      let t = e.target;
      if (t.failure) {
        console.error(padl(10, t.name) + "FAILED: " + e.target.failure);
      } else {
        const result = padl(30, t.name)
              + padr(13, t.hz.toFixed(2) + " op/s")
              + " \xb1" + padr(7, t.stats.rme.toFixed(2) + "%")
              + padr(15, " (" + t.stats.sample.length + " samples)");
        console.log(result);
      }})

    .on("start", function(): void {
      console.log("\n--------------------- " + this.name + " ---------------------");
    })

    .on("complete", function(): void {
      console.log("------------------ Winner: " + this.filter("fastest").map("name") + " ------------------");
    });
};

function padl(n: number, s: string): string {
  while (s.length < n) {
    s += " ";
  }
  return s;
}

function padr(n: number, s: string): string {
  while (s.length < n) {
    s = " " + s;
  }
  return s;
}
