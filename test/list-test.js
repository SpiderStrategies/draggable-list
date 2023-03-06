import { test } from 'tape'
import List from '../'
import * as d3 from 'd3-selection'
import {setup, trigger} from './test-util.js'

test('works as a call with d3', function (t) {
  var container = setup()
    , mover = container.querySelector('ul li:nth-child(2)')

  d3.selectAll('ul')
    .call(List)

  trigger(mover, 'mousedown')
  trigger(mover, 'mousemove', {
    clientX: 100,
    clientY: 10000 // Slam it
  })

  t.equal(mover.className, 'placeholder', 'moved node has placeholder class')
  t.equal(container.querySelector('ul').children[4].innerHTML, mover.innerHTML, 'mover now at index 4 of parent children')
  t.equal(container.querySelector('ul li:nth-child(5)').style.top, '325px', 'traveler top set')

  trigger(mover, 'mouseup')
  container.remove()
  t.end()
})

test('prevent dnd if only one li', function (t) {
  var container = document.createElement('div')
  container.innerHTML = '<ul>' +
                          '<li style="height: 50px;">KPI Dashboards</li>' +
                        '</ul>'

  var ul = container.querySelector('ul')
    , list = new List(ul)
  t.ok(ul.querySelector('li').className, 'draggable-list-nodrag', 'nodrag class set')
  container.remove()
  t.end()
})

test('allows inner elements to have click events', function (t) {
  var container = setup()
    , link = document.createElement('a')
    , li = container.querySelector('ul li:nth-child(2)')

  link.addEventListener('click', function (e) {
    container.remove()
    t.end()
  })
  link.innerHTML = 'Clickable link'

  li.appendChild(link)

  var list = new List(container.querySelector('ul'))

  // Simulate the natural sequence
  trigger(link, 'mouseover')
  trigger(link, 'mousedown')
  trigger(link, 'mouseup')
  trigger(link, 'click')
})

test('nodrag prevents dnd', function (t) {
  var container = setup()
    , li = container.querySelector('ul li:nth-child(2)')

  li.className = 'draggable-list-nodrag'

  var ul = container.querySelector('ul')
    , list = new List(ul)

  t.ok(!d3.select(ul).classed('is-dragging'), 'ul does not have `is-dragging` css class')

  trigger(li, 'mousedown')
  trigger(li, 'mousemove', {
    clientX: 100,
    clientY: 100
  })
  t.ok(!d3.select(ul).classed('is-dragging'), 'ul still does not have `is-dragging` css class')
  trigger(li, 'mouseup')
  trigger(li, 'click')
  container.remove()
  t.end()
})

test('inner elements container can prevent dnd', function (t) {
  var container = setup()
    , div = document.createElement('div')
    , nodrag = document.createElement('span')
    , li = container.querySelector('ul li:nth-child(2)')

  div.className = 'draggable-list-nodrag'
  nodrag.innerHTML = 'cannot drag this span'

  div.appendChild(nodrag)
  li.appendChild(div)

  var ul = container.querySelector('ul')
    , list = new List(ul)

  t.ok(!d3.select(ul).classed('is-dragging'), 'ul does not have `is-dragging` css class')

  trigger(nodrag, 'mousedown')
  trigger(nodrag, 'mousemove', {
    clientX: 100,
    clientY: 100
  })
  t.ok(!d3.select(ul).classed('is-dragging'), 'ul still does not have `is-dragging` css class')
  trigger(nodrag, 'mouseup')
  trigger(nodrag, 'click')
  container.remove()
  t.end()
})

test('inner elements can prevent dnd', function (t) {
  var container = setup()
    , nodrag = document.createElement('div')
    , li = container.querySelector('ul li:nth-child(2)')

  nodrag.className = 'draggable-list-nodrag'
  nodrag.innerHTML = 'cannot drag this span'

  li.appendChild(nodrag)

  var ul = container.querySelector('ul')
    , list = new List(ul)

  t.ok(!d3.select(ul).classed('is-dragging'), 'ul does not have `is-dragging` css class')

  trigger(nodrag, 'mousedown')
  trigger(nodrag, 'mousemove', {
    clientX: 100,
    clientY: 100
  })
  t.ok(!d3.select(ul).classed('is-dragging'), 'ul still does not have `is-dragging` css class')
  trigger(nodrag, 'mouseup')
  trigger(nodrag, 'click')
  container.remove()
  t.end()
})

