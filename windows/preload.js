/* Pranchetas Digitais - © 2026 Guilherme. */
/* 3.0: a única coisa que a tela pode pedir ao programa: guardar e ler a cópia dos dados em Documentos/Usina/BackupUsina. */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pranchetasPC', { guardarCopia: (nome, texto) => ipcRenderer.invoke('guardar-copia', nome, texto), lerCopia: (nome) => ipcRenderer.invoke('ler-copia', nome) });
