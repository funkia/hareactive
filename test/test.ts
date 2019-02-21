import { assert } from "chai";
import * as H from "../src";
import { Behavior, Stream } from "../src";
import {
  testFuture,
  assertFutureEqual,
  testStreamFromObject,
  testAt,
  testStreamFromArray,
  assertStreamEqual,
  testBehavior,
  testNow
} from "../src/test";
import { createRef, mutateRef } from "./helpers";
import { performIO, Now } from "../src";
import { fgo, withEffects } from "@funkia/jabz";

describe("testing", () => {
  describe("future", () => {
    describe("assertFutureEqual", () => {
      it("does not throw when equal", () => {
        assertFutureEqual(testFuture(4, "hello"), testFuture(4, "hello"));
      });
      it("does throws when not equal", () => {
        assert.throws(() => {
          assertFutureEqual(testFuture(3, "hello"), testFuture(4, "hello"));
        });
        assert.throws(() => {
          assertFutureEqual(testFuture(4, "hello"), testFuture(4, "HELLO"));
        });
      });
    });
    describe("combine", () => {
      it("gives first future if earliest", () => {
        const fut1 = testFuture(2, "foo");
        const fut2 = testFuture(3, "bar");
        const res = H.combine(fut1, fut2);
        assertFutureEqual(res, fut1);
      });
      it("gives second future if earliest", () => {
        const fut1 = testFuture(4, "foo");
        const fut2 = testFuture(3, "bar");
        const res = H.combine(fut1, fut2);
        assertFutureEqual(res, fut2);
      });
    });
    describe("functor", () => {
      it("maps value", () => {
        const fut = H.testFuture(3, "hello");
        const fut2 = fut.map((s) => s.toUpperCase());
        assertFutureEqual(fut2, H.testFuture(3, "HELLO"));
      });
      it("maps to constant", () => {
        const fut = H.testFuture(7, "hello");
        const fut2 = fut.mapTo("world");
        assertFutureEqual(fut2, H.testFuture(7, "world"));
      });
    });
    describe("never", () => {
      it("never occurs", () => {
        assert.strictEqual(H.never.model().time, "infinity");
      });
    });
    describe("lift", () => {
      const f1 = H.testFuture(2, 2);
      const f2 = H.testFuture(5, 3);
      const f3 = H.testFuture(1, 7);
      it("applies function to values with last time", () => {
        const f4 = H.lift((a, b, c) => a * b + c, f1, f2, f3);
        assertFutureEqual(f4, H.testFuture(5, 13));
      });
      it("returns never when given a never", () => {
        const f4 = H.lift((a, b, c) => a * b + c, H.never, f2, f3);
        assertFutureEqual(f4, H.never);
      });
    });
    describe("of", () => {
      it("occurs at negative infinity", () => {
        const fut = H.Future.of(12);
        assertFutureEqual(fut, testFuture(-Infinity, 12));
      });
    });
    describe("flatMap", () => {
      it("occurs at negative infinity", () => {
        const fut = testFuture(3, "foo").flatMap((s) =>
          testFuture(5, s + "bar")
        );
        assertFutureEqual(fut, testFuture(5, "foobar"));
      });
      it("returns never on never", () => {
        const fut = H.never.flatMap((s) => testFuture(5, s + "bar"));
        assertFutureEqual(fut, H.never);
      });
    });
    describe("nextOccurrence", () => {
      const s = testStreamFromObject({ 4: "foo", 6: "bar", 9: "baz" });
      const b = H.nextOccurence(s);
      it("returns next occurrence", () => {
        assertFutureEqual(testAt(3, b), testFuture(4, "foo"));
        assertFutureEqual(testAt(7, b), testFuture(9, "baz"));
      });
      it("returns never when no next occurrence", () => {
        assertFutureEqual(testAt(10, b), H.never);
      });
    });
  });
  describe("stream", () => {
    describe("test streams", () => {
      it("creates test stream with increasing times from array", () => {
        const s = testStreamFromArray([[0, 0], [1, 1], [2, 2], [3, 3]]);
        assert.deepEqual(s.model(), [
          { value: 0, time: 0 },
          { value: 1, time: 1 },
          { value: 2, time: 2 },
          { value: 3, time: 3 }
        ]);
      });
      it("creates test stream from object", () => {
        const s = H.testStreamFromObject({
          2: "one",
          4: "two",
          5.5: "three"
        });
        assert.deepEqual(s.model(), [
          { value: "one", time: 2 },
          { value: "two", time: 4 },
          { value: "three", time: 5.5 }
        ]);
      });
    });
    describe("map", () => {
      it("applies function to values", () => {
        const s = testStreamFromArray([[1, 1], [2, 2], [3, 3]]);
        const mapped = s.map((n) => n * n);
        assertStreamEqual(mapped, { 1: 1, 2: 4, 3: 9 });
      });
    });
    describe("map", () => {
      it("changes values to constant", () => {
        const s = testStreamFromArray([[1, 1], [2, 2], [3, 3]]);
        const mapped = s.mapTo(7);
        assertStreamEqual(mapped, [[1, 7], [2, 7], [3, 7]]);
      });
    });
    describe("filter", () => {
      it("filter values semantically", () => {
        const s = H.testStreamFromObject({ 0: 1, 1: 3, 2: 2, 3: 4, 4: 1 });
        const filtered = s.filter((n) => n > 2);
        assertStreamEqual(filtered, { 1: 3, 3: 4 });
      });
    });
    describe("combine", () => {
      it("interleaves occurrences", () => {
        const s1 = H.testStreamFromObject({
          0: "#1",
          2: "#3"
        });
        const s2 = H.testStreamFromObject({
          1: "#2",
          2: "#4",
          3: "#5"
        });
        const combined = s2.combine(s1);
        assert.deepEqual(combined.model(), [
          { time: 0, value: "#1" },
          { time: 1, value: "#2" },
          { time: 2, value: "#3" },
          { time: 2, value: "#4" },
          { time: 3, value: "#5" }
        ]);
      });
    });
    describe("filter", () => {
      it("has semantic representation", () => {
        const b = testBehavior((t) => t * t);
        const s = H.testStreamFromObject({
          1: 1,
          4: 4,
          8: 8
        });
        const shot = H.snapshot(b, s);
        const expected = H.testStreamFromObject({
          1: 1,
          4: 16,
          8: 8 * 8
        });
        assertStreamEqual(shot, expected);
      });
    });
    describe("empty", () => {
      it("is empty array semantically", () => {
        assertStreamEqual(H.empty, []);
      });
    });
    it("works", () => {
      function foobar(s1: Stream<number>, s2: Stream<number>) {
        const isEven = (n) => n % 2 === 0;
        const a = s1.filter(isEven).map((n) => n * n);
        const b = s2.filter((n) => !isEven(n)).map(Math.sqrt);
        return a.combine(b);
      }
      const a = H.testStreamFromObject({ 0: 1, 2: 4, 4: 6 });
      const b = H.testStreamFromObject({ 1: 9, 3: 8 });
      const result = foobar(a, b);
      const expected = H.testStreamFromObject({ 1: 3, 2: 16, 4: 36 });
      assert.deepEqual(result.model(), expected.model());
    });
    describe("scanS", () => {
      it("accumulates state", () => {
        const s = H.testStreamFromObject({
          1: 1,
          2: 1,
          4: 2,
          6: 3,
          7: 1
        });
        const scanned = H.scanS((n, m) => n + m, 0, s);
        const from0 = testAt(0, scanned);
        assertStreamEqual(from0, {
          1: 1,
          2: 2,
          4: 4,
          6: 7,
          7: 8
        });
        const from3 = testAt(3, scanned);
        assertStreamEqual(from3, {
          4: 2,
          6: 5,
          7: 6
        });
      });
    });
    describe("delay", () => {
      it("delays occurrences", () => {
        const s = H.testStreamFromObject({
          1: 1,
          2: 1,
          4: 2,
          6: 3,
          7: 1
        });
        assertStreamEqual(H.delay(3, s), {
          4: 1,
          5: 1,
          7: 2,
          9: 3,
          10: 1
        });
      });
    });
  });
  describe("behavior", () => {
    describe("time", () => {
      it("is the identity function", () => {
        assert.strictEqual(testAt(0, H.time), 0);
        assert.strictEqual(testAt(1.3, H.time), 1.3);
        assert.strictEqual(testAt(17, H.time), 17);
      });
    });
    describe("map", () => {
      it("has semantic representation", () => {
        const b = H.testBehavior((t) => t);
        const mapped = b.map((t) => t * t);
        const semantic = mapped.model();
        assert.strictEqual(semantic(1), 1);
        assert.strictEqual(semantic(2), 4);
        assert.strictEqual(semantic(3), 9);
      });
    });
    describe("mapTo", () => {
      it("creates constant function", () => {
        const b = H.testBehavior((t) => {
          throw new Error("Don't call me");
        });
        const mapped = b.mapTo(7);
        const semantic = mapped.model();
        assert.strictEqual(semantic(-3), 7);
        assert.strictEqual(semantic(4), 7);
        assert.strictEqual(semantic(9), 7);
      });
    });
    describe("scan", () => {
      it("accumulates state", () => {
        const s = H.testStreamFromObject({
          1: 1,
          2: 1,
          4: 2,
          6: 3,
          7: 1
        });
        const scanned = H.scan((n, m) => n + m, 0, s);
        const semantic = scanned.model();
        const from0 = semantic(0).model();
        assert.strictEqual(from0(0), 0);
        assert.strictEqual(from0(1), 1);
        assert.strictEqual(from0(2), 2);
        assert.strictEqual(from0(3), 2);
        assert.strictEqual(from0(4), 4);
        const from3 = semantic(3).model();
        assert.strictEqual(from3(3), 0);
        assert.strictEqual(from3(4), 2);
        assert.strictEqual(from3(5), 2);
        assert.strictEqual(from3(6), 5);
        assert.strictEqual(from3(7), 6);
      });
    });
  });
  describe("behavior", () => {
    describe("of", () => {
      it("can be tested", () => {
        assert.strictEqual(testNow(Now.of(12)), 12);
      });
    });
    describe("flatMap", () => {
      it("can be tested", () => {
        const now = Now.of(3).flatMap((n) => Now.of(n * 4));
        assert.strictEqual(testNow(now), 12);
      });
    });
    describe("perform", () => {
      it("can be tested", () => {
        const ref1 = createRef(1);
        const comp = performIO(mutateRef(2, ref1));
        const result = testNow(comp, [testFuture(0, "foo")]);
        assert(result.model().value, "foo");
      });
    });
    describe("sample", () => {
      it("can be tested", () => {
        const stream = testStreamFromObject({ 1: 1, 2: 3, 4: 2 });
        const now = H.sample(H.scan((n, m) => n + m, 0, stream));
        const result = testNow(now);
        const fn = result.model();
        assert.deepEqual([fn(0), fn(1), fn(2), fn(3), fn(4)], [0, 1, 4, 4, 6]);
      });
      it("it can test with go", () => {
        const model = fgo(function*(incrementClick: Stream<any>) {
          const increment = incrementClick.mapTo(1);
          const count = yield H.sample(H.scan((n, m) => n + m, 0, increment));
          return count;
        });
        const stream = testStreamFromObject({ 1: 0, 2: 0, 4: 0 });
        const result = testNow<Behavior<number>>(model(stream));
        const fn = result.model();
        assert.strictEqual(fn(0), 0);
        assert.strictEqual(fn(1), 1);
        assert.strictEqual(fn(2), 2);
        assert.strictEqual(fn(3), 2);
        assert.strictEqual(fn(4), 3);
      });
    });
    describe("performStream", () => {
      it("can be tested", () => {
        let requests: number[] = [];
        const model = fgo(function*({ click }) {
          const request = click.mapTo(
            withEffects((n: number) => {
              requests.push(n);
              return n + 2;
            })
          );
          const response: Stream<string> = yield H.performStream(request);
          return { res: response };
        });
        const click = testStreamFromArray([
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5]
        ]);
        const out: { res: Stream<string> } = testNow(model({ click }), [
          testStreamFromArray([[0, "old1"], [1, "old2"], [2, "response"]])
        ]);
        assert(H.isStream(out.res));
        assert.deepEqual(
          out.res.model(),
          testStreamFromArray([
            [0, "old1"],
            [1, "old2"],
            [2, "response"]
          ]).model()
        );
        assert.deepEqual(requests, []);
      });
    });
    describe("performStreamLatest", () => {
      it("can be tested", () => {
        let requests: number[] = [];
        const model = fgo(function*({ click }) {
          const request = click.mapTo(
            withEffects((n: number) => {
              requests.push(n);
              return n + 2;
            })
          );
          const response = yield H.performStreamLatest(request);
          const res = H.stepper("", response.map((e) => e.toString()));
          return { res };
        });
        const click = testStreamFromArray([
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5]
        ]);
        const out: { res: Behavior<Behavior<string>> } = testNow(
          model({ click }),
          [testStreamFromArray([[0, "old"], [1, "old"], [2, "response"]])]
        );
        assert(H.isBehavior(out.res));
        assert.equal(
          out.res
            .model()(0)
            .model()(4),
          "response"
        );
        assert.deepEqual(requests, []);
      });
    });
    describe("performStreamOrdered", () => {
      it("can be tested", () => {
        let requests: number[] = [];
        const model = fgo(function*({ click }) {
          const request = click.mapTo(
            withEffects((n: number) => {
              requests.push(n);
              return n + 2;
            })
          );
          const response: Stream<string> = yield H.performStreamOrdered(
            request
          );
          return { res: response };
        });
        const click = testStreamFromArray([
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5]
        ]);
        const out: { res: Stream<string> } = testNow(model({ click }), [
          testStreamFromArray([[0, "old1"], [1, "old2"], [2, "response"]])
        ]);
        assert(H.isStream(out.res));
        assert.deepEqual(
          out.res.model(),
          testStreamFromArray([
            [0, "old1"],
            [1, "old2"],
            [2, "response"]
          ]).model()
        );
        assert.deepEqual(requests, []);
      });
    });
  });
});
