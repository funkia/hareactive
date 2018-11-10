import { assert } from "chai";
import { spy } from "sinon";
import {
  lift,
  callP,
  IO,
  withEffects,
  withEffectsP,
  go,
  fgo
} from "@funkia/jabz";

import {
  testStreamFromObject,
  Behavior,
  switchTo,
  when,
  scan,
  Future,
  performIO,
  Now,
  performStream,
  performStreamLatest,
  performStreamOrdered,
  plan,
  runNow,
  sample,
  testNow,
  loopNow,
  Stream,
  sinkStream,
  SinkStream,
  time,
  toPromise
} from "../src";
import * as H from "../src";

// A reference that can be mutated
type Ref<A> = { ref: A };

function createRef<A>(a: A): Ref<A> {
  return { ref: a };
}

const mutateRef: <A>(a: A, r: Ref<A>) => IO<{}> = withEffects(
  (a: any, r: Ref<any>) => (r.ref = a)
);

describe("Now", () => {
  describe("of", () => {
    it("can be tested", () => {
      assert.strictEqual(testNow(Now.of(12)), 12);
    });
  });
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
    it("lifts over constant now", () => {
      const now = Now.of(1);
      assert.strictEqual(lift((n) => n * n, now.of(3)).run(), 9);
      assert.strictEqual(lift((n, m) => n + m, now.of(1), now.of(3)).run(), 4);
      assert.strictEqual(
        lift((n, m, p) => n + m + p, now.of(1), now.of(3), now.of(5)).run(),
        9
      );
    });
  });
  describe("chain", () => {
    it("can be tested", () => {
      const now = Now.of(3).chain((n) => Now.of(n * 4));
      assert.strictEqual(testNow(now), 12);
    });
    it("executes several `async`s in succession", async () => {
      const ref1 = createRef(1);
      const ref2 = createRef("Hello");
      const comp = performIO(mutateRef(2, ref1)).chain((_: any) =>
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
      assert.strictEqual(runNow(Now.of(Now.of(12)).flatten()), 12);
    });
    it("throws in go if incorrect monad is yielded", (done) => {
      const now = go(function*() {
        const a = yield Now.of(1);
        const b = yield Behavior.of(2);
        return 3;
      }, Now);
      try {
        runNow(now);
      } catch {
        done();
      }
    });
  });
  describe("async", () => {
    it("works with runNow", () => {
      let resolve: (n: number) => void;
      const future = runNow(
        performIO(
          callP((n: number) => new Promise((res) => (resolve = res)), 0)
        )
      );
      setTimeout(() => {
        resolve(12);
      });
      return toPromise(future).then((result: number) => {
        assert.deepEqual(result, 12);
      });
    });
  });
  describe("sample", () => {
    it("samples constant behavior", async () => {
      const b = Behavior.of(6);
      const comp = sample(b).chain((n) => Now.of(Future.of(n)));
      const result = await toPromise(runNow(comp));
      assert.strictEqual(result, 6);
    });
    it("can be tested", () => {
      const stream = testStreamFromObject({ 1: 1, 2: 3, 4: 2 });
      const now = sample(scan((n, m) => n + m, 0, stream));
      const result = testNow(now);
      const fn = result.semantic();
      assert.deepEqual([fn(0), fn(1), fn(2), fn(3), fn(4)], [0, 1, 4, 4, 6]);
    });
    it("it can test with go", () => {
      const model = fgo(function*(incrementClick: Stream<any>) {
        const increment = incrementClick.mapTo(1);
        const count = yield sample(scan((n, m) => n + m, 0, increment));
        return count;
      });
      const stream = testStreamFromObject({ 1: 0, 2: 0, 4: 0 });
      const result = testNow<Behavior<number>>(model(stream));
      const fn = result.semantic();
      assert.strictEqual(fn(0), 0);
      assert.strictEqual(fn(1), 1);
      assert.strictEqual(fn(2), 2);
      assert.strictEqual(fn(3), 2);
      assert.strictEqual(fn(4), 3);
    });
  });
  describe("plan", () => {
    it("executes plan asynchronously", async () => {
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
    const getNextNr = withEffectsP((n: number) => {
      return new Promise((res) => {
        resolve = res;
      });
    });
    function loop(n: number): Now<Behavior<number>> {
      return go(function*() {
        const nextNumber = yield performIO(getNextNr(1));
        const future = yield plan(nextNumber.map(loop));
        return switchTo(Behavior.of(n), future);
      });
    }
    function main(): Now<Future<number>> {
      return go(function*() {
        const b: Behavior<number> = yield loop(0);
        const e = yield sample(
          when(
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
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStream(mappedS)).subscribe((n) => results.push(n));
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
  describe("performStreamLatest", () => {
    it("work with one occurrence", (done: Function) => {
      let results: any[] = [];
      const impure = withEffectsP(
        (n: number) => new Promise((resolve, reject) => resolve(n))
      );
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStreamLatest(mappedS)).subscribe((n) => results.push(n));
      s.push(60);
      setTimeout(() => {
        assert.deepEqual(results, [60]);
        done();
      });
    });

    it("runs io actions and ignores outdated results", (done: Function) => {
      const resolves: ((n: any) => void)[] = [];
      let results: any[] = [];
      const impure = withEffectsP((n: number) => {
        return new Promise((resolve, reject) => {
          resolves[n] = resolve;
        });
      });
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStreamLatest(mappedS)).subscribe((n) => results.push(n));
      s.push(0);
      s.push(1);
      s.push(2);
      resolves[1](1);
      resolves[2](2);
      resolves[0](0);
      setTimeout(() => {
        assert.deepEqual(results, [1, 2]);
        done();
      });
    });
  });

  describe("performStreamOrdered", () => {
    it("work with one occurrence", (done: Function) => {
      let results: any[] = [];
      const impure = withEffectsP(
        (n: number) => new Promise((resolve, reject) => resolve(n))
      );
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStreamOrdered(mappedS)).subscribe((n) => results.push(n));
      s.push(60);
      setTimeout(() => {
        assert.deepEqual(results, [60]);
        done();
      });
    });

    it("runs io actions and makes sure to keep the results in the same order", (done: Function) => {
      let results: any[] = [];
      const resolves: ((n: any) => void)[] = [];
      const impure = withEffectsP((n: number) => {
        return new Promise((resolve, reject) => {
          resolves[n] = resolve;
        });
      });
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStreamOrdered(mappedS)).subscribe((n) => results.push(n));
      s.push(0);
      s.push(1);
      s.push(2);
      s.push(3);
      s.push(4);
      s.push(5);
      resolves[3](3);
      resolves[1](1);
      resolves[0]("zero");
      resolves[4](undefined);
      resolves[2](2);
      resolves[5](5);
      setTimeout(() => {
        assert.deepEqual(results, ["zero", 1, 2, 3, undefined, 5]);
        done();
      });
    });

    it("should support `undefined` as result", (done: MochaDone) => {
      let results: any[] = [];
      const impure = withEffectsP(
        (n: number) => new Promise((resolve, reject) => resolve(n))
      );
      const s = sinkStream();
      const mappedS = s.map(impure);
      runNow(performStreamOrdered(mappedS)).subscribe((n) => results.push(n));
      s.push(60);
      s.push(undefined);
      s.push(20);
      setTimeout(() => {
        assert.deepEqual(results, [60, undefined, 20]);
        done();
      });
    });
  });
  describe("loopNow", () => {
    it("should loop the reactives", () => {
      let result = [];
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
      let result = [];
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
        const t1 = yield sample(time);
        while (Date.now() <= t1) {}
        const t2 = yield sample(time);
        assert.strictEqual(t1, t2);
      });
      runNow(now);
    });
  });
});
