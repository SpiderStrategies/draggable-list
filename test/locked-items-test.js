import { test } from 'tape'
import List from '../'
import * as d3 from 'd3-selection'
import {setup, trigger} from './test-util.js'

test('all nodes locked', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , li = container.querySelectorAll('li')
    , mover = container.querySelector('ul li:nth-child(1)')
    , expected = [...li].map(node => node.innerText)

  li.forEach(node => node.classList.add('draggable-list-lock'))

  trigger(mover, 'mousedown')
  trigger(mover, 'mousemove', {
    clientX: 100,
    clientY: 300 // Slide down
  })
  trigger(mover, 'mouseup')

  t.deepEqual([...container.querySelectorAll('li')].map(node => node.innerText), expected, 'node order unchanged')

  container.remove()
  t.end()
})

test('nodes can move around locked nodes', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , li = container.querySelectorAll('li')
    , mover = container.querySelector('ul li:nth-child(1)')

  container.querySelector('ul li:nth-child(2)').classList.add('draggable-list-lock')

  trigger(mover, 'mousedown')
  trigger(mover, 'mousemove', {
    clientX: 100,
    clientY: 320 // All the way to bottom
  })
  trigger(mover, 'mouseup')

  t.equal(container.querySelector('li:nth-child(1)').innerText, 'Yummygum', '3rd item is now first')
  t.equal(container.querySelector('li:nth-child(2)').innerText, 'Mayberry', 'Mayberry did not move')
  t.equal(container.querySelector('li:nth-child(3)').innerText, mover.innerText, '1st item is now third')

  container.remove()
  t.end()
})
