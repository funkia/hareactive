import { assert } from "chai";
import { spy, useFakeTimers } from "sinon";
import { go, map, mapTo } from "@funkia/jabz";
import {
  at,
  Behavior,
  isBehavior,
  observe,
  producerBehavior,
  push,
  sinkBehavior,
  moment,
  format,
  switchTo,
  fromFunction,
  sinkFuture,
  freezeTo,
  Stream,
  time,
  runNow,
  Time,
  SinkBehavior
} from "../src";

import * as H from "../src";

import { subscribeSpy } from "./helpers";
import { placeholder } from "../src/placeholder";
import { MonadDictionary } from "@funkia/jabz/dist/monad";

declare module "@funkia/jabz" {
  export function go<T, TReturn, TYield>(
    gen: () => Generator<T, TReturn, TYield>,
    monad?: MonadDictionary
  ): any; // sorry
}

function double(n: number): number {
  return n * 2;
}

function sum(n: number, m: number): number {
  return n + m;
}

const add = (a: number) => (b: number): number => a + b;

describe("behavior", () => {
  describe("isBehavior", () => {
    it("should be true when Behavior object", () => {
      assert.isTrue(isBehavior(Behavior.of(2)));
    });
    it("should be false when not Behavior object", () => {
      assert.isFalse(isBehavior([]));
      assert.isFalse(isBehavior({}));
      assert.isFalse(isBehavior(undefined));
      assert.isFalse(isBehavior("test"));
      assert.isFalse(isBehavior([Behavior.of(42)]));
      assert.isFalse(isBehavior(1234));
      assert.isFalse(isBehavior(H.isBehavior));
      // A stream is not a behavior
      assert.isFalse(isBehavior(H.sinkStream()));
      assert.isFalse(Behavior.is(1));
    });
  });

  describe("producer", () => {
    it("activates and deactivates", () => {
      const activate = spy();
      const deactivate = spy();
      class MyProducer extends H.ProducerBehavior<undefined> {
        update(): undefined {
          return undefined;
        }
        activateProducer(): void {
          activate();
        }
        deactivateProducer(): void {
          deactivate();
        }
      }
      const producer = new MyProducer();
      const observer = producer.subscribe((a) => a);
      observer.deactivate();
      assert(activate.calledOnce);
      assert(deactivate.calledOnce);
    });
  });
  describe("producerBehavior", () => {
    it("activates and deactivates", () => {
      const activate = spy();
      const deactivate = spy();
      const producer = producerBehavior(
        (_push) => {
          activate();
          return deactivate;
        },
        () => ""
      );
      const observer = producer.subscribe((a) => a);
      observer.deactivate();
      assert(activate.calledOnce);
      assert(deactivate.calledOnce);
    });
    it("can push and pull", () => {
      let variable = 0;
      let push: undefined | ((t: Time) => void);
      const setVar = (n: number) => {
        variable = n;
        if (push !== undefined) {
          push(n);
        }
      };
      const producer = producerBehavior(
        (push_) => {
          push = push_;
          return () => (push = undefined);
        },
        () => variable
      );
      assert.strictEqual(H.at(producer), 0);
      variable = 1;
      assert.strictEqual(H.at(producer), 1);
      const spy = subscribeSpy(producer);
      setVar(2);
      assert.strictEqual(H.at(producer), 2);
      setVar(3);
      assert.deepEqual(spy.args, [[1], [2], [3]]);
    });
  });
  describe("observe", () => {
    it("samples in same timestamp", () => {
      const f = jest.fn(() => 0);
      const b = fromFunction(f);
      const result = -1;
      b.observe(
        (_) => result,
        (pull) => {
          pull();
          return () => {};
        },
        3
      );
      expect(f.mock.calls).toEqual([[3]]);
    });
  });
  describe("fromFunction", () => {
    it("pulls from time varying functions", () => {
      let time = 0;
      const b = H.fromFunction(() => time);
      assert.equal(H.at(b), 0);
      time = 1;
      assert.equal(H.at(b), 1);
      time = 2;
      assert.equal(H.at(b), 2);
      time = 3;
      assert.equal(H.at(b), 3);
    });
    it("does not recompute when pulling with same timestamp", () => {
      let callCount = 0;
      const b = H.fromFunction(() => {
        callCount++;
        return 0;
      });
      b.at(0);
      b.at(0);
      b.at(1);
      b.at(1);
      assert.strictEqual(callCount, 2);
    });
  });
  describe("functor", () => {
    describe("map", () => {
      it("maps over initial value from parent", () => {
        const b = Behavior.of(3);
        assert.strictEqual(at(b, 1), 3);
        const mapped = map(double, b);
        let a;
        mapped.observe((v: unknown) => (a = v), () => {});
        assert.strictEqual(a, 6);
      });
      it("maps constant function", () => {
        const b = sinkBehavior(0);
        const mapped = map(double, b);
        const cb = spy();
        mapped.subscribe(cb);
        push(1, b);
        push(2, b);
        push(3, b);
        assert.deepEqual(cb.args, [[0], [2], [4], [6]]);
      });
      it("maps time function", () => {
        let time = 0;
        const b = H.fromFunction(() => {
          return time;
        });
        const mapped = map(double, b);
        const cb = spy();
        mapped.observe(cb, (pull: (t: Time) => void) => {
          pull(1);
          time = 1;
          pull(2);
          time = 2;
          pull(3);
          time = 3;
          pull(4);
        });
        assert.deepEqual(cb.args, [[0], [2], [4], [6]]);
      });
    });
    describe("mapTo", () => {
      it("maps to constant", () => {
        const b = Behavior.of(1);
        const b2 = mapTo(2, b);
        assert.strictEqual(at(b2), 2);
      });
    });
  });
  describe("applicative", () => {
    it("returns a constant behavior from of", () => {
      const b1 = Behavior.of(1);
      const b2 = b1.of(2);
      assert.strictEqual(at(b1), 1);
      assert.strictEqual(at(b2), 2);
    });
    describe("ap", () => {
      it("applies event of functions to event of numbers with publish", () => {
        const fnB = sinkBehavior(add(1));
        const numE = sinkBehavior(3);
        const applied = H.ap(fnB, numE);
        const cb = spy();
        applied.subscribe(cb);
        assert.equal(H.at(applied, 1), 4);
        push(add(2), fnB);
        assert.equal(H.at(applied, 2), 5);
        push(4, numE);
        assert.equal(H.at(applied, 3), 6);
        push(double, fnB);
        assert.equal(H.at(applied, 4), 8);
        assert.deepEqual(cb.args, [[4], [5], [6], [8]]);
      });
      it("applies event of functions to event of numbers with pull", () => {
        let n = 1;
        let fn = add(5);
        const fnB = H.fromFunction(() => fn);
        const numB = H.fromFunction(() => n);
        const applied = H.ap(fnB, numB);
        const cb = spy();
        applied.observe(cb, (pull) => {
          pull(1);
          fn = add(2);
          pull(2);
          n = 4;
          pull(3);
          fn = double;
          pull(4);
          n = 8;
          pull(5);
          return () => {};
        });
        assert.deepEqual(cb.args, [[6], [3], [6], [8], [16]]);
      });
      it("applies pushed event of functions to pulled event of numbers", () => {
        let n = 1;
        const fnB = sinkBehavior(add(5));
        const numE = H.fromFunction(() => n);
        const applied = H.ap(fnB, numE);
        const cb = spy();
        let pull: (() => void) | undefined;
        applied.observe(cb, (pull_) => {
          pull = pull_;
          return () => {};
        });
        if (pull !== undefined) {
          pull();
          push(add(2), fnB);
          pull();
          n = 4;
          pull();
          push(double, fnB);
          pull();
          n = 8;
          pull();
        }
        assert.deepEqual(cb.args, [[6], [3], [6], [8], [16]]);
      });
    });
    describe("lift", () => {
      it("lifts function of three arguments", () => {
        const b1 = H.sinkBehavior(1);
        const b2 = H.sinkBehavior(1);
        const b3 = H.sinkBehavior(1);
        const lifted = H.lift((a, b, c) => a * b + c, b1, b2, b3);
        const cb = spy();
        lifted.subscribe(cb);
        assert.strictEqual(at(lifted), 2);
        push(2, b2);
        assert.strictEqual(at(lifted), 3);
        push(3, b1);
        assert.strictEqual(at(lifted), 7);
        push(3, b3);
        assert.strictEqual(at(lifted), 9);
        assert.deepEqual(cb.args, [[2], [3], [7], [9]]);
      });
      it("lift function of five arguments", () => {
        const b = H.lift(
          (a, b, c, d, e) => (a - b + c) * (d + e),
          Behavior.of(1),
          Behavior.of(2),
          Behavior.of(3),
          Behavior.of(4),
          Behavior.of(5)
        );
        assert.strictEqual(H.at(b), 18);
      });
      it("handles diamond dependency", () => {
        //     p
        //   /   \
        //  b1   b2
        //   \   /
        //    b3
        const p = sinkBehavior(3);
        const b1 = p.map((n) => n * n);
        const b2 = p.map((n) => n + 4);
        const b3 = H.lift((n, m) => n + m, b1, b2);
        const cb = subscribeSpy(b3);
        p.newValue(4);
        assert.deepEqual(cb.args, [[16], [24]]);
      });
      it("only switched to push if all parents are push", () => {
        // In this test the lifted behavior `b3` starts out in the pull state
        // since both of its parents are in pull. Then one of the parents
        // switches to push. But, since one parent is still in pull the lifted
        // behavior should remain in pull.
        let n = 1;
        const b1 = H.fromFunction(() => n);
        const fut = H.sinkFuture<H.Behavior<number>>();
        const b2 = H.switchTo(fromFunction(() => 2), fut);
        const b3 = H.lift((n, m) => n + m, b1, b2);
        observe(
          () => {},
          () => {
            return () => {
              throw new Error("Should not be called.");
            };
          },
          b3
        );
        expect(H.at(b3)).toEqual(3);
        fut.resolve(H.sinkBehavior(5));
        expect(H.at(b3)).toEqual(6);
        n = 2;
        expect(H.at(b3)).toEqual(7);
      });
    });
  });
  describe("flatMap", () => {
    it("handles a constant behavior", () => {
      const b1 = Behavior.of(12);
      const b2 = b1.flatMap((x) => Behavior.of(x * x));
      b2.observe((_v) => {}, () => () => {});
      assert.strictEqual(at(b2), 144);
    });
    it("handles changing outer behavior", () => {
      const b1 = sinkBehavior(0);
      const b2 = b1.flatMap((x) => Behavior.of(x * x));
      const cb = spy();
      b2.observe(cb, () => () => {});
      b1.push(2);
      b1.push(3);
      assert.deepEqual(cb.args, [[0], [4], [9]]);
    });
    it("handles changing inner behavior", () => {
      const inner = sinkBehavior(0);
      const b = Behavior.of(1).flatMap((_) => inner);
      const cb = spy();
      b.observe(cb, () => () => {});
      assert.strictEqual(at(b), 0);
      inner.push(2);
      assert.strictEqual(at(b), 2);
      inner.push(3);
      assert.strictEqual(at(b), 3);
      assert.deepEqual(cb.args, [[0], [2], [3]]);
    });
    it("stops subscribing to past inner behavior", () => {
      const inner = sinkBehavior(0);
      const outer = sinkBehavior(1);
      const b = outer.flatMap((n) => (n === 1 ? inner : Behavior.of(6)));
      b.observe(() => {}, () => () => {});
      assert.strictEqual(at(b), 0);
      inner.push(2);
      assert.strictEqual(at(b), 2);
      outer.push(2);
      assert.strictEqual(at(b), 6);
      inner.push(3);
      assert.strictEqual(at(b), 6);
    });
    it("handles changes from both inner and outer", () => {
      const outer = sinkBehavior(0);
      const inner1 = sinkBehavior(1);
      const inner2 = sinkBehavior(3);
      const b = outer.flatMap((n) => {
        if (n === 1) {
          return inner1;
        } else if (n === 2) {
          return inner2;
        }
        return Behavior.of(0);
      });
      b.observe(() => {}, () => () => {});
      assert.strictEqual(at(b), 0);
      outer.push(1);
      assert.strictEqual(at(b), 1);
      inner1.push(2);
      assert.strictEqual(at(b), 2);
      outer.push(2);
      assert.strictEqual(at(b), 3);
      inner1.push(7); // Pushing to previous inner should have no effect
      assert.strictEqual(at(b), 3);
      inner2.push(4);
      assert.strictEqual(at(b), 4);
    });
    it("can switch between pulling and pushing", () => {
      const pushingB = sinkBehavior(0);
      let variable = 7;
      const pullingB = H.fromFunction(() => variable);
      const outer = sinkBehavior(true);
      const chained = outer.flatMap((b) => (b ? pushingB : pullingB));
      const pushSpy = spy();
      const beginPullingSpy = spy();
      const endPullingSpy = spy();
      const handlePulling = (...args: unknown[]) => {
        beginPullingSpy(...args);
        return endPullingSpy;
      };
      // Test that several observers are notified
      chained.observe(pushSpy, handlePulling);
      pushingB.push(1);
      pushingB.push(2);
      outer.push(false);
      assert.strictEqual(at(chained), 7);
      variable = 8;
      assert.strictEqual(at(chained), 8);
      pushingB.push(3);
      pushingB.push(4);
      outer.push(true);
      pushingB.push(5);
      outer.push(false);
      variable = 9;
      assert.strictEqual(at(chained), 9);
      assert.deepEqual(pushSpy.args, [[0], [1], [2], [4], [5]]);
      assert.equal(beginPullingSpy.callCount, 2);
      assert.equal(endPullingSpy.callCount, 1);
    });
    it("works with go-notation", () => {
      const a = H.sinkBehavior(1);
      const b: SinkBehavior<unknown> = go(function*(): Generator<
        SinkBehavior<number>,
        number,
        number
      > {
        const val = yield a;
        return val * 2;
      });
      const cb = spy();
      b.subscribe(cb);
      a.push(7);
      assert.deepEqual(cb.args, [[2], [14]]);
    });
  });
  describe("flat", () => {
    it("has proper type", () => {
      const b = Behavior.of(Behavior.of("foo"));
      H.flat(b).map((s) => s + "bar");
    });
  });
  describe("format", () => {
    it("interpolates string", () => {
      const bs1 = sinkBehavior("foo");
      const bs2 = sinkBehavior("bar");
      const b = format`${bs1} and ${bs2}!`;
      const cb = spy();
      b.subscribe(cb);
      bs1.push("Hello");
      bs2.push("goodbye");
      assert.deepEqual(cb.args, [
        ["foo and bar!"],
        ["Hello and bar!"],
        ["Hello and goodbye!"]
      ]);
    });
    it("insert numbers", () => {
      const bs1 = sinkBehavior("foo");
      const bs2 = sinkBehavior(12);
      const b = format`first ${bs1} then ${bs2}!`;
      const cb = spy();
      b.subscribe(cb);
      bs1.push("bar");
      bs2.push(24);
      assert.deepEqual(cb.args, [
        ["first foo then 12!"],
        ["first bar then 12!"],
        ["first bar then 24!"]
      ]);
    });
    it("supports literals", () => {
      const bs1 = sinkBehavior("foo");
      const n = 12;
      const s = "then";
      const b = format`first ${bs1} ${s} ${n}!`;
      const cb = spy();
      b.subscribe(cb);
      bs1.push("bar");
      assert.deepEqual(cb.args, [
        ["first foo then 12!"],
        ["first bar then 12!"]
      ]);
    });
  });
  describe("moment", () => {
    it("works as lift", () => {
      const b1 = sinkBehavior(0);
      const b2 = sinkBehavior(1);
      const derived = moment((at) => {
        return at(b1) + at(b2);
      });
      const cb = spy();
      derived.subscribe(cb);
      b1.push(2);
      b2.push(3);
      assert.deepEqual(cb.args, [[1], [3], [5]]);
    });
    it("adds and removes dependencies", () => {
      const flag = sinkBehavior(true);
      const b1 = sinkBehavior(2);
      const b2 = sinkBehavior(3);
      const derived = moment((at) => {
        return at(flag) ? at(b1) : at(b2);
      });
      const cb = spy();
      derived.subscribe(cb);
      b1.push(4);
      flag.push(false);
      b2.push(5);
      b1.push(6);
      assert.deepEqual(cb.args, [[2], [4], [3], [5]]);
    });
    it("can combine behaviors from array", () => {
      const nr1 = sinkBehavior(4);
      const nr2 = sinkBehavior(3);
      const nr3 = sinkBehavior(2);
      const count1 = { count: nr1 };
      const count2 = { count: nr2 };
      const count3 = { count: nr3 };
      const list: H.SinkBehavior<{ count: Behavior<number> }[]> = sinkBehavior(
        []
      );
      const derived = moment((at) => {
        return at(list)
          .map(({ count }) => at(count))
          .reduce((n, m) => n + m, 0);
      });
      const cb = spy();
      derived.subscribe(cb);
      list.push([count1, count2, count3]);
      nr2.push(5);
      list.push([count1, count3]);
      nr2.push(10);
      nr3.push(3);
      assert.deepEqual(cb.args, [[0], [9], [11], [6], [7]]);
    });
    it("works with placeholders", () => {
      const p = placeholder<number>();
      const b0 = sinkBehavior(3);
      const b1 = sinkBehavior(1);
      const b2 = sinkBehavior(2);
      const derived = moment((at) => {
        return at(b1) + at(p) + at(b2);
      });
      const cb = spy();
      derived.subscribe(cb);
      b1.push(2);
      p.replaceWith(b0);
      b0.push(0);
      assert.deepEqual(cb.args, [[7], [4]]);
    });
    it("works with snapshot", () => {
      const b1 = H.sinkBehavior(1);
      const b2 = H.moment((at) => at(b1) * 2);
      const snapped = H.snapshot(b2, H.empty);
      subscribeSpy(snapped);
    });
    it("time doesn't pass inside moment", () => {
      const b = moment((at) => {
        const t1 = at(time);
        while (Date.now() <= t1) {
          undefined;
        }
        const t2 = at(time);
        assert.strictEqual(t1, t2);
      });
      b.observe(
        () => {},
        (pull) => {
          pull();
          return () => {};
        }
      );
    });
    it("can be sampled", () => {
      const b = Behavior.of(3);
      const b2 = H.moment((at) => 2 * at(b));
      const n = H.at(b2);
      assert.strictEqual(n, 6);
    });
  });
});

