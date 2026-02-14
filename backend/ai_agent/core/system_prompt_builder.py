"""
系统提示词构建器
负责构建包含文件树结构和持久记忆的完整系统提示词
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
import logging

from backend.config.config import settings
from backend.file.file_service import get_file_tree
from backend.ai_agent.embedding import get_all_knowledge_bases, asearch_emb, get_two_step_rag_config

logger = logging.getLogger(__name__)


class SystemPromptBuilder:
    """系统提示词构建器"""
    
    def __init__(self):
        self.novel_dir = settings.NOVEL_DIR
        self.file_tree_cache = None
        self.last_cache_time = None
        self.cache_timeout = 30  # 缓存30秒
        
    def get_novel_path(self) -> str:
        """获取novel目录路径
        
        在开发环境中，novel目录位于项目根目录下的data/novel
        在生产环境中，novel目录位于.exe文件同级目录
        """
        return self.novel_dir
    
    def _load_store_config(self) -> Dict[str, Any]:
        """加载存储配置"""
        try:
            config_path = Path(__file__).parent.parent.parent / "data" / "config" / "store.json"
            if not config_path.exists():
                logger.warning("配置文件不存在，返回空配置")
                return {}
            
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"加载存储配置失败: {e}")
            return {}
    
    def _get_persistent_memory_for_mode(self, mode: str) -> str:
        """获取指定模式的持久记忆信息
        
        Args:
            mode: 模式名称
            
        Returns:
            格式化的持久记忆信息字符串
        """
        try:
            config = self._load_store_config()
            additional_info = config.get("additionalInfo", {})
            
            # 获取当前模式的持久记忆信息
            mode_info = additional_info.get(mode, {})
            if not mode_info:
                return ""
            
            # 构建格式化的持久记忆信息
            memory_parts = []
            
            # 新格式：content 对象包含 path 和 content
            content_info = mode_info.get("content", {})
            if content_info:
                content = content_info.get("content", "").strip()
                path = content_info.get("path", "").strip()
                
                if content:
                    # 如果有路径信息，添加路径标识
                    if path:
                        memory_parts.append(f"[额外信息 - 来源: {path}]:\n{content}")
                    else:
                        memory_parts.append(f"[额外信息]:\n{content}")
            
            if memory_parts:
                return "\n\n".join(memory_parts)
            else:
                return ""
                
        except Exception as e:
            logger.error(f"获取持久记忆信息失败: {e}")
            return ""
    
    def _get_knowledge_bases_info(self) -> str:
        """获取知识库列表信息
        
        Returns:
            格式化的知识库列表信息字符串
        """
        try:
            knowledge_bases = get_all_knowledge_bases()
            
            if not knowledge_bases:
                return ""
            
            # 构建格式化的知识库列表
            kb_parts = []
            for kb_id, kb_config in knowledge_bases.items():
                name = kb_config.get("name", "")
                
                if name:
                    kb_parts.append(f"id: {kb_id}\nname: {name}")
            
            if kb_parts:
                return "\n\n".join(kb_parts)
            else:
                return ""
                
        except Exception as e:
            logger.error(f"获取知识库列表信息失败: {e}")
            return ""
    
    async def _perform_rag_search(self, user_input: str) -> str:
        """执行RAG检索，获取相关文档内容
        
        Args:
            user_input: 用户输入文本，作为检索查询
            
        Returns:
            格式化的RAG检索结果字符串
        """
        try:
            # 获取两步RAG配置
            rag_config = get_two_step_rag_config()
            kb_id = rag_config.get("id")
            kb_name = rag_config.get("name")
            
            if not kb_id:
                logger.info("未配置两步RAG知识库，跳过RAG检索")
                return ""
            
            # 验证知识库是否存在
            knowledge_bases = get_all_knowledge_bases()
            if kb_id not in knowledge_bases:
                logger.warning(f"配置的知识库 {kb_name} (ID: {kb_id}) 不存在，跳过RAG检索")
                return ""
            logger.info(f"使用配置的知识库进行RAG检索: {kb_name} (ID: {kb_id})")

            # 执行异步检索
            results = await asearch_emb(
                collection_name=kb_id,
                search_input=user_input
            )
            
            if not results:
                logger.info("RAG检索未返回结果")
                return ""
            
            # 格式化检索结果
            rag_parts = []
            for doc, score in results:
                filename = doc.metadata.get('original_filename', '未知文件')
                rag_parts.append(f"[来源: {filename}, 相似度: {score:.4f}]\n{doc.page_content}")
            
            rag_content = "\n\n".join(rag_parts)
            logger.info(f"RAG检索完成，共找到 {len(results)} 条相关文档")
            
            return rag_content
            
        except Exception as e:
            logger.error(f"RAG检索失败: {e}")
            return ""
    
    async def get_file_tree_content(self) -> str:
        """获取格式化的文件树内容
        
        Returns:
            格式化的文件树文本，如：
            ```
            [当前工作区文件结构 (novel 目录)]:
            - 文件夹1/
              - 文件1.txt
              - 文件2.txt
            - 文件2.txt
            ```
        """
        try:
            # 获取novel目录路径
            novel_path = self.get_novel_path()
            
            # 确保novel目录存在
            os.makedirs(novel_path, exist_ok=True)
            
            # 获取文件树
            file_tree_result = {"success": True, "tree": await get_file_tree(novel_path, novel_path)}
            
            if not file_tree_result.get("success", False):
                logger.error(f"获取文件树失败: {file_tree_result.get('error', '未知错误')}")
                return "[当前工作区文件结构 (novel 目录)]:\n(获取文件树失败)"
            
            # 格式化文件树为文本
            tree_text = self._format_tree_to_text(file_tree_result.get("tree", []))
            
            return f"[当前工作区文件结构 (novel 目录)]:\n{tree_text}"
            
        except Exception as e:
            logger.error(f"获取文件树内容时出错: {e}")
            return "[当前工作区文件结构 (novel 目录)]:\n(获取文件树出错)"
    
    def _format_tree_to_text(self, nodes: list, indent: int = 0) -> str:
        """将文件树节点格式化为文本
        
        Args:
            nodes: 文件树节点列表
            indent: 缩进级别
            
        Returns:
            格式化的文本
        """
        lines = []
        indent_str = "  " * indent
        
        for node in nodes:
            if node.get("isFolder", False):
                # 文件夹
                lines.append(f"{indent_str}- {node['title']}/")
                # 递归处理子节点
                children = node.get("children", [])
                if children:
                    children_text = self._format_tree_to_text(children, indent + 1)
                    lines.append(children_text)
            else:
                # 文件
                lines.append(f"{indent_str}- {node['title']}")
        
        return "\n".join(lines)
    
    async def build_system_prompt(
        self,
        mode: Optional[str] = None,
        include_file_tree: bool = True,
        include_persistent_memory: bool = True,
        include_knowledge_bases: bool = True,
        user_input: Optional[str] = None,
        enable_rag: bool = True
    ) -> str:
        """构建完整的系统提示词
        
        Args:
            mode: 对话模式 (outline/writing/adjustment)
            include_file_tree: 是否包含文件树结构
            include_persistent_memory: 是否包含持久记忆信息
            include_knowledge_bases: 是否包含知识库列表信息
            user_input: 用户输入文本，用于RAG检索
            enable_rag: 是否启用RAG检索
            
        Returns:
            完整的系统提示词
        """
        try:
            prompt_configs = settings.get_config("mode", mode, "prompt", default="你是一个AI助手，负责为用户解决各种需求。")
            # 构建完整提示词
            prompt_parts = [prompt_configs]

            # 添加知识库列表信息
            if include_knowledge_bases:
                knowledge_bases_info = self._get_knowledge_bases_info()
                if knowledge_bases_info:
                    prompt_parts.append(f"[可用知识库]:\n{knowledge_bases_info}")

            # 添加文件树结构
            if include_file_tree:
                file_tree_content = await self.get_file_tree_content()
                prompt_parts.append(file_tree_content)
            
            # 添加持久记忆信息
            if include_persistent_memory:
                persistent_memory = self._get_persistent_memory_for_mode(mode or "")
                if persistent_memory:
                    prompt_parts.append(f"[持久记忆信息]:\n{persistent_memory}")
            
            # 执行RAG检索并添加结果
            if enable_rag and user_input:
                rag_content = await self._perform_rag_search(user_input)
                if rag_content:
                    prompt_parts.append(f"[RAG检索结果]:\n{rag_content}")
            
            # 合并所有部分
            full_prompt = "\n\n".join(prompt_parts)
            
            logger.info(f"系统提示词构建完成，模式: {mode}，包含文件树: {include_file_tree}，包含持久记忆: {include_persistent_memory}，包含知识库: {include_knowledge_bases}，启用RAG: {enable_rag}")
            logger.info(f"构建的完整系统提示词:\n{full_prompt}")
            return full_prompt
            
        except Exception as e:
            logger.error(f"构建系统提示词时出错: {e}")
            prompt_configs = settings.get_config("mode", mode, "prompt", default="你是一个AI助手，负责为用户解决各种需求。")
            return prompt_configs
    
    async def refresh_file_tree_cache(self):
        """刷新文件树缓存"""
        try:
            # 获取novel目录路径
            novel_path = self.get_novel_path()
            
            # 重新获取文件树
            file_tree_result = {"success": True, "tree": await get_file_tree(novel_path, novel_path)}
            
            if file_tree_result.get("success", False):
                self.file_tree_cache = file_tree_result.get("tree", [])
                self.last_cache_time = os.path.getmtime(novel_path) if os.path.exists(novel_path) else None
                logger.info("文件树缓存已刷新")
            else:
                logger.error(f"刷新文件树缓存失败: {file_tree_result.get('error', '未知错误')}")
                
        except Exception as e:
            logger.error(f"刷新文件树缓存时出错: {e}")


# 创建全局实例
system_prompt_builder = SystemPromptBuilder()
