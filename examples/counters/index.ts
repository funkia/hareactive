import {Do} from "jabz/monad";

import {Behavior, stepper, scan} from "../../src/Behavior";
import * as B from "../../src/Behavior";
import {Stream, snapshotWith, merge, map} from "../../src/Stream";
import {Now, sample} from "../../src/Now";

import {
  Component, component, runMain, span, input, br, text, button,
  div, h1, list
} from "../../src/framework";

const add = (n: number, m: number) => n + m;
const append = <A>(a: A, as: A[]) => as.concat([a]);
const apply = <A>(f: (a: A) => A, a: A) => f(a);

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
      const count = yield sample(
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

type MainModel = {
  counterIds: Behavior<number[]>,
};

type MainViewOut = {
  streams: [Stream<Event>, Stream<Event>]
};

const main = component<MainModel, MainViewOut>({
  model: ({streams: [addCounter, removeCounter]}) => Do(function*(): Iterator<Now<any>> {
    const nextId: Behavior<number> =
      yield sample(scan(add, 3, addCounter.mapTo(1)));
    const nextIdS =
      snapshotWith((_, b) => b, nextId, addCounter);
    const appendCounterFn =
      map((id) => (ids: number[]) => ids.concat([id]), nextIdS);
    const removeCounterFn =
      removeCounter.mapTo((ids: number[]) => ids.slice(0, -1));
    const modifications =
      merge(appendCounterFn, removeCounterFn);
    const counterIds =
      yield sample(scan(apply, [0,1,2], modifications));
    return Now.of({counterIds, nextId});
  }),
  view: ({counterIds}) => Do(function*(): Iterator<Component<any>> {
    yield h1("Counters");
    const {click: addCounter} = yield button("Add counter")
    yield text(" ");
    const {click: removeCounter} = yield button("Remove counter")
    yield br;
    yield br;
    yield list(() => counter, (n: number) => n, counterIds);
    return Component.of({
      behaviors: [], streams: [addCounter, removeCounter]
    });
  }),
});

runMain("body", main);
