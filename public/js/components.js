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
  el.innerHTML = "Conectando..."
  el.style.color = 'powderblue'
  return el
}

const getClosedEl = () => {
  // rootEl.innerHTML = 
  // `
  //   <p style='color: black'>Conexão fechada</p>
  //   <button type='button' onclick='reconnect()'>Reconnectar</button>
  // `
  const el = document.createElement('div')
  const p = document.createElement('p')
  p.innerHTML = "Conexão fechada"
  p.style.color = '#ddd'

  const button = document.createElement('button')
  button.innerHTML = "Reconectar"
  button.addEventListener("click", () => {
    console.log("reconnecting")
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