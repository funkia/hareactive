///<reference path="./../typings/index.d.ts" />

import {assert} from "chai";

import * as Future from "../src/Future";
import {sink} from "../src/Future";

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
});
