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
});
