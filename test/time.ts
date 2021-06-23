import { assert } from "chai";
import { useFakeTimers, SinonFakeTimers } from "sinon";
import * as H from "../src";
import { mockNow } from "./helpers";

describe("behavior", () => {
  describe("integrateFrom", () => {
    let clock: SinonFakeTimers;
    beforeEach(() => {
      clock = useFakeTimers();
    });
    afterEach(() => {
      clock.restore();
    });
    it("can integrate", () => {
      const acceleration = H.sinkBehavior(1);
      const bIntergrate = H.integrateFrom(acceleration);
      const integration = H.at(bIntergrate);
      assert.strictEqual(H.at(integration), 0);
      clock.tick(2000);
      assert.strictEqual(H.at(integration), 2000);
      clock.tick(1000);
      assert.strictEqual(H.at(integration), 3000);
      clock.tick(500);
      acceleration.push(2);
      assert.strictEqual(H.at(integration), 4000);
    });
    it("stays in pull state if parent changes to push", () => {
      const fut = H.sinkFuture<H.Behavior<number>>();
      const b1 = H.switchTo(H.fromFunction(() => 4), fut);
      const integration = H.runNow(H.integrate(b1));
      H.observe(
        () => {},
        () => {
          return () => {
            throw new Error("Should not be called.");
          };
        },
        integration
      );
      fut.resolve(H.sinkBehavior(5));
    });
    it("supports circular dependencies", () => {
      const { speed } = H.runNow(
        H.loopNow((input: { speed: H.Behavior<number> }) =>
          H.sample(
            H.moment((at) => {
              const velocity = input.speed.map((s) => (s < 4000 ? 1 : 0));
              const speed = at(H.integrateFrom(velocity));
              return { speed };
            })
          )
        )
      );
      speed.observe(() => {}, () => () => {});
      assert.strictEqual(H.at(speed), 0);
      clock.tick(3000);
      assert.strictEqual(H.at(speed), 3000);
      clock.tick(1000);
      assert.strictEqual(H.at(speed), 4000);
      clock.tick(1000);
      assert.strictEqual(H.at(speed), 4000);
      clock.tick(1000);
      assert.strictEqual(H.at(speed), 4000);
    });
    it("does not sample parent for no delta", () => {
      const b = H.fromFunction(() => {
        throw new Error("Must not be called");
      });
      const result = H.runNow(H.integrate(b).chain((bi) => H.sample(bi)));
      assert.strictEqual(result, 0);
    });
  });
  describe("continuous time", () => {
    describe("measureTime", () => {
      it("gives time from sample point", () => {
        const [setTime, restore] = mockNow();
        setTime(3);
        const time = H.runNow(H.measureTime);
        let pull: ((t?: number) => void) | undefined;
        const results: number[] = [];
        H.observe(
          (n: number) => {
            results.push(n);
          },
          (p) => {
            pull = p;
            return () => {};
          },
          time
        );
        if (pull !== undefined) {
          pull();
          setTime(4);
          pull();
          setTime(7);
          pull();
        }
        assert.deepEqual(results, [0, 1, 4]);
        restore();
      });
    });
    describe("time", () => {
      it("gives time since UNIX epoch", () => {
        let beginPull = false;
        let endPull = false;
        const pushed: number[] = [];
        H.observe(
          (n: number) => pushed.push(n),
          (_pull) => {
            beginPull = true;
            return () => {
              endPull = true;
            };
          },
          H.time
        );
        assert.strictEqual(beginPull, true);
        const t = H.at(H.time);
        const now = Date.now();
        assert(now - 2 <= t && t <= now);
        assert.strictEqual(endPull, false);
      });
    });
  });
  describe("timing operators", () => {
    let clock: any;
    beforeEach(() => {
      clock = useFakeTimers();
    });
    afterEach(() => {
      clock.restore();
    });
    describe("delay", () => {
      it("should delay every push", () => {
        let n = 0;
        const s = H.sinkStream<number>();
        const delayedS = H.runNow(H.delay(50, s));
        delayedS.subscribe(() => (n = 2));
        s.subscribe(() => (n = 1));
        s.push(0);
        assert.strictEqual(n, 1);
        clock.tick(49);
        assert.strictEqual(n, 1);
        clock.tick(1);
        assert.strictEqual(n, 2);
      });
    });
    describe("throttle", () => {
      it("after an occurrence it should ignore", () => {
        let n = 0;
        const s = H.sinkStream<number>();
        const throttleS = H.runNow(H.throttle(100, s));
        throttleS.subscribe((v) => (n = v));
        assert.strictEqual(n, 0);
        s.push(1);
        assert.strictEqual(n, 1);
        clock.tick(80);
        s.push(2);
        assert.strictEqual(n, 1);
        clock.tick(19);
        s.push(3);
        assert.strictEqual(n, 1);
        clock.tick(1);
        s.push(4);
        assert.strictEqual(n, 4);
      });
    });
    describe("debounce", () => {
      it("holding the latest occurrence until an amount of time has passed", () => {
        let n = 0;
        const s = H.sinkStream<number>();
        const debouncedS = H.runNow(H.debounce(100, s));
        debouncedS.subscribe((v) => (n = v));
        assert.strictEqual(n, 0);
        s.push(1);
        clock.tick(80);
        assert.strictEqual(n, 0);
        clock.tick(30);
        assert.strictEqual(n, 1);
        s.push(2);
        assert.strictEqual(n, 1);
        clock.tick(99);
        assert.strictEqual(n, 1);
        clock.tick(2);
        assert.strictEqual(n, 2);
      });
    });
  });
});
