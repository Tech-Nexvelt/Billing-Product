import { Menu, shell } from 'electron';
export function installMenu(window) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        { label: 'File', submenu: [{ label: 'New Order', accelerator: 'Ctrl+N', click: () => window.webContents.send('desktop:shortcut', 'new-order') }, { label: 'Print', accelerator: 'Ctrl+P', click: () => window.webContents.send('desktop:shortcut', 'print') }, { role: 'quit' }] },
        { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen', accelerator: 'F11' }] },
        { label: 'Settings', submenu: [{ label: 'Printer Manager', accelerator: 'Ctrl+Shift+P', click: () => window.webContents.send('desktop:shortcut', 'printer-manager') }] },
        { label: 'Help', submenu: [{ label: 'NexVelt Support', click: () => void shell.openExternal('https://github.com/Tech-Nexvelt/Billing-Product') }] },
    ]));
}
