import { assert } from "chai";
import { spy } from "sinon";
import { go } from "@funkia/jabz";
import { callP, withEffects, withEffectsP } from "@funkia/io";

import {
  Behavior,
  switchTo,
  whenFrom,
  Future,
  performIO,
  Now,
  performStream,
  plan,
  runNow,
  sample,
  loopNow,
  sinkStream,
  SinkStream,
  time,
  toPromise,
  instant
} from "../src";
import * as H from "../src";
import { createRef, mutateRef } from "./helpers";

describe("Now", () => {
  describe("is", () => {
    it("can check if value is Now", () => {
      assert.isTrue(Now.is(Now.of(12)));
      assert.isFalse(Now.is(12));
      assert.isFalse(Now.is(Behavior.of(12)));
      assert.isFalse(Now.is({ foo: "bar" }));
    });
  });
  describe("functor", () => {
    it("mapTo", () => {
      assert.strictEqual(runNow(Now.of(12).mapTo(4)), 4);
    });
  });
  describe("applicative", () => {
    it("ap applies function now to value in now", () => {
      const nowA = Now.of((n: number) => n * n);
      const nowB = Now.of(3);
      assert.strictEqual(runNow(nowB.ap(nowA)), 9);
    });
    it("lifts over constant now", () => {
      const now = Now.of(1);
      assert.strictEqual(runNow(H.lift((n) => n * n, now.of(3))), 9);
      assert.strictEqual(
        runNow(H.lift((n, m) => n + m, now.of(1), now.of(3))),
        4
      );
      assert.strictEqual(
        runNow(H.lift((n, m, p) => n + m + p, now.of(1), now.of(3), now.of(5))),
        9
      );
    });
  });
  describe("flatMap", () => {
    it("executes several `async`s in succession", async () => {
      const ref1 = createRef(1);
      const ref2 = createRef("Hello");
      const comp = performIO(mutateRef(2, ref1)).flatMap((_: any) =>
        performIO(mutateRef("World", ref2)).chain((__: any) =>
          Now.of(Future.of(true))
        )
      );
      const result = await toPromise(runNow(comp));
      assert.strictEqual(result, true);
      assert.strictEqual(ref1.ref, 2);
      assert.strictEqual(ref2.ref, "World");
    });
    it("can flatten pure nows", () => {
      assert.strictEqual(runNow(Now.of(Now.of(12)).flat()), 12);
    });
    it("throws in go if incorrect monad is yielded", (done) => {
      const now = go(
        function*() {
          const a: number = yield Now.of(1);
          const b: number = yield Behavior.of(2);
          return a + b;
        },
        Now as any
      );
      try {
        runNow(now);
      } catch {
        done();
      }
    });
  });
  describe("async", () => {
    it("works with runNow", async () => {
      let resolve: (n: number) => void;
      const future = runNow(
        performIO(
          callP((_: number) => new Promise((res) => (resolve = res)), 0)
        )
      );
      setTimeout(() => {
        resolve(12);
      });
      const result = await toPromise(future);
      assert.deepEqual(result, 12);
    });
  });
  describe("sample", () => {
    it("samples constant behavior", async () => {
      const b = Behavior.of(6);
      const comp = sample(b).chain((n) => Now.of(Future.of(n)));
      const result = await toPromise(runNow(comp));
      assert.strictEqual(result, 6);
    });
  });
  describe("plan", () => {
    it("executes plan asynchronously", async () => {
      let resolve: (n: number) => void;
      let done = false;
      const fn = withEffectsP((_: number) => {
        return new Promise((res) => {
          resolve = res;
        });
      });
      function comp(n: number): Now<number> {
        return Now.of(n * 2);
      }
      const prog = go(function*() {
        const e: Future<number> = yield performIO(fn(1));
        const e2 = yield plan(e.map((r) => comp(r)));
        return e2;
      });
      setTimeout(() => {
        assert.strictEqual(done, false);
        resolve(11);
      });
      const res = await toPromise(runNow(prog));
      done = true;
      assert.strictEqual(res, 22);
    });
    it("executes plan when resulting future is not observed", () => {
      let calledWith = 0;
      const fut = H.sinkFuture<number>();
      const now = H.plan(fut.map((n) => H.perform(() => (calledWith = n))));
      runNow(now);
      fut.resolve(3);
      assert.equal(calledWith, 3, "called is true");
    });
  });
  it("handles recursively defined behavior", () => {
    let resolve: (n: number) => void;
    const getNextNr = withEffectsP<number, [number]>((_: number) => {
      return new Promise((res) => {
        resolve = res;
      });
    });
    function loop(n: number): Now<Behavior<number>> {
      return go(function*() {
        const nextNumber: Future<number> = yield performIO(getNextNr(1));
        const future = yield plan(nextNumber.map(loop));
        return switchTo(Behavior.of(n), future);
      });
    }
    function main(): Now<Future<number>> {
      return go(function*() {
        const b: Behavior<number> = yield loop(0);
        const e = yield sample(
          whenFrom(
            b.map((n: number) => {
              return n === 3;
            })
          )
        );
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
    return toPromise(runNow(main()));
  });
  describe("performStream", () => {
    it("runs io actions", (done: Function) => {
      const actions: number[] = [];
      const results: number[] = [];
      const impure = withEffects((n: number) => {
        actions.push(n);
        return n + 2;
      });
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStream(mappedS).flatMap(H.flatFutures)).subscribe((n) =>
        results.push(n)
      );
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
  describe("performMap", () => {
    it("runs callback and uses return value for stream", () => {
      const s = H.sinkStream<number>();
      const cb = spy();
      const s2 = H.runNow(H.performMap((n) => n * n, s));
      H.subscribe(cb, s2);
      s.push(2);
      s.push(3);
      s.push(4);
      assert.deepEqual(cb.args, [[4], [9], [16]]);
    });
    it("runs callback and uses return value for future", () => {
      const fut = H.sinkFuture<number>();
      const cb = spy();
      const fut2 = H.runNow(H.performMap((n) => n * n, fut));
      fut2.subscribe(cb);
      fut.resolve(3);
      assert.deepEqual(cb.args, [[9]]);
    });
  });
  describe("loopNow", () => {
    it("should loop the reactives", () => {
      const result: unknown[] = [];
      let s: SinkStream<string>;
      const now = loopNow(({ stream }) => {
        stream.subscribe((a) => result.push(a));
        s = sinkStream();
        return Now.of({ stream: s });
      });
      runNow(now);
      s.push("a");
      s.push("b");
      s.push("c");

      assert.deepEqual(result, ["a", "b", "c"]);
    });
    it("should return the reactives", () => {
      const result: unknown[] = [];
      let s: SinkStream<string>;
      const now = loopNow(({ stream }) => {
        stream.subscribe((a) => a);
        s = sinkStream();
        return Now.of({ stream: s });
      });
      const { stream } = runNow(now);
      stream.subscribe((a) => result.push(a));
      s.push("a");
      s.push("b");
      s.push("c");
      assert.deepEqual(result, ["a", "b", "c"]);
    });
  });
  describe("time instant abstraction", () => {
    it("time doesn't pass in a Now", () => {
      const now = go(function*() {
        const t1: number = yield sample(time);
        while (Date.now() <= t1) {
          undefined;
        }
        const t2 = yield sample(time);
        assert.strictEqual(t1, t2);
      });
      runNow(now);
    });
  });
  describe("instant", () => {
    it("time doesn't pass", () => {
      const now = instant((start) => {
        const t1 = start(sample(time));
        while (Date.now() <= t1) {
          undefined;
        }
        const t2 = start(sample(time));
        assert.strictEqual(t1, t2);
      });
      runNow(now);
    });
  });
});
