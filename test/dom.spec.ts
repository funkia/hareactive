import { streamFromEvent } from "../src/dom";
import "mocha";
import { assert } from "chai";
import * as browserEnv from "browser-env";

browserEnv();

describe("dom", () => {
  describe("streamFromEvent", () => {
    it("has occurrence on event", () => {
      const div = document.createElement("div");
      const s = streamFromEvent("click", div);
      const result = [];
      s.subscribe((ev) => result.push(ev));
      const event = new MouseEvent("click", {
        view: window
      });
      div.dispatchEvent(event);
      div.dispatchEvent(event);
      div.dispatchEvent(event);
      assert.strictEqual(result.length, 3);
    });
    it("applies extractor to event", () => {
      const input = document.createElement("input");
      const s = streamFromEvent(
        "input", input, (e, elm) => ({ bubbles: e.bubbles, value: elm.value })
      );
      const result = [];
      s.subscribe((ev) => result.push(ev));
      const event = new Event("input");
      input.dispatchEvent(event);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].bubbles, false);
      assert.strictEqual(result[0].value, "");
    });
  });
});