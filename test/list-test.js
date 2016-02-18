var test = require('tape').test
  , List = require('../')

function setup () {
  var container = document.createElement('div')

  container.className = 'container'
  container.style.height = '700px'
  container.style['margin-top'] = '100px'
  container.style['margin-left'] = '50px'

  container.innerHTML = '<ul>' +
                          '<li style="height: 50px;">KPI Dashboards</li>' +
                          '<li style="height: 50px;">Mayberry</li>' +
                          '<li style="height: 200px;">Yummygum</li>' +
                          '<li style="height: 50px;">Spider Strategies</li>' +
                        '</ul>'

  document.body.appendChild(container)

  return container
}

function trigger (node, type, opts) {
  opts = opts || {}
  var e = document.createEvent('Event')
  for (var arg in opts) {
    e[arg] = opts[arg]
  }
  e.initEvent(type, true, true)
  node.dispatchEvent(e)
}

test('creates the traveler', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , mover = container.querySelector('ul li:nth-child(2)')

  trigger(mover, 'mousedown')

  t.equal(container.querySelectorAll('ul li').length, 5, '5 total nodes') // normal number + 1

  var traveler = container.querySelector('ul li:nth-child(5)')
  t.equal(traveler.className, 'traveler', 'last node is the traveler')
  t.equal(traveler.style.position, 'absolute', 'traveler has absolute positioning')
  t.equal(traveler.style.top, '50px', 'traveler top set')
  t.equal(traveler.style.height, '50px', 'traveler height set')
  t.equal(traveler.style.width, '701px', 'traveler width set')
  t.equal(traveler.innerHTML, 'Mayberry', 'node contents set')

  container.remove()
  t.end()
})

test('moves a node within the list\'s bounds', function (t) {
  var container = setup()
    , list = new List(container.querySelector('ul'))
    , mover = container.querySelector('ul li:nth-child(1)')

  trigger(mover, 'mousedown')

  t.equal(mover.className, 'placeholder', 'moved node has placeholder class')
  t.equal(container.querySelector('ul').children[0], mover, 'mover at index 0 of parent children')

  trigger(mover, 'mousemove', {
    clientX: 100,
    clientY: 10000 // Slam it
  })

  t.equal(container.querySelector('ul').children[3].innerHTML, mover.innerHTML, 'mover now at index 3 of parent children')
  t.equal(container.querySelector('ul li:nth-child(5)').style.top, '300px', 'traveler top set')

  setTimeout(function () {
    trigger(mover, 'mousemove', {
      clientX: 100,
      clientY: -10000 // unslam it
    })
    t.equal(container.querySelector('ul').children[0].innerHTML, mover.innerHTML, 'mover now at index 0 of parent children')
    t.equal(container.querySelector('ul li:nth-child(5)').style.top, '0px', 'traveler top set')

    container.remove()
    t.end()
  }, 300)
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
  trigger(li, 'mousemove')
  trigger(window, 'keydown', {
    keyCode: 27
  })
  trigger(li, 'mousedown')
  trigger(li, 'mouseup')

  t.equal(calls, 4, '4 events emitted')

  container.remove()
  t.end()
})
