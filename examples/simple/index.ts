import {Observable, map} from '../../src/Observable';
import {h} from '../../src/DOMBuilder';
import run from '../../src/run';


const app = (input$: Observable<string>) => {
  let inputOn;

  const DOM = h('div', [
    h('span', ['Hello ']), h('span', [input$]),
    h('br'),
    h('label', ['Name: ']),
    {on: inputOn} = h('input')
  ]);

  const inputEvent$ = inputOn('input');
  input$.def = map(ev => ev.target.value, inputEvent$);

  return DOM;
};

run('body', app);

