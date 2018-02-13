var d3drag = require('d3-drag')
  , d3 = require('d3-selection')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')

var clamp = function (value, min, max) {
  return Math.min(Math.max(value, min), max)
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

function dnd (container) {
  var ul = d3.select(container)
             .style('position', 'relative') // needed for dnd to work
             .classed('draggable-list', true)
    , self = this
    , parent = ul.node()
    , drag = d3drag.drag()
                   .filter(function () {
                     var nodrag = d3.select(d3.event.target).classed('draggable-list-nodrag') || // check target node
                                  d3.select(this).classed('draggable-list-nodrag') // check `li` element
                       , p = d3.event.target.parentNode

                     // walk tree between target and list element seeing if there is a nodrag along the way
                     while (d3.event.target !== this && p && p !== this && !nodrag) {
                       if (d3.select(p).classed('draggable-list-nodrag')) {
                         nodrag = true
                       }
                       p = p.parentNode
                     }

                     return !d3.event.button && // prevent right clicks
                            !nodrag

                   })
    , travelerTimeout = null
    , dragging = false

  drag.on('start', function () {
    var start = Array.prototype.slice.call(parent.children).indexOf(this)
      , node = this

    d3.select(this).property('__startIndex__', start)
    travelerTimeout = setTimeout(dndstart.bind(null, this, parent), 300)

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
    if (!dragging) {
      dndstart(this, parent)
      clearTimeout(travelerTimeout)
      dragging = true
    }

    var bb = this.getBoundingClientRect()
      , containerBottom = parent.offsetHeight + parent.scrollTop
      , lowerBound = containerBottom - bb.height / 2
      , top = clamp(d3.event.y - bb.height / 2, -(bb.height / 2), lowerBound) // Top of the moving node
      , y = top + parent.getBoundingClientRect().top + bb.height / 2
      , x = Math.ceil(bb.left) // Round up to ensure we're inside of the `li` node in case a browser rounds down
                              // the `elementFromPoint` call.

    // Reposition the traveling node
    d3.select('.traveler', parent)
      .style('top', top + 'px')
      .style('display', 'none') // Hide it so we can get the node under the traveler

    var target = document.elementFromPoint(x, y)

    d3.select('.traveler', parent)
      .style('display', '') // Show it again

    if (!target) {
      // We don't have a place to drop this node that's in the ul
      return
    }

    var targetRect = target.getBoundingClientRect()
      , targetMiddle = target.offsetTop + targetRect.height / 2
      , mouseDelta = Math.abs(targetMiddle - (top + bb.height / 2))
      , mouseOutside = d3.event.y < 0 || d3.event.y > containerBottom

    if (mouseDelta / targetMiddle > .1 && !mouseOutside) {
      // Too far away, carry on
      return
    }

    move(this, target)
  })

  drag.on('end', function () {
    if (travelerTimeout) {
      window.clearTimeout(travelerTimeout)
    }

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

  function dndstart (source, parent) {
    if (d3.select('.traveler', parent).size()) {
      // Already created
      return
    }

    var traveler = source.cloneNode(true)

    d3.select(source)
      .classed('placeholder', true)

    d3.select(traveler)
      .classed('traveler', true)
      .style('top', source.offsetTop + 'px')
      .style('width', d3.select(source).style('width'))
      .style('height', d3.select(source).style('height'))
      .style('position', 'absolute')
      .style('z-index', 1000)
      .style('pointerEvents', 'none')

    parent.appendChild(traveler)

    self.emit('dndstart')
    ul.classed('is-dragging', true)

    return traveler
  }

  function cleanup (node) {
    dragging = false
    ul.classed('is-dragging', false)
    d3.select(window).on('keydown.dnd-escape', null)
    d3.select(node).classed('placeholder', false)
                   .property('__startIndex__', null)
    d3.selectAll('.traveler', parent).remove()
  }

  ul.selectAll('ul.draggable-list > li')
    .call(drag)
    .filter(function (d, i, all) {
      return all.length === 1
    })
    .classed('draggable-list-nodrag', true)
}

var List = function (selection) {
  if (this instanceof List) {
    dnd.call(this, selection)
    return this
  } else if (selection instanceof d3.selection) {
    selection.each(function () {
      dnd.call(new EventEmitter, this)
    })
  }
}

util.inherits(List, EventEmitter)

module.exports = List
