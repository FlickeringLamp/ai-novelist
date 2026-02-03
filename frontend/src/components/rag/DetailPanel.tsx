import { useRef } from "react";
import HeaderBar from "./HeaderBar";
import FilesManager from "./FilesManager";
import UploadProgress from "./UploadProgress";
import type { UploadProgressRef } from "./UploadProgress";

const DetailPanel = () => {
  const uploadProgressRef = useRef<UploadProgressRef | null>(null);

  return (
    <div className="w-[80%] h-full flex flex-col relative">
      <HeaderBar />
      <div className="flex-1 flex flex-col">
        <FilesManager
          uploadProgressRef={uploadProgressRef}
        />
      </div>
      <div className="h-[5%]">
        <UploadProgress ref={uploadProgressRef} />
      </div>
    </div>
  );
};

export default DetailPanel;
