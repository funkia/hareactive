import {Now} from "./Now";
import {Do} from "jabz/monad";

import {runNow} from "./Now";
import {Behavior, placeholder, sink, subscribe} from "./Behavior";
import * as B from "./Behavior";
import {Future} from "./Future";
import {Stream, empty} from "./Stream";

// Quick n' dirty proof of concept implementation

function id<A>(a: A): A { return a; };
function snd<A, B>(a: [A, B]): B { return a[1]; }

type CompVal<A> = [A, Node[]];

/**
 * A component is a function from a parent DOM node to a now
 * computation I.e. something like `type Component<A> = (p: Node) =>
 * Now<A>`. We don't define it as a type alias because we wan't to
 * make it a monad in different way than Now.
 */
export class Component<A> {
  constructor(public content: (n: Node) => Now<A>) {}
  static of<B>(b: B): Component<B> {
    return new Component(() => Now.of(b));
  }
  public of: <B>(b: B) => Component<B> = Component.of;
  public chain<B>(f: (a: A) => Component<B>): Component<B> {
    return new Component((parent: Node) => {
      return this.content(parent).chain((a) => {
        return f(a).content(parent);
      });
    });
  }
  public flatten<B>(now: Component<Component<A>>): Component<A> {
    return now.chain(id);
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

/** Run component and the now-computation inside */
function runComponentNow<A>(parent: Node, c: Component<A>): A {
  return c.content(parent).run();
}

class MfixNow<M extends Behavior<any>[], O> extends Now<[M, O]> {
  constructor(private fn: (m: M) => Now<[M, O]>) {
    super();
  };
  public run(): [M, O] {
    const placeholders: any = [
      placeholder(), placeholder(), placeholder(), placeholder()
    ];
    // const fakeArg: [M, O] = [placeholders, undefined];
    const [behaviors, out] = this.fn(placeholders).run();
    // Tie the recursive knot
    for (let i = 0; i < behaviors.length; ++i) {
      placeholders[i].replaceWith(behaviors[i]);
    }
    return [behaviors, out];
  };
}

/**
 * Something resembling the monadic fixpoint combinatior for Now.
 */
export function mfixNow<M extends Behavior<any>[], O>(
  comp: (m: M) => Now<[M, O]>
): Now<[M, O]> {
  return new MfixNow(comp);
}

export function component<M extends Behavior<any>[], V, O>({model, view}: {
  model: (v: V) => Now<[M, O]>,
  view: (m: M) => Component<V>
}): Component<O> {
  return new Component((parent: Node) => mfixNow<M, O>(
    (bs) => view(bs).content(parent).chain((v: V) => model(v))
  ).map(snd));
}

export function runMain(selector: string, c: Component<any>): void {
  const element = document.querySelector(selector);
  runComponentNow(element, c);
}

// DOM constructor stuff, should eventually be in different file

type Showable = string | number;

type BehaviorDescription<A> = {
  on: string,
  name: string,
  initial: A,
  extractor: (event: any) => A
}

type StreamDescription<A> = {
  on: string,
  name: string,
  extractor: (event: any) => A
}

class CreateDomNow<A> extends Now<A> {
  constructor(
    private parent: Node,
    private tagName: string,
    private behaviors: BehaviorDescription<any>[],
    private streams: StreamDescription<any>[],
    private text?: string,
    private children?: Component<any>
  ) { super(); };
  public run(): A {
    const elm = document.createElement(this.tagName);
    let output: any;
    if (this.children !== undefined) {
      // If the component has children we don't create event listeners
      // for the element. In this case we instead pass on the streams
      // and behaviors that hte children creates.
      output = runComponentNow(elm, this.children);
    } else {
      output = {};
      for (const bd of this.behaviors) {
        output[bd.name] = behaviorFromEvent(bd, elm);
      }
      for (const bd of this.streams) {
        output[bd.name] = streamFromEvent(bd, elm);
      }
      if (this.text !== undefined) {
        elm.textContent = this.text;
      }
    }
    this.parent.appendChild(elm);
    return output;
  }
}

function behaviorFromEvent<A>(
  {on, initial, extractor}: BehaviorDescription<A>,
  dom: Node
): Behavior<A> {
  const b = sink(initial);
  dom.addEventListener(on, (ev) => b.publish(extractor(ev)));
  return b;
}

function streamFromEvent<A>(
  {on, extractor}: StreamDescription<A>,
  dom: Node
): Stream<A> {
  const s = empty<A>();
  dom.addEventListener(on, (ev) => {
    s.publish(extractor(ev));
  });
  return s;
}

export const input = () => new Component((p) => new CreateDomNow<{inputValue: Behavior<string>}>(
  p, "input",
  [{on: "input", name: "inputValue", extractor: (ev: any) => ev.target.value, initial: ""}],
  []
));

export const br = new Component((p) => new CreateDomNow<{}>(p, "br", [], []));

export function span(text: string): Component<{}> {
  return new Component((p) => new CreateDomNow<{}>(p, "span", [], [], text));
}

export function h1(text: string): Component<{}> {
  return new Component((p) => new CreateDomNow<{}>(p, "h1", [], [], text));
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
  return new Component((parent: Node) => {
    parent.appendChild(elm);
    return Now.of({});
  });
}

export function button(label: string): Component<{click: Stream<Event>}> {
  return new Component((p) => new CreateDomNow<{click: Stream<Event>}>(
    p, "button", [],
    [{on: "click", name: "click", extractor: id}], label
  ));
}

export function div<A>(children: Component<A>): Component<A> {
  return new Component((p) => new CreateDomNow<A>(
    p, "div", [], [], undefined, children
  ));
}

type ComponentStuff<A> = {
  elm: Node, out: A
}

class ComponentListNow<A, B> extends Now<Behavior<B[]>> {
  constructor(
    private parent: Node,
    private getKey: (a: A) => number,
    private compFn: (a: A) => Component<B>,
    private list: Behavior<A[]>
  ) { super(); }
  public run(): Behavior<B[]> {
    // The reordering code below is neither pretty nor fast. But it at
    // least avoids recreating elements and is quite simple.
    const resultB = sink<B[]>([]);
    const end = document.createComment("list end");
    let keyToElm: {[key: string]: ComponentStuff<B>} = {};
    this.parent.appendChild(end);
    B.subscribe((newAs) => {
      const newKeyToElm: {[key: string]: ComponentStuff<B>} = {};
      const newArray: B[] = [];
      // Re-add existing elements and new elements
      for (const a of newAs) {
        const key = this.getKey(a);
        let stuff = keyToElm[key];
        if (stuff === undefined) {
          const fragment = document.createDocumentFragment();
          const out = runComponentNow(fragment, this.compFn(a));
          // Assumes component only adds a single element
          stuff = {out, elm: fragment.firstChild};
        }
        this.parent.insertBefore(stuff.elm, end);
        newArray.push(stuff.out);
        newKeyToElm[key] = stuff;
      }
      // Remove elements that are no longer present
      const oldKeys = Object.keys(keyToElm);
      for (const key of oldKeys) {
        if (newKeyToElm[key] === undefined) {
          this.parent.removeChild(keyToElm[key].elm);
        }
      }
      keyToElm = newKeyToElm;
      resultB.publish(newArray);
    }, this.list);
    return resultB;
  }
}

export function list<A>(
  c: (a: A) => Component<any>, getKey: (a: A) => number, l: Behavior<A[]>
): Component<{}> {
  return new Component((p) => new ComponentListNow(p, getKey, c, l));
}
