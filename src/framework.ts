import {Now} from "./Now";
import {Do} from "jabz/monad";

import {runNow} from "./Now";
import {Behavior, sink, subscribe} from "./Behavior";
import * as B from "./Behavior";
import {Future} from "./Future";
import {Stream, empty} from "./Stream";

// Quick n' dirty proof of concept implementation

/**
 * A component is a now computation of a pair of a value and a view.
 * I.e. something like `type Component<A> = Now<[A, View[]]>`. We don't
 * define it as a type alias because we wan't to make it a monad in
 * different way than Now.
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
}

type ViewBehaviors = Array<Behavior<any>>;
type ViewStreams = Array<Stream<any>>;

type ViewOut<VB, VS> = {behaviors: VB, streams: VS};

export function viewOut<VB, VS>(behaviors: VB, streams: VS): Component<ViewOut<VB, VS>> {
  return Component.of({behaviors, streams});
}

/**
 * Something resembling the monadic fixpoint combinatior for Now.
 */
export function mfixNow<VB extends ViewBehaviors, VS extends ViewStreams>(
  comp: (v: [ViewOut<VB, VS>, Node[]]) => Now<[ViewOut<VB, VS>, Node[]]>
): Now<[ViewOut<VB, VS>, Node[]]> {
  const fakeBehaviors: any = [sink(""), sink({}), sink({}), sink({})];
  const fakeStreams: any = [empty(), empty(), empty(), empty()];
  return comp([{behaviors: fakeBehaviors, streams: fakeStreams}, []])
    .map((arg) => {
      const [{behaviors}, _] = arg;
      // Let's tie the recursive knot
      for (let i = 0; i < behaviors.length; ++i) {
        behaviors[i].listen(fakeBehaviors[i]);
      }
      return arg;
  });
}

function runComponent<A>(c: Component<A>): Now<[A, Node[]]> {
  return c.content;
}

export function component<M, VB extends ViewBehaviors, VS extends ViewStreams>({model, view}: {
  model: (v: ViewOut<VB, VS>) => Now<M>,
  view: (m: M) => Component<ViewOut<VB, VS>>
}): Component<ViewOut<VB, VS>> {
  return new Component(mfixNow<VB, VS>(
    ([v, _]) => model(v).chain((m: M) => runComponent(view(m)))
  ));
}

export function runMain(selector: string, c: Component<any>): void {
  const element = document.querySelector(selector);
  runNow(runComponent(c).map(([whut, nodes]) => {
    for (const node of nodes) {
      element.appendChild(node);
    }
    console.log(whut);
    console.log(nodes);
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
    elm.nodeValue = B.at(tOrB).toString();
    subscribe((t) => elm.nodeValue = t.toString(), tOrB);
  }
  return Component.fromPair({}, [elm]);
}
