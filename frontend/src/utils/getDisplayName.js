// 辅助函数：根据文件名获取显示名称(文件名去掉后缀)
const getDisplayName = (name, isFolder) => {
    if (isFolder) {return name;}
    const lastDotIndex = name.lastIndexOf('.');
    return lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
};

export default getDisplayName