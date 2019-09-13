import * as sinon from "sinon";
import { spy } from "sinon";
import { IO, withEffects } from "@funkia/io";

import { ProducerStream, SinkBehavior } from "../src/index";
import { State, Reactive } from "../src/common";

// A reference that can be mutated
export type Ref<A> = { ref: A };

export function createRef<A>(a: A): Ref<A> {
  return { ref: a };
}

export const mutateRef: <A>(a: A, r: Ref<A>) => IO<{}> = withEffects(
  (a: any, r: Ref<any>) => (r.ref = a)
);

export function subscribeSpy(b: Reactive<any, any>): sinon.SinonSpy {
  const cb = spy();
  b.subscribe(cb);
  return cb;
}

export function mockNow(): [(t: number) => void, () => void] {
  const orig = Date.now;
  let time = 0;
  Date.now = () => time;
  return [(t: number) => (time = t), () => (Date.now = orig)];
}

class TestProducer<A> extends ProducerStream<A> {
  constructor(
    private activateSpy: sinon.SinonSpy,
    private deactivateSpy: sinon.SinonSpy
  ) {
    super();
  }
  activate(): void {
    this.activateSpy();
    this.state = State.Pull;
  }
  deactivate(): void {
    this.deactivateSpy();
  }
}

export function createTestProducer() {
  const activate = spy();
  const deactivate = spy();
  const producer = new TestProducer(activate, deactivate);
  const push = producer.pushS.bind(producer);
  return { activate, deactivate, push, producer };
}

class TestProducerBehavior<A> extends SinkBehavior<A> {
  constructor(
    last: A,
    private activateSpy: sinon.SinonSpy,
    private deactivateSpy: sinon.SinonSpy
  ) {
    super(last);
  }
  activateProducer(): void {
    this.activateSpy();
    this.state = State.Pull;
  }
  deactivateProducer(): void {
    this.deactivateSpy();
  }
}

export function createTestProducerBehavior<A>(initial: A) {
  const activate = spy();
  const deactivate = spy();
  const producer = new TestProducerBehavior(initial, activate, deactivate);
  const push = producer.newValue.bind(producer);
  return { activate, deactivate, push, producer };
}
