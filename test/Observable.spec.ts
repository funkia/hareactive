/// <reference path="../typings/index.d.ts" />

import * as $ from "../src/Observable";
import {assert} from "chai";

describe("Observable API", () => {

  describe('Observable()', () => {

    it('should be a function', () => {
      assert.isFunction($.Observable);
    });

    it("should create an Observable", () => {
      const obs = $.Observable();

      assert.isObject(obs);
      assert.property(obs, 'subscribers');
      assert.isArray(obs.subscribers);
      assert.lengthOf(obs.subscribers, 0);
      assert.property(obs, 'def');
    });

  });


  describe('subscribe', () => {

    it('should be a function', () => {
      assert.isFunction($.subscribe)
    });


    it('should add the subscribtions to the observable', () => {
      const addSubs = (obs :any) => {
        $.subscribe(() => null, obs);
      }
      const obs = $.Observable();
      addSubs(obs);
      assert.lengthOf(obs.subscribers, 1);
      addSubs(obs);
      assert.lengthOf(obs.subscribers, 2);
    });

  });

  describe('publish', () => {

    it('should be a function', () => {
      assert.isFunction($.publish);
    });

    it('should call subscribtions on publish', () => {
      const obs = $.Observable();
      let a = 0;
      let b = 0;
      $.subscribe((v : number) => a = v, obs);
      $.subscribe((v : number) => b = v, obs);

      $.publish(1, obs);
      assert.equal(a, 1);
      assert.equal(b, 1);

      $.publish(1123, obs);
      assert.equal(a, 1123);
      assert.equal(b, 1123);
    });

  });


  describe('filter', () => {

    it('should be a function', () => {
      assert.isFunction($.filter);
    });

    it('should filter the unwanted publishions', () => {
      const obs = $.Observable();
      let a = 0;

      const filteredObs = $.filter((v) => v > 100, obs)

      $.subscribe((v : number) => a = v, filteredObs);

      $.publish(100, obs);
      assert.equal(a, 0);

      $.publish(101, obs);
      assert.equal(a, 101);
    });


  });




});
