class DisplayNameHelper {
    name: string;
    isFolder: boolean;

    constructor(name: string, isFolder = false) {
        this.name = name;
        this.isFolder = isFolder;
    }

    // 获取最后一个展示名（去掉路径部分）
    getLastDisplayName() {
        const lastSlashIndex = this.name.lastIndexOf('/');
        const lastDisplayName = lastSlashIndex !== -1 
            ? this.name.substring(lastSlashIndex + 1) 
            : this.name;
        return new DisplayNameHelper(lastDisplayName, this.isFolder);
    }

    // 去除后缀
    removeSuffix() {
        if (this.isFolder) {
            return new DisplayNameHelper(this.name, this.isFolder);
        }
        const lastDotIndex = this.name.lastIndexOf('.');
        const nameWithoutSuffix = lastDotIndex !== -1 
            ? this.name.substring(0, lastDotIndex) 
            : this.name;
        return new DisplayNameHelper(nameWithoutSuffix, this.isFolder);
    }

    // 获取最终结果
    getValue() {
        return this.name;
    }
}

export default DisplayNameHelper;
