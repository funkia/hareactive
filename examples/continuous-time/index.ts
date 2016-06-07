import {stepper} from "../../src/Behavior";
import {AbstractEvents, Events, snapshotWith, map} from "../../src/Events";
import {Component, h, button, br} from "../../src/DOMBuilder";
import run from "../../src/run";
import timeB from "../../src/timeB";

function app(): Component {

  const btnClick = new Events();

  const messageFromClick =
    snapshotWith((_, t) => "You last pressed the button at " + t.toString(), timeB, btnClick);
  const clickTimeMessage = stepper("You've not clicked the button yet", messageFromClick);

  return h("div", [
    h("span", ["Current time is: ", timeB.map((dateNumber) => new Date(dateNumber).getSeconds())]),
    br(),
    br(),
    {click: btnClick.def} = button("Click me"),
    br(),
    br(),
    h("span", [clickTimeMessage])
  ]);

}

run("#mount", app);
