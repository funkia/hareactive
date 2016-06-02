import {map} from '../../src/Observable';
import {h} from '../../src/DOMBuilder';
import run from '../../src/run';


const app = (input$) => {

  var inputOn;

  const DOM = h('div', [
    h('label', ['Name: ']),
    h('br'),
    h('span','Hello '), h('span', input$),
    h('h1', [
      {on: inputOn} = h('input'),
      input$
    ])
  ]);


  const inputEvent$ = inputOn('input');
  input$.def = map(ev => ev.target.value, inputEvent$);

  return DOM;
};

run('body', app);
