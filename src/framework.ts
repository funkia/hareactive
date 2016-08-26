import {Now} from "./Now";
import {Do} from "jabz/monad";

import {runNow} from "./Now";
import {Behavior, placeholder, sink, subscribe} from "./Behavior";
import * as B from "./Behavior";
import {Future} from "./Future";
import {Stream, empty} from "./Stream";

// Quick n' dirty proof of concept implementation

/**
 * A component is a now computation of a pair of a value and a list of
 * DOM nodes. I.e. something like `type Component<A> = Now<[A,
 * Node[]]>`. We don't define it as a type alias because we wan't to
 * make it a monad in different way than Now. Component's `chain`
 * concatenates the DOM nodes from the first and the returned
 * Component. We use this to build up the view using do-notation.
 */

type CompVal<A> = [A, Node[]];

export class Component<A> {
  constructor(public content: Now<[A, Node[]]>) {}
  static of<B>(b: B): Component<B> {
    // We need this decleration because TS can't infer the tuple type :'(
    const pair: [B, Node[]] = [b, []];
    return new Component(Now.of(pair));
  }
  public of: <B>(b: B) => Component<B> = Component.of;
  static fromPair<B>(b: B, nodes: Node[]): Component<B> {
    const pair: [B, Node[]] = [b, nodes];
    return new Component(Now.of(pair));
  }
  public chain<B>(f: (a: A) => Component<B>): Component<B> {
    return new Component(this.content.chain(([a, nodes]) => {
      return f(a).content.map(([b, moreNodes]): [B, Node[]] => {
        return [b, nodes.concat(moreNodes)];
      });
    }));
  }
  public flatten<B>(now: Component<Component<A>>): Component<A> {
    return now.chain((n: Component<A>) => n);
  }
  map<B>(f: (a: A) => B): Component<B> {
    return this.chain((a: A) => this.of(f(a)));
  }
  mapTo<B>(b: B): Component<B> {
    return this.chain((_) => this.of(b));
  }
  lift<T1, R>(f: (t: T1) => R, m: Component<T1>): Component<R>;
  lift<T1, T2, R>(f: (t: T1, u: T2) => R, m1: Component<T1>, m2: Component<T2>): Component<R>;
  lift<T1, T2, T3, R>(f: (t1: T1, t2: T2, t3: T3) => R, m1: Component<T1>, m2: Component<T2>, m3: Component<T3>): Component<R>;
  lift(f: Function, ...ms: any[]): Component<any> {
    const {of} = ms[0];
    switch (f.length) {
    case 1:
      return ms[0].map(f);
    case 2:
      return ms[0].chain((a: any) => ms[1].chain((b: any) => of(f(a, b))));
    case 3:
      return ms[0].chain((a: any) => ms[1].chain((b: any) => ms[2].chain((c: any) => of(f(a, b, c)))));
    }
  }
}

interface ViewOutput {
  behaviors?: Array<Behavior<any>>;
  streams?: Array<Stream<any>>;
}

class MfixNow<V extends ViewOutput> extends Now<[V, Node[]]> {
  constructor(private fn: (v: [V, Node[]]) => Now<[V, Node[]]>) {
    super();
  };
  public run(): [V, Node[]] {
    const placeholders: any = {
      behaviors: [placeholder(), placeholder(), placeholder(), placeholder()],
      streams: [empty(), empty(), empty(), empty()]
    };
    const arg = this.fn([placeholders, []]).run();
    const [{behaviors, streams}, _] = arg;
    // Tie the recursive knot
    if (behaviors !== undefined) {
      for (let i = 0; i < behaviors.length; ++i) {
        placeholders.behaviors[i].replaceWith(behaviors[i]);
      }
    }
    if (streams !== undefined) {
      for (let i = 0; i < streams.length; ++i) {
        placeholders.streams[i].def = streams[i];
      }
    }
    return arg;
  };
}
/**
 * Something resembling the monadic fixpoint combinatior for Now.
 */
export function mfixNow<V extends ViewOutput>(
  comp: (v: [V, Node[]]) => Now<[V, Node[]]>
): Now<[V, Node[]]> {
  return new MfixNow(comp);
}

function runComponent<A>(c: Component<A>): Now<[A, Node[]]> {
  return c.content;
}

export function component<M, V extends ViewOutput>({model, view}: {
  model: (v: V) => Now<M>,
  view: (m: M) => Component<V>
}): Component<V> {
  return new Component(mfixNow<V>(
    ([v, _]) => model(v).chain((m: M) => runComponent(view(m)))
  ));
}

export function runMain(selector: string, c: Component<any>): void {
  const element = document.querySelector(selector);
  runNow(runComponent(c).map(([_, nodes]) => {
    for (const node of nodes) {
      element.appendChild(node);
    }
    return Future.of({});
  }));
}

// DOM constructor stuff, should eventually be in different file

type Showable = string | number;

function behaviorFromEvent<A>(
  initial: A,
  eventName: string,
  extractor: (ev: Event) => A,
  dom: Node
): Behavior<A> {
  const b = sink(initial);
  dom.addEventListener(eventName, (ev) => {
    b.publish(extractor(ev));
  });
  return b;
}

function streamFromEvent<A>(
  eventName: string,
  extractor: (ev: Event) => A,
  dom: Node
): Stream<A> {
  const s = empty<A>();
  dom.addEventListener(eventName, (ev) => {
    s.publish(extractor(ev));
  });
  return s;
}

export function input(): Component<{inputValue: Behavior<string>}> {
  const elm = document.createElement("input");
  const inputValue = behaviorFromEvent(
    "", "input", (ev: any) => ev.target.value, elm
  );
  return Component.fromPair({inputValue}, [elm]);
}

export function br(): Component<{}> {
  const elm = document.createElement("br");
  return Component.fromPair({}, [elm]);
}

export function span(text: string): Component<{}> {
  const elm = document.createElement("span");
  elm.innerText = text;
  return Component.fromPair({}, [elm]);
}

export function text(tOrB: string|Behavior<Showable>): Component<{}> {
  const elm = document.createTextNode("");
  if (typeof tOrB === "string") {
    elm.nodeValue = tOrB;
  } else {
    if (tOrB.pushing === true) {
      elm.nodeValue = B.at(tOrB).toString();
    }
    subscribe((t) => elm.nodeValue = t.toString(), tOrB);
  }
  return Component.fromPair({}, [elm]);
}

export function button(label: string): Component<{click: Stream<Event>}> {
  const elm = document.createElement("button");
  elm.textContent = label;
  const click = streamFromEvent(
    "click", (ev: any) => ev, elm
  );
  return Component.fromPair({click}, [elm]);
}
