///<reference path="./../typings/index.d.ts" />

import {assert} from "chai";

import * as Occ from "../src/Occurence";
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
    it("of gives occurence that has occured", () => {
      let result: number;
      const o = Occ.of(12);
      o.subscribe((x: number) => {
        result = x;
      });
      assert.strictEqual(result, 12);
    });
  });
});
