import { observe } from "./common";
import { Stream, ProducerStream } from "./stream";
import { Behavior, ProducerBehavior, toggle } from "./behavior";
import { Now } from "./now";

export type HTMLEventName = keyof HTMLElementEventMap;
export type WindowEventName = keyof WindowEventMap;
export type EventName = HTMLEventName | WindowEventName;
export type Extractor<E, T, A> = (event: E, target: T) => A;

class DomEventStream<A> extends ProducerStream<A> {
  constructor(
    private target: EventTarget,
    private eventName: string,
    private extractor: Extractor<any, EventTarget, A>
  ) {
    super();
  }
  handleEvent(event: Event): void {
    this.pushS(undefined, this.extractor(event, this.target));
  }
  activate(): void {
    this.target.addEventListener(this.eventName, this);
  }
  deactivate(): void {
    this.target.removeEventListener(this.eventName, this);
  }
}

function id<A>(a: A): A {
  return a;
}

/**
 * Creates a stream from a DOM element and an event name.
 */
export function streamFromEvent<A, E extends WindowEventName, T extends Window>(
  target: T,
  eventName: E
): Stream<WindowEventMap[E]>;
export function streamFromEvent<A, E extends WindowEventName, T extends Window>(
  target: T,
  eventName: E,
  extractor: Extractor<WindowEventMap[E], T, A>
): Stream<A>;
// Overloads for HTMLElement
export function streamFromEvent<
  A,
  E extends HTMLEventName,
  T extends HTMLElement
>(target: T, eventName: E): Stream<HTMLElementEventMap[E]>;
export function streamFromEvent<
  A,
  E extends HTMLEventName,
  T extends HTMLElement
>(
  target: T,
  eventName: E,
  extractor: Extractor<HTMLElementEventMap[E], T, A>
): Stream<A>;
export function streamFromEvent<A>(
  target: EventTarget,
  eventName: string,
  extractor: Extractor<any, EventTarget, A>
): Stream<A>;
export function streamFromEvent<A>(
  target: EventTarget,
  eventName: string,
  extractor: Extractor<any, EventTarget, A> = id
): Stream<A> {
  return new DomEventStream(target, eventName, extractor);
}

class DomEventBehavior<A> extends ProducerBehavior<A> {
  constructor(
    private target: EventTarget,
    private eventName: string,
    private getter: (t: EventTarget) => A,
    private extractor: Extractor<any, EventTarget, A>
  ) {
    super();
    this.last = getter(target);
  }
  handleEvent(event: Event): void {
    this.newValue(this.extractor(event, this.target));
  }
  update(): A {
    return this.getter(this.target);
  }
  activateProducer(): void {
    this.target.addEventListener(this.eventName, this);
  }
  deactivateProducer(): void {
    this.target.removeEventListener(this.eventName, this);
  }
}

/**
 * Creates a behavior from a DOM element.
 */
export function behaviorFromEvent<
  A,
  E extends WindowEventName,
  T extends Window
>(
  target: T,
  eventName: E,
  getter: (t: T) => A,
  extractor: Extractor<WindowEventMap[E], T, A>
): Behavior<A>;
// Overloads for HTMLElement
export function behaviorFromEvent<
  A,
  E extends HTMLEventName,
  T extends HTMLElement
>(
  target: T,
  eventName: E,
  getter: (t: T) => A,
  extractor: Extractor<HTMLElementEventMap[E], T, A>
): Behavior<A>;
export function behaviorFromEvent<A>(
  target: EventTarget,
  eventName: string,
  getter: (t: EventTarget) => A,
  extractor: Extractor<any, EventTarget, A>
): Behavior<A>;
export function behaviorFromEvent<A>(
  target: EventTarget,
  eventName: string,
  getter: (t: EventTarget) => A,
  extractor: Extractor<any, EventTarget, A>
): Behavior<A> {
  return new DomEventBehavior(target, eventName, getter, extractor);
}

function pullOnFrame(pull: (t?: number) => void): () => void {
  let isPulling = true;
  function frame(): void {
    if (isPulling) {
      pull();
      window.requestAnimationFrame(frame);
    }
  }
  frame();
  return () => {
    isPulling = false;
  };
}

/**
 * Returns a stream that has an occurrence whenever a key is pressed down. The
 * value is the
 * [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
 * associated with the key press.
 */
export const keyDown: Stream<KeyboardEvent> = streamFromEvent(
  window,
  "keydown"
);

/**
 * Returns a stream that has an occurrence whenever a key is pressed down. The
 * value is the
 * [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
 * associated with the key press.
 */
export const keyUp: Stream<KeyboardEvent> = streamFromEvent(window, "keyup");

/**
 * Returns a behavior that is true when the key is pressed and false then the
 * key is not pressed.
 *
 * The code is a [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code).
 */
export function keyPressed(code: string): Now<Behavior<boolean>> {
  const isKey = (e: KeyboardEvent) => e.code === code;
  return toggle(false, keyDown.filter(isKey), keyUp.filter(isKey));
}

/**
 * Used to render the value of a behaviors into the DOM, a canvas, etc. The
 * `renderer` function is called on each frame using `requestAnimationFrame` if
 * the behavior has changed.
 */
export function render<A>(
  renderer: (a: A) => void,
  behavior: Behavior<A>
): void {
  observe(renderer, pullOnFrame, behavior);
}
