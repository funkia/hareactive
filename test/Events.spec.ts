///<reference path="./../typings/index.d.ts" />
import * as E from "../src/Events";
import {Events} from "../src/Events";
import * as B from "../src/Behavior";
import {Behavior} from "../src/Behavior";
import {assert} from "chai";
import {spy} from "sinon";

const addTwo = (v: number): number => v + 2;
const sum = (a: number, b: number): number => a + b;

describe("Events", () => {
  describe("isEvents", () => {
    it("should be a function", () => {
      assert.isFunction(E.isEvents);
    });

    it("should be true when Events object", () => {
      assert.isTrue(E.isEvents(E.empty()));
    });

    it("should be false when not Events object", () => {
      assert.isFalse(E.isEvents([]));
      assert.isFalse(E.isEvents({}));
      assert.isFalse(E.isEvents("test"));
      assert.isFalse(E.isEvents([E.empty()]));
      assert.isFalse(E.isEvents(1234));
      assert.isFalse(E.isEvents(E.isEvents));
    });
  });

  describe("subscribe", () => {
    it("should be a function", () => {
      assert.isFunction(E.subscribe);
    });
  });

  describe("publish", () => {
    it("should be a function", () => {
      assert.isFunction(E.publish);
    });

    it("should call the subscribers", () => {
      const obs = E.empty();
      const callback = spy();
      E.subscribe(callback, obs);

      assert.equal(callback.callCount, 0);

      E.publish("value", obs);
      assert.equal(callback.callCount, 1);

      E.publish("value", obs);
      assert.equal(callback.callCount, 2);
    });

    it("should pass the published value to subscribers", () => {
      const obs = E.empty();
      const callback1 = spy();
      const callback2 = spy();

      E.subscribe(callback1, obs);
      E.subscribe(callback2, obs);

      const err1 = "Wrong or no value was recieved after publish.";
      E.publish("random value", obs);
      assert(callback1.calledWith("random value"), err1);
      assert(callback2.calledWith("random value"), err1);

      const err2 = "Wrong or no value was recieved after a second publish.";
      E.publish("another random value", obs);
      assert(callback1.calledWith("another random value"), err2);
      assert(callback2.calledWith("another random value"), err2);
    });
  });

  describe("merge", () => {
    it("should be a function", () => {
      assert.isFunction(E.merge);
    });

    it("should merge two Events", () => {
      const eventE1 = E.empty();
      const eventE2 = E.empty();
      const callback = spy();

      const mergedEventE = E.merge(eventE1, eventE2);
      E.subscribe(callback, mergedEventE);
      E.publish(1, eventE1);
      E.publish("2", eventE2);

      assert.deepEqual(callback.args, [[1], ["2"]]);
    });
  });

  describe("map", () => {
    it("should be a function", () => {
      assert.isFunction(E.map);
    });

    it("should map the published values", () => {
      const obs = E.empty();
      const callback = spy();

      const mappedObs = E.map(addTwo, obs);

      E.subscribe(callback, mappedObs);

      for (let i = 0; i < 5; i++) {
        E.publish(i, obs);
      }

      assert.deepEqual(callback.args, [[2], [3], [4], [5], [6]], "Wrong or no value was recieved");
    });
  });

  describe("filter", () => {
    it("should be a function", () => {
      assert.isFunction(E.filter);
    });

    it("should filter the unwanted publishions", () => {
      const obs = E.empty();
      const callback = spy();

      const isEven = (v: number): boolean => !(v % 2);

      const filteredObs = E.filter(isEven, obs);

      E.subscribe(callback, filteredObs);

      for (let i = 0; i < 10; i++) {
        E.publish(i, obs);
      }
      assert.deepEqual(callback.args, [[0], [2], [4], [6], [8]], "Wrong or no value was recieved");
    });
  });

  describe("scan", () => {
    it("should be a function", () => {
      assert.isFunction(E.scan);
    });

    it("should scan the values", () => {
      const eventE = E.empty();
      const callback = spy();
      const sumF = (currSum: number, val: number) => currSum + val;

      const currentSumE = E.scan(sumF, 0, eventE);
      E.subscribe(callback, currentSumE);

      for (let i = 0; i < 10; i++) {
        E.publish(i, eventE);
      }

      assert.deepEqual(callback.args, [[0], [1], [3], [6], [10], [15], [21], [28], [36], [45]]);
    });
  });

  describe("def", () => {
    it("should merge two events", () => {
      const callback1 = spy();
      const callback2 = spy();
      const e1 = E.empty();
      const e1Mapped = E.map(addTwo, e1);
      E.subscribe(callback1, e1);
      E.subscribe(callback2, e1Mapped);
      const e2 = E.empty();
      e1.def = e2;
      E.publish(1, e2);
      E.publish(2, e2);
      assert.deepEqual(callback1.args, [[1], [2]]);
      assert.deepEqual(callback2.args, [[3], [4]]);
    });
  });

  describe("snapshot", () => {
    it("it snapshots pull based Behavior", () => {
      let n = 0;
      const b: Behavior<number> = B.fromFunction(() => n);
      const e: Events<number> = E.empty<number>();
      const shot = E.snapshot<number, number>(b, e);
      const callback = spy();
      E.subscribe(callback, shot);
      E.publish(0, e);
      E.publish(1, e);
      n = 1;
      E.publish(2, e);
      n = 2;
      E.publish(3, e);
      E.publish(4, e);
      assert.deepEqual(callback.args, [
        [[0, 0]], [[1, 0]], [[2, 1]], [[3, 2]], [[4, 2]]
      ]);
    });
    it("it applies function in snapshotWith to pull based Behavior", () => {
      let n = 0;
      const b: Behavior<number> = B.fromFunction(() => n);
      const e: Events<number> = E.empty<number>();
      const shot = E.snapshotWith<number, number, number>(sum, b, e);
      const callback = spy();
      E.subscribe(callback, shot);
      E.publish(0, e);
      E.publish(1, e);
      n = 1;
      E.publish(2, e);
      n = 2;
      E.publish(3, e);
      E.publish(4, e);
      assert.deepEqual(callback.args, [
        [0], [1], [3], [5], [6]
      ]);
    });
  });
});
