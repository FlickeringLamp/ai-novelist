import BaseListPanel from "./BaseListPanel";
import HeaderBar from "./HeaderBar";
import FilesManager from "./FilesManager";

const KnowledgeBasePanel = () => {
  return (
    <div className="w-full h-full flex">
      {/* 左侧：知识库列表 */}
      <BaseListPanel />

      {/* 右侧：文件列表 */}
      <div className="w-[80%] h-full flex flex-col">
        <HeaderBar />
        <FilesManager />
      </div>
    </div>
  );
};

export default KnowledgeBasePanel;
