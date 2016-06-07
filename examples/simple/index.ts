import {Behavior} from "../../src/Behavior";
import {h, input, br} from "../../src/DOMBuilder";
import run from "../../src/run";

function app(input$: Behavior<string>) {
  return h("div", [
    h("span", ["Hello "]), h("span", [input$]),
    br(),
    h("label", ["Name: "]),
    {inputValue: input$.def} = input()
  ]);
}

run("body", app);
