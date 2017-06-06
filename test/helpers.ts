import * as sinon from "sinon";
import { ProducerStream } from "../src/stream";
import { spy } from "sinon";

import { State, Reactive } from "../src/common";
import { Behavior, ProducerBehavior } from "../src/behavior";

export function subscribeSpy(b: Reactive<any>): sinon.SinonSpy {
  const cb = spy();
  b.subscribe(cb);
  return cb;
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
  const push = producer.push.bind(producer);
  return { activate, deactivate, push, producer };
}

class TestProducerBehavior<A> extends ProducerBehavior<A> {
  constructor(
    public last: A,
    private activateSpy: sinon.SinonSpy,
    private deactivateSpy: sinon.SinonSpy
  ) {
    super();
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
  const push = producer.push.bind(producer);
  return { activate, deactivate, push, producer };
}
