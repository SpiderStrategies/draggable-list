
export const setup = () => {
  var container = document.createElement('div')

  container.className = 'container'
  container.style.height = '700px'
  container.style['margin-top'] = '100px'
  container.style['margin-left'] = '50px'
  container.style['width'] = '250px'

  container.innerHTML = '<ul>' +
                          '<li style="height: 50px;">KPI Dashboards</li>' +
                          '<li style="height: 50px;">Mayberry</li>' +
                          '<li style="height: 200px;">Yummygum</li>' +
                          '<li style="height: 50px;">Spider Strategies</li>' +
                        '</ul>'

  document.body.appendChild(container)

  return container
}

export const trigger = (node, type, opts) => {
  opts = opts || {}
  var e = document.createEvent('Event')
  for (var arg in opts) {
    e[arg] = opts[arg]
  }
  e.view = window
  e.which = 1
  e.initEvent(type, true, true)
  node.dispatchEvent(e)
}
