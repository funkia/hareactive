/// <reference path="../typings/index.d.ts" />

import * as $ from "../src/Observable";
import {assert} from "chai";

describe("Observable API", () => {
  it("should create an Observable", () => {
    assert.isFunction($.Observable);

    const obs = $.Observable();

    assert.isObject(obs);
    assert.property(obs, 'subscribers');
    assert.isArray(obs.subscribers);
    assert.lengthOf(obs.subscribers, 0);
    assert.property(obs, 'def');

  });

  it('should add a subscribtion', () => {
    const addSubs = (obs :any) => {
      $.subscribe(() => null, obs);
    }
    const obs = $.Observable();

    assert.isFunction($.subscribe)

    addSubs(obs);
    assert.lengthOf(obs.subscribers, 1);

    addSubs(obs);
    assert.lengthOf(obs.subscribers, 2);

  });

  it('should call subscribtions on publish', () => {
    const obs = $.Observable();
    let a = 0;

    $.subscribe((v : number) => a = v, obs);

    assert.isFunction($.publish);

    $.publish(1, obs);
    assert.equal(a, 1);

    $.publish(1123, obs);
    assert.notEqual(a, 1);

  });



});
