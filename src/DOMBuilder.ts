import {
  Events, publish, empty
} from "./Events";
import * as B from "./Behavior";
import {Behavior, at} from "./Behavior";

type Children = (Behavior<string|number|Component|Component[]> | string | Component)[]

export interface Component {
  elm: HTMLElement;
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

interface Properties {
  on?: EventTable;
}

export function h(
  tag: string,
  props?: Properties|Children,
  children?: Children
): Component {

  switch (arguments.length) {

  case 1:
    return createComponent(tag, {}, []);

  case 2:
    if (Array.isArray(props)) {
      return createComponent(tag, {}, (<Children>props));
    } else if (props instanceof Object) {
      return createComponent(tag, (<Properties>props), []);
    }
  default:
    return createComponent(tag, props, children);
  }
};

export function createComponent(
  tag: string,
  props: Properties,
  children: Children
): Component {

  // Create Element with id and classes
  const elm = createElement(tag);

  // Events
  for (const eventName in props.on) {
    elm.addEventListener(eventName, (ev) => props.on[eventName].publish(ev));
  }

  // Initialize children
  const childrenLength = children.length;
  for (let i = 0; i < childrenLength; i++) {
    let ch = children[i];

    if (B.isBehavior(ch)) {
      let node: Node;
      let nodes: Node[] = [];
      const initial = at(ch);

      if (Array.isArray(initial)) {
        for (const {elm: n} of initial) {
          nodes.push(n);
          elm.appendChild(n);
        }
      } else {
        if (isComponent(initial)) {
          node = (<Component>initial).elm;
        } else {
          node = document.createTextNode("");
          node.nodeValue = initial.toString();
        }
        elm.appendChild(node);
      }

      if (ch.pushing === true) {
        B.subscribe((t: any) => {
          if (isComponent(t)) {
            elm.replaceChild(t.elm, node);
            node = t.elm;
          } else if (Array.isArray(t)) {
            // huge hack, slow, buggy
            for (const n of nodes) {
              elm.removeChild(n);
            }
            nodes = [];
            for (const {elm: n} of t) {
              nodes.push(n);
              elm.appendChild(n);
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

    } else if (isComponent(ch)) {
      elm.appendChild((<Component>ch).elm);

    } else {
      elm.appendChild(document.createTextNode(ch.toString()));

    }
  }

  return {elm};
}

// export function on(eventName: string, comp: Component): Events<any> {
//   let {elm, event} = comp;

//   if (event[eventName]) {
//     return event[eventName];
//   } else {
//     const event$ = new Events();
//     elm.addEventListener(eventName, (ev) => publish(ev, event$));
//     event[eventName] = event$;
//     return event$;
//   }
// }

// Beware: ugly component implementations below

export interface InputComponent extends Component {
  inputValue: Behavior<string>;
}

export function input(): InputComponent {
  const elm = document.createElement("input");
  return {
    elm,
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
  click: Events<number>;
}

export function button(text: string): ButtonComponent {
  const elm = document.createElement("button");
  elm.textContent = text;
  return {
    elm,
    get click(): Events<number> {
      const ev = empty<number>();
      elm.addEventListener(
        "click",
        () => publish(0, ev)
      );
      return ev;
    }
  };
}

export function br(): Component {
  return {
    elm: document.createElement("br")
  };
}
