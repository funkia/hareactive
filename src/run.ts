import {Observable} from './Observable'

type HasElement = {elm: HTMLElement}
type RenderFn = (...obs: Observable<any>[]) => HasElement

export default (sel: string, render: RenderFn) => {
  let initialObservables: Observable<any>[] = []
  for (let i = 0; i < render.length; ++i) {
    initialObservables.push(Observable())
  }
  const {elm} = render(...initialObservables)
  document.querySelector(sel).appendChild(elm)
}
