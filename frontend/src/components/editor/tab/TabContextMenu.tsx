import { useDispatch } from 'react-redux';
import { closeOtherTabs, closeSavedTabs, closeAllTabs, addTabBar, setActiveTabBar } from '../../../store/editor.ts';
import ContextMenu from '../../others/ContextMenu.tsx';
import type { EditorContextMenuProps, ContextMenuItem } from '@/types';

function EditorContextMenu({
  visible,
  x,
  y,
  tabId,
  tabBarId,
  activeTabBarId,
  onClose
}: EditorContextMenuProps) {
  const dispatch = useDispatch();

  const handleCloseOtherTabs = () => {
    if (tabId) {
      if (activeTabBarId !== tabBarId) {
        dispatch(setActiveTabBar({ tabBarId: tabBarId! }));
      }
      dispatch(closeOtherTabs({ tabId }));
    }
    onClose();
  };

  const handleCloseSavedTabs = () => {
    dispatch(setActiveTabBar({ tabBarId: tabBarId! }));
    dispatch(closeSavedTabs());
    onClose();
  };

  const handleCloseAllTabs = () => {
    dispatch(setActiveTabBar({ tabBarId: tabBarId! }));
    dispatch(closeAllTabs());
    onClose();
  };

  const handleSplitRight = () => {
    if (tabId) {
      dispatch(addTabBar({ sourceTabId: tabId }));
    }
    onClose();
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    return [
      { label: '关闭其他标签', onClick: handleCloseOtherTabs },
      { label: '关闭所有已保存标签', onClick: handleCloseSavedTabs },
      { label: '关闭所有标签', onClick: handleCloseAllTabs },
      { divider: true },
      { label: '向右拆分', onClick: handleSplitRight }
    ];
  };

  return (
    <ContextMenu
      visible={visible}
      x={x}
      y={y}
      items={getContextMenuItems()}
      onClose={onClose}
      positionType="fixed"
      enableKeyboard={false}
      enableAutoAdjust={false}
    />
  );
}

export default EditorContextMenu;
