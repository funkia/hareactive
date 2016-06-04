import "./../typings/index.d.ts";
import * as $ from "../src/Events";
import {assert} from "chai";
import {spy} from "sinon";

describe("Events API:", function(): void {

  describe("isEvents", function(): void {
    it("should be a function", function(): void {
      assert.isFunction($.isEvents);
    });

    it("should be true when Events object", function (): void {
      assert.isTrue($.isEvents(new $.Events()));
    });

    it("should be false when not Events object", function (): void {
      assert.isFalse($.isEvents([]));
      assert.isFalse($.isEvents({}));
      assert.isFalse($.isEvents("test"));
      assert.isFalse($.isEvents([new $.Events()]));
      assert.isFalse($.isEvents(1234));
      assert.isFalse($.isEvents($.isEvents));
    });

  });

  describe("subscribe", function(): void {

    it("should be a function", function(): void {
      assert.isFunction($.subscribe);
    });

  });

  describe("publish", function(): void {

    it("should be a function", function(): void {
      assert.isFunction($.publish);
    });

    it("should call the subscribers", function(): void {
      const obs = new $.Events();
      const callback = spy();
      $.subscribe(callback, obs);

      assert.equal(callback.callCount, 0);

      $.publish("value", obs);
      assert.equal(callback.callCount, 1);

      $.publish("value", obs);
      assert.equal(callback.callCount, 2);
    });

    it("should pass the published value to subscribers", function(): void {
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

  describe("merge", function(): void {
    it("should be a function", function(): void {
      assert.isFunction($.merge);
    });

    it("should merge two Events", function(): void {
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

  describe("map", function(): void {
    it("should be a function", function(): void {
      assert.isFunction($.map);
    });

    it("should map the published values", function(): void {
      const obs = new $.Events();
      const callback = spy();

      const addTwo = (v: number): number => v + 2;

      const mappedObs = $.map(addTwo, obs);

      $.subscribe(callback, mappedObs);

      for (let i = 0; i < 5; i++) {
        $.publish(i, obs);
      }

      assert.deepEqual(callback.args, [[2], [3], [4], [5], [6]], "Wrong or no value was recieved");
    });
  });

  describe("filter", function(): void {

    it("should be a function", function(): void {
      assert.isFunction($.filter);
    });

    it("should filter the unwanted publishions", function(): void {
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
});
