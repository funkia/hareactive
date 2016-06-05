import {suite} from "./default-suite";
import * as most from "most";
import * as $ from "../src/Events";
import * as $_old from "../src/Events_old";

const n = 100000;

let testData: number[] = [];
let result = 0;
for (let i = 0; i < n; i++) {
  testData[i] = i;
  result += i;
};

function sum(curr: number, val: number): number {
  return curr + val;
};

// add tests
export default suite("Scan")
  .add("Events", function(defered: any): void {
    let j = new $.Events();
    let s = $.scan(sum, 0, j);
    $.subscribe(function(e: number): void {
      if (e === result) {
        defered.resolve();
      }
    }, s);
    let i = 0;
    const l = testData.length;
    for (; i < l; i++) {
      $.publish(testData[i], j);
    }
  }, {defer: true})

  .add("Events_old", function(defered: any): void {
    let j = new $_old.Events();
    let s = $_old.scan(sum, 0, j);
    $_old.subscribe(function(e: number): void {
      if (e === result) {
        defered.resolve();
      }
    }, s);
    let i = 0;
    const l = testData.length;
    for (; i < l; i++) {
      $_old.publish(testData[i], j);
    }
  }, {defer: true})

  .add("most", function(defered: any): void {
    most.create(function(add: ((n: number) => void)): any {
      let i = 0;
      let l = testData.length;
      for (; i < l; i++) {
        add(testData[i]);
      }
    }).scan(sum, 0)
      .observe(function(e: number): void {
        if (e === result) {
          defered.resolve();
        }
    });
  }, {defer: true})

  .run({ "async": true });
