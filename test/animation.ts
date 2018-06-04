import { transitionBehavior, TransitionConfig, linear } from "../src/animation";
import { sinkBehavior, at } from "../src/behavior";
import { sinkStream } from "../src/stream";
import { assert } from "chai";
import { spy } from "sinon";

describe("animation", () => {
  describe("transitionBehavior", () => {
    it("should have initial value before any transition", () => {
      const time = sinkBehavior(0);
      const target = sinkStream<number>();

      const config: TransitionConfig = {
        delay: 0,
        timingFunction: linear,
        duration: 100
      };

      const t = transitionBehavior(config, 0, target, time).flatten();
      t.subscribe(() => "");
      assert.strictEqual(at(t), 0);
      time.publish(10);
      assert.strictEqual(at(t), 0);
      time.publish(20);
      assert.strictEqual(at(t), 0);
    });
    it("should make a simple linear transition", () => {
      const time = sinkBehavior(0);
      const target = sinkStream<number>();

      const config: TransitionConfig = {
        delay: 0,
        timingFunction: linear,
        duration: 100
      };

      const tB = transitionBehavior(config, 0, target, time);
      const t = tB.at();
      t.subscribe(() => "");
      target.publish(10);
      assert.strictEqual(t.at(), 0);
      time.publish(10);
      assert.strictEqual(t.at(), 1);
      time.publish(50);
      assert.strictEqual(t.at(), 5);
      time.publish(90);
      assert.strictEqual(t.at(), 9);
      time.publish(100);
      assert.strictEqual(t.at(), 10);
      time.publish(140);
      assert.strictEqual(t.at(), 10);
    });

    it("should delay the transition", () => {
      const time = sinkBehavior(0);
      const target = sinkStream<number>();

      const config: TransitionConfig = {
        delay: 100,
        timingFunction: linear,
        duration: 100
      };

      const t = transitionBehavior(config, 0, target, time).at();
      t.subscribe(() => "");
      target.publish(10);
      assert.strictEqual(t.at(), 0);
      time.publish(90);
      assert.strictEqual(t.at(), 0);
      time.publish(100);
      assert.strictEqual(t.at(), 0);
      time.publish(110);
      assert.strictEqual(t.at(), 1);
      time.publish(190);
      assert.strictEqual(t.at(), 9);
      time.publish(200);
      assert.strictEqual(t.at(), 10);
    });
  });
});
