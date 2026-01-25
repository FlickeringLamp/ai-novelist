import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFolder, faFile, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { useDispatch } from 'react-redux';
import { collapseAll } from '../../store/file.ts';
import ContextMenu from './ContextMenu.tsx';
import UnifiedModal from '../others/UnifiedModal';
import httpClient from '../../utils/httpClient.ts';
import ChapterTreeItem from './TreeRender.tsx';

interface ChapterItem {
  id: string;
  title?: string;
  isFolder?: boolean;
  type?: string;
  children?: ChapterItem[];
}


function ChapterTreePanel() {
  const dispatch = useDispatch();
  const [chapters, setChapters] = useState<ChapterItem[]>([]); // 整个章节列表
  //@ts-ignore
  /*
   * 以下是两个item状态的思路
   * 首先，文件操作分为三类：
   * 1. 一个对象的操作，比如新建，删除，重命名
   * 2. 需要两个对象的操作，比如复制粘贴，剪切粘贴
   * 3. 特殊状态：选中，这个状态主要出现在右键项目后，具体操作完成前，用于强调被选中的文件，呈现更加醒目的视觉效果
   * 单对象操作，只用selectedItem即可，两对象操作，需要读取lastSelectedItem和selectedItem的状态
  */
  const [selectedItem, setSelectedItem] = useState<{ state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }>({
    state: null, // 'selected' | 'renaming' | null
    id: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  });
  const [lastSelectedItem, setLastSelectedItem] = useState<{ state: string | null; id: string | null; isFolder: boolean; itemTitle: string | null; itemParentPath: string | null }>({
    state: null, // 'copying' | 'cutting' | null
    id: null,
    isFolder: false,
    itemTitle: null,
    itemParentPath: null
  });
  // 消息模态框状态
  const [modal, setModal] = useState<{ show: boolean; message: string; onConfirm: (() => void) | null }>({
    show: false,
    message: '',
    onConfirm: null
  });
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0
  });

  // 获取章节列表
  const fetchChapters = async () => {
    try {
      const result = await httpClient.get('/api/file/tree');
      setChapters(result || []);
    } catch (error) {
      console.error('获取章节列表失败：', error);
      setModal({ show: true, message: (error as Error).toString(), onConfirm: null });
    }
  };
  // 注册章节更新监听器和初始加载
  useEffect(() => {
    fetchChapters();
  }, []);

  // 看看每次的数据长啥样
  useEffect(()=>{
    console.log("选中的项目信息",selectedItem)
    console.log("上一个被选中的项目信息",lastSelectedItem)
  },[selectedItem,lastSelectedItem])


  const handleContextMenu = (event: React.MouseEvent, itemId: string, isFolder: boolean, itemTitle: string, itemParentPath: string) => {
    event.preventDefault();
    setSelectedItem({
      state: 'selected',
      id: itemId,
      isFolder: isFolder,
      itemTitle: itemTitle,
      itemParentPath: itemParentPath
    });
    setContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY
    });
  };
  const handleCloseContextMenu = () => {
    setContextMenu({
      show: false,
      x: 0,
      y: 0
    })
  };

  // 统一的新建函数
  const handleCreateItem = async (isFolder: boolean, parentPath: string = '') => {
    try {
      const result = await httpClient.post('/api/file/items', {
        parent_path: parentPath,
        is_folder: isFolder
      });
      handleCloseContextMenu();
      await fetchChapters();
      // 自动进入重命名状态
      if (result && result.id) {
        setSelectedItem({
          state: 'renaming',
          id: result.id,
          isFolder: isFolder,
          itemTitle: result.title,
          itemParentPath: parentPath
        });
      }
    } catch (error) {
      console.error('创建失败:', error);
      setModal({ show: true, message: (error as Error).toString(), onConfirm: null });
    }
  };



  // 按钮样式
  const commonBtnStyle = "text-theme-white border border-theme-gray1 p-2 rounded-small cursor-pointer text-base flex items-center gap-1 hover:border-theme-green hover:text-theme-green";


  return (
    <div className="bg-theme-black text-theme-gray2 flex flex-col h-full">
      <div className="flex justify-center gap-2.5 border-b border-theme-gray3 h-[5%] flex-shrink-0 items-center bg-theme-gray1 w-full">
        <button className={commonBtnStyle} onClick={() => handleCreateItem(false)} title="新建文件">
          <FontAwesomeIcon icon={faFile} />
        </button>
        <button className={commonBtnStyle} onClick={() => handleCreateItem(true)} title="新建文件夹">
          <FontAwesomeIcon icon={faFolder} />
        </button>
        <button className={commonBtnStyle} onClick={() => dispatch(collapseAll())} title="折叠所有">
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>
      </div>

      <div className="flex flex-col h-[90%] flex-shrink-0 bg-theme-gray1 w-full">
        <div className="flex-grow overflow-y-auto p-2.5" onContextMenu={(e) => handleContextMenu(e, '', false, '', '')}>
          {chapters.length === 0 ? (
            <p className="p-2.5 text-center text-theme-green">暂无文件</p>
          ) : (
            <ul className="list-none p-0 m-0">
              {chapters.map(item => (
                <ChapterTreeItem
                  key={item.id}
                  item={item}
                  level={0}
                  props={{
                    handleContextMenu,
                    selectedItem,
                    lastSelectedItem,
                    setSelectedItem,
                    fetchChapters,
                    setModal
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* 右键菜单 */}
      <ContextMenu
        contextMenu={contextMenu}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        lastSelectedItem={lastSelectedItem}
        setLastSelectedItem={setLastSelectedItem}
        handleCloseContextMenu={handleCloseContextMenu}
        handleCreateItem={handleCreateItem}
        fetchChapters={fetchChapters}
        setModal={setModal}
      />

      {/* 设置按钮区域 */}
      <div className="h-[5%] flex-shrink-0 flex justify-end items-end p-2.5 bg-theme-gray1 w-full border-t border-theme-gray3">
        <button className="bg-transparent text-theme-white border-none p-0 rounded-0 text-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-transparent hover:border-transparent hover:text-theme-green" title="设置">
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>

      {/* 模态框管理模块 */}
      {modal.show && (
        <UnifiedModal
          message={modal.message}
          buttons={[
            { text: '确定', onClick: modal.onConfirm || (() => setModal({ show: false, message: '', onConfirm: null })), className: 'bg-theme-green' }
          ]}
        />
      )}

    </div>
  );
}

export default ChapterTreePanel;
