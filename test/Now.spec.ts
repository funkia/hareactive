///<reference path="./../typings/index.d.ts" />
import {assert} from "chai";
import * as IO from "jabz/io";

import * as B from "../src/Behavior";
import * as S from "../src/Stream";
import * as F from "../src/Future";
import {runNow, async} from "../src/Now";

describe("Now", () => {
  describe("async", () => {
    it("works with runNow", () => {
      let resolve: (n: number) => void;
      const promise = runNow(async(IO.fromPromise(new Promise((res) => resolve = res))));
      setTimeout(() => { resolve(12); });
      return promise.then((result: number) => {
        assert.strictEqual(result, 12);
      });
    });
  });
});
