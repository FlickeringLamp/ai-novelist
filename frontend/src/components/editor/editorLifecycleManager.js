class EditorLifecycleManager {
  constructor() {
    this.editorInstances = new Map();
  }

  registerEditor(tabId, editorInstance) {
    this.editorInstances.set(tabId, editorInstance);
  }

  unregisterEditor(tabId) {
    const instance = this.editorInstances.get(tabId);
    if (instance) {
      try {
        if (instance.dispose) {
          instance.dispose();
        }
      } catch (error) {
        console.warn(`销毁编辑器实例失败 for tab ${tabId}:`, error);
      }
      this.editorInstances.delete(tabId);
    }
  }

  getEditorInstance(tabId) {
    return this.editorInstances.get(tabId) || null;
  }
}

export default EditorLifecycleManager