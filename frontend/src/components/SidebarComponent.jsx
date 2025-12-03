import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faBook,
  faRobot,
  faPencil,
  faBriefcase,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import './SidebarComponent.css';

const SidebarComponent = ({
  showRagSettingsModal,
  setShowRagSettingsModal,
  showApiSettingsModal,
  setShowApiSettingsModal,
  showGeneralSettingsModal,
  setShowGeneralSettingsModal,
  showHomePage,
  setShowHomePage
}) => {
  const [activeItem, setActiveItem] = useState(null);

  // 关闭所有模态框并显示主页面的函数
  const showHomePageAndCloseModals = () => {
    if (setShowApiSettingsModal) setShowApiSettingsModal(false);
    setShowRagSettingsModal(false);
    if (setShowGeneralSettingsModal) setShowGeneralSettingsModal(false);
    if (setShowHomePage) setShowHomePage(true);
  };

  // 侧边栏项目配置 - 每个图标绑定独立的设置模态框
  const sidebarItems = [
    {
      id: 'home',
      icon: faPencil,
      label: '首页',
      action: () => {
        // 点击首页按钮，关闭所有模态框并显示主页面
        showHomePageAndCloseModals();
        setActiveItem('home');
      }
    },
    // 暂时注释掉工作流面板项目
    // {
    //   id: 'workspace',
    //   icon: faBriefcase,
    //   label: '工作区',
    //   action: () => {
    //     if (showWorkspacePanel) {
    //       // 如果当前已经打开，则关闭
    //       dispatch(setShowWorkspacePanel(false));
    //       dispatch(setShowHomePage(true));
    //       setActiveItem(null);
    //     } else {
    //       // 如果当前未打开，则关闭其他模态框并打开当前模态框
    //       dispatch(setShowHomePage(false));
    //       dispatch(setShowApiSettingsModal(false));
    //       dispatch(setShowRagSettingsModal(false));
    //       dispatch(setShowGeneralSettingsModal(false));
    //       dispatch(setShowPersistentMemoryPanel(false));
    //       dispatch(setShowWorkspacePanel(true));
    //       setActiveItem('workspace');
    //     }
    //   }
    // },
    {
      id: 'api-settings',
      icon: faGear,
      label: 'API设置',
      action: () => {
        if (showApiSettingsModal) {
          // 如果当前已经打开，则关闭
          if (setShowApiSettingsModal) setShowApiSettingsModal(false);
          if (setShowHomePage) setShowHomePage(true);
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          if (setShowHomePage) setShowHomePage(false);
          setShowRagSettingsModal(false);
          if (setShowGeneralSettingsModal) setShowGeneralSettingsModal(false);
          if (setShowApiSettingsModal) setShowApiSettingsModal(true);
          setActiveItem('api-settings');
        }
      }
    },
    {
      id: 'rag-settings',
      icon: faBook,
      label: 'rag知识库',
      action: () => {
        if (showRagSettingsModal) {
          // 如果当前已经打开，则关闭
          setShowRagSettingsModal(false);
          if (setShowHomePage) setShowHomePage(true);
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          if (setShowHomePage) setShowHomePage(false);
          if (setShowApiSettingsModal) setShowApiSettingsModal(false);
          if (setShowGeneralSettingsModal) setShowGeneralSettingsModal(false);
          setShowRagSettingsModal(true);
          setActiveItem('rag-settings');
        }
      }
    },
    {
      id: 'general-settings',
      icon: faRobot,
      label: 'agent设置',
      action: () => {
        if (showGeneralSettingsModal) {
          // 如果当前已经打开，则关闭
          if (setShowGeneralSettingsModal) setShowGeneralSettingsModal(false);
          if (setShowHomePage) setShowHomePage(true);
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          if (setShowHomePage) setShowHomePage(false);
          if (setShowApiSettingsModal) setShowApiSettingsModal(false);
          setShowRagSettingsModal(false);
          if (setShowGeneralSettingsModal) setShowGeneralSettingsModal(true);
          setActiveItem('general-settings');
        }
      }
    },
  ];

  const handleItemClick = (item) => {
    item.action();
  };

  // 根据当前打开的模态框更新 activeItem 状态
  React.useEffect(() => {
    if (showApiSettingsModal) {
      setActiveItem('api-settings');
    } else if (showRagSettingsModal) {
      setActiveItem('rag-settings');
    } else if (showGeneralSettingsModal) {
      setActiveItem('general-settings');
    }
    // else if (showWorkspacePanel) { // 暂时注释掉
    //   setActiveItem('workspace');
    // }
    else if (showHomePage) {
      setActiveItem('home');
    } else {
      setActiveItem(null);
    }
  }, [showApiSettingsModal, showRagSettingsModal, showGeneralSettingsModal, showHomePage]);

  return (
    <div className="sidebar">
      {/* 侧边栏项目列表 */}
      <div className="sidebar-items">
        {sidebarItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${activeItem === item.id ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
            title={item.label}
          >
            <FontAwesomeIcon icon={item.icon} className="item-icon" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarComponent;
