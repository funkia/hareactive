import {
  AbstractEvents, Events, publish
} from "./Events";
import * as B from "./Behavior";
import {Behavior, at} from "./Behavior";

type Children = (Behavior<string|number|Component> | string | Component)[]

export interface Component {
  elm: HTMLElement;
  event: EventTable;
};

function isComponent(obj: any): boolean {
  return obj instanceof Object && obj.hasOwnProperty("elm");
}

interface EventTable {
  [index: string]: Events<any>;
}

function createElement(tag: string): HTMLElement {
  const parsedTag = tag.match(/[.#]?\w+/g);
  const elm = document.createElement(parsedTag[0]);

  for (let i = 1; i < parsedTag.length; i++) {
    let classOrId = parsedTag[i];
    let name = classOrId.substring(1, classOrId.length);
    if (classOrId[0] === "#") {
      elm.setAttribute("id", name);
    } else if (classOrId[0] === ".") {
      elm.classList.add(name);
    }
  }
  return elm;
}

export function h(tag: string, children: Children = []): Component {
  const elm = createElement(tag);
  const event: EventTable = {};

  const childrenLength = children.length;
  for (let i = 0; i < childrenLength; i++) {
    let ch = children[i];

    if (B.isBehavior(ch)) {
      let node: Node;
      const initial = at(ch);

      if (isComponent(initial)) {
        node = (<Component>initial).elm;
      } else {
        node = document.createTextNode("");
        node.nodeValue = initial.toString();
      }
      elm.appendChild(node);

      if (ch.pushing === true) {
        B.subscribe((t: any) => {
          if (isComponent(t)) {
            const currentChild = elm.childNodes[i];
            if (currentChild !== undefined) {
              elm.replaceChild(t.elm, currentChild);
            }
          } else {
            node.nodeValue = t.toString();
          }

        }, ch);

      } else {
        // quick hack below
        const sampleFn = () => {
          const newVal = at(ch);
          node.nodeValue = newVal.toString();
          window.requestAnimationFrame(sampleFn);
        };
        window.requestAnimationFrame(sampleFn);
      }

    } else if (typeof ch === "string") {
      elm.appendChild(document.createTextNode(ch));

    } else {
      elm.appendChild(ch.elm);
    }
  }

  return {elm, event};
}

export function on(eventName: string, comp: Component): Events<any> {
  let {elm, event} = comp;

  if (event[eventName]) {
    return event[eventName];
  } else {
    const event$ = new Events();
    elm.addEventListener(eventName, (ev) => publish(ev, event$));
    event[eventName] = event$;
    return event$;
  }
}

// Beware: ugly component implementations below

export interface InputComponent extends Component {
  inputValue: Behavior<string>;
}

export function input(): InputComponent {
  const elm = document.createElement("input");
  return {
    elm,
    event: {},
    get inputValue(): Behavior<string> {
      const newB = B.sink("");
      elm.addEventListener(
        "input",
        (ev: any) => B.publish(ev.target.value, newB)
      );
      return newB;
    }
  };
}

export interface ButtonComponent extends Component {
  click: AbstractEvents<number>;
}

export function button(text: string): ButtonComponent {
  const elm = document.createElement("button");
  elm.textContent = text;
  return {
    elm,
    event: {},
    get click(): AbstractEvents<number> {
      const ev = new Events<number>();
      elm.addEventListener(
        "click",
        () => publish(0, ev)
      );
      return ev;
    }
  };
}

export function br(): Component {
  return h("br");
}
