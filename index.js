import * as d3drag from 'd3-drag'
import * as d3 from 'd3-selection'
import { EventEmitter } from 'events'
import util from 'util'

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

function dnd (container, options = {}) {
  var ul = d3.select(container)
             .style('position', 'relative') // needed for dnd to work
             .classed('draggable-list', true)
    , self = this
    , parent = ul.node()
    , drag = d3drag.drag()
                   .filter(function (e) {
                     var nodrag = d3.select(e.target).classed('draggable-list-nodrag') || // check target node
                                  d3.select(this).classed('draggable-list-nodrag') // check `li` element
                       , p = e.target.parentNode

                     // walk tree between target and list element seeing if there is a nodrag along the way
                     while (e.target !== this && p && p !== this && !nodrag) {
                       if (d3.select(p).classed('draggable-list-nodrag')) {
                         nodrag = true
                       }
                       p = p.parentNode
                     }

                     return !e.button && // prevent right clicks
                            !nodrag

                   })
    , travelerTimeout = null
    , dragging = false
    , scrollEl = options.scrollEl
    , stopScrolling = true

  drag.on('start', function () {
    var start = Array.prototype.slice.call(parent.children).indexOf(this)
      , node = this

    d3.select(this).property('__startIndex__', start)
    travelerTimeout = setTimeout(dndstart.bind(null, this, parent), 300)

    d3.select(window)
      .on('keydown.dnd-escape', function (e) {
         // If it's the escape, then cancel
        if (e.keyCode === 27) {
          self.emit('dndcancel')
          move(node, parent.children[start])
          cleanup(node)
        }
      })
  })

  drag.on('drag', function (e) {
    if (!dragging) {
      dndstart(this, parent)
      clearTimeout(travelerTimeout)
      dragging = true
    }

    var bb = this.getBoundingClientRect()
      , containerBottom = parent.offsetHeight + parent.scrollTop
      , lowerBound = containerBottom - bb.height / 2
      , top = clamp(e.y - bb.height / 2, -(bb.height / 2), lowerBound) // Top of the moving node
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

    // If a scrolling container is present, allow the list to scroll up/down
    // when dragging an item to the top or bottom of the scroll container
    if (scrollEl) {
      let scrollUp = top <= scrollEl.scrollTop
      let scrollDown = top + bb.height >= scrollEl.scrollTop + scrollEl.offsetHeight

      if (scrollUp) {
        scroll(-1) // Scroll up
        stopScrolling = false
      }

      if (scrollDown) {
        scroll(1) // Scroll down
        stopScrolling = false
      }

      if (!scrollUp && !scrollDown) {
        stopScrolling = true
      }
    }

    if (!target) {
      // We don't have a place to drop this node that's in the ul
      return
    }

    var targetRect = target.getBoundingClientRect()
      , targetMiddle = target.offsetTop + targetRect.height / 2
      , mouseDelta = Math.abs(targetMiddle - (top + bb.height / 2))
      , mouseOutside = e.y < 0 || e.y > containerBottom

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

  function scroll (step) {
    let scrollSpeed = 100
    let scrollY = scrollEl.scrollTop
    scrollEl.scrollTop = scrollY + step
    if (!stopScrolling && dragging) {
      setTimeout(function () { scroll(step) }, scrollSpeed)
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

/**
 * @constructs
 *
 * @param {Object} options
 *
 * @param {Object} [options.scrollEl] Element containing the list that allows
 * the list to scroll while dragging.
 *
 */
var List = function (selection, options) {
  if (this instanceof List) {
    dnd.call(this, selection, options)
    return this
  } else if (selection instanceof d3.selection) {
    selection.each(function () {
      dnd.call(new EventEmitter, this, options)
    })
  }
}

util.inherits(List, EventEmitter)

export default List
