///<reference path="./../typings/index.d.ts" />
import {assert} from "chai";
import {IO, withEffects, withEffectsP, fromPromise} from "jabz/io";
import {Do, Monad} from "jabz/monad";

import * as B from "../src/Behavior";
import {Behavior, switcher, when} from "../src/Behavior";
import * as S from "../src/Stream";
import * as F from "../src/Future";
import {Future} from "../src/Future";
import {Now, runNow, async, sample, plan} from "../src/Now";

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
  describe("sample", () => {
    it("samples constant behavior", () => {
      const b = B.of(6);
      const comp = sample(b).chain((n) => Now.of(F.of(n)));
      return runNow(comp).then((result: number) => {
        assert.strictEqual(result, 6);
      });
    });
  });
  describe("plan", () => {
    it("excutes plan asynchronously", () => {
      let resolve: (n: number) => void;
      let done = false;
      const fn = withEffectsP(() => {
        return new Promise((res) => {
          resolve = res;
        });
      });
      function comp(n: number): Now<number> {
        return Now.of(n * 2);
      }
      const prog = Do(function*(): Iterator<Now<any>> {
        const e = yield async(fn());
        const e2 = yield plan(e.map(comp));
        return Now.of(e2);
      });
      setTimeout(() => {
        assert.strictEqual(done, false);
        resolve(11);
      });
      return runNow(prog).then((res: number) => {
        done = true;
        assert.strictEqual(res, 22);
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
            (__: any) => Now.of(F.of(true))
          )
        );
      return runNow(comp).then((result: boolean) => {
        assert.strictEqual(result, true);
        assert.strictEqual(ref1.ref, 2);
        assert.strictEqual(ref2.ref, "World");
      });
    });
  });
  it("handles recursively defined behavior", () => {
    let resolve: (n: number) => void;
    function getNextNr(): IO<number> {
      return withEffectsP(() => {
        return new Promise((res) => {
          resolve = res;
        });
      })();
    }
    function loop(n: number): Now<Behavior<number>> {
      return Do(function*(): Iterator<Now<any>> {
        const e = yield async(getNextNr());
        const e1 = yield plan(e.map(loop));
        return Now.of(switcher(Behavior.of(n), e1));
      });
    }
    function main(): Now<Future<number>> {
      return Do(function*(): Iterator<Now<any>> {
        const b: Behavior<number> = yield loop(0);
        const e = yield sample(when(b.map((n: number) => {
          return n === 3;
        })));
        return Now.of(e);
      });
    }
    setTimeout(() => {
      resolve(1);
      setTimeout(() => {
        resolve(2);
        setTimeout(() => {
          resolve(3);
        });
      });
    });
    return runNow(main());
  });
});
