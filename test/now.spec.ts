import {assert} from "chai";

import {IO, callP, withEffects, withEffectsP} from "jabz/io";
import {map} from "jabz/functor";
import {lift} from "jabz/applicative";
import {go, Monad} from "jabz/monad";
import {Either, right, fromEither} from "jabz/either";

import * as B from "../src/behavior";
import {Behavior, switchTo, when} from "../src/behavior";
import * as S from "../src/stream";
import * as F from "../src/future";
import {Future} from "../src/future";
import {
  Now, runNow, async, sample, plan, performStream, performStreamLatest, performStreamOrdered
} from "../src/now";

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
      const promise = runNow(
        async(callP((n: number) => new Promise((res) => resolve = res), 0))
      );
      setTimeout(() => { resolve(12); });
      return promise.then((result: Either<any, number>) => {
        assert.deepEqual(result, 12);
      });
    });
  });
  describe("sample", () => {
    it("samples constant behavior", () => {
      const b = Behavior.of(6);
      const comp = sample(b).chain((n) => Now.of(Future.of(n)));
      return runNow(comp).then((result: number) => {
        assert.strictEqual(result, 6);
      });
    });
  });
  describe("plan", () => {
    it("executes plan asynchronously", () => {
      let resolve: (n: number) => void;
      let done = false;
      const fn = withEffectsP((n: number) => {
        return new Promise((res) => {
          resolve = res;
        });
      });
      function comp(n: number): Now<number> {
        return Now.of(n * 2);
      }
      const prog = go(function*(): Iterator<Now<any>> {
        const e: Future<number> = yield async(fn(1));
        const e2 = yield plan(e.map((r) => comp(r)));
        return e2;
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
  describe("functor", () => {
    it("mapTo", () => {
      assert.strictEqual(Now.of(12).mapTo(4).run(), 4);
    });
  });
  describe("applicative", () => {
    it("lifts over constant now", () => {
      const n = Now.of(1);
      assert.strictEqual(lift((n) => n * n, n.of(3)).run(), 9);
      assert.strictEqual(
        lift((n, m) => n + m, n.of(1), n.of(3)).run(),
        4
      );
      assert.strictEqual(
        lift((n, m, p) => n + m + p, n.of(1), n.of(3), n.of(5)).run(),
        9
      );
    });
  });
  describe("monad", () => {
    it("executes several `async`s in succession", () => {
      const ref1 = createRef(1);
      const ref2 = createRef("Hello");
      const comp =
        async(mutateRef(2, ref1)).chain(
          (_: any) => async(mutateRef("World", ref2)).chain(
            (__: any) => Now.of(Future.of(true))
          )
        );
      return runNow(comp).then((result: boolean) => {
        assert.strictEqual(result, true);
        assert.strictEqual(ref1.ref, 2);
        assert.strictEqual(ref2.ref, "World");
      });
    });
    it("can flatten pure nows", () => {
      assert.strictEqual(Now.of(Now.of(12)).flatten().run(), 12);
    });
  });
  it("handles recursively defined behavior", () => {
    let resolve: (n: number) => void;
    const getNextNr = withEffectsP((n: number) => {
      return new Promise((res) => {
        resolve = res;
      });
    });
    function loop(n: number): Now<Behavior<number>> {
      return go(function*(): Iterator<Now<any>> {
        const e = yield async(getNextNr(1));
        const e1 = yield plan(e.map(loop));
        return switchTo(Behavior.of(n), e1);
      });
    }
    function main(): Now<Future<number>> {
      return go(function*(): Iterator<Now<any>> {
        const b: Behavior<number> = yield loop(0);
        const e = yield sample(when(b.map((n: number) => {
          return n === 3;
        })));
        return e;
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
  describe("performStream", () => {
    it("runs io actions", (done: Function) => {
      let actions: number[] = [];
      let results: number[] = [];
      const impure = withEffects((n: number) => {
        actions.push(n);
        return n + 2;
      });
      const s = S.empty();
      const mappedS = s.map(impure);
      performStream(mappedS).run().subscribe((n) => results.push(n));
      s.push(1);
      setTimeout(() => {
        s.push(2);
        setTimeout(() => {
          s.push(3);
          setTimeout(() => {
            assert.deepEqual(actions, [1, 2, 3]);
            assert.deepEqual(results, [3, 4, 5]);
            done();
          });
        });
      });
    });
  });

  describe("performStreamLatest", () => {
    it("work with one occurence", (done: Function) => {
      let results: any[] = [];
      const impure = withEffectsP((n: number) => new Promise((resolve, reject) => resolve(n)));
      const s = S.empty();
      const mappedS = s.map(impure);
      performStreamLatest(mappedS).run().subscribe((n) => results.push(n));
      s.push(60);
      setTimeout(() => {
        assert.deepEqual(results, [60])
        done();
      });
    });

    it("runs io actions and ignores outdated results", (done: Function) => {
      let results: any[] = [];
      const impure = withEffects((n: number) => {
	return new Promise((resolve, reject) => {
	  setTimeout(() => {
	    resolve(n);
	  }, n);
	});
      });
      const s = S.empty();
      const mappedS = s.map(impure);
      performStreamLatest(mappedS).run().subscribe((n) => results.push(n));
      s.push(60);
      s.push(20);
      s.push(30);
      setTimeout(() => {
	assert.deepEqual(results, [20, 30])
	done();
      }, 100);
    });
  });
  
  describe("performStreamOrdered", () => {
    it("work with one occurence", (done: Function) => {
      let results: any[] = [];
      const impure = withEffectsP((n: number) => new Promise((resolve, reject) => resolve(n)));
      const s = S.empty();
      const mappedS = s.map(impure);
      performStreamOrdered(mappedS).run().subscribe((n) => results.push(n));
      s.push(60);
      setTimeout(() => {
	assert.deepEqual(results, [60])
	done();
      });
    });
    
    it("runs io actions and makes sure to keep the results in the same order", (done: Function) => {
      let results: any[] = [];
      const impure = withEffectsP((n: number) => {
	return new Promise((resolve, reject) => {
	  setTimeout(() => resolve(n), n);
	});
      });
      const s = S.empty();
      const mappedS = s.map(impure);
      performStreamOrdered(mappedS).run().subscribe((n) => results.push(n));
      s.push(60);
      s.push(20);
      s.push(30);
      s.push(undefined);
      s.push(50);
      s.push(40);
      setTimeout(() => {
	assert.deepEqual(results, [60, 20, 30, undefined, 50, 40])
	done();
      }, 100);
    });

    it("should support `undefined` as result", (done) => {
      let results: any[] = [];
      const impure = withEffectsP((n: number) => new Promise((resolve, reject) => resolve(n)));
      const s = S.empty();
      const mappedS = s.map(impure);
      performStreamOrdered(mappedS).run().subscribe((n) => results.push(n));
      s.push(60);
      s.push(undefined);
      s.push(20);
      setTimeout(() => {
	assert.deepEqual(results, [60, undefined, 20]);
	done();
      });
    });
  });
});
