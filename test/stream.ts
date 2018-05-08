import { assert } from "chai";
import { spy, useFakeTimers } from "sinon";
import { State } from "../src/common";
import {
  map,
  publish,
  placeholder,
  apply,
  changes,
  debounce,
  delay,
  empty,
  filter,
  filterApply,
  isStream,
  keepWhen,
  producerStream,
  ProducerStream,
  scanS,
  Behavior,
  ProducerBehavior,
  fromFunction,
  sinkBehavior,
  testBehavior,
  sinkStream,
  snapshot,
  snapshotWith,
  split,
  subscribe,
  testStreamFromArray,
  testStreamFromObject,
  throttle,
  combine
} from "../src/index";

import {
  createTestProducer,
  createTestProducerBehavior,
  subscribeSpy
} from "./helpers";

const addTwo = (v: number): number => v + 2;
const sum = (a: number, b: number): number => a + b;

describe("stream", () => {
  describe("test streams", () => {
    it("creates test stream with increasing times from array", () => {
      const s = testStreamFromArray([0, 1, 2, 3]);
      assert.deepEqual(s.semantic(), [
        { value: 0, time: 0 },
        { value: 1, time: 1 },
        { value: 2, time: 2 },
        { value: 3, time: 3 }
      ]);
    });
    it("creates test stream from object", () => {
      const s = testStreamFromObject({
        2: "one",
        4: "two",
        5.5: "three"
      });
      assert.deepEqual(s.semantic(), [
        { value: "one", time: 2 },
        { value: "two", time: 4 },
        { value: "three", time: 5.5 }
      ]);
    });
  });
  describe("isStream", () => {
    it("should be true when Stream object", () => {
      assert.isTrue(isStream(empty));
    });
    it("should be false when not Stream object", () => {
      assert.isFalse(isStream([]));
      assert.isFalse(isStream({}));
      assert.isFalse(isStream("test"));
      assert.isFalse(isStream([empty]));
      assert.isFalse(isStream(1234));
      assert.isFalse(isStream(isStream));
    });
  });
  describe("subscribe", () => {
    it("supports multiple listeners", () => {
      const s = sinkStream();
      const cb1 = spy();
      const cb2 = spy();
      s.subscribe(cb1);
      s.subscribe(cb2);
      publish(2, s);
      publish(3, s);
      assert.strictEqual(cb1.callCount, 2);
      assert.strictEqual(cb2.callCount, 2);
    });
    it("single listeners can be removed", () => {
      const s = sinkStream();
      const cb1 = spy();
      const cb2 = spy();
      s.subscribe(cb1);
      const listener = s.subscribe(cb2);
      s.removeListener(listener.node);
      publish(2, s);
      publish(3, s);
      assert.strictEqual(cb1.callCount, 2);
      assert.strictEqual(cb2.callCount, 0);
    });
    it("supports removing listener when more than two", () => {
      const s = sinkStream();
      const cb1 = spy();
      const cb2 = spy();
      const cb3 = spy();
      s.subscribe(cb1);
      const listener = s.subscribe(cb2);
      s.subscribe(cb3);
      s.removeListener(listener.node);
      publish(2, s);
      publish(3, s);
      assert.strictEqual(cb1.callCount, 2);
      assert.strictEqual(cb2.callCount, 0);
      assert.strictEqual(cb3.callCount, 2);
    });
  });
  describe("producer", () => {
    it("activates and deactivates", () => {
      const activate = spy();
      const deactivate = spy();
      class MyProducer<A> extends ProducerStream<A> {
        activate(): void {
          activate();
          this.state = State.Pull;
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
    it("pushes to listener", () => {
      const callback = spy();
      let push: (n: number) => void;
      class MyProducer<A> extends ProducerStream<A> {
        activate(): void {
          push = this.push.bind(this);
        }
        deactivate(): void {
          push = undefined;
        }
      }
      const producer = new MyProducer();
      producer.subscribe(callback);
      push(1);
      push(2);
      assert.deepEqual(callback.args, [[1], [2]]);
    });
  });
  describe("producerStream", () => {
    it("activates and deactivates", () => {
      const activate = spy();
      const deactivate = spy();
      const producer = producerStream((push) => {
        activate();
        return deactivate;
      });
      const observer = producer.subscribe((a) => a);
      observer.deactivate();
      assert(activate.calledOnce);
      assert(deactivate.calledOnce);
    });
    it("pushes to listener", () => {
      const callback = spy();
      let push: (n: number) => void;
      const producer = producerStream((p) => {
        push = p;
        return () => (push = undefined);
      });
      producer.subscribe(callback);
      push(1);
      push(2);
      assert.deepEqual(callback.args, [[1], [2]]);
    });
  });
  describe("empty", () => {
    it("is empty array semantically", () => {
      assert.deepEqual(empty.semantic(), []);
    });
  });
  describe("combine", () => {
    describe("semantics", () => {
      it("interleaves occurrences", () => {
        const s1 = testStreamFromObject({
          0: "#1",
          2: "#3"
        });
        const s2 = testStreamFromObject({
          1: "#2",
          2: "#4",
          3: "#5"
        });
        const combined = s2.combine(s1);
        assert.deepEqual(combined.semantic(), [
          { time: 0, value: "#1" },
          { time: 1, value: "#2" },
          { time: 2, value: "#3" },
          { time: 2, value: "#4" },
          { time: 3, value: "#5" }
        ]);
      });
    });
    it("should combine two streams", () => {
      const stream1 = sinkStream();
      const stream2 = sinkStream();
      const callback = spy();
      const combinedS = stream2.combine(stream1);
      combinedS.subscribe(callback);
      publish(1, stream1);
      publish("2", stream2);
      assert.deepEqual(callback.args, [[1], ["2"]]);
    });
    it("should combine three streams", () => {
      const stream1 = sinkStream();
      const stream2 = sinkStream();
      const stream3 = sinkStream();
      const combinedS = combine(stream1, stream2, stream3);
      const callback = subscribeSpy(combinedS);
      publish(1, stream1);
      publish(2, stream2);
      publish(3, stream2);
      assert.deepEqual(callback.args, [[1], [2], [3]]);
    });
  });
  describe("map", () => {
    it("maps values semantically", () => {
      const s = testStreamFromArray([1, 2, 3]);
      const mapped = s.map((n) => n * n);
      assert.deepEqual(
        mapped.semantic(),
        testStreamFromArray([1, 4, 9]).semantic()
      );
    });
    it("should map the published values", () => {
      const obs = sinkStream();
      const callback = spy();
      const mappedObs = map(addTwo, obs);
      subscribe(callback, mappedObs);
      for (let i = 0; i < 5; i++) {
        publish(i, obs);
      }
      assert.deepEqual(callback.args, [[2], [3], [4], [5], [6]]);
    });
    it("maps to a constant with mapTo", () => {
      const stream = sinkStream();
      const callback = spy();
      const mapped = stream.mapTo(7);
      subscribe(callback, mapped);
      publish(1, stream);
      publish(2, stream);
      publish(3, stream);
      assert.deepEqual(callback.args, [[7], [7], [7]]);
    });
    it("maps to constant semantically", () => {
      const s = testStreamFromArray([1, 2, 3]);
      const mapped = s.mapTo(7);
      assert.deepEqual(
        mapped.semantic(),
        testStreamFromArray([7, 7, 7]).semantic()
      );
    });
  });
  describe("apply", () => {
    it("at applies function in behavior", () => {
      const fnB = sinkBehavior((n: number) => n * n);
      const origin = sinkStream<number>();
      const applied = apply(fnB, origin);
      const callback = spy();
      subscribe(callback, applied);
      publish(2, origin);
      publish(3, origin);
      fnB.push((n: number) => 2 * n);
      publish(4, origin);
      publish(5, origin);
      fnB.push((n: number) => n / 2);
      publish(4, origin);
      fnB.push(Math.sqrt);
      publish(25, origin);
      publish(36, origin);
      assert.deepEqual(callback.args, [[4], [9], [8], [10], [2], [5], [6]]);
    });
  });
  describe("filter", () => {
    it("filter values semantically", () => {
      const s = testStreamFromArray([1, 3, 2, 4, 1]);
      const filtered = s.filter((n) => n > 2);
      assert.deepEqual(filtered.semantic(), [
        { time: 1, value: 3 },
        { time: 3, value: 4 }
      ]);
    });
    it("should filter the unwanted values", () => {
      const sink = sinkStream();
      const callback = spy();
      const isEven = (v: number): boolean => v % 2 === 0;
      const filteredObs = filter(isEven, sink);
      subscribe(callback, filteredObs);
      for (let i = 0; i < 10; i++) {
        publish(i, sink);
      }
      assert.deepEqual(callback.args, [[0], [2], [4], [6], [8]]);
    });
  });
  describe("split", () => {
    it("splits based on predicate", () => {
      const sink = sinkStream<number>();
      const callbackA = spy();
      const callbackB = spy();
      const [a, b] = split((n) => n % 2 === 0, sink);
      a.subscribe(callbackA);
      b.subscribe(callbackB);
      sink.push(1);
      sink.push(4);
      sink.push(7);
      sink.push(10);
      assert.deepEqual(callbackA.args, [[4], [10]]);
      assert.deepEqual(callbackB.args, [[1], [7]]);
    });
  });
  describe("filterApply", () => {
    it("at applies filter from behavior", () => {
      const predB = sinkBehavior((n: number) => n % 2 === 0);
      const origin = sinkStream<number>();
      const filtered = filterApply(predB, origin);
      const callback = spy();
      subscribe(callback, filtered);
      publish(2, origin);
      publish(3, origin);
      predB.push((n: number) => n % 3 === 0);
      publish(4, origin);
      publish(6, origin);
      predB.push((n: number) => n % 4 === 0);
      publish(6, origin);
      publish(12, origin);
      assert.deepEqual(callback.args, [[2], [6], [12]]);
    });
  });

  describe("scanS", () => {
    it("should scan the values to a stream", () => {
      const eventS = sinkStream();
      const callback = spy();
      const sumF = (currSum: number, val: number) => currSum + val;
      const currentSumE = scanS(sumF, 0, eventS).at();
      subscribe(callback, currentSumE);
      for (let i = 0; i < 10; i++) {
        publish(i, eventS);
      }
      assert.deepEqual(callback.args, [
        [0],
        [1],
        [3],
        [6],
        [10],
        [15],
        [21],
        [28],
        [36],
        [45]
      ]);
    });
  });

  describe("keepWhen", () => {
    it("removes occurrences when behavior is false", () => {
      let flag = true;
      const bool: Behavior<boolean> = fromFunction(() => flag);
      const origin = sinkStream<number>();
      const filtered = keepWhen(origin, bool);
      const callback = spy();
      subscribe(callback, filtered);
      publish(0, origin);
      publish(1, origin);
      flag = false;
      publish(2, origin);
      publish(3, origin);
      flag = true;
      publish(4, origin);
      flag = false;
      publish(5, origin);
      flag = true;
      publish(6, origin);
      assert.deepEqual(callback.args, [[0], [1], [4], [6]]);
    });
  });
  describe("timing operators", () => {
    let clock: any;
    beforeEach(() => {
      clock = useFakeTimers();
    });
    afterEach(() => {
      clock.restore();
    });
    describe("delay", () => {
      it("should delay every push", () => {
        let n = 0;
        const s = sinkStream<number>();
        const delayedS = delay(50, s);
        delayedS.subscribe(() => (n = 2));
        s.subscribe(() => (n = 1));
        s.push(0);
        assert.strictEqual(n, 1);
        clock.tick(49);
        assert.strictEqual(n, 1);
        clock.tick(1);
        assert.strictEqual(n, 2);
      });
    });
    describe("throttle", () => {
      it("after an occurrence it should ignore", () => {
        let n = 0;
        const s = sinkStream<number>();
        const throttleS = throttle(100, s);
        throttleS.subscribe((v) => (n = v));
        assert.strictEqual(n, 0);
        s.push(1);
        assert.strictEqual(n, 1);
        clock.tick(80);
        s.push(2);
        assert.strictEqual(n, 1);
        clock.tick(19);
        s.push(3);
        assert.strictEqual(n, 1);
        clock.tick(1);
        s.push(4);
        assert.strictEqual(n, 4);
      });
    });
    describe("debounce", () => {
      it("holding the latest occurrence until an amount of time has passed", () => {
        let n = 0;
        const s = sinkStream<number>();
        const debouncedS = debounce(100, s);
        debouncedS.subscribe((v) => (n = v));
        assert.strictEqual(n, 0);
        s.push(1);
        clock.tick(80);
        assert.strictEqual(n, 0);
        clock.tick(30);
        assert.strictEqual(n, 1);
        s.push(2);
        assert.strictEqual(n, 1);
        clock.tick(99);
        assert.strictEqual(n, 1);
        clock.tick(2);
        assert.strictEqual(n, 2);
      });
    });
  });
  describe("snapshot", () => {
    it("snapshots pull based Behavior", () => {
      let n = 0;
      const b: Behavior<number> = fromFunction(() => n);
      const e = sinkStream<number>();
      const shot = snapshot<number>(b, e);
      const callback = spy();
      subscribe(callback, shot);
      publish(0, e);
      publish(1, e);
      n = 1;
      publish(2, e);
      n = 2;
      publish(3, e);
      publish(4, e);
      assert.deepEqual(callback.args, [[0], [0], [1], [2], [2]]);
    });
    it("snapshots push based Behavior", () => {
      const b = sinkBehavior(0);
      const e = sinkStream<number>();
      const shot = snapshot<number>(b, e);
      const callback = spy();
      subscribe(callback, shot);
      publish(0, e);
      publish(1, e);
      b.push(1);
      publish(2, e);
      b.push(2);
      publish(3, e);
      publish(4, e);
      assert.deepEqual(callback.args, [[0], [0], [1], [2], [2]]);
    });
    it("activates producer", () => {
      const { activate, push, producer } = createTestProducerBehavior(0);
      const mapped = map(addTwo, producer);
      const s = sinkStream<undefined>();
      const shot = snapshot(mapped, s);
      const callback = spy();
      shot.subscribe(callback);
      s.push(undefined);
      push(1);
      s.push(undefined);
      push(2);
      s.push(undefined);
      push(3);
      push(4);
      s.push(undefined);
      assert(activate.calledOnce, "called once");
      assert.deepEqual(callback.args, [[2], [3], [4], [6]]);
    });
    it("applies function in snapshotWith to pull based Behavior", () => {
      let n = 0;
      const b: Behavior<number> = fromFunction(() => n);
      const e = sinkStream<number>();
      const shot = snapshotWith<number, number, number>(sum, b, e);
      const callback = spy();
      subscribe(callback, shot);
      publish(0, e);
      publish(1, e);
      n = 1;
      publish(2, e);
      n = 2;
      publish(3, e);
      publish(4, e);
      assert.deepEqual(callback.args, [[0], [1], [3], [5], [6]]);
    });
    it("has semantic representation", () => {
      const b = testBehavior((t) => t * t);
      const s = testStreamFromObject({
        1: 1,
        4: 4,
        8: 8
      });
      const shot = snapshot(b, s);
      const expected = testStreamFromObject({
        1: 1,
        4: 16,
        8: 8 * 8
      });
      assert.deepEqual(shot.semantic(), expected.semantic());
    });
  });
  describe("changes", () => {
    it("gives changes from pushing behavior", () => {
      const b = sinkBehavior(0);
      const s = changes(b);
      const cb = spy();
      subscribe(cb, s);
      b.push(1);
      b.push(2);
      b.push(2);
      b.push(2);
      b.push(3);
      assert.deepEqual(cb.args, [[1], [2], [3]]);
    });
    /*
    it("gives changes from pulling behavior", () => {
      let x = 0;
      const b = fromFunction(() => x);
      const s = changes(b);
      const cb = spy();
      observe
      x = 1;
      x = 2;
      x = 3;
      assert.deepEqual(cb.args, [[1], [2], [3]]);
    });
    */
  });
  it("works", () => {
    function foobar(stream1, stream2) {
      const isEven = (n) => n % 2 === 0;
      const a = stream1.filter(isEven).map((n) => n * n);
      const b = stream2.filter((n) => !isEven(n)).map(Math.sqrt);
      return a.combine(b);
    }
    const a = testStreamFromObject({ 0: 1, 2: 4, 4: 6 });
    const b = testStreamFromObject({ 1: 9, 3: 8 });
    const result = foobar(a, b);
    const expected = testStreamFromObject({ 1: 3, 2: 16, 4: 36 });
    assert.deepEqual(result.semantic(), expected.semantic());
  });
});
