///<reference path="./../typings/index.d.ts" />
import * as B from "../src/Behaviour";
import {assert} from "chai";
// import {spy} from "sinon";

function id<A>(v: A): A {
  return v;
}

function isEven(n: number): boolean {
  return n % 2 === 0;
}

function double(n: number): number {
  return n * 2;
}

const add = (a: number) => (b: number) => a + b;

describe("Behavior", () => {
  it("pulls constant function", () => {
    const b = B.of(0);
    assert.equal(B.at(b), 0);
    b.publish(1);
    assert.equal(B.at(b), 1);
    b.publish(2);
    assert.equal(B.at(b), 2);
    b.publish(3);
    assert.equal(B.at(b), 3);
  });

  it("publishes from time varying functions", () => {
    let time = 0;
    const b = B.fromFunction(() => {
      return time;
    });
    assert.equal(B.at(b), 0);
    time = 1;
    assert.equal(B.at(b), 1);
    time = 2;
    assert.equal(B.at(b), 2);
    time = 3;
    assert.equal(B.at(b), 3);
  });

  it("allows listening on discrete changes", () => {
    const b = B.sink(0);
    const result: number[] = [];
    B.subscribe((v) => { result.push(v); }, b);
    b.publish(1);
    b.publish(2);
    b.publish(3);
    assert.deepEqual(result, [1, 2, 3]);
  });

  describe("concat", () => {
    // let mNumber: (a: number);
    // const mAdd = (m) => {
    //   return mNumber(this.n + m.n);
    // };
    // mNumber = (n) => {
    //   return {n: n, concat: mAdd};
    // };
    // it("appends values from behaviors with publish", () => {
    //   const nB = B.BehaviorK(mNumber(1));
    //   const mB = B.BehaviorK(mNumber(2));
    //   const nmB = nB.concat(mB);
    //   assert.equal(B.at(nmB).n, 3);
    //   nB.publish(mNumber(3));
    //   assert.equal(B.at(nmB).n, 5);
    //   mB.publish(mNumber(5));
    //   assert.equal(B.at(nmB).n, 8);
    // });
    // it("appends values from behaviors with pull", () => {
    //   const n = 1, m = 3;
    //   const nB = B.fromFunction(() => {
    //     return mNumber(n);
    //   });
    //   const mB = B.BehaviorK(mNumber(4));
    //   const nmB = nB.concat(mB);
    //   assert.equal(B.at(nmB).n, 5);
    //   n = 2;
    //   assert.equal(B.at(nmB).n, 6);
    //   B.set(mB, () => {
    //     return mNumber(m);
    //   });
    //   assert.equal(B.at(nmB).n, 5);
    //   m = 4;
    //   assert.equal(B.at(nmB).n, 6);
    //   nB.publish(mNumber(0));
    //   assert.equal(B.at(nmB).n, 4);
    // });
  });
  describe("map", () => {
    it("maps constant function", () => {
      const b = B.of(0);
      const mapped = B.map(double, b);
      assert.equal(B.at(b), 0);
      B.publish(1, b);
      assert.equal(B.at(mapped), 2);
      B.publish(2, b);
      assert.equal(B.at(mapped), 4);
      B.publish(3, b);
      assert.equal(B.at(mapped), 6);
    });
    it("maps values method", () => {
      const b = B.sink(0);
      const mapped = b.map(double);
      b.publish(1);
      assert.equal(B.at(mapped), 2);
      b.publish(2);
      assert.equal(B.at(mapped), 4);
      b.publish(3);
      assert.equal(B.at(mapped), 6);
    });
    it("maps time function", () => {
      let time = 0;
      const b = B.fromFunction(() => {
        return time;
      });
      const mapped = B.map(double, b);
      assert.equal(B.at(mapped), 0);
      time = 1;
      assert.equal(B.at(mapped), 2);
      time = 2;
      assert.equal(B.at(mapped), 4);
      time = 3;
      assert.equal(B.at(mapped), 6);
    });
  });
  describe("ap", () => {
    it("applies event of functions to event of numbers with publish", () => {
      const fnB = B.sink(add(1));
      const numE = B.sink(3);
      const applied = B.ap(fnB, numE);
      assert.equal(B.at(applied), 4);
      fnB.publish(add(2));
      assert.equal(B.at(applied), 5);
      numE.publish(4);
      assert.equal(B.at(applied), 6);
      fnB.publish(double);
      assert.equal(B.at(applied), 8);
    });
    it("applies event of functions to event of numbers with pull", () => {
      let number = 1;
      let fn = add(5);
      const fnB = B.fromFunction(() => fn);
      const numB = B.fromFunction(() => number);
      const applied = B.ap(fnB, numB);

      assert.equal(B.at(applied), 6);
      fn = add(2);
      assert.equal(B.at(applied), 3);
      number = 4;
      assert.equal(B.at(applied), 6);
      fn = double;
      assert.equal(B.at(applied), 8);
      number = 8;
      assert.equal(B.at(applied), 16);
    });
    // it("applies pushed event of functions to pulled event of numbers", () => {
    //   let number = 1;
    //   const fnB = B.of(add(5));
    //   const numE = B.fromFunction(() => {
    //     return number;
    //   });
    //   const applied = B.ap(fnB, numE);
    //   assert.equal(B.at(applied), 6);
    //   fnB.publish(add(2));
    //   assert.equal(B.at(applied), 3);
    //   number = 4;
    //   assert.equal(B.at(applied), 6);
    //   fnB.publish(double);
    //   assert.equal(B.at(applied), 8);
    //   number = 8;
    //   assert.equal(B.at(applied), 16);
    // });
  });
  // describe("of", () => {
  //   it("identity", () => {
  //     const result1 = [];
  //     const result2 = [];
  //     const numB = B.of(0);
  //     const num2B = B.of(id).ap(numB);
  //     numB.publish(1);
  //     assert.equal(B.at(numB), 1);
  //     assert.equal(B.at(num2B), 1);
  //     numB.publish(2);
  //     assert.equal(B.at(numB), 2);
  //     assert.equal(B.at(num2B), 2);
  //     numB.publish(3);
  //     assert.equal(B.at(numB), 3);
  //     assert.equal(B.at(num2B), 3);
  //   });
  // });
  // it("can switch from constant to constying and back", () => {
  //   const time = 0;
  //   const b = B.of(0);
  //   const mapped = B.map(double, b);
  //   assert.equal(B.at(mapped), 0);
  //   B.set(b, () => {
  //     return time;
  //   });
  //   assert.equal(B.at(mapped), 0);
  //   time = 2;
  //   assert.equal(B.at(mapped), 4);
  //   B.publish(b, 4);
  //   assert.equal(B.at(mapped), 8);
  // });
  // describe("stepper", () => {
  //   it("steps to the last event value", () => {
  //     const e = new E.Event();
  //     const b = new B.stepper(0, e);
  //     assert.equal(B.at(b), 0);
  //     e.publish(1);
  //     assert.equal(B.at(b), 1);
  //     e.publish(2);
  //     assert.equal(B.at(b), 2);
  //   });
  // });
});
