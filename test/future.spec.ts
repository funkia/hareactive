import {assert} from "chai";

import * as Future from "../src/future";
import {sink, lift} from "../src/future";

describe("Future", () => {
  describe("sink", () => {
    it("notifies subscriber", () => {
      let result: number;
      const s = sink<number>();
      s.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, undefined);
      s.resolve(2);
      assert.strictEqual(result, 2);
    });
  });
  describe("Functor", () => {
    it("maps over value", () => {
      let result: number;
      const s = sink<number>();
      const mapped = s.map(x => x * x);
      mapped.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, undefined);
      s.resolve(4);
      assert.strictEqual(result, 16);
    });
    it("maps to constant", () => {
      let result: string;
      const s = sink<number>();
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
    it("of gives future that has occured", () => {
      let result: number;
      const o = Future.of(12);
      o.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, 12);
    });
    it("lifts a function of one argument", () => {
      let result: string;
      const fut = sink<string>();
      const lifted = lift((s: string) => s + "!", fut);
      lifted.subscribe((s: string) => result = s);
      assert.strictEqual(result, undefined);
      fut.resolve("Hello");
      assert.strictEqual(result, "Hello!");
    });
    it("lifts a function of three arguments", () => {
      let result: string;
      const fut1 = sink<string>();
      const fut2 = sink<string>();
      const fut3 = sink<string>();
      const lifted = lift((s1: string, s2: string, s3: string) => {
        return s1 + "-" + s2 + "+" + s3;
      }, fut1, fut2, fut3);
      lifted.subscribe((s: string) => result = s);
      assert.strictEqual(result, undefined);
      fut1.resolve("Hello");
      assert.strictEqual(result, undefined);
      fut2.resolve("over");
      assert.strictEqual(result, undefined);
      fut3.resolve("there");
      assert.strictEqual(result, "Hello-over+there");
    });
  });
  describe("Monad", () => {
    it("chains value", () => {
      let result: number[] = [];
      const fut1 = sink<number>();
      const fut2 = sink<number>();
      const chained = fut1.chain((n: number) => {
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
    const promise = new Promise((res) => resolve = res);
    const future = Future.fromPromise(promise);
    future.subscribe((res: number) => result = res);
    assert.strictEqual(result, undefined);
    resolve(12);
    return promise.then(() => {
      assert.strictEqual(result, 12);
    });
  });
});
