var d3 = require('d3')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')

var clamp = function (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

var _createTraveler = function (source, parent) {
  var traveler = source.cloneNode(true)

  d3.select(traveler)
    .classed('traveler', true)
    .classed('placehoder', false)
    .style('top', source.offsetTop + 'px')
    .style('width', d3.select(source).style('width'))
    .style('height', d3.select(source).style('height'))
    .style('position', 'absolute')
    .style('z-index', 1000)
    .style('pointerEvents', 'none')

  parent.appendChild(traveler)

  return traveler
}

function animate (prevRect, target) {
  var currentRect = target.getBoundingClientRect()
    , ms = 250

  d3.select(target)
    .style('transition', 'none')
    .style('transform', 'translate(0px,'+ (prevRect.top - currentRect.top) + 'px)')

  target.offsetWidth // trigger reflow

  d3.select(target)
    .style('transition', 'transform ' + ms + 'ms')
    .style('transform', 'translate(0,0)')

  clearTimeout(target.animated)
  target.animated = setTimeout(function () {
    d3.select(target)
      .style('transition', '')
      .style('transform', '')
    target.animated = false
  }, ms)
}

var List = function (container) {
  var ul = d3.select(container)
    , self = this
    , parent = ul.node()
    , drag = d3.behavior.drag()

  drag.on('dragstart', function () {
    var start = Array.prototype.slice.call(parent.children).indexOf(this)
      , node = this
    d3.select(this)
      .classed('placehoder', true)
      .property('__startIndex__', start)

    _createTraveler(this, parent)
    self.emit('dndstart')

    d3.select(window)
      .on('keydown.dnd-escape', function () {
         // If it's the escape, then cancel
        if (d3.event.keyCode === 27) {
          self.emit('dndcancel')
          move(node, parent.children[start])
          cleanup(node)
        }
      })
  })

  drag.on('drag', function () {
    var bb = this.getBoundingClientRect()
      , lowerBound = parent.offsetHeight + parent.scrollTop - bb.height
      , y = clamp(d3.event.y - bb.height / 2, 0, lowerBound) // Top of the moving node

    // Reposition the traveling node
    d3.select('.traveler', parent)
      .style('top', y + 'px')
      .style('display', 'none') // Hide it so we can get the node under the traveler

    var target = document.elementFromPoint(bb.left, y + parent.offsetTop + bb.height / 2)

    d3.select('.traveler', parent)
      .style('display', '') // Show it again

    var targetRect = target.getBoundingClientRect()
      , targetMiddle = target.offsetTop + targetRect.height / 2
      , mouseDelta = Math.abs(targetMiddle - (y + bb.height / 2))

    if (mouseDelta / targetMiddle > .1) {
      // Too far away, carry on
      return
    }

    move(this, target)
  })

  drag.on('dragend', function () {
    var startIndex = d3.select(this).property('__startIndex__')
      , newIndex = Array.prototype.slice.call(parent.children).indexOf(this)

    if (newIndex !== startIndex) {
      self.emit('move', this, newIndex, startIndex)
    }
    cleanup(this)
    self.emit('dndstop')
  })

  function move (node, target) {
    var currentIndex = Array.prototype.slice.call(parent.children).indexOf(node)
      , targetIndex = Array.prototype.slice.call(parent.children).indexOf(target)
      , bb = node.getBoundingClientRect()
      , targetBb = target.getBoundingClientRect()

    if (target.animated) {
      // already working
      return
    }

    if (targetIndex == -1) {
      // Not on a real node, carry on
      return
    }

    if (currentIndex === targetIndex) {
      // Same node, carry on
      return
    }

    if (currentIndex > targetIndex) {
      // Sliding current node up
      parent.insertBefore(node, target)
      animate(bb, node)
      animate(targetBb, target)
    } else if (currentIndex < targetIndex) {
      // slide current node down
      parent.insertBefore(node, target.nextSibling)
      animate(bb, node)
      animate(targetBb, target)
    }
  }

  function cleanup (node) {
    d3.select(window).on('keydown.dnd-escape', null)
    d3.select(node).classed('placehoder', false)
                   .property('__startIndex__', null)
    d3.selectAll('.traveler', parent).remove()
  }

  ul.selectAll('li')
    .call(drag)
}

util.inherits(List, EventEmitter)

module.exports = List
