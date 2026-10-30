const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } = require('electron')

protocol.registerSchemesAsPrivileged([{ scheme: 'uart', privileges: {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  corsEnabled: true,
  stream: true,
} }])
app.commandLine.appendSwitch('enable-features', 'WebBluetooth')
app.setName('UART Debugger')
const ORIGIN = 'uart://app'
const windows = new Set()
const pending = new Map()
const local = value => typeof value === 'string' && (value === ORIGIN || value.startsWith(`${ORIGIN}/`))

function finish(id, selection = '') {
  const request = pending.get(id)
  if (!request)
    return
  pending.delete(id)
  clearTimeout(request.timer)
  request.callback(request.items.some(item => item.id === selection) ? selection : '')
  if (!request.contents.isDestroyed())
    request.contents.send('uart:devices', null)
}
function offer(contents, kind, items, callback) {
  finish(contents.id)
  const timer = setTimeout(() => finish(contents.id), 120000)
  pending.set(contents.id, { contents, kind, items, callback, timer })
  contents.send('uart:devices', { kind, items })
}
function portItems(ports) {
  return ports.map(p => ({ id: p.portId, name: `${p.portName || '串口'}${p.displayName ? ` · ${p.displayName}` : ''}`, detail: p.vendorId ? `VID ${p.vendorId} / PID ${p.productId || '—'}` : '系统串口设备' }))
}
function updatePorts(contents, port, remove) {
  const r = pending.get(contents.id)
  if (!r || r.kind !== 'serial')
    return
  r.items = r.items.filter(p => p.id !== port.portId)
  if (!remove)
    r.items.push(...portItems([port]))
  contents.send('uart:devices', { kind: 'serial', items: r.items })
}

function createWindow(url = `${ORIGIN}/index.html`, parent) {
  let saved = {}
  try {
    saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'window.json'), 'utf8'))
  }
  catch {}
  const win = new BrowserWindow({
    width: Math.max(1100, Math.min(saved.width || 1440, 2400)),
    height: Math.max(720, Math.min(saved.height || 900, 1600)),
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#171717',
    title: 'UART Debugger',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../dist/uart-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  })
  windows.add(win)
  win.once('ready-to-show', () => {
    win.show()
    if (saved.maximized && !parent)
      win.maximize()
  })
  win.on('close', () => {
    const bounds = win.getNormalBounds()
    try {
      fs.writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify({ ...bounds, maximized: win.isMaximized() }))
    }
    catch {}
  })
  const contents = win.webContents
  const contentsId = contents.id
  win.on('closed', () => {
    finish(contentsId)
    windows.delete(win)
  })
  contents.on('destroyed', () => finish(contentsId))
  contents.on('will-prevent-unload', (event) => {
    if (dialog.showMessageBoxSync(win, { type: 'question', buttons: ['返回调试', '断开并退出'], defaultId: 0, title: '设备仍在连接', message: '关闭窗口会断开当前设备连接。是否退出？' }) === 1) {
      event.preventDefault()
    }
  })
  contents.setWindowOpenHandler(({ url: target }) => {
    if (local(target))
      createWindow(target, win)
    else if (/^https:\/\//.test(target))
      shell.openExternal(target)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, target) => {
    if (!local(target))
      event.preventDefault()
  })
  contents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    const items = devices.map(d => ({ id: d.deviceId, name: d.deviceName || '未命名 BLE 设备', detail: d.deviceId }))
    const r = pending.get(contents.id)
    if (r?.kind === 'bluetooth') {
      r.items = items
      contents.send('uart:devices', { kind: 'bluetooth', items })
    }
    else {
      offer(contents, 'bluetooth', items, callback)
    }
  })
  win.loadURL(url)
  return win
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const dist = path.resolve(__dirname, '../dist')
  protocol.handle('uart', (request) => {
    const url = new URL(request.url)
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const file = path.resolve(dist, `.${relative}`)
    if (url.hostname !== 'app' || !file.startsWith(`${dist}${path.sep}`))
      return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString()).then((response) => {
      const headers = new Headers(response.headers)
      headers.set('Content-Security-Policy', 'default-src \'self\'; script-src \'self\' \'wasm-unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' blob: data:; font-src \'self\' data:; connect-src \'self\' blob:; worker-src \'self\' blob:; object-src \'none\'; base-uri \'self\'')
      return new Response(response.body, { status: response.status, headers })
    })
  })
  const ses = session.defaultSession
  // All runtime resources are local; no telemetry or network dependency.
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }))
  const allowed = new Set(['serial', 'bluetooth', 'bluetooth-scanning', 'local-fonts'])
  ses.setPermissionCheckHandler((contents, permission, origin) => !!contents && local(contents.getURL()) && local(origin) && allowed.has(permission))
  ses.setPermissionRequestHandler((contents, permission, callback) => callback(local(contents.getURL()) && allowed.has(permission)))
  ses.setDevicePermissionHandler(details => local(details.origin) && ['serial', 'bluetooth'].includes(details.deviceType))
  ses.on('select-serial-port', (event, ports, contents, callback) => {
    event.preventDefault()
    if (!local(contents.getURL()))
      return callback('')
    offer(contents, 'serial', portItems(ports), callback)
  })
  ses.on('serial-port-added', (_event, port, contents) => updatePorts(contents, port, false))
  ses.on('serial-port-removed', (_event, port, contents) => updatePorts(contents, port, true))
  ses.setBluetoothPairingHandler((details, callback) => {
    const win = [...windows].find(w => w.isFocused()) || [...windows][0]
    if (!win)
      return callback({ confirmed: false })
    win.webContents.send('uart:pairing', details)
    const channel = `uart:pairing:${win.webContents.id}`
    let timer
    const listener = (_event, response) => {
      clearTimeout(timer)
      callback({ confirmed: !!response?.confirmed, pin: String(response?.pin || '').slice(0, 16) })
    }
    timer = setTimeout(() => {
      ipcMain.removeListener(channel, listener)
      callback({ confirmed: false })
      if (!win.isDestroyed())
        win.webContents.send('uart:pairing', null)
    }, 60000)
    ipcMain.once(channel, listener)
  })
  ses.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: '保存导出文件', defaultPath: path.join(app.getPath('documents'), path.basename(item.getFilename())) }))
  ipcMain.on('uart:select', (event, selection) => {
    if (local(event.sender.getURL()))
      finish(event.sender.id, String(selection || ''))
  })
  ipcMain.on('uart:pairing-response', (event, response) => {
    if (local(event.sender.getURL()))
      ipcMain.emit(`uart:pairing:${event.sender.id}`, event, response)
  })
  createWindow()
})
app.on('window-all-closed', () => app.quit())
