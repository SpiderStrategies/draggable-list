# draggable-list

[![Build
Status](https://travis-ci.org/SpiderStrategies/draggable-list.svg?branch=master)](https://travis-ci.org/SpiderStrategies/draggable-list)

This is a component, built using d3, that will take a html `ul` and make it sortable using
drag and drop.

## Code Example

As an object that emits `move` events

```javascript
var List = require('draggable-list')
  , d3 = require('d3')

var list = new List(document.querySelector('.draggable-list')) // Pass in a node that should
                                                               // have dnd to sort
list.on('move', function (node, newIndex, prevIndex) {
  console.log(arguments)
})
```

Or using d3 conventions

```javascript
var draggable = require('draggable-list')
  , d3 = require('d3')

d3.selectAll('.draggable-list')
  .call(draggable)
```

Elements can set a class of `draggable-list-nodrag` to prevent dnd operations on that element.

## Installation

```
$ npm install draggable-list
```

## Tests

```
$ npm test
```

## License

ISC
