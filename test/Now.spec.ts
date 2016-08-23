///<reference path="./../typings/index.d.ts" />
import {assert} from "chai";
import {IO, withEffects, fromPromise} from "jabz/io";

import * as B from "../src/Behavior";
import * as S from "../src/Stream";
import * as F from "../src/Future";
import {runNow, async, Now} from "../src/Now";

// A reference that can be mutated
type Ref<A> = {ref: A};

function createRef<A>(a: A): Ref<A> {
  return {ref: a};
}

const mutateRef: <A>(a: A, r: Ref<A>) => IO<{}> = withEffects((a: any, r: Ref<any>) => r.ref = a);

describe("Now", () => {
  describe("async", () => {
    it("works with runNow", () => {
      let resolve: (n: number) => void;
      const promise = runNow(async(fromPromise(new Promise((res) => resolve = res))));
      setTimeout(() => { resolve(12); });
      return promise.then((result: number) => {
        assert.strictEqual(result, 12);
      });
    });
  });
  describe("chain", () => {
    it("executes several `async`s in succession", () => {
      const ref1 = createRef(1);
      const ref2 = createRef("Hello");
      const comp =
        async(mutateRef(2, ref1)).chain(
          (_: any) => async(mutateRef("World", ref2)).chain(
            (_: any) => Now.of(F.of(true))
          )
        );
      return runNow(comp).then((result: boolean) => {
        assert.strictEqual(result, true);
        assert.strictEqual(ref1.ref, 2);
        assert.strictEqual(ref2.ref, "World");
      });
    });
  });
});
