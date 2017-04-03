import { empty, Stream } from "../Stream";

export type EventName = keyof HTMLElementEventMap;

export function streamFromEvent<N extends EventName>(
  eventName: N, element: Node
): Stream<HTMLElementEventMap[N]>;
export function streamFromEvent<E extends HTMLElement, N extends EventName, A>(
  eventName: N, element: E, extractor: (e: HTMLElementEventMap[N], elm: E) => A
): Stream<A>;
export function streamFromEvent<A>(
  eventName: EventName, element: Node, extractor?: (e: any, elm: Node) => A
): Stream<A> {
  const s = empty<A>();
  const hasExtractor = extractor !== undefined;
  element.addEventListener(eventName, (ev) => {
    s.push(hasExtractor ? extractor(ev, element) : ev);
  });
  return s;
}
