import { State } from "../src/common";
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

function subscribeSpy(b: Behavior<any>): sinon.SinonSpy {
  const cb = spy();
  b.subscribe(cb);
  return cb;
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

describe("Behavior and Future", () => {
  describe("snapshotAt", () => {
    it("snapshots behavior at future occurring in future", () => {
      let result: number;
      const bSink = sinkBehavior(1);
      const futureSink = F.sinkFuture();
      const mySnapshot = at(B.snapshotAt(bSink, futureSink));
      mySnapshot.subscribe(res => result = res);
      bSink.push(2);
      bSink.push(3);
      futureSink.resolve({});
      bSink.push(4);
      assert.strictEqual(result, 3);
    });
    it("uses current value when future occurred in the past", () => {
      let result: number;
      const bSink = sinkBehavior(1);
      const occurredFuture = Future.of({});
      bSink.push(2);
      const mySnapshot = at(B.snapshotAt(bSink, occurredFuture));
      mySnapshot.subscribe(res => result = res);
      bSink.push(3);
      assert.strictEqual(result, 2);
    });
  });
  describe("switchTo", () => {
    it("switches to new behavior", () => {
      const b1 = sinkBehavior(1);
      const b2 = sinkBehavior(8);
      const futureSink = F.sinkFuture<Behavior<number>>();
      const switching = switchTo(b1, futureSink);
      assert.strictEqual(at(switching), 1);
      b2.push(9);
      assert.strictEqual(at(switching), 1);
      b1.push(2);
      assert.strictEqual(at(switching), 2);
      b1.push(3);
      assert.strictEqual(at(switching), 3);
      futureSink.resolve(b2);
      assert.strictEqual(at(switching), 9);
      b2.push(10);
      assert.strictEqual(at(switching), 10);
    });
    it("changes from push to pull", () => {
      const pushSpy = spy();
      const beginPullingSpy = spy();
      const endPullingSpy = spy();
      const pushingB = sinkBehavior(0);
      let x = 7;
      const pullingB = fromFunction(() => x);
      const futureSink = F.sinkFuture<Behavior<number>>();
      const switching = switchTo(pushingB, futureSink);
      observe(pushSpy, beginPullingSpy, endPullingSpy, switching);
      assert.strictEqual(at(switching), 0);
      pushingB.push(1);
      assert.strictEqual(at(switching), 1);
      futureSink.resolve(pullingB);
      assert.strictEqual(at(switching), 7);
      x = 8;
      assert.strictEqual(at(switching), 8);
      assert.strictEqual(beginPullingSpy.callCount, 1);
      assert.strictEqual(endPullingSpy.callCount, 0);
    });
    it("changes from pull to push", () => {
      let beginPull = false;
      let endPull = false;
      let pushed: number[] = [];
      let x = 0;
      const b1 = B.fromFunction(() => x);
      const b2 = sinkBehavior(2);
      const futureSink = F.sinkFuture<Behavior<number>>();
      const switching = switchTo(b1, futureSink);
      observe(
        (n: number) => pushed.push(n),
        () => beginPull = true,
        () => endPull = true,
        switching
      );
      assert.strictEqual(beginPull, true);
      assert.strictEqual(at(switching), 0);
      x = 1;
      assert.strictEqual(at(switching), 1);
      assert.strictEqual(endPull, false);
      futureSink.resolve(b2);
      assert.strictEqual(endPull, true);
      b2.push(3);
      assert.deepEqual(pushed, [2, 3]);
    });
  });
});

describe("Behavior and Stream", () => {
  describe("switcher", () => {
    it("switches to behavior", () => {
      const result: number[] = [];
      const stream = sinkStream<Behavior<number>>();
      const initB = Behavior.of(1);
      const outerSwitcher = switcher(initB, stream);
      const switchingB = at(outerSwitcher);
      switchingB.subscribe((n) => result.push(n));
      const sinkB = sinkBehavior(2);
      stream.push(sinkB);
      sinkB.push(3);
      assert.deepEqual(result, [1, 2, 3]);
      assert.deepEqual(at(at(outerSwitcher)), 1);
    });
  });
  describe("stepper", () => {
    it("steps to the last event value", () => {
      const e = sinkStream();
      const b = stepper(0, e);
      const cb = subscribeSpy(b);
      e.push(1);
      e.push(2);
      assert.deepEqual(cb.args, [[0], [1], [2]]);
    });
  });
});
