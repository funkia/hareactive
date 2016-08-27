import {Do} from "jabz/monad";

import {Behavior, stepper} from "../../src/Behavior";
import * as B from "../../src/Behavior";
import {Stream, snapshotWith, scan, merge, map} from "../../src/Stream";
import {Now} from "../../src/Now";

import {
  Component, component, runMain, span, input, br, text, button, div
} from "../../src/framework";

// Counter

type CounterModelOut = {
  count: Behavior<number>
};

type CounterViewOut = {
  streams: [Stream<any>, Stream<any>]
};

const counter = component<CounterModelOut, CounterViewOut>({
  model: ({streams: [incrementClick, decrementClick]}) =>
    Do(function*(): Iterator<Now<any>> {
      const increment = incrementClick.mapTo(1);
      const decrement = decrementClick.mapTo(-1);
      const count = B.stepper(
        0,
        scan((n, m) => Math.max(n + m, 0), 0, merge(increment, decrement))
      );
      return Now.of({count});
    }),
  view: ({count}) =>
    div<CounterViewOut>(Do(function*() {
      yield text("Counter ");
      yield text(count);
      yield text(" ");
      const {click: increment} = yield button(" + ");
      yield text(" ");
      const {click: decrement} = yield button(" - ");
      yield br;
      return Component.of({streams: [increment, decrement]})
    }))
});

const isValidEmail = (s: string) => s.match(/.+@.+\..+/i);

const getLength = (_: any, s: string) => s.length;

type MainModel = {};

type MainViewOut = {};

const main = component<MainModel, MainViewOut>({
  model: ({}) => Do(function*(): Iterator<Now<any>> {
    return Now.of({});
  }),
  view: ({}) => Do(function*(): Iterator<Component<any>> {
    yield counter;
    yield counter;
    return Component.of({behaviors: [], streams: []});
  }),
});

// `runMain` should be the only impure function in application code
runMain("body", main);
