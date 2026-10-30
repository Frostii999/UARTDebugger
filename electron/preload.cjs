const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}
contextBridge.exposeInMainWorld('uartDesktop', {
  version: '1.0.1',
  onDevices: callback => subscribe('uart:devices', callback),
  selectDevice: id => ipcRenderer.send('uart:select', id),
  onPairing: callback => subscribe('uart:pairing', callback),
  respondPairing: response => ipcRenderer.send('uart:pairing-response', response),
})
