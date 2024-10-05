const getConnectedEl = () =>  {
  const el = document.createElement('p')
  el.innerHTML = "Thats me!"
  return el
}

const disconnected = () => {}

const connecting = () => {}

const closed = () => {}


const components = {
  connected: getConnectedEl(),
  disconnected,
  connecting,
  closed
}

export default components