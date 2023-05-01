import * as d3drag from 'd3-drag'
import * as d3 from 'd3-selection'
import { EventEmitter } from 'events'
import util from 'util'

const clamp = function (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const buildState = nodes => {
  return nodes.map((node, idx) => {
    let locked = node.classList.contains('draggable-list-lock')
      , bb = node.getBoundingClientRect()

    return {
      node,
      idx,
      locked,
      bb
    }
  })
}

const shouldSwap = (state, travelerCenter) => {
  // Build a virtual list so we don't thrash the DOM
  let top = 0
    , list = state.map(item => {
      let result = {
        top,
        height: item.bb.height,
        center: top + item.bb.height / 2,
        placeholder: item.placeholder,
        target: item.target,
      }
      top += result.height
      return result
    })

  let placeholder = list.find(item => item.placeholder)
    , target = list.find(item => item.target)

  const isCloserToTarget = () => {
    return Math.abs(travelerCenter - placeholder.center) > Math.abs(travelerCenter - target.center)
  }

  let swap = false

  // Based on current location, determine if the traveler node is now closer
  // to the target
  if (isCloserToTarget()) {
    // It's closer to the target, set the swap flag
    swap = true

    // Now re-arrange the list items and figure out new dimensions
    list.splice(list.indexOf(target), 0, list.splice(list.indexOf(placeholder), 1)[0])

    // Reassign dimensions
    let top = 0
    list.forEach(item => {
      item.top = top
      item.center = top + item.height / 2
      top += item.height
    })

    // Check another time to see if it's closer to the target again. If so
    // We don't want to swap b/c it will "jump" between the nodes
    if (isCloserToTarget()) {
      // Don't do anything, the original location was a better match
      swap = false
    }
  }

  return swap
}

const isInvalid = (target, targetIndex, currentIndex, lockedIndexes) => {
  if (!target) {
    // We don't have a place to drop this node that's in the ul
    return true
  }

  if (currentIndex == targetIndex) {
    // Same node
    return true
  }

  if (target.animated) {
    // already working
    return true
  }

  if (targetIndex == -1) {
    // Not on a real node, carry on
    return true
  }

  if (lockedIndexes.includes(targetIndex)) {
    // Not a valid location
    return true
  }

  return false
}

const animateItem = (startingBB, node) => {
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

  drag.on('start', function (e) {
    let nodes = Array.prototype.slice.call(container.children)
      , state = buildState(nodes)
      , placeholderIndex = nodes.indexOf(this)
      , node = this

    d3.select(this).property('__startIndex__', placeholderIndex)
    travelerTimeout = setTimeout(dndstart.bind(null, this), 300)

    d3.select(window)
      .on('keydown.dnd-escape', function (e) {
         // If it's the escape, then cancel
        if (e.keyCode === 27) {
          self.emit('dndcancel')
          cleanup(node)
          rearrange(state, nodes.indexOf(node), placeholderIndex)
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
      , halfHeight = bb.height / 2
      , travelerTop = clamp(y - halfHeight, -halfHeight, containerBottom - halfHeight) // Top of the moving node
      , travelerCenter = travelerTop + halfHeight
      , traveler = ul.selectChildren('.traveler')
      , x = Math.ceil(bb.left) // Round up to ensure we're inside of the `li` node in case a browser rounds down
                              // the `elementFromPoint` call.
      , nodes = Array.prototype.slice.call(container.children).filter(node => traveler.node() != node)
      , placeholderIndex = nodes.indexOf(node)
      , state = buildState(nodes)
      , lockedIndexes = state.filter(obj => obj.locked).map(obj => obj.idx)

    traveler.style('top', `${travelerTop}px`)
            .style('display', 'none') // Hide it so we can get the node under the traveler

    let target = document.elementFromPoint(x, travelerCenter + container.getBoundingClientRect().top)
      , targetIndex = nodes.indexOf(target)

    traveler.style('display', '') // Show it again

    if (isInvalid(target, targetIndex, placeholderIndex, lockedIndexes)) {
      // Can't move in this location
      return
    }

    // Store placeholder and target fields on the state objects so
    // we can use them when determining if to do swaps.
    state.forEach(item => {
      if (item.idx == placeholderIndex) {
        item.placeholder = true
      }
      if (item.idx == targetIndex) {
        item.target = true
      }
    })

    if (shouldSwap(state, travelerCenter)) {
      rearrange(state, targetIndex, placeholderIndex)
    }
  }

  function lockedSort (objects) {
    const locked = objects.filter(obj => obj.locked)
    const all = objects.filter(obj => !obj.locked) // Start w/ the sorted list of unlocked

    locked.forEach(obj => {
      all.splice(obj.idx, 0, obj)
    })

    return all
  }

  function rearrange (state, targetIndex, currentIndex) {
    // Move this node to its new location
    state.splice(targetIndex, 0, state.splice(currentIndex, 1)[0])

    // Sort the entire state to make sure locked nodes maintain their order
    let items = lockedSort(state)

    items.forEach(obj => {
      // Append them to the container in the correct order
      container.appendChild(obj.node)
    })

    // Run animations on the nodes
    items.forEach(obj => {
      animateItem(obj.bb, obj.node)
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
