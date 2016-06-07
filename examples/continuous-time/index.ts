// import {Behavior} from "../../src/Behavior";
import {Component, h} from "../../src/DOMBuilder";
import run from "../../src/run";
import timeB from "../../src/timeB";

function app(): Component {
  return h("div", [
    h("span", ["Current time is: "]), h("span", [timeB])
  ]);
}

run("body", app);
