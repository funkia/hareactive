import { Stream, SemanticStream } from "./stream";
import { Behavior, SemanticBehavior } from "./behavior";

class TestStream<A> extends Stream<A> {
  constructor(private semanticStream: SemanticStream<A>) {
    super();
  }
  semantic(): SemanticStream<A> {
    return this.semanticStream;
  }
  /* istanbul ignore next */
  activate(): SemanticStream<A> {
    throw new Error("You cannot activate a TestStream");
  }
  /* istanbul ignore next */
  deactivate(): SemanticStream<A> {
    throw new Error("You cannot deactivate a TestStream");
  }
  /* istanbul ignore next */
  pushS(t: number, a: A): void {
    throw new Error("You cannot push to a TestStream");
  }
}

export function testStreamFromArray<A>(array: A[]): Stream<A> {
  const semanticStream = array.map((value, time) => ({ value, time }));
  return new TestStream(semanticStream);
}

export function testStreamFromObject<A>(object: {
  [time: number]: A;
}): Stream<A> {
  const semanticStream = Object.keys(object).map((key) => ({
    time: parseFloat(key),
    value: object[key]
  }));
  return new TestStream(semanticStream);
}
