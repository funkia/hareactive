import {Observable, publish, subscribe, isObservable} from "./Observable";

type Children = Observable<string>[] | string[]

type Component = {
  elm: HTMLElement,
  on: (event: string) => Observable<any>
}

interface EventsTable {
  [index: string]: Observable<any>;
}

export const h = (tag: string, children: Children = []): Component => {
  const elm = document.createElement(tag);

  [].concat(children).forEach((ch) => {

    if (isObservable(ch)) {
      const text = document.createElement("span");
      subscribe((t: string) => text.innerText = t, ch);
      elm.appendChild(text);
    } else {
      elm.appendChild((typeof ch === "string") ? document.createTextNode(ch) : ch.elm);
    }
  });

  let events: EventsTable = {};

  const on = (eventname: string) => {
    if (events[eventname]) {
      return events[eventname];
    }

    const event$ = Observable();
    elm.addEventListener(eventname, (ev) => publish(ev, event$));
    events[eventname] = event$;
    return event$;
  };

  return {elm, on};
};
