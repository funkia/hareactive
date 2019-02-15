import { assert } from "chai";
import * as H from "../src";
import {
  testFuture,
  assertFutureEqual,
  testStreamFromObject,
  testAt
} from "../src/test";

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
        assert.strictEqual(H.never.test().time, "infinity");
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
});
