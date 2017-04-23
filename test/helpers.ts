import { spy } from "sinon";

import { Behavior } from "../src/behavior";

export function subscribeSpy(b: Behavior<any>): sinon.SinonSpy {
  const cb = spy();
  b.subscribe(cb);
  return cb;
}
