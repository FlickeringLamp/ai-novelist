export namespace gitman {
	
	export class BranchInfo {
	    name: string;
	    is_remote: boolean;
	    is_current: boolean;
	    sha: string;
	
	    static createFrom(source: any = {}) {
	        return new BranchInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.is_remote = source["is_remote"];
	        this.is_current = source["is_current"];
	        this.sha = source["sha"];
	    }
	}
	export class CommitDetail {
	    sha: string;
	    message: string;
	    date: string;
	    author: string;
	    parents: string[];
	    is_head: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CommitDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sha = source["sha"];
	        this.message = source["message"];
	        this.date = source["date"];
	        this.author = source["author"];
	        this.parents = source["parents"];
	        this.is_head = source["is_head"];
	    }
	}

}

export namespace updater {
	
	export class CommitInfo {
	    sha: string;
	    message: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new CommitInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sha = source["sha"];
	        this.message = source["message"];
	        this.date = source["date"];
	    }
	}
	export class Config {
	    // Go type: struct { Name string "yaml:\"name\""; MainExecutable string "yaml:\"main_executable\"" }
	    App: any;
	    // Go type: struct { RemoteURL string "yaml:\"remote_url\""; ProjectDir string "yaml:\"project_dir\""; Branch string "yaml:\"branch\"" }
	    Git: any;
	    Mirror: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.App = this.convertValues(source["App"], Object);
	        this.Git = this.convertValues(source["Git"], Object);
	        this.Mirror = source["Mirror"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateStatus {
	    has_update: boolean;
	    remote_commit: CommitInfo;
	    local_commit?: CommitInfo;
	
	    static createFrom(source: any = {}) {
	        return new UpdateStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.has_update = source["has_update"];
	        this.remote_commit = this.convertValues(source["remote_commit"], CommitInfo);
	        this.local_commit = this.convertValues(source["local_commit"], CommitInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

