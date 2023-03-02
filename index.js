import * as d3drag from 'd3-drag'
import * as d3 from 'd3-selection'
import { EventEmitter } from 'events'
import util from 'util'

const clamp = function (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function animate (prevRect, target) {
  let currentRect = target.getBoundingClientRect()
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
  let ul = d3.select(container)
             .style('position', 'relative') // needed for dnd to work
             .classed('draggable-list', true)
    , self = this
    , parent = ul.node()
    , drag = d3drag.drag()
                   .filter(function (e) {
                     let nodrag = d3.select(e.target).classed('draggable-list-nodrag') || // check target node
                                  d3.select(this).classed('draggable-list-nodrag') || // check `li` element can be dragged
                                  d3.select(this).classed('draggable-list-lock') // Make sure item isn't locked

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
    , _autoscrollTimeout

  drag.on('start', function () {
    let start = Array.prototype.slice.call(parent.children).indexOf(this)
      , node = this

    d3.select(this).property('__startIndex__', start)
    travelerTimeout = setTimeout(dndstart.bind(null, this, parent), 300)

    d3.select(window)
      .on('keydown.dnd-escape', function (e) {
         // If it's the escape, then cancel
        if (e.keyCode === 27) {
          self.emit('dndcancel')
          rearrange(node, parent.children[start])
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

    _autoscroll(this, e.y)
    _move(this, e.y)
  })

  drag.on('end', function () {
    if (travelerTimeout) {
      window.clearTimeout(travelerTimeout)
    }

    let startIndex = d3.select(this).property('__startIndex__')
      , newIndex = Array.prototype.slice.call(parent.children).indexOf(this)

    if (newIndex !== startIndex) {
      self.emit('move', this, newIndex, startIndex)
    }
    cleanup(this)
    self.emit('dndstop')
  })

  function _autoscroll (node, y) {
    if (_autoscrollTimeout) {
      // Prevent race conditions
      window.clearTimeout(_autoscrollTimeout)
      _autoscrollTimeout = null
    }

    if (!dragging || !scrollEl) {
      return
    }

    let threshold = 30
      , pixels = 10

    if (y - threshold <= scrollEl.scrollTop) {
      scroll(-pixels) // Scroll up
    }

    if (y + threshold >= scrollEl.scrollTop + scrollEl.offsetHeight) {
      scroll(pixels) // Scroll down
    }

    function scroll (pixels) {
      scrollEl.scrollTop += pixels
      y += pixels

      _move(node, y)

      _autoscrollTimeout = setTimeout(function () {
        _autoscroll(node, y)
      }, 10)
    }
  }

  function _move (node, y) {
    let bb = node.getBoundingClientRect()
      , containerBottom = parent.offsetHeight + parent.scrollTop
      , lowerBound = containerBottom - bb.height / 2
      , top = clamp(y - bb.height / 2, -(bb.height / 2), lowerBound) // Top of the moving node
      , newY = top + parent.getBoundingClientRect().top + bb.height / 2
      , x = Math.ceil(bb.left) // Round up to ensure we're inside of the `li` node in case a browser rounds down
                              // the `elementFromPoint` call.

    // Reposition the traveling node
    d3.select('.traveler', parent)
      .style('top', top + 'px')
      .style('display', 'none') // Hide it so we can get the node under the traveler

    let target = document.elementFromPoint(x, newY)

    d3.select('.traveler', parent)
      .style('display', '') // Show it again

    if (!target) {
      // We don't have a place to drop this node that's in the ul
      return
    }

    let targetRect = target.getBoundingClientRect()
      , targetMiddle = target.offsetTop + targetRect.height / 2
      , mouseDelta = Math.abs(targetMiddle - (top + bb.height / 2))
      , mouseOutside = newY < 0 || newY > containerBottom

    if (mouseDelta / targetMiddle > .1 && !mouseOutside) {
      // Too far away, carry on
      return
    }

    rearrange(node, target)
  }

  /*
   * Actually performs the operation that moves the nodes in the DOM
   */
  function _moveAndAnimate (node, referenceNode, target) {
    let bb = node.getBoundingClientRect()
      , targetBb = target.getBoundingClientRect()

    parent.insertBefore(node, referenceNode)
    animate(bb, node)
    animate(targetBb, target)
  }

  /*
   * Rearranges the nodes
   */
  function rearrange (node, target) {
    let nodes = Array.prototype.slice.call(parent.children)
      , currentIndex = nodes.indexOf(node)
      , targetIndex = nodes.indexOf(target)

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
      _moveAndAnimate(node, target, target)
    } else if (currentIndex < targetIndex) {
      // slide current node down
      _moveAndAnimate(node, target.nextSibling, target)
    }
  }

  function dndstart (source, parent) {
    if (d3.select('.traveler', parent).size()) {
      // Already created
      return
    }

    const traveler = source.cloneNode(true)

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
const List = function (selection, options) {
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
