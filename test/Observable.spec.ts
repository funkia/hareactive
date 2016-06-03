/// <reference path="../typings/index.d.ts" />

import * as $ from "../src/Observable";
import {assert} from "chai";
import {spy} from "sinon";

describe("Observable API:", function() {

  describe('Observable()', function() {

    it('should be a function', function() {
      assert.isFunction($.Observable);
    });

    it("should create an Observable", function() {
      const obs = $.Observable();

      assert.isObject(obs);
      assert.property(obs, 'subscribers');
      assert.isArray(obs.subscribers);
      assert.lengthOf(obs.subscribers, 0);
      assert.property(obs, 'def');
    });

  });

  describe('subscribe', function() {

    it('should be a function', function() {
      assert.isFunction($.subscribe)
    });

  });

  describe('publish', function() {

    it('should be a function', function() {
      assert.isFunction($.publish);
    });

    it('should call the subscribers', function() {
      const obs = $.Observable();
      const callback = spy();
      $.subscribe(callback, obs);

      assert.equal(callback.callCount, 0);

      $.publish("value", obs);
      assert.equal(callback.callCount, 1);

      $.publish("value", obs);
      assert.equal(callback.callCount, 2);
    });

    it('should pass the published value to subscribers', function() {
      const obs = $.Observable();
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

  describe('map', function() {
    it('should be a function', function() {
      assert.isFunction($.map);
    });

    it('should map the published values', function() {
      const obs = $.Observable();
      const callback = spy();

      const addTwo = (v :number) :number => v+2;

      const mappedObs = $.map(addTwo, obs);

      $.subscribe(callback, mappedObs);

      for(var i = 0; i < 5; i++) {
        $.publish(i, obs);
      }
      assert.deepEqual(callback.args, [[2], [3], [4], [5], [6]], "Wrong or no value was recieved");
    });
  });



  describe('filter', function() {

    it('should be a function', function() {
      assert.isFunction($.filter);
    });

    it('should filter the unwanted publishions', function() {
      const obs = $.Observable();
      const callback = spy();

      const isEven = (v :number) :boolean => !(v%2);

      const filteredObs = $.filter(isEven, obs)

      $.subscribe(callback, filteredObs);

      for(var i = 0; i < 10; i++) {
        $.publish(i, obs);
      }
      assert.deepEqual(callback.args, [[0], [2], [4], [6], [8]], "Wrong or no value was recieved");
    });
  });
});
