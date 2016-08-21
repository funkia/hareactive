///<reference path="./../typings/index.d.ts" />
import {assert} from "chai";

import * as B from "../src/Behavior";
import * as S from "../src/Stream";
import * as F from "../src/Future";
import {Behavior, at, switcher} from "../src/Behavior";

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

  describe("isBehavior", () => {
    it("should be a function", () => {
      assert.isFunction(B.isBehavior);
    });

    it("should be true when Behavior object", () => {
      assert.isTrue(B.isBehavior(B.of(2)));
    });

    it("should be false when not Behavior object", () => {
      assert.isFalse(B.isBehavior([]));
      assert.isFalse(B.isBehavior({}));
      assert.isFalse(B.isBehavior("test"));
      assert.isFalse(B.isBehavior([B.of(42)]));
      assert.isFalse(B.isBehavior(1234));
      assert.isFalse(B.isBehavior(B.isBehavior));
      assert.isFalse(B.isBehavior(S.empty()));
    });
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
    it("maps over initial value from parent", () => {
      const b = B.of(3);
      const mapped = B.map(double, b);
      assert.strictEqual(at(mapped), 6);
    });
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
      let n = 1;
      let fn = add(5);
      const fnB = B.fromFunction(() => fn);
      const numB = B.fromFunction(() => n);
      const applied = B.ap(fnB, numB);

      assert.equal(B.at(applied), 6);
      fn = add(2);
      assert.equal(B.at(applied), 3);
      n = 4;
      assert.equal(B.at(applied), 6);
      fn = double;
      assert.equal(B.at(applied), 8);
      n = 8;
      assert.equal(B.at(applied), 16);
    });
    it("applies pushed event of functions to pulled event of numbers", () => {
      let n = 1;
      const fnB = B.of(add(5));
      const numE = B.fromFunction(() => {
        return n;
      });
      const applied = B.ap(fnB, numE);
      assert.equal(B.at(applied), 6);
      fnB.publish(add(2));
      assert.equal(B.at(applied), 3);
      n = 4;
      assert.equal(B.at(applied), 6);
      fnB.publish(double);
      assert.equal(B.at(applied), 8);
      n = 8;
      assert.equal(B.at(applied), 16);
    });
  });
  describe("chain", () => {
    it("handles a constant behavior", () => {
      const b1 = B.of(12);
      const b2 = b1.chain(x => B.of(x * x));
      assert.strictEqual(at(b2), 144);
    });
    it("handles changing outer behavior", () => {
      const b1 = B.sink(0);
      const b2 = b1.chain(x => B.of(x * x));
      assert.strictEqual(at(b2), 0);
      b1.publish(2);
      assert.strictEqual(at(b2), 4);
      b1.publish(3);
      assert.strictEqual(at(b2), 9);
    });
    it("handles changing inner behavior", () => {
      const inner = B.sink(0);
      const b = B.of(1).chain(_ => inner);
      assert.strictEqual(at(b), 0);
      inner.publish(2);
      assert.strictEqual(at(b), 2);
      inner.publish(3);
      assert.strictEqual(at(b), 3);
    });
    it("stops subscribing to past inner behavior", () => {
      const inner = B.sink(0);
      const outer = B.sink(1);
      const b = outer.chain(n => n === 1 ? inner : B.of(6));
      assert.strictEqual(at(b), 0);
      inner.publish(2);
      assert.strictEqual(at(b), 2);
      outer.publish(2);
      assert.strictEqual(at(b), 6);
      inner.publish(3);
      assert.strictEqual(at(b), 6);
    });
    it("handles changes from both inner and outer", () => {
      const outer = B.sink(0);
      const inner1 = B.sink(1);
      const inner2 = B.sink(3);
      const b = outer.chain(n => {
        if (n === 0) {
          return B.of(0);
        } else if (n === 1) {
          return inner1;
        } else if (n === 2) {
          return inner2;
        }
      });
      assert.strictEqual(at(b), 0);
      outer.publish(1);
      assert.strictEqual(at(b), 1);
      inner1.publish(2);
      assert.strictEqual(at(b), 2);
      outer.publish(2);
      assert.strictEqual(at(b), 3);
      inner1.publish(7); // Pushing to previous inner should have no effect
      assert.strictEqual(at(b), 3);
      inner2.publish(4);
      assert.strictEqual(at(b), 4);
    });
  });
});

describe("Behavior and Future", () => {
  describe("when", () => {
    it("gives occured future when behavior is true", () => {
      let occurred = false;
      const b = B.of(true);
      const w = B.when(b);
      const fut = at(w);
      fut.subscribe((_) => occurred = true);
      assert.strictEqual(occurred, true);
    });
    it("future occurs when behavior turns true", () => {
      let occurred = false;
      const b = B.sink(false);
      const w = B.when(b);
      const fut = at(w);
      fut.subscribe((_) => occurred = true);
      assert.strictEqual(occurred, false);
      b.publish(true);
      assert.strictEqual(occurred, true);
    });
  });
  describe("snapshot", () => {
    it("snapshots behavior at future occuring in future", () => {
      let result: number;
      const bSink = B.sink(1);
      const futureSink = F.sink();
      const mySnapshot = at(B.snapshot(bSink, futureSink));
      mySnapshot.subscribe(res => result = res);
      bSink.publish(2);
      bSink.publish(3);
      futureSink.resolve({});
      bSink.publish(4);
      assert.strictEqual(result, 3);
    });
    it("uses current value when future occured in the past", () => {
      let result: number;
      const bSink = B.sink(1);
      const occurredFuture = F.of({});
      bSink.publish(2);
      const mySnapshot = at(B.snapshot(bSink, occurredFuture));
      mySnapshot.subscribe(res => result = res);
      bSink.publish(3);
      assert.strictEqual(result, 2);
    });
  });
  describe("switcher", () => {
    it("switches between behavior", () => {
      const b1 = B.sink(1);
      const b2 = B.sink(8);
      const futureSink = F.sink<Behavior<number>>();
      const switching = switcher(b1, futureSink);
      assert.strictEqual(at(switching), 1);
      b2.publish(9);
      assert.strictEqual(at(switching), 1);
      b1.publish(2);
      assert.strictEqual(at(switching), 2);
      b1.publish(3);
      assert.strictEqual(at(switching), 3);
      futureSink.resolve(b2);
      assert.strictEqual(at(switching), 9);
      b2.publish(10);
      assert.strictEqual(at(switching), 10);
    });
  });
});

describe("Behavior and Stream", () => {
  describe("stepper", () => {
    it("steps to the last event value", () => {
      const e = S.empty();
      const b = B.stepper(0, e);
      assert.equal(B.at(b), 0);
      e.publish(1);
      assert.equal(B.at(b), 1);
      e.publish(2);
      assert.equal(B.at(b), 2);
    });
  });
});
