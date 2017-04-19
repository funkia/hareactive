import {State} from "../src/common";
import { ProducerBehavior, publish, sinkBehavior, toggle } from "../src";
import "mocha";
import { assert } from "chai";
import { spy, useFakeTimers } from "sinon";

import { lift, mapTo } from "@funkia/jabz";

import { map } from "../src/index";
import * as B from "../src/behavior";
import * as S from "../src/stream";
import { Future } from "../src/future";
import * as F from "../src/future";
import { placeholder } from "../src/placeholder";
import {
  Behavior, at, switchTo, switcher, scan, timeFrom, observe,
  time, integrate, ap, stepper, isBehavior, fromFunction
} from "../src/behavior";
import { sinkStream, Stream } from "../src/stream";

function double(n: number): number {
  return n * 2;
}

function sum(n: number, m: number): number {
  return n + m;
}

const add = (a: number) => (b: number) => a + b;

function mockNow(): [(t: number) => void, () => void] {
  const orig = Date.now;
  let time = 0;
  Date.now = () => time;
  return [
    (t: number) => time = t,
    () => Date.now = orig
  ];
}

describe("behavior", () => {
  describe("isBehavior", () => {
    it("should be true when Behavior object", () => {
      assert.isTrue(isBehavior(Behavior.of(2)));
    });
    it("should be false when not Behavior object", () => {
      assert.isFalse(isBehavior([]));
      assert.isFalse(isBehavior({}));
      assert.isFalse(isBehavior(undefined));
      assert.isFalse(isBehavior("test"));
      assert.isFalse(isBehavior([Behavior.of(42)]));
      assert.isFalse(isBehavior(1234));
      assert.isFalse(isBehavior(B.isBehavior));
      // A stream is not a behavior
      assert.isFalse(isBehavior(sinkStream()));
    });
  });
  describe("producer", () => {
    it("activates and deactivates", () => {
      const activate = spy();
      const deactivate = spy();
      class MyProducer<A> extends ProducerBehavior<A> {
        activate(): void {
          activate();
        }
        deactivate(): void {
          deactivate();
        }
      }
      const producer = new MyProducer();
      const observer = producer.subscribe((a) => a);
      observer.deactivate();
      assert(activate.calledOnce);
      assert(deactivate.calledOnce);
    });
  });

  describe("functor", () => {
    it("maps over initial value from parent", () => {
      const b = Behavior.of(3);
      const mapped = map(double, b);
      assert.strictEqual(at(mapped), 6);
    });
    it("maps constant function", () => {
      const b = sinkBehavior(0);
      const mapped = map(double, b);
      const cb = spy();
      mapped.subscribe(cb);
      publish(1, b);
      publish(2, b);
      publish(3, b);
      assert.deepEqual(cb.args, [[0], [2], [4], [6]]);
    });
    it("maps values method", () => {
      const b = sinkBehavior(0);
      const mapped = b.map(double);
      b.push(1);
      assert.equal(B.at(mapped), 2);
      b.push(2);
      assert.equal(B.at(mapped), 4);
      b.push(3);
      assert.equal(B.at(mapped), 6);
    });
    it("maps time function", () => {
      let time = 0;
      const b = B.fromFunction(() => {
        return time;
      });
      const mapped = map(double, b);
      assert.equal(B.at(mapped), 0);
      time = 1;
      assert.equal(B.at(mapped), 2);
      time = 2;
      assert.equal(B.at(mapped), 4);
      time = 3;
      assert.equal(B.at(mapped), 6);
    });
    it("maps to constant", () => {
      const b = Behavior.of(1);
      const b2 = mapTo(2, b);
      assert.strictEqual(at(b2), 2);
    });
  });
});
