import { Stream, ProducerStream } from "./stream";
import { Behavior, ProducerBehavior } from "./behavior";

export type HTMLEventName = keyof HTMLElementEventMap;
export type WindowEventName = keyof WindowEventMap;
export type EventName = HTMLEventName | WindowEventName;
export type Extractor<E, T, A> = (event: E, target: T) => A;

class DomEventStream<A> extends ProducerStream<A> {
  private listener: EventListener;
  constructor(private target: EventTarget, private eventName: string, private extractor: Extractor<any, EventTarget, A>) {
    super();
    this.listener = (ev) => {
      this.push(this.extractor(ev, this.target));
    };
  }
  activate(): void {
    this.target.addEventListener(this.eventName, this.listener);
  }
  deactivate(): void {
    this.target.removeEventListener(this.eventName, this.listener);
  }
}

function id<A>(a: A): A {
  return a;
}

// Overloads for Window
export function streamFromEvent<A, E extends WindowEventName, T extends Window>(
  target: T, eventName: E): Stream<WindowEventMap[E]>;
export function streamFromEvent<A, E extends WindowEventName, T extends Window>(
  target: T, eventName: E, extractor: Extractor<WindowEventMap[E], T, A>): Stream<A>;
// Overloads for HTMLElement
export function streamFromEvent<A, E extends HTMLEventName, T extends HTMLElement>(
  target: T, eventName: E): Stream<HTMLElementEventMap[E]>;
export function streamFromEvent<A, E extends HTMLEventName, T extends HTMLElement>(
  target: T, eventName: E, extractor: Extractor<HTMLElementEventMap[E], T, A>): Stream<A>;
export function streamFromEvent<A>(
  target: EventTarget, eventName: string, extractor: Extractor<any, EventTarget, A>): Stream<A>;
export function streamFromEvent<A>(
  target: EventTarget, eventName: string, extractor: Extractor<any, EventTarget, A> = id
): Stream<A> {
  return new DomEventStream(target, eventName, extractor);
}

class DomEventBehavior<A> extends ProducerBehavior<A> {
  private listener: EventListener;
  constructor(private target: EventTarget, private eventName: string, initial: A,  private extractor: Extractor<any, EventTarget, A>) {
    super();
    this.last = initial;
    this.listener = ev => {
      this.push(this.extractor(ev, this.target));
    };
  }
  activate(): void {
    this.target.addEventListener(this.eventName, this.listener);
  }
  deactivate(): void {
    this.target.removeEventListener(this.eventName, this.listener);
  }
}

// Overloads for Window
export function behaviorFromEvent<A, E extends WindowEventName, T extends Window>(
  target: T, eventName: E, initial: WindowEventMap[E]): Behavior<WindowEventMap[E]>;
export function behaviorFromEvent<A, E extends WindowEventName, T extends Window>(
  target: T, eventName: E, initial: A, extractor: Extractor<WindowEventMap[E], T, A>): Behavior<A>;
// Overloads for HTMLElement
export function behaviorFromEvent<A, E extends HTMLEventName, T extends HTMLElement>(
  target: T, eventName: E, initial: A): Behavior<HTMLElementEventMap[E]>;
export function behaviorFromEvent<A, E extends HTMLEventName, T extends HTMLElement>(
  target: T, eventName: E, initial: A, extractor: Extractor<HTMLElementEventMap[E], T, A>): Behavior<A>;
export function behaviorFromEvent<A>(
  target: EventTarget, eventName: string, initial: A, extractor: Extractor<any, EventTarget, A>): Behavior<A>;
export function behaviorFromEvent<A>(
  target: EventTarget, eventName: string, initial: A, extractor: Extractor<any, EventTarget, A> = id
): Behavior<A> {
  return new DomEventBehavior(target, eventName, initial, extractor);
}
