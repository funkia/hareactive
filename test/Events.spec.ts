// import "./../typings/index.d.ts";
import * as $ from "../src/Events";
import {assert} from "chai";
import {spy} from "sinon";

const addTwo = (v: number): number => v + 2;

describe("Events", () => {
  describe("isEvents", () => {
    it("should be a function", () => {
      assert.isFunction($.isEvents);
    });

    it("should be true when Events object", () => {
      assert.isTrue($.isEvents(new $.Events()));
    });

    it("should be false when not Events object", () => {
      assert.isFalse($.isEvents([]));
      assert.isFalse($.isEvents({}));
      assert.isFalse($.isEvents("test"));
      assert.isFalse($.isEvents([new $.Events()]));
      assert.isFalse($.isEvents(1234));
      assert.isFalse($.isEvents($.isEvents));
    });
  });

  describe("subscribe", () => {
    it("should be a function", () => {
      assert.isFunction($.subscribe);
    });
  });

  describe("publish", () => {
    it("should be a function", () => {
      assert.isFunction($.publish);
    });

    it("should call the subscribers", () => {
      const obs = new $.Events();
      const callback = spy();
      $.subscribe(callback, obs);

      assert.equal(callback.callCount, 0);

      $.publish("value", obs);
      assert.equal(callback.callCount, 1);

      $.publish("value", obs);
      assert.equal(callback.callCount, 2);
    });

    it("should pass the published value to subscribers", () => {
      const obs = new $.Events();
      const callback1 = spy();
      const callback2 = spy();

      $.subscribe(callback1, obs);
      $.subscribe(callback2, obs);

      const err1 = "Wrong or no value was recieved after publish.";
      $.publish("random value", obs);
      assert(callback1.calledWith("random value"), err1);
      assert(callback2.calledWith("random value"), err1);

      const err2 = "Wrong or no value was recieved after a second publish.";
      $.publish("another random value", obs);
      assert(callback1.calledWith("another random value"), err2);
      assert(callback2.calledWith("another random value"), err2);
    });
  });

  describe("merge", () => {
    it("should be a function", () => {
      assert.isFunction($.merge);
    });

    it("should merge two Events", () => {
      const event$1 = new $.Events();
      const event$2 = new $.Events();
      const callback = spy();

      const mergedEvent$ = $.merge(event$1, event$2);
      $.subscribe(callback, mergedEvent$);
      $.publish(1, event$1);
      $.publish("2", event$2);

      assert.deepEqual(callback.args, [[1], ["2"]]);
    });
  });

  describe("map", () => {
    it("should be a function", () => {
      assert.isFunction($.map);
    });

    it("should map the published values", () => {
      const obs = new $.Events();
      const callback = spy();

      const mappedObs = $.map(addTwo, obs);

      $.subscribe(callback, mappedObs);

      for (let i = 0; i < 5; i++) {
        $.publish(i, obs);
      }

      assert.deepEqual(callback.args, [[2], [3], [4], [5], [6]], "Wrong or no value was recieved");
    });
  });

  describe("filter", () => {
    it("should be a function", () => {
      assert.isFunction($.filter);
    });

    it("should filter the unwanted publishions", () => {
      const obs = new $.Events();
      const callback = spy();

      const isEven = (v: number): boolean => !(v % 2);

      const filteredObs = $.filter(isEven, obs);

      $.subscribe(callback, filteredObs);

      for (let i = 0; i < 10; i++) {
        $.publish(i, obs);
      }
      assert.deepEqual(callback.args, [[0], [2], [4], [6], [8]], "Wrong or no value was recieved");
    });
  });

  describe("scan", () => {
    it("should be a function", () => {
      assert.isFunction($.scan);
    });

    it("should scan the values", () => {
      const event$ = new $.Events();
      const callback = spy();
      const sum = (currSum: number, val: number) => currSum + val;

      const currentSum$ = $.scan(sum, 0, event$);
      $.subscribe(callback, currentSum$);

      for (let i = 0; i < 10; i++) {
        $.publish(i, event$);
      }

      assert.deepEqual(callback.args, [[0], [1], [3], [6], [10], [15], [21], [28], [36], [45]]);
    });
  });

  describe("def", () => {
    it("should merge two events", () => {
      const callback1 = spy();
      const callback2 = spy();
      const e1 = new $.Events();
      const e1Mapped = $.map(addTwo, e1);
      $.subscribe(callback1, e1);
      $.subscribe(callback2, e1Mapped);
      const e2 = new $.Events();
      e1.def = e2;
      $.publish(1, e2);
      $.publish(2, e2);
      assert.deepEqual(callback1.args, [[1], [2]]);
      assert.deepEqual(callback2.args, [[3], [4]]);
    });
  });
});
