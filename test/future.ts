import { assert } from "chai";
import { spy } from "sinon";

import {
  Future,
  sinkFuture,
  fromPromise,
  nextOccurence,
  mapCbFuture
} from "../src/future";
import { SinkStream, Behavior } from "../src";
import * as H from "../src";

describe("Future", () => {
  describe("isFuture", () => {
    it("should be true when Future object", () => {
      assert.isTrue(H.isFuture(H.sinkFuture()));
      assert.isTrue(H.isFuture(Future.of(3)));
    });
    it("should be false when not Stream object", () => {
      assert.isFalse(H.isFuture([]));
      assert.isFalse(H.isFuture({}));
      assert.isFalse(H.isFuture(undefined));
      assert.isFalse(H.isFuture(Behavior.of(2)));
      assert.isFalse(H.isFuture("test"));
      assert.isFalse(H.isFuture(H.empty));
      assert.isFalse(H.isFuture(1234));
      assert.isFalse(H.isFuture(H.isFuture));
    });
  });
  describe("sink", () => {
    it("notifies subscriber", () => {
      let result: number;
      const s = sinkFuture<number>();
      s.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, undefined);
      s.resolve(2);
      assert.strictEqual(result, 2);
    });
    it("notifies subscriber several layers down", () => {
      let result: number;
      const s = sinkFuture<number>();
      const s2 = s.map((n) => n + 2).mapTo(9);
      s2.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, undefined);
      s.resolve(1);
      assert.strictEqual(result, 9);
    });
    it("subscribing to resolved sink gives value", () => {
      const cb = spy();
      const s = sinkFuture<number>();
      s.resolve(1);
      assert.equal(s.state, H.State.Done, "Is done");
      s.subscribe(cb);
      assert.deepEqual(cb.args, [[1]]);
    });
  });
  describe("Semigroup", () => {
    it("returns the first future if it occurs first", () => {
      let result: number;
      const future1 = sinkFuture<number>();
      const future2 = sinkFuture<number>();
      const combined = future1.combine(future2);
      combined.subscribe((a) => (result = a));
      future1.resolve(1);
      future2.resolve(2);
      assert.strictEqual(result, 1);
    });
    it("returns the seconds future if it occurs first", () => {
      let result: number;
      const future1 = sinkFuture<number>();
      const future2 = sinkFuture<number>();
      const combined = future1.combine(future2);
      combined.subscribe((a) => (result = a));
      future2.resolve(2);
      future1.resolve(1);
      assert.strictEqual(result, 2);
    });
    it("returns when only one occurs", () => {
      let result1: number;
      let result2: number;
      const future1 = sinkFuture<number>();
      const future2 = sinkFuture<number>();
      const combined = future1.combine(future2);
      future1.subscribe((a) => {
        result1 = a;
      });
      combined.subscribe((a) => (result2 = a));
      future1.resolve(1);
      assert.strictEqual(result1, 1);
    });
  });
  describe("Monoid", () => {
    it("has no occurrence", () => {
      let result: number;
      H.never.map((a) => (result = a))
      assert.strictEqual(result, undefined);
    });
    it("has semantic representation", () => {
      assert.strictEqual(H.never.semantic(), H.neverOccurringFuture);
    });
  });
  describe("Functor", () => {
    it("maps over value", () => {
      let result: number;
      const s = sinkFuture<number>();
      const mapped = s.map((x) => x * x);
      mapped.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, undefined);
      s.resolve(4);
      assert.strictEqual(result, 16);
    });
    it("maps to constant", () => {
      let result: string;
      const s = sinkFuture<number>();
      const mapped = s.mapTo("horse");
      mapped.subscribe((x: string) => {
        result = x;
      });
      assert.strictEqual(result, undefined);
      s.resolve(4);
      assert.strictEqual(result, "horse");
    });
  });
  describe("Applicative", () => {
    it("of gives future that has occurred", () => {
      let result: number;
      const o = Future.of(12);
      o.subscribe((x) => (result = x));
      assert.strictEqual(result, 12);
      o.of(7).subscribe((x) => (result = x));
      assert.strictEqual(result, 7);
    });
    it("lifts a function of one argument", () => {
      let result: string;
      const fut = sinkFuture<string>();
      const lifted = H.lift((s: string) => s + "!", fut);
      lifted.subscribe((s: string) => (result = s));
      assert.strictEqual(result, undefined);
      fut.resolve("Hello");
      assert.strictEqual(result, "Hello!");
    });
    it("lifts a function of three arguments", () => {
      let result: string;
      const fut1 = sinkFuture<string>();
      const fut2 = sinkFuture<string>();
      const fut3 = sinkFuture<string>();
      const lifted = H.lift(
        (s1: string, s2: string, s3: string) => {
          return s1 + "-" + s2 + "+" + s3;
        },
        fut1,
        fut2,
        fut3
      );
      lifted.subscribe((s: string) => (result = s));
      assert.strictEqual(result, undefined);
      fut1.resolve("Hello");
      assert.strictEqual(result, undefined);
      fut2.resolve("over");
      assert.strictEqual(result, undefined);
      fut3.resolve("there");
      assert.strictEqual(result, "Hello-over+there");
    });
  });
  describe("flatMap", () => {
    it("flatMaps value", () => {
      let result: number[] = [];
      const fut1 = sinkFuture<number>();
      const fut2 = sinkFuture<number>();
      const chained = fut1.flatMap((n: number) => {
        result.push(n);
        return fut2;
      });
      chained.subscribe((n: number) => {
        result.push(n);
      });
      fut1.resolve(1);
      assert.deepEqual(result, [1]);
      fut2.resolve(2);
      assert.deepEqual(result, [1, 2]);
    });
  });
  it("can convert Promise to Future", () => {
    let result: number;
    let resolve: (n: number) => void;
    const promise = new Promise((res) => (resolve = res));
    const future = fromPromise(promise);
    future.subscribe((res: number) => (result = res));
    assert.strictEqual(result, undefined);
    resolve(12);
    return promise.then(() => {
      assert.strictEqual(result, 12);
    });
  });
  describe("nextOccurence", () => {
    it("resolves on next occurence", () => {
      let result: string;
      const s = new SinkStream<string>();
      const next = nextOccurence(s);
      s.push("a");
      const f = next.at();
      f.subscribe((v) => (result = v));
      assert.strictEqual(result, undefined);
      s.push("b");
      assert.strictEqual(result, "b");
    });
  });
  describe("mapCbFuture", () => {
    it("resolves with result when done callback invoked", () => {
      const fut = sinkFuture<number>();
      const cb = spy();
      let value;
      let done;
      const fut2 = mapCbFuture((v, d) => {
        value = v;
        done = d;
      }, fut);
      fut2.subscribe(cb);
      fut.resolve(3);
      assert.equal(value, 3);
      assert.equal(cb.callCount, 0);
      done(value + 1);
      assert.equal(cb.callCount, 1);
      assert.deepEqual(cb.args, [[4]]);
    });
  });
});
