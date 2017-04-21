import { Stream, ProducerStream } from "./stream";

export type EventName = keyof HTMLElementEventMap;
export type Extractor<A> = (e: any, elm: Node) => A;

class DomEventStream<A> extends ProducerStream<A> {
  private listener: EventListener;
  constructor(private eventName: EventName, private element: Node, private extractor: Extractor<A>) {
    super();
    this.listener = (ev) => {
      this.push(this.extractor(ev, this.element));
    };
  }
  activate(): void {
    this.element.addEventListener(this.eventName, this.listener);
  }
  deactivate(): void {
    this.element.removeEventListener(this.eventName, this.listener);
  }
}

function id<A>(a: A): A {
  return a;
}

export function streamFromEvent<N extends EventName>(
  eventName: N, element: Node): Stream<HTMLElementEventMap[N]>;
export function streamFromEvent<E extends HTMLElement, N extends EventName, A>(
  eventName: N, element: E, extractor: (e: HTMLElementEventMap[N], elm: E) => A
): Stream<A>;
export function streamFromEvent<A>(
  eventName: EventName, element: Node, extractor: Extractor<A> = id
): Stream<A> {
  return new DomEventStream(eventName, element, extractor);
}
