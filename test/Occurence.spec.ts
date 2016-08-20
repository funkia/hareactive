///<reference path="./../typings/index.d.ts" />

import {assert} from "chai";

import {sink} from "../src/Occurence";

describe("Occurence", () => {
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
  });
});
