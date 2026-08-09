import { contextBridge, ipcRenderer } from 'electron'
import type { AiEvent } from '../renderer/src/lib/types'

const api = {
  platform: 'electron',
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  loadConfig: (): Promise<string | null> => ipcRenderer.invoke('config:load'),
  saveConfig: (json: string): Promise<void> => ipcRenderer.invoke('config:save', json),
  pickSkillFiles: (): Promise<{ name: string; content: string }[]> =>
    ipcRenderer.invoke('skills:pick-files'),
  listUserSkills: (): Promise<{ name: string; content: string }[]> =>
    ipcRenderer.invoke('skills:list-user'),
  saveUserSkill: (id: string, content: string): Promise<void> =>
    ipcRenderer.invoke('skills:save-user', id, content),
  deleteUserSkill: (id: string): Promise<void> =>
    ipcRenderer.invoke('skills:delete-user', id),
  listChats: (): Promise<unknown[]> => ipcRenderer.invoke('chats:list'),
  saveChat: (session: unknown): Promise<void> => ipcRenderer.invoke('chats:save', session),
  deleteChat: (id: string): Promise<void> => ipcRenderer.invoke('chats:delete', id),
  listBaziHistory: (): Promise<unknown[]> => ipcRenderer.invoke('bazi:list'),
  saveBaziHistory: (record: unknown): Promise<void> => ipcRenderer.invoke('bazi:save', record),
  deleteBaziHistory: (id: string): Promise<void> => ipcRenderer.invoke('bazi:delete', id),
  loadBaziDraft: (): Promise<unknown | null> => ipcRenderer.invoke('bazi:draft-load'),
  saveBaziDraft: (draft: unknown): Promise<void> => ipcRenderer.invoke('bazi:draft-save', draft),
  exportMarkdown: (options: { defaultName?: string; content: string }): Promise<{
    ok: boolean
    path?: string
    message?: string
  }> => ipcRenderer.invoke('export:save-markdown', options),
  aiChat: (req: unknown): Promise<string> => ipcRenderer.invoke('ai:chat', req),
  aiCancel: (requestId: string): Promise<void> => ipcRenderer.invoke('ai:cancel', requestId),
  testProvider: (provider: {
    name: string
    baseURL: string
    model: string
    apiKeys: string[]
  }): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('ai:test', provider),
  onAiEvent: (cb: (e: AiEvent) => void): (() => void) => {
    const listener = (_e: unknown, event: AiEvent): void => cb(event)
    ipcRenderer.on('ai:event', listener)
    return () => ipcRenderer.removeListener('ai:event', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
