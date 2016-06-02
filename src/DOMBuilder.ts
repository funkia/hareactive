import {Observable, publish, subscribe, isObservable} from './Observable'

type Children = any[] | string

export const h = (tag: string, children: Children = [], events = []): any => {
  const elm = document.createElement(tag);

  [].concat(children).forEach((ch) => {

    if (isObservable(ch)) {
      const text = document.createElement("span");
      subscribe((t) => text.innerText = t, ch);
      elm.appendChild(text);
    } else {
      elm.appendChild(
      (typeof ch === "string") ?document.createTextNode(ch) : ch.elm)

  }});

  var observables = {};
  [].concat(events).forEach(eventname => {
    const value = Observable();
    elm.addEventListener('input', (ev: any) => publish(ev.target.value, value))
    observables[eventname] = value;
  });
  return {elm, events: observables};
};
