import { assert } from "chai";
import * as H from "../src";
import { Behavior, Stream, never, Now } from "../src";
import {
  testFuture,
  assertFutureEqual,
  testStreamFromObject,
  testAt,
  testStreamFromArray,
  assertStreamEqual,
  testBehavior,
  testNow,
  assertBehaviorEqual
} from "../src/testing";
import { createRef, mutateRef } from "./helpers";
import { fgo } from "@funkia/jabz";
import { withEffects } from "@funkia/io";

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
      it("gives first future if only resolved", () => {
        const fut1 = testFuture(4, "foo");
        const res = H.combine(fut1, never);
        assertFutureEqual(res, fut1);
      });
      it("gives second future if only resolved", () => {
        const fut2 = testFuture(3, "bar");
        const res = H.combine(never, fut2);
        assertFutureEqual(res, fut2);
      });
      it("gives never if none resolved", () => {
        const res = H.combine(never, never);
        assertFutureEqual(res, never);
      });
    });
    describe("functor", () => {
      it("maps value", () => {
        const fut = testFuture(3, "hello");
        const fut2 = fut.map((s) => s.toUpperCase());
        assertFutureEqual(fut2, testFuture(3, "HELLO"));
      });
      it("maps to constant", () => {
        const fut = testFuture(7, "hello");
        const fut2 = fut.mapTo("world");
        assertFutureEqual(fut2, testFuture(7, "world"));
      });
    });
    describe("never", () => {
      it("never occurs", () => {
        assert.strictEqual(H.never.model().time, "infinity");
      });
    });
    describe("lift", () => {
      const f1 = testFuture(2, 2);
      const f2 = testFuture(5, 3);
      const f3 = testFuture(1, 7);
      it("applies function to values with last time", () => {
        const f4 = H.lift((a, b, c) => a * b + c, f1, f2, f3);
        assertFutureEqual(f4, testFuture(5, 13));
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
        const fut = H.never.flatMap((s: string) => testFuture(5, s + "bar"));
        assertFutureEqual(fut, H.never);
      });
    });
    describe("nextOccurrence", () => {
      const s = testStreamFromObject({ 4: "foo", 6: "bar", 9: "baz" });
      const b = H.nextOccurrenceFrom(s);
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
        const s = testStreamFromObject({
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
        assertStreamEqual(mapped, { 1: 7, 2: 7, 3: 7 });
      });
    });
    describe("filter", () => {
      it("filter values semantically", () => {
        const s = testStreamFromObject({ 0: 1, 1: 3, 2: 2, 3: 4, 4: 1 });
        const filtered = s.filter((n) => n > 2);
        assertStreamEqual(filtered, { 1: 3, 3: 4 });
      });
    });
    describe("combine", () => {
      it("interleaves occurrences", () => {
        const s1 = testStreamFromObject({ 0: "#1", 2: "#3" });
        const s2 = testStreamFromObject({ 1: "#2", 2: "#4", 3: "#5" });
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
        const s = testStreamFromObject({ 1: 1, 4: 4, 8: 8 });
        const shot = H.snapshot(b, s);
        const expected = testStreamFromObject({ 1: 1, 4: 16, 8: 8 * 8 });
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
        const isEven = (n: number) => n % 2 === 0;
        const a = s1.filter(isEven).map((n) => n * n);
        const b = s2.filter((n) => !isEven(n)).map(Math.sqrt);
        return a.combine(b);
      }
      const a = testStreamFromObject({ 0: 1, 2: 4, 4: 6 });
      const b = testStreamFromObject({ 1: 9, 3: 8 });
      const result = foobar(a, b);
      const expected = testStreamFromObject({ 1: 3, 2: 16, 4: 36 });
      assert.deepEqual(result.model(), expected.model());
    });
    describe("scanS", () => {
      it("accumulates state", () => {
        const s = testStreamFromObject({ 1: 1, 2: 1, 4: 2, 6: 3, 7: 1 });
        const scanned = H.scanFrom((n, m) => n + m, 0, s);
        const from0 = testAt(0, scanned);
        assertStreamEqual(from0, { 1: 1, 2: 2, 4: 4, 6: 7, 7: 8 });
        const from3 = testAt(3, scanned);
        assertStreamEqual(from3, { 4: 2, 6: 5, 7: 6 });
      });
    });
    describe.skip("delay", () => {
      it("delays occurrences", () => {
        const s = testStreamFromObject({ 1: 1, 2: 1, 4: 2, 6: 3, 7: 1 });
        const res = testNow(H.delay(3, s));
        assertStreamEqual(res, { 4: 1, 5: 1, 7: 2, 9: 3, 10: 1 });
      });
    });
    describe("flatFutures", () => {
      it("can be tested", () => {
        const s = testStreamFromObject({
          0: testFuture(1, "a"),
          2: testFuture(5, "b"),
          4: testFuture(2, "c"),
          6: testFuture(7, "d")
        });
        const res = testNow(H.flatFutures(s), []);
        assert(H.isStream(res));
        assertStreamEqual(
          res,
          testStreamFromArray([[1, "a"], [4, "c"], [5, "b"], [7, "d"]])
        );
      });
    });
    describe("flatFuturesLatest", () => {
      it("can be tested", () => {
        const s = testStreamFromObject({
          0: testFuture(1, "a"),
          2: testFuture(6, "b"), // should be dropped
          4: testFuture(5, "c"),
          6: testFuture(12, "d"), // should be dropped
          8: testFuture(12, "e"), // should be dropped
          10: testFuture(3, "f")
        });
        const res = testNow(H.flatFuturesLatest(s), []);
        assert(H.isStream(res));
        assertStreamEqual(
          res,
          testStreamFromArray([[1, "a"], [5, "c"], [10, "f"]])
        );
      });
    });
    describe("flatFuturesOrdered", () => {
      it("can be tested", () => {
        const s = testStreamFromObject({
          0: testFuture(3, "a"),
          1: testFuture(2, "b"),
          2: testFuture(4, "c"),
          3: testFuture(0, "d"),
          4: testFuture(5, "e")
        });
        const res = testNow(H.flatFuturesOrdered(s), []);
        assert(H.isStream(res));
        assertStreamEqual(
          res,
          testStreamFromArray([
            [3, "a"],
            [3, "b"],
            [4, "c"],
            [4, "d"],
            [5, "e"]
          ])
        );
      });
    });
  });
  describe("behavior", () => {
    describe("assertBehaviorEqual", () => {
      const b = testBehavior((t) => t * t);
      it("does not throw", () => {
        assertBehaviorEqual(b, { 3: 9, 5: 25, 8: 64 });
      });
      it("throws", () => {
        assert.throws(() => {
          assertBehaviorEqual(b, { 3: 9, 5: 26, 8: 64 });
        });
      });
    });
    describe("time", () => {
      it("is the identity function", () => {
        assert.strictEqual(testAt(0, H.time), 0);
        assert.strictEqual(testAt(1.3, H.time), 1.3);
        assert.strictEqual(testAt(17, H.time), 17);
      });
    });
    describe("map", () => {
      it("has semantic representation", () => {
        const b = testBehavior((t) => t);
        const mapped = b.map((t) => t * t);
        assertBehaviorEqual(mapped, { "-3": 9, 1: 1, 2: 4, "4.5": 20.25 });
      });
    });
    describe("mapTo", () => {
      it("creates constant function", () => {
        const b = testBehavior((_) => {
          throw new Error("Don't call me");
        });
        const mapped = b.mapTo(7);
        assertBehaviorEqual(mapped, { "-3": 7, 4: 7, 9: 7 });
      });
    });
    describe("scan", () => {
      it("accumulates state", () => {
        const s = testStreamFromObject({ 1: 1, 2: 1, 4: 2, 6: 3, 7: 1 });
        const scanned = H.accumFrom((n, m) => n + m, 0, s);
        const semantic = scanned.model();
        const from0 = semantic(0);
        assertBehaviorEqual(from0, {
          0.1: 0,
          1: 0,
          1.1: 1,
          2: 1,
          2.1: 2,
          3: 2,
          4: 2,
          4.1: 4
        });
        const from3 = semantic(3);
        assertBehaviorEqual(from3, { 3.1: 0, 4.1: 2, 5.1: 2, 6.1: 5, 7.1: 6 });
      });
    });
  });
  describe("now", () => {
    describe("of", () => {
      it("can be tested", () => {
        assert.strictEqual(testNow(Now.of(12)), 12);
      });
    });
    describe("map", () => {
      it("can be tested", () => {
        assert.strictEqual(testNow(Now.of(3).map((n) => n * n)), 9);
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
        const comp = H.performIO(mutateRef(2, ref1));
        const result = testNow(comp, [testFuture(0, "foo")]);
        assert(result.model().value, "foo");
      });
    });
    describe("sample", () => {
      it("can be tested", () => {
        const stream = testStreamFromObject({ 1: 1, 2: 3, 4: 2 });
        const now = H.sample(H.accumFrom((n, m) => n + m, 0, stream));
        const result = testNow(now);
        assertBehaviorEqual(result, { 0.1: 0, 1.1: 1, 2.1: 4, 3.1: 4, 4.1: 6 });
      });
      it("it can test with go", () => {
        const model = fgo(function*(incrementClick: Stream<any>) {
          const increment = incrementClick.mapTo(1);
          const count = yield H.sample(
            H.accumFrom((n, m) => n + m, 0, increment)
          );
          return count;
        });
        const stream = testStreamFromObject({ 1: 0, 2: 0, 4: 0 });
        const result = testNow<Behavior<number>>(model(stream));
        assertBehaviorEqual(result, { 0.1: 0, 1.1: 1, 2.1: 2, 3.1: 2, 4.1: 3 });
      });
    });
    describe("performStream", () => {
      it("can be tested", () => {
        const requests: number[] = [];
        const model = fgo(function*({ click }) {
          const request = click.mapTo(
            withEffects((n: number) => {
              requests.push(n);
              return n + 2;
            })
          );
          const response: Stream<string> = yield H.performStream(
            request
          ).flatMap(H.flatFuturesOrdered);
          return { res: response };
        });
        const click = testStreamFromObject({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
        const out: { res: Stream<string> } = testNow(model({ click }), [
          testStreamFromArray([
            [0, testFuture(0, "old1")],
            [1, testFuture(1, "old2")],
            [2, testFuture(2, "response")]
          ])
        ]);
        assert(H.isStream(out.res));
        assertStreamEqual(
          out.res,
          testStreamFromObject({ 0: "old1", 1: "old2", 2: "response" })
        );
        assert.deepEqual(requests, []);
      });
    });
    describe("instant", () => {
      it("can be tested", () => {
        const requests: number[] = [];
        const model = (click: Stream<number>) =>
          H.instant((run) => {
            const request = click.map(
              withEffects((n: number) => {
                requests.push(n);
                return n + 2;
              })
            );
            const res = run(
              H.performStream(request).flatMap(H.flatFuturesOrdered)
            );
            return { res };
          });
        const click = testStreamFromObject({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
        const out = testNow(model(click), [
          testStreamFromArray([
            [0, testFuture(0, "old1")],
            [1, testFuture(1, "old2")],
            [2, testFuture(2, "response")]
          ])
        ]);
        assert(H.isStream(out.res));
        assertStreamEqual(
          out.res,
          // @ts-ignore
          testStreamFromObject({ 0: "old1", 1: "old2", 2: "response" })
        );
        assert.deepEqual(requests, []);
      });
    });
    describe("examples", () => {
      it("can test counter", () => {
        type CounterModelInput = {
          incrementClick: Stream<any>;
          decrementClick: Stream<any>;
        };
        const counterModel = fgo(function*({
          incrementClick,
          decrementClick
        }: CounterModelInput) {
          const increment = incrementClick.mapTo(1);
          const decrement = decrementClick.mapTo(-1);
          const changes = H.combine(increment, decrement);
          const count = yield H.sample(
            H.accumFrom((n, m) => n + m, 0, changes)
          );
          return { count };
        });
        const { count } = testNow(
          counterModel({
            incrementClick: testStreamFromObject({
              1: 0,
              2: 0,
              3: 0,
              5: 0,
              7: 0
            }),
            decrementClick: testStreamFromObject({ 4: 0, 6: 0 })
          })
        );
        assertBehaviorEqual(count, {
          1.1: 1,
          2.1: 2,
          3.1: 3,
          4.1: 2,
          5.1: 3,
          6.1: 2,
          7.1: 3
        });
      });
    });
  });
});