test('applies dragging class during drag', function (t) {
  var container = setup()
    , ul = container.querySelector('ul')
    , list = new List(ul)
    , mover = container.querySelector('ul li:nth-child(1)')

  t.ok(!d3.select(ul).classed('is-dragging'), 'ul does not have `is-dragging` css class')

  trigger(mover, 'mousedown')
  trigger(mover, 'mousemove', {
    clientX: 100,
    clientY: 100
  })
  t.ok(d3.select(ul).classed('is-dragging'), 'ul has `is-dragging` css class')
  trigger(mover, 'mouseup')
  t.ok(!d3.select(ul).classed('is-dragging'), 'ul does not have `is-dragging` css class')

  container.remove()
  t.end()
})

test('creates the traveler', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , mover = container.querySelector('ul li:nth-child(2)')

  trigger(mover, 'mousedown')

  t.ok(!container.querySelector('ul li.traveler'), 'no traveler at first')

  setTimeout(function () {
    t.equal(container.querySelectorAll('ul li').length, 5, '5 total nodes') // normal number + 1
    var traveler = container.querySelector('ul li:nth-child(5)')
    t.equal(traveler.className, 'traveler', 'last node is the traveler')
    t.equal(traveler.style.position, 'absolute', 'traveler has absolute positioning')
    t.equal(traveler.style.top, '50px', 'traveler top set')
    t.equal(traveler.style.height, '50px', 'traveler height set')
    t.equal(traveler.style.width, '210px', 'traveler width set')
    t.equal(traveler.innerHTML, 'Mayberry', 'node contents set')
    trigger(mover, 'mouseup')

    container.remove()
    t.end()
  }, 400)
})

test('moves a node within the list\'s bounds', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , mover = container.querySelector('ul li:nth-child(1)')

  trigger(mover, 'mousedown')

  t.equal(container.querySelector('ul').children[0], mover, 'mover at index 0 of parent children')

  trigger(mover, 'mousemove', {
    clientX: 100,
    clientY: 10000 // Slam it
  })

  t.equal(mover.className, 'placeholder', 'moved node has placeholder class')
  t.equal(container.querySelector('ul').children[4].innerHTML, mover.innerHTML, 'mover now at index 4 of parent children')
  t.equal(container.querySelector('ul li:nth-child(5)').style.top, '325px', 'traveler top set')

  setTimeout(function () {
    trigger(mover, 'mousemove', {
      clientX: 100,
      clientY: -10000 // unslam it
    })

    t.equal(container.querySelector('ul').children[0].innerHTML, mover.innerHTML, 'mover now at index 0 of parent children')
    t.equal(container.querySelector('ul li:nth-child(5)').style.top, '-25px', 'traveler top set')

    trigger(mover, 'mouseup')
    container.remove()
    t.end()
  }, 100)
})

test('fires move events', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , mover = container.querySelector('ul li:nth-child(1)')

  list.on('move', function (node, newIndex, oldIndex) {
    t.deepEqual(node, mover)
    t.equal(2, newIndex, 'new index is 2')
    t.equal(0, oldIndex, 'old index is 0')
    container.remove()
    t.end()
  })

  trigger(mover, 'mousedown')
  trigger(mover, 'mousemove', {
    clientX: 110,
    clientY: 300
  })
  trigger(mover, 'mouseup')
})

test('fires dnd events', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , li = container.querySelector('ul li:nth-child(2)')
    , calls = 0

  list.on('dndstart', function () {
    calls++
  })

  list.on('dndcancel', function () {
    calls++
  })

  list.on('dndstop', function () {
    calls++
  })

  trigger(li, 'mousedown')
  trigger(li, 'mousemove', {
    clientX: 10,
    clientY: 10
  })
  trigger(window, 'keydown', {
    keyCode: 27
  })
  trigger(li, 'mousedown')

  // Wait for the start event to trigger from create traveler callback
  setTimeout(function () {
    trigger(li, 'mouseup')

    t.equal(calls, 4, '4 events emitted')

    container.remove()
    t.end()
  }, 350)

})
