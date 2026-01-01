// 标签页状态管理服务 - 替代Redux状态管理
class TabStateService extends EventTarget {
  constructor() {
    super();
    this.state = {
      openTabs: [],
      activeTabId: null,
      chapters: [],
      refreshCounter: 0,
      splitView: {
        enabled: false,
        layout: 'horizontal',
        leftTabId: null,
        rightTabId: null,
      },
    };
  }

  // 提取文件名的辅助函数
  getFileName(filePath) {
    const cleanPath = filePath.replace(/^novel\//, '');
    const baseName = cleanPath.split('/').pop().split('\\').pop();
    const lastDotIndex = baseName.lastIndexOf('.');
    return lastDotIndex !== -1 ? baseName.substring(0, lastDotIndex) : baseName;
  }

  // 获取状态
  getState() {
    return { ...this.state };
  }

  // 获取打开的标签页
  getOpenTabs() {
    return [...this.state.openTabs];
  }

  // 获取激活的标签页ID
  getActiveTabId() {
    return this.state.activeTabId;
  }

  // 获取激活的标签页
  getActiveTab() {
    return this.state.openTabs.find(tab => tab.id === this.state.activeTabId);
  }

  // 获取章节列表
  getChapters() {
    return [...this.state.chapters];
  }

  // 获取刷新计数器
  getRefreshCounter() {
    return this.state.refreshCounter;
  }

  // 获取分屏状态
  getSplitView() {
    return { ...this.state.splitView };
  }

  // 设置激活的标签页
  setActiveTab(tabId) {
    this.state.activeTabId = tabId;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 关闭标签页
  closeTab(tabId) {
    const tabIndex = this.state.openTabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) return;

    this.state.openTabs.splice(tabIndex, 1);

    if (this.state.activeTabId === tabId) {
      if (this.state.openTabs.length > 0) {
        const newActiveIndex = Math.min(tabIndex, this.state.openTabs.length - 1);
        this.state.activeTabId = this.state.openTabs[newActiveIndex].id;
      } else {
        this.state.activeTabId = null;
      }
    }

    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 更新标签页内容
  updateTabContent(tabId, content, isDirty) {
    const tab = this.state.openTabs.find(t => t.id === tabId);
    if (tab) {
      tab.content = content;
      if (isDirty !== undefined) {
        tab.isDirty = isDirty;
      } else {
        tab.isDirty = content !== tab.originalContent;
      }
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 开始diff模式
  startDiff(tabId, suggestion) {
    const tab = this.state.openTabs.find(t => t.id === tabId);
    if (tab) {
      tab.suggestedContent = suggestion;
      tab.viewMode = 'diff';
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 接受建议
  acceptSuggestion(tabId) {
    const tab = this.state.openTabs.find(t => t.id === tabId);
    if (tab && tab.viewMode === 'diff') {
      tab.content = tab.suggestedContent;
      tab.suggestedContent = null;
      tab.viewMode = 'edit';
      tab.isDirty = true;
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 拒绝建议
  rejectSuggestion(tabId) {
    const tab = this.state.openTabs.find(t => t.id === tabId);
    if (tab && tab.viewMode === 'diff') {
      tab.suggestedContent = null;
      tab.viewMode = 'edit';
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 设置章节列表
  setChapters(chapters) {
    this.state.chapters = chapters;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 触发章节刷新
  triggerChapterRefresh() {
    this.state.refreshCounter += 1;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 同步文件内容
  syncFileContent(filePath, newContent) {
    const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    const tab = this.state.openTabs.find(t => t.id === cleanFilePath);

    if (tab) {
      console.log(`[TabStateService] Matched tab '${cleanFilePath}' for content sync.`);
      tab.content = newContent;
      tab.originalContent = newContent;
      tab.suggestedContent = null;
      tab.isDirty = false;
      tab.viewMode = 'edit';
      console.log(`[TabStateService] Tab '${filePath}' content synced and view mode reset.`);
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 文件写入
  fileWritten(filePath, content) {
    const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    const existingTab = this.state.openTabs.find(tab => tab.id === cleanFilePath);

    if (existingTab) {
      existingTab.content = content;
      existingTab.isDirty = false;
      existingTab.originalContent = content;
      existingTab.suggestedContent = null;
      existingTab.viewMode = 'edit';
    } else {
      const newTab = {
        id: cleanFilePath,
        title: this.getFileName(cleanFilePath),
        content: content,
        originalContent: content,
        suggestedContent: null,
        isDirty: false,
        viewMode: 'edit',
      };
      this.state.openTabs.push(newTab);
      this.state.activeTabId = cleanFilePath;
    }

    this.state.refreshCounter += 1;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 文件删除
  fileDeleted(filePath) {
    const cleanFilePath = filePath.startsWith('novel/') ? filePath.substring(6) : filePath;
    const tab = this.state.openTabs.find(t => t.id === cleanFilePath);

    if (tab) {
      tab.isDeleted = true;
      if (this.state.activeTabId === cleanFilePath) {
        const availableTabs = this.state.openTabs.filter(t => !t.isDeleted);
        if (availableTabs.length > 0) {
          this.state.activeTabId = availableTabs[0].id;
        } else {
          this.state.activeTabId = null;
        }
      }
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 文件重命名
  fileRenamed(oldFilePath, newFilePath) {
    const cleanOldPath = oldFilePath.startsWith('novel/') ? oldFilePath.substring(6) : oldFilePath;
    const cleanNewPath = newFilePath.startsWith('novel/') ? newFilePath.substring(6) : newFilePath;

    const tab = this.state.openTabs.find(t => t.id === cleanOldPath);
    if (tab) {
      tab.id = cleanNewPath;
      tab.title = this.getFileName(cleanNewPath);
      if (this.state.activeTabId === cleanOldPath) {
        this.state.activeTabId = cleanNewPath;
      }
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }
  }

  // 重新排序标签页
  reorderTabs(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const [movedTab] = this.state.openTabs.splice(fromIndex, 1);
    this.state.openTabs.splice(toIndex, 0, movedTab);
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 启用分屏
  enableSplitView(leftTabId, rightTabId, layout = 'horizontal') {
    this.state.splitView.enabled = true;
    this.state.splitView.leftTabId = leftTabId;
    this.state.splitView.rightTabId = rightTabId;
    this.state.splitView.layout = layout;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 禁用分屏
  disableSplitView() {
    this.state.splitView.enabled = false;
    this.state.splitView.leftTabId = null;
    this.state.splitView.rightTabId = null;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 设置分屏布局
  setSplitViewLayout(layout) {
    this.state.splitView.layout = layout;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 设置分屏标签页
  setSplitViewTabs(leftTabId, rightTabId) {
    this.state.splitView.leftTabId = leftTabId;
    this.state.splitView.rightTabId = rightTabId;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }

  // 创建新标签页
  createTab(filePath, content) {
    const newTab = {
      id: filePath,
      title: this.getFileName(filePath),
      content: content,
      originalContent: content,
      suggestedContent: null,
      isDirty: false,
      viewMode: 'edit',
    };
    this.state.openTabs.push(newTab);
    this.state.activeTabId = filePath;
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    return newTab;
  }

  // 更新章节列表中的文件路径
  updateChapterPath(oldPath, newPath) {
    this.state.chapters = this.state.chapters.map(chapter =>
      chapter === oldPath ? newPath : chapter
    );
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
  }
}

// 创建全局实例
const tabStateService = new TabStateService();

export default tabStateService;
