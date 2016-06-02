import {h} from '../../src/DOMBuilder'
import run from '../../src/run'

const app = (input) =>
  h('div',[
    h('label', ['Name: ']),
    h('br'),
    h('span', 'Hello'), h('span', input),
    h('h1', [
      {events: {input: input.def}} = h('input',[],['input']),
      input
    ])
  ]);

run('body', app)
