import {Events, map} from "../../src/Events";
import {h} from "../../src/DOMBuilder";
import run from "../../src/run";

const app = (input$: Events<string>) => {
  let inputOn: ((eventName: string) => Events<any>);

  const DOM = h("div", [
    h("span", ["Hello "]), h("span", [input$]),
    h("br"),
    h("label", ["Name: "]),
    {on: inputOn} = h("input")
  ]);

  const inputEvent$ = inputOn("input");
  input$.def = map((ev) => ev.target.value, inputEvent$);

  return DOM;
};

run("body", app);
