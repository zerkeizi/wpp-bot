const getConnectedEl = () =>  {
  const el = document.createElement('p')
  el.innerHTML = "connected"
  el.style.color = 'limegreen'
  return el
}

const getDisconnectedEl = () => {
  const el = document.createElement('p')
  el.innerHTML = "disconnected"
  el.style.color = '#ddd'
  return el
}

const getConnectingEl = () => {
  const el = document.createElement('p')
  el.innerHTML = "connecting..."
  el.style.color = 'powderblue'
  return el
}

const getClosedEl = () => {
  const el = document.createElement('div')
  const p = document.createElement('p')
  p.innerHTML = "connection closed"
  p.style.color = '#ddd'

  const button = document.createElement('button')
  button.innerHTML = "reconnect"
  button.addEventListener("click", () => {
    console.log("reconnecting")
    fetch("/reconnect", {
      method: "POST",
      body: "",
      headers: {
        "Content-type": "application/json; charset=UTF-8"
      }
    });
  })

  el.appendChild(p)
  el.appendChild(button)
  
  return el
}


const components = {
  connected: getConnectedEl(),
  disconnected: getDisconnectedEl(),
  connecting: getConnectingEl(),
  closed: getClosedEl()
}

export default components