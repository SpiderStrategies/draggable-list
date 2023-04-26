import * as d3drag from 'd3-drag'
import * as d3 from 'd3-selection'
import { EventEmitter } from 'events'
import util from 'util'

const clamp = function (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function animate (startingBB, node) {
  let endingBB = node.getBoundingClientRect()
    , ms = 250

  if (startingBB.top == endingBB.top) {
    // Same location, exit early
    return
  }

  d3.select(node)
    .style('transition', 'none')
    .style('transform', 'translate(0px,'+ (startingBB.top - endingBB.top) + 'px)')

  node.offsetWidth // trigger reflow

  d3.select(node)
    .style('transition', 'transform ' + ms + 'ms')
    .style('transform', 'translate(0,0)')

  clearTimeout(node.animated)
  node.animated = setTimeout(function () {
    d3.select(node)
      .style('transition', '')
      .style('transform', '')
    node.animated = false
  }, ms)
}

function dnd (container, options = {}) {
  let ul = d3.select(container)
             .style('position', 'relative') // needed for dnd to work
             .classed('draggable-list', true)
    , self = this
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
    let start = Array.prototype.slice.call(container.children).indexOf(this)
      , node = this

    d3.select(this).property('__startIndex__', start)
    travelerTimeout = setTimeout(dndstart.bind(null, this), 300)

    d3.select(window)
      .on('keydown.dnd-escape', function (e) {
         // If it's the escape, then cancel
        if (e.keyCode === 27) {
          self.emit('dndcancel')
          rearrange(node, container.children[start])
          cleanup(node)
        }
      })
  })

  drag.on('drag', function (e) {
    if (!dragging) {
      dndstart(this)
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
      , newIndex = Array.prototype.slice.call(container.children).indexOf(this)

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
      , containerBottom = container.offsetHeight + container.scrollTop
      , lowerBound = containerBottom - bb.height / 2
      , top = clamp(y - bb.height / 2, -(bb.height / 2), lowerBound) // Top of the moving node
      , newY = top + container.getBoundingClientRect().top + bb.height / 2
      , x = Math.ceil(bb.left) // Round up to ensure we're inside of the `li` node in case a browser rounds down
                              // the `elementFromPoint` call.

    // Reposition the traveling node
    ul.selectChildren('.traveler')
      .style('top', top + 'px')
      .style('display', 'none') // Hide it so we can get the node under the traveler

    let target = document.elementFromPoint(x, newY)

    ul.selectChildren('.traveler')
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

  function lockedSort (objects) {
    const locked = objects.filter(obj => obj.locked)
    const all = objects.filter(obj => !obj.locked) // Start w/ the sorted list of unlocked

    locked.forEach(obj => {
      all.splice(obj.idx, 0, obj)
    })

    return all
  }

  /*
   * Rearranges the nodes
   */
  function rearrange (node, target) {
    let nodes = Array.prototype.slice.call(container.children)
      , currentIndex = nodes.indexOf(node)
      , targetIndex = nodes.indexOf(target)
      , state = nodes.map((node, idx) => {
        let locked = node.classList.contains('draggable-list-lock')
        return {
          node,
          idx,
          locked,
          bb: node.getBoundingClientRect()
        }
      })
      , unlocked = state.filter(obj => obj.unlocked)
      , lockedIndexes = state.filter(obj => obj.locked).map(obj => obj.idx)

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

    if (lockedIndexes.includes(targetIndex)) {
      // Not a valid location
      return
    }

    // Move this node to its new location
    state.splice(targetIndex, 0, state.splice(currentIndex, 1)[0])

    // Sort the entire state to make sure locked nodes maintain their order
    let items = lockedSort(state)

    items.forEach(obj => {
      // Append them to the container in the correct order
      container.appendChild(obj.node)
    })

    // Once the DOM nodes are in the correct order, run the animation
    items.forEach(obj => {
      animate(obj.bb, obj.node)
    })
  }

  function dndstart (source) {
    if (ul.selectChildren('.traveler').size()) {
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

    container.appendChild(traveler)

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
    ul.selectChildren('.traveler').remove()
  }

  ul.selectChildren('li:not(.draggable-list-lock)')
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
