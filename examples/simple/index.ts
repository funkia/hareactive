import {Do} from "jabz/monad";

import {Behavior} from "../../src/Behavior";
import {Stream} from "../../src/Stream";
import {Now} from "../../src/Now";

import {
  Component, component, runMain, span, input, br, text, viewOut
} from "../../src/framework";

const isValidEmail = (s: string) => s.match(/.+@.+\..+/i);

const getLength = (s: string) => s.length;

type Model = {
  validB: Behavior<boolean>,
  lengthB: Behavior<number>
};

type ViewBehaviors = [Behavior<string>];
type ViewStreams = Stream<any>[];

const main = component<Model, ViewBehaviors, ViewStreams>({
  model({behaviors: [emailB]}: {behaviors: Behavior<string>[]}) {
    return Do(function*(): Iterable<Now<any>> {
      return Now.of({
        validB: emailB.map(isValidEmail),
        lengthB: emailB.map(getLength)
      });
    });
  },
  view({validB, lengthB}) {
    return Do(function*(): Iterable<Component<any>> {
      yield span("Please enter an email address:")
      const {inputValue: emailB} = yield input();
      yield br();
      yield text("The length of the email is "),
      yield text(lengthB),
      yield br();
      yield text("The address is ");
      yield text(validB.map(t => t ? "valid" : "invalid"));
      return viewOut([emailB], []);
    });
  }
});

// `runMain` should be the only impure function in application code
runMain("body", main);