describe("Behavior and Future", () => {
  describe("whenFrom", () => {
    it("gives occurred future when behavior is true", () => {
      let occurred = false;
      const b = Behavior.of(true);
      const fut = runNow(H.when(b));
      fut.subscribe((_) => (occurred = true));
      assert.strictEqual(occurred, true);
    });
    it("future occurs when behavior turns true", () => {
      let occurred = false;
      const b = sinkBehavior(false);
      const w = H.whenFrom(b);
      const fut = at(w);
      fut.subscribe((_) => (occurred = true));
      assert.strictEqual(occurred, false);
      b.push(true);
      assert.strictEqual(occurred, true);
    });
  });
  describe("snapshotAt", () => {
    it("snapshots behavior at future occurring in future", () => {
      let result: number | undefined = undefined;
      const bSink = sinkBehavior(1);
      const futureSink = H.sinkFuture();
      const mySnapshot = at(H.snapshotAt(bSink, futureSink));
      mySnapshot.subscribe((res) => (result = res));
      bSink.push(2);
      bSink.push(3);
      futureSink.resolve({});
      bSink.push(4);
      assert.strictEqual(result, 3);
    });
    it("uses current value when future occurred in the past", () => {
      let result: number | undefined = undefined;
      const bSink = sinkBehavior(1);
      const occurredFuture = H.Future.of({});
      bSink.push(2);
      const mySnapshot = at(H.snapshotAt(bSink, occurredFuture));
      mySnapshot.subscribe((res) => (result = res));
      bSink.push(3);
      assert.strictEqual(result, 2);
    });
  });
  describe("switchTo", () => {
    it("steps to new value", () => {
      const futureSink = sinkFuture<number>();
      const step = H.stepTo(3, futureSink);
      const cb = subscribeSpy(step);
      assert.strictEqual(at(step), 3);
      futureSink.resolve(7);
      assert.strictEqual(at(step), 7);
      assert.deepEqual(cb.args, [[3], [7]]);
    });
  });
  describe("switchTo", () => {
    it("switches to new behavior", () => {
      const b1 = sinkBehavior(1);
      const b2 = sinkBehavior(8);
      const futureSink = sinkFuture<Behavior<number>>();
      const switching = switchTo(b1, futureSink);
      const cb = subscribeSpy(switching);
      assert.strictEqual(at(switching), 1);
      b2.push(9);
      assert.strictEqual(at(switching), 1);
      b1.push(2);
      b1.push(3);
      futureSink.resolve(b2);
      b2.push(10);
      assert.deepEqual(cb.args, [[1], [2], [3], [9], [10]]);
    });
    it("changes from push to pull", () => {
      const pushSpy = spy();
      const beginPullingSpy = spy();
      const endPullingSpy = spy();
      const handlePulling = (...args: unknown[]) => {
        beginPullingSpy(...args);
        return endPullingSpy;
      };
      const pushingB = sinkBehavior(0);
      let x = 7;
      const pullingB = fromFunction(() => x);
      const futureSink = sinkFuture<Behavior<number>>();
      const switching = switchTo(pushingB, futureSink);
      observe(pushSpy, handlePulling, switching);
      assert.strictEqual(at(switching), 0);
      pushingB.push(1);
      assert.strictEqual(at(switching), 1);
      futureSink.resolve(pullingB);
      assert.strictEqual(at(switching), 7);
      x = 8;
      assert.strictEqual(at(switching), 8);
      assert.strictEqual(beginPullingSpy.callCount, 1);
      assert.strictEqual(endPullingSpy.callCount, 0);
    });
    it("changes from pull to push", () => {
      let beginPull = false;
      let endPull = false;
      const pushed: number[] = [];
      let x = 0;
      const b1 = fromFunction(() => x);
      const b2 = sinkBehavior(2);
      const futureSink = sinkFuture<Behavior<number>>();
      const switching = switchTo(b1, futureSink);
      observe(
        (n: number) => pushed.push(n),
        () => {
          beginPull = true;
          return () => {
            endPull = true;
          };
        },
        switching
      );
      assert.strictEqual(beginPull, true);
      assert.strictEqual(at(switching), 0);
      x = 1;
      assert.strictEqual(at(switching), 1);
      assert.strictEqual(endPull, false);
      futureSink.resolve(b2);
      assert.strictEqual(endPull, true);
      b2.push(3);
      assert.deepEqual(pushed, [2, 3]);
    });
  });
  describe("freezeTo", () => {
    it("freezes to the future's resolve value", () => {
      const cb = spy();
      const b = sinkBehavior("a");
      const f = sinkFuture<string>();
      const frozenBehavior = freezeTo(b, f);
      frozenBehavior.subscribe(cb);
      b.push("b");
      f.resolve("c");
      b.push("d");
      assert.deepEqual(cb.args, [["a"], ["b"], ["c"]]);
    });
  });
  describe("freezeAt", () => {
    it("freezes to the value of the behavior when the future resolved", () => {
      const cb = spy();
      const b = sinkBehavior("a");
      const f = sinkFuture<string>();
      const frozenBehavior = runNow(H.freezeAt(b, f));
      frozenBehavior.subscribe(cb);
      b.push("b");
      assert.deepEqual(cb.args, [["a"], ["b"]]);
      f.resolve("c");
      b.push("d");
      assert.deepEqual(cb.args, [["a"], ["b"]]);
    });
  });
});
describe("Behavior and Stream", () => {
  describe("switcher", () => {
    it("switches to behavior", () => {
      const result: number[] = [];
      const stream = H.sinkStream<Behavior<number>>();
      const initB = Behavior.of(1);
      const outerSwitcher = H.switcher(initB, stream);
      const switchingB = runNow(outerSwitcher);
      switchingB.subscribe((n) => result.push(n));
      const sinkB = sinkBehavior(2);
      stream.push(sinkB);
      sinkB.push(3);
      assert.deepEqual(result, [1, 2, 3]);
      assert.deepEqual(at(runNow(outerSwitcher)), 1);
    });
    it("stays in pull when stream switches to push", () => {
      const stream = H.placeholder<Behavior<number>>();
      let val = 2;
      const initB = H.fromFunction(() => val);
      const switchingB = runNow(H.switcher(initB, stream));
      observe(
        () => {},
        () => {
          return () => {
            throw new Error("Should not be called.");
          };
        },
        switchingB
      );
      stream.replaceWith(H.sinkStream());
      val = 4;
      expect(H.at(switchingB)).toBe(4);
    });
  });
  describe("stepper", () => {
    it("steps to the last event value", () => {
      const s = H.sinkStream();
      const b = runNow(H.stepper(0, s));
      const cb = subscribeSpy(b);
      s.push(1);
      s.push(2);
      assert.deepEqual(cb.args, [[0], [1], [2]]);
    });
    it("saves last occurrence from stream", () => {
      const s = H.sinkStream();
      const t = runNow(H.stepper(1, s));
      s.push(12);
      const spy = subscribeSpy(t);
      assert.deepEqual(spy.args, [[12]]);
    });
    it("has old value in exact moment", () => {
      const s = H.sinkStream();
      const b = runNow(H.stepper(0, s));
      const res = H.snapshot(b, s);
      const spy = subscribeSpy(res);
      s.push(1);
      assert.strictEqual(b.at(), 1);
      s.push(2);
      assert.strictEqual(b.at(), 2);
      assert.deepEqual(spy.args, [[0], [1]]);
    });
  });
  describe("accum", () => {
    it("has accumFrom as method on stream", () => {
      H.empty.accumFrom(sum, 0);
    });
    it("accumulates in a pure way", () => {
      const s = H.sinkStream<number>();
      const accumulated = H.accumFrom(sum, 1, s);
      const b1 = at(accumulated);
      const spy = subscribeSpy(b1);
      assert.strictEqual(at(b1), 1);
      s.push(2);
      assert.strictEqual(at(b1), 3);
      const b2 = at(accumulated);
      assert.strictEqual(at(b2), 1);
      s.push(4);
      assert.strictEqual(at(b1), 7);
      assert.strictEqual(at(b2), 5);
      assert.deepEqual(spy.args, [[1], [3], [7]]);
    });
    it("works with placeholder", () => {
      const s = H.sinkStream<number>();
      const ps = H.placeholder();
      const accumulated = runNow(ps.accum(sum, 1));
      ps.replaceWith(s);
      s.push(2);
      s.push(3);
      s.push(4);
      assert.strictEqual(accumulated.at(), 10);
    });
  });
  describe("scanCombineFrom", () => {
    it("combines several streams", () => {
      const add = H.sinkStream();
      const sub = H.sinkStream();
      const mul = H.sinkStream();
      const b = runNow(
        H.accumCombine(
          [
            [add, (n: number, m: number) => n + m],
            [sub, (n: number, m: number) => m - n],
            [mul, (n: number, m: number) => n * m]
          ],
          1
        )
      );
      const cb = subscribeSpy(b);
      add.push(3);
      mul.push(3);
      sub.push(5);
      assert.deepEqual(cb.args, [[1], [4], [12], [7]]);
    });
  });
  describe("shiftCurrent", () => {
    it("returns stream that emits from stream", () => {
      const s1 = H.sinkStream();
      const s2 = H.sinkStream();
      const s3 = H.sinkStream();
      const b = sinkBehavior(s1);
      const switching = H.shiftCurrent(b);
      const cb = spy();
      switching.subscribe(cb);
      s1.push(1);
      s1.push(2);
      b.push(s2);
      s2.push(3);
      b.push(s3);
      s2.push(4);
      s3.push(5);
      s3.push(6);
      assert.deepEqual(cb.args, [[1], [2], [3], [5], [6]]);
    });
    it("works with placeholder", () => {
      const s1 = H.sinkStream<number>();
      const b = sinkBehavior(s1);
      const pB = H.placeholder<Stream<number>>();
      const s = H.shiftCurrent(pB);
      const callback = subscribeSpy(s);
      pB.replaceWith(b);
      s1.push(0);
      assert.deepEqual(callback.args, [[0]]);
    });
    // it("can be applied to `scanFrom` stream", () => {
    //   // FIXME: `s3` below should result in an empty stream. This probably
    //   // requires implementing pull stream.
    //   const s1 = H.sinkStream();
    //   const s2 = H.scanFrom((_, b) => b + 1, 0, s1);
    //   const s3 = H.shiftCurrent(s2);
    //   H.subscribe((s) => console.log(s), s3);
    // });
  });
  describe("toggle", () => {
    it("has correct initial value", () => {
      const s1 = H.sinkStream();
      const s2 = H.sinkStream();
      const flipper1 = runNow(H.toggle(true, s1, s2));
      assert.strictEqual(at(flipper1), true);
      const flipper2 = runNow(H.toggle(false, s1, s2));
      assert.strictEqual(at(flipper2), false);
    });
    it("flips properly", () => {
      const s1 = H.sinkStream();
      const s2 = H.sinkStream();
      const flipper = runNow(H.toggle(false, s1, s2));
      const cb = subscribeSpy(flipper);
      s1.push(1);
      s2.push(2);
      s1.push(3);
      assert.deepEqual(cb.args, [[false], [true], [false], [true]]);
    });
  });
  describe("observe", () => {
    it("when switching from push to pull the pull handler can pull", () => {
      const pushingB = sinkBehavior(0);
      let variable = -1;
      const pullingB = H.fromFunction(() => variable);
      const outer = sinkBehavior<Behavior<number>>(pushingB);
      const flattened = H.flat(outer);
      const pushSpy = spy();
      let pull: undefined | (() => void);
      const handlePulling = (p: () => void): (() => void) => {
        pull = p;
        return () => undefined;
      };
      flattened.observe(pushSpy, handlePulling);
      outer.push(pullingB);
      variable = 1;
      if (pull !== undefined) {
        pull();
        variable = 2;
        pull();
        variable = 3;
        pull();
      }
      assert.deepEqual(pushSpy.args, [[0], [1], [2], [3]]);
    });
  });
  describe("log", () => {
    it("logs every change on push behavior", () => {
      const origLog = console.log;
      const strings: unknown[] = [];
      console.log = (...s: string[]) => strings.push(s);
      const b = sinkBehavior("hello");
      b.log();
      b.push("world");
      console.log = origLog;
      assert.deepEqual(strings, [["hello"], ["world"]]);
    });
    it("logs with prefix", () => {
      const origLog = console.log;
      const strings: unknown[] = [];
      console.log = (...s: string[]) => strings.push(s);
      const b = sinkBehavior("hello");
      b.log("b");
      b.push("world");
      console.log = origLog;
      assert.deepEqual(strings, [["b", "hello"], ["b", "world"]]);
    });
    it("logs on pull behavior", () => {
      const clock = useFakeTimers();
      const origLog = console.log;
      const strings: unknown[] = [];
      console.log = (...s: string[]) => strings.push(s);

      let v = "zero";
      const b = fromFunction(() => v);
      b.log("b", 1000);

      clock.tick(500);
      v = "one";
      clock.tick(500);
      v = "two";
      clock.tick(1000);
      // Restore
      console.log = origLog;
      clock.restore();

      assert.deepEqual(strings, [["b", "zero"], ["b", "one"], ["b", "two"]]);
    });
  });
});
