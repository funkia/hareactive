import { subscribeSpy, mockNow } from "./helpers";
import { useFakeTimers, spy } from "sinon";
import { assert } from "chai";

import { placeholder } from "../src/placeholder";
import { observe } from "../src/common";
import {
  isBehavior,
  Behavior,
  stepperFrom,
  fromFunction,
  sinkBehavior,
  debounce,
  delay,
  isStream,
  sinkStream,
  snapshot,
  throttle
} from "../src";
import * as H from "../src";

import { createTestProducerBehavior } from "./helpers";

describe("placeholder", () => {
  describe("behavior", () => {
    it("subscribers are notified when placeholder is replaced", () => {
      let result: number;
      const p = placeholder<string>();
      const mapped = p.map((s) => s.length);
      mapped.subscribe((n: number) => (result = n));
      p.replaceWith(sinkBehavior("Hello"));
      assert.strictEqual(result, 5);
    });
    it("subscribers are notified when placeholder is replaced 2", () => {
      let result: string;
      const p = placeholder<string>();
      p.subscribe((s) => (result = s));
      p.replaceWith(Behavior.of("Hello"));
      assert.strictEqual(result, "Hello");
    });
    it("observes are notified when replaced with pushing behavior", () => {
      const p = placeholder();
      const b = sinkBehavior(0);
      const pushSpy = spy();
      observe(
        pushSpy,
        () => {
          throw new Error("should not be called");
        },
        p
      );
      p.replaceWith(b);
      b.newValue(1);
      assert.deepEqual(pushSpy.args, [[0], [1]]);
    });
    it("observer are notified when replaced with pulling behavior", () => {
      let beginPulling = false;
      const p = placeholder();
      const b = fromFunction(() => 12);
      observe(
        () => {
          throw new Error("should not be called");
        },
        () => {
          beginPulling = true;
          return () => {
            throw new Error("should not be called");
          };
        },
        p
      );
      assert.strictEqual(beginPulling, false);
      p.replaceWith(b);
      assert.strictEqual(beginPulling, true);
      assert.strictEqual(p.at(), 12);
    });
    it("can be replaced with constant behavior and sampled", () => {
      const p = H.placeholder();
      p.replaceWith(Behavior.of(3));
      assert.strictEqual(H.at(p), 3);
    });
    it("can pull mapped placeholder", () => {
      let variable = 0;
      const b = fromFunction(() => variable);
      const p = placeholder<number>();
      const mapResult = [];
      const pm = p.map((n) => (mapResult.push(n), n));
      const result: Array<number> = [];
      let pull;
      observe(
        (a) => {
          result.push(a);
        },
        (pullCb) => {
          pull = pullCb;
          return () => {
            throw new Error("Should not be called");
          };
        },
        pm
      );
      p.replaceWith(b);
      pull();
      variable = 1;
      pull();
      variable = 2;
      pull();
      assert.deepEqual(result, [0, 1, 2], "result");
      assert.deepEqual(mapResult, [0, 1, 2], "mapResult");
    });
    it("is possible to subscribe to a placeholder that has been replaced", () => {
      const p = placeholder<string>();
      p.replaceWith(Behavior.of("hello"));
      p.subscribe((n) => assert.strictEqual(n, "hello"));
    });
    it("is possible to subscribe to a mapped placeholder that has been replaced", () => {
      const p = placeholder<string>();
      const mapped = p.map((s) => s.length);
      p.replaceWith(Behavior.of("hello"));
      observe((n) => assert.strictEqual(n, 5), () => 0 as any, mapped);
    });
    it("pushes if replaced with pushing behavior", () => {
      const stream = sinkStream();
      const b = stepperFrom(0, stream).at();
      const p = placeholder();
      // We replace with a behavior that does not support pulling
      p.replaceWith(b);
      assert.strictEqual(p.at(), 0);
    });
    it("is a behavior", () => {
      const p = placeholder();
      assert.strictEqual(isBehavior(p), true);
    });
    it("throws on attempt to sample non-replaced behavior", () => {
      const p = placeholder();
      assert.throws(() => {
        p.at();
      }, "placeholder");
    });
    it("mapTo", () => {
      const p = placeholder<number>();
      const mapped = p.mapTo(12);
      assert.isTrue(isBehavior(mapped));
      assert.isTrue(isBehavior(mapped.mapTo(3)));
      const cb = subscribeSpy(mapped);
      p.replaceWith(sinkBehavior(0));
      assert.deepEqual(cb.args, [[12]]);
    });
    it("ap works on placeholder", () => {
      const bp = H.placeholder<number>();
      const b = Behavior.of(3).ap(bp.map((n) => (m) => n + m));
      let result = undefined;
      b.observe(
        (n) => {
          result = n;
        },
        () => {
          return () => {};
        }
      );
      bp.replaceWith(Behavior.of(2));
      assert.strictEqual(result, 5);
    });
    it("chain works on placeholder", () => {
      const b = placeholder();
      const chained = b.chain((n: any) => Behavior.of(n));
      b.replaceWith(Behavior.of(3));
    });
    it("is possible to snapshot a placeholder that has been replaced", () => {
      const { activate, push, producer } = createTestProducerBehavior(0);
      const pB = placeholder();
      const s = sinkStream<string>();
      const shot = snapshot(pB, s);
      const callback = subscribeSpy(shot);
      pB.replaceWith(producer);
      s.push("a");
      s.push("b");
      push(1);
      s.push("c");
      s.push("d");
      push(4);
      s.push("e");
      assert.deepEqual(callback.args, [[0], [0], [1], [1], [4]]);
    });
    it("supports circular dependency and switcher", () => {
      // The important part of this test is the circular dependency and that the
      // placeholder is replaced by a `switcher` that should have its `last`
      // property set.
      const [setTime, restore] = mockNow();
      setTime(2000);
      const sum = H.placeholder<number>();
      const change = sum.map((_) => 1);
      const sum2 = H.at(H.switcherFrom(H.at(H.integrateFrom(change)), H.empty));
      const results = [];
      let pull;
      observe(
        (n: number) => results.push(n),
        (p) => {
          pull = p;
          return () => {};
        },
        sum
      );
      sum.replaceWith(sum2);
      pull();
      setTime(4000);
      pull();
      setTime(7000);
      pull();
      assert.deepEqual(results, [0, 2000, 5000]);
      restore();
    });
    it("is possible to invoke changes on a placeholder", () => {
      const p = H.placeholder<number>();
      const b = H.changes(p);
      const cb = subscribeSpy(b);
      const sink = sinkBehavior(0);
      p.replaceWith(sink);
      sink.push(1);
      assert.deepEqual(cb.args, [[1]]);
    });
    it.skip("handles diamond dependency", () => {
      //     p
      //   /   \
      //  b1   b2
      //   \   /
      //    b3
      const p = H.placeholder<number>();
      const b1 = p.map((n) => n * n);
      const b2 = p.map((n) => n + 4);
      const b3 = H.lift(
        (n, m) => {
          assert.isNumber(n);
          assert.isNumber(m);
          return n + m;
        },
        b1,
        b2
      );
      subscribeSpy(b3);
      p.replaceWith(H.Behavior.of(3));
      assert.strictEqual(H.at(b3), 16);
    });
  });
  describe("stream", () => {
    it("is stream", () => {
      assert.isTrue(isStream(placeholder()));
    });
    it("returns stream from map", () => {
      const p = placeholder<number>();
      const mapped = p.map((n) => n * n);
      assert.isTrue(isStream(mapped));
    });
    it("map", () => {
      let result = 0;
      const p = placeholder();
      const mapped = p.map((s: number) => s + 1);
      mapped.subscribe((n: number) => (result = n));
      const s = sinkStream();
      p.replaceWith(s);
      assert.strictEqual(result, 0);
      s.push(1);
      assert.strictEqual(result, 2);
    });
    it("mapTo", () => {
      const sink = sinkStream<number>();
      const p = placeholder<number>();
      const mapped = p.mapTo(12);
      assert.isTrue(isStream(mapped));
      const cb = subscribeSpy(mapped);
      p.replaceWith(sink);
      assert.deepEqual(cb.args, []);
      sink.push(12);
      sink.push(12);
      assert.deepEqual(cb.args, [[12], [12]]);
    });
    it("snapshot", () => {
      let result = 0;
      const b = Behavior.of(7);
      const p = placeholder();
      const snap = snapshot(b, p);
      snap.subscribe((n: number) => (result = n));
      const s = sinkStream();
      p.replaceWith(s);
      assert.strictEqual(result, 0);
      s.push(1);
      assert.strictEqual(result, 7);
    });
    describe("timing operators", () => {
      let clock: any;
      beforeEach(() => {
        clock = useFakeTimers();
      });
      afterEach(() => {
        clock.restore();
      });
      it("delay work with placeholder", () => {
        let n = 0;
        const p = placeholder();
        const delayedP = H.runNow(delay(50, p));
        delayedP.subscribe(() => (n = 2));
        p.subscribe(() => (n = 1));
        const s = sinkStream<number>();
        p.replaceWith(s);
        s.push(0);
        assert.strictEqual(n, 1);
        clock.tick(49);
        assert.strictEqual(n, 1);
        clock.tick(1);
        assert.strictEqual(n, 2);
        clock.restore();
      });
      it("throttle", () => {
        let n = 0;
        const p = placeholder();
        const throttleP = H.runNow(throttle(100, p));
        throttleP.subscribe((v: number) => (n = v));
        assert.strictEqual(n, 0);
        const s = sinkStream<number>();
        p.replaceWith(s);
        s.push(1);
        clock.tick(99);
        s.push(2);
        assert.strictEqual(n, 1);
        clock.tick(1);
        s.push(3);
        assert.strictEqual(n, 3);
      });
      it("should work with placeholder", () => {
        let n = 0;
        const p = placeholder();
        const debouncedP = H.runNow(debounce(100, p));
        debouncedP.subscribe((v: number) => (n = v));
        const s = sinkStream<number>();
        p.replaceWith(s);
        assert.strictEqual(n, 0);
        s.push(1);
        clock.tick(80);
        assert.strictEqual(n, 0);
        clock.tick(30);
        assert.strictEqual(n, 1);
        s.push(2);
        assert.strictEqual(n, 1);
        clock.tick(99);
        assert.strictEqual(n, 1);
        clock.tick(2);
        assert.strictEqual(n, 2);
      });
    });
  });
  describe("future", () => {
    it("is future", () => {
      assert.isTrue(H.isFuture(placeholder()));
    });
    it("subscribers are notified when replaced with occurred future", () => {
      let result: string;
      const p = placeholder<string>();
      p.subscribe((n: string) => (result = n));
      p.replaceWith(H.Future.of("Hello"));
      assert.strictEqual(result, "Hello");
    });
    it("subscribers are notified when placeholder has been replaced", () => {
      let result: string;
      const p = placeholder<string>();
      p.replaceWith(H.Future.of("Hello"));
      p.subscribe((n: string) => (result = n));
      assert.strictEqual(result, "Hello");
    });
    it("can be mapped", () => {
      let result = 0;
      const p = placeholder();
      const mapped = p.map((s: number) => s + 1);
      mapped.subscribe((n: number) => (result = n));
      const fut = H.sinkFuture();
      p.replaceWith(fut);
      assert.strictEqual(result, 0);
      fut.resolve(1);
      assert.strictEqual(result, 2);
    });
    it("works with mapped switchTo", () => {
      const b1 = Behavior.of(1);
      const b2 = Behavior.of(2);
      const p = placeholder<Behavior<number>>();
      const cb = spy();
      const switching = H.switchTo(b1, p);
      const mapped = switching.map((n) => n);
      mapped.subscribe(cb);
      const fut = H.sinkFuture<Behavior<number>>();
      p.replaceWith(fut);
      fut.resolve(b2);
      assert.deepEqual(cb.args, [[1], [2]]);
    });
  });
});
