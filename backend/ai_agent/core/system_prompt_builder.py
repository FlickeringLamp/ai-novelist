"""
系统提示词构建器
负责构建包含文件树结构和持久记忆的完整系统提示词

架构说明：
- 系统提示词 (SystemMessage): 静态核心指令，变化极少
- 上下文消息 (HumanMessage): 动态环境信息，拼接到消息列表末尾
"""

import os
import re
from pathlib import Path
from typing import Optional, List, Tuple
import logging

from backend.config.config import settings
from backend.file.file_service import get_file_tree_for_ai, read_file, resolve_file_path, normalize_to_absolute
from backend.ai_agent.embedding import get_all_knowledge_bases, asearch_emb, get_two_step_rag_config
from backend.ai_agent.skill import get_skill_loader
from backend.ai_agent.utils.file_utils import split_paragraphs

logger = logging.getLogger(__name__)


class SystemPromptBuilder:
    """系统提示词构建器"""
    
    def __init__(self):
        self.data_dir = settings.DATA_DIR
        self.file_tree_cache = None
        self.last_cache_time = None
        self.cache_timeout = 30  # 缓存30秒
    
    def _extract_at_paths(self, user_input: str) -> List[str]:
        """从用户输入中提取 @+路径 模式的路径列表
        
        匹配规则：@后面跟随的路径不包含空格或换行
        例如："请查看 @folder/file.txt 和 @readme.md" -> ["folder/file.txt", "readme.md"]
        
        Args:
            user_input: 用户输入文本
            
        Returns:
            提取的文件路径列表（去重）
        """
        if not user_input:
            return []
        
        # 匹配 @ 后面跟随的非空白字符（路径）
        # 路径可以包含字母、数字、下划线、连字符、点、斜杠
        pattern = r'@([\w\-\./]+)'
        matches = re.findall(pattern, user_input)
        
        # 去重并保持顺序
        seen = set()
        unique_paths = []
        for path in matches:
            if path not in seen:
                seen.add(path)
                unique_paths.append(path)
        
        return unique_paths
    
    def _sync_at_paths_to_additional_info(self, at_paths: List[str], mode: str) -> None:
        """将 @路径 同步到当前模式的 additionalInfo 中
        
        如果路径已存在于 additionalInfo 中则跳过，否则添加进去。
        同时会验证文件是否存在，不存在的文件会被忽略。
        所有路径会转换为绝对路径存储。
        
        Args:
            at_paths: 从用户输入中提取的 @路径 列表（支持相对和绝对路径）
            mode: 当前模式名称
        """
        try:
            if not at_paths or not mode:
                return
            
            # 过滤出实际存在的文件路径，并转换为绝对路径
            existing_abs_paths = []
            missing_paths = []
            for path in at_paths:
                file_path = resolve_file_path(path)
                if file_path.exists() and file_path.is_file():
                    # 转换为绝对路径存储
                    abs_path = normalize_to_absolute(path)
                    existing_abs_paths.append(abs_path)
                else:
                    missing_paths.append(path)
            
            # 记录不存在的文件路径
            if missing_paths:
                logger.warning(f"以下 @路径 引用的文件不存在，已忽略: {missing_paths}")
            
            # 如果没有存在的文件，直接返回
            if not existing_abs_paths:
                logger.info(f"没有有效的 @路径 需要添加到 {mode} 模式")
                return
            
            # 获取当前模式的 additionalInfo
            additional_files = settings.get_config("mode", mode, "additionalInfo", default=[])
            
            if not isinstance(additional_files, list):
                additional_files = []
            
            # 过滤出不在 additionalInfo 中的新路径
            new_paths = [p for p in existing_abs_paths if p not in additional_files]
            
            if new_paths:
                # 将新路径添加到 additionalInfo
                updated_list = additional_files + new_paths
                settings.update_config(updated_list, "mode", mode, "additionalInfo")
                logger.info(f"已将 @路径 添加到 {mode} 模式的 additionalInfo: {new_paths}")
            else:
                logger.info(f"所有 @路径 已存在于 {mode} 模式的 additionalInfo 中")
                
        except Exception as e:
            logger.error(f"同步 @路径 到 additionalInfo 失败: {e}")
    
    async def _get_loaded_files_content(self, mode: str) -> str:
        """获取已加载文件的内容（用于末尾附加消息）
        
        Args:
            mode: 模式名称
            
        Returns:
            格式化的文件内容字符串（带段落编号）
        """
        try:
            # 从配置中获取当前模式的 additionalInfo 文件列表
            loaded_files = settings.get_config("mode", mode, "additionalInfo", default=[])
            
            # 如果没有加载的文件，返回空字符串
            if not loaded_files or not isinstance(loaded_files, list):
                return "[额外文件内容]:\n暂未加载文件"
            
            # 构建格式化的文件内容
            file_contents = []
            
            for file_path in loaded_files:
                if not isinstance(file_path, str):
                    continue
                
                try:
                    # 使用 file_service 的 read_file 读取文件内容
                    content = await read_file(file_path)
                    
                    if content:
                        # 为文件内容添加段落编号
                        paragraphs, paragraph_ending = split_paragraphs(content)
                        numbered_paragraphs = [f"{i+1} | {p}" for i, p in enumerate(paragraphs)]
                        numbered_content = paragraph_ending.join(numbered_paragraphs)
                        
                        file_contents.append(f"[额外文件 - {file_path}]:\n{numbered_content}")
                    else:
                        logger.warning(f"文件内容为空或文件不存在: {file_path}")
                except Exception as e:
                    logger.error(f"读取文件失败 {file_path}: {e}")
            
            if file_contents:
                return f"[额外文件内容]:\n\n{'\n\n'.join(file_contents)}"
            else:
                return "[额外文件内容]:\n暂未加载文件"
                
        except Exception as e:
            logger.error(f"获取 additionalInfo 文件内容失败: {e}")
            return "[额外文件内容]:\n暂未加载文件"
    
    def _get_skills_info(self, mode: str) -> str:
        """获取指定模式的 Skills 简要信息（仅名称和描述）
        
        Args:
            mode: 模式名称
            
        Returns:
            格式化的 Skills 简要信息字符串
        """
        try:
            # 从配置中获取当前模式的 skills 列表
            skill_names = settings.get_config("mode", mode, "skills", default=[])
            
            if not skill_names or not isinstance(skill_names, list):
                return ""
            
            # 使用 SkillLoader 加载并过滤 Skills
            skill_loader = get_skill_loader()
            skills = skill_loader.filter_skills(skill_names)
            
            if not skills:
                return ""
            
            # 格式化 Skills 简要信息（只显示名称和描述）
            return skill_loader.format_skills_for_prompt(skills)
            
        except Exception as e:
            logger.error(f"获取 Skills 信息失败: {e}")
            return ""
    
    async def _get_loaded_skills_content(self, mode: str) -> str:
        """获取已加载 Skill 的内容（用于末尾附加消息）
        
        Args:
            mode: 模式名称
            
        Returns:
            格式化的 Skill 内容字符串（格式：[Skill directory: path/] + content）
        """
        try:
            # 从配置中获取当前模式的 skillPaths 列表
            skill_paths = settings.get_config("mode", mode, "skillPaths", default=[])
            
            # 如果没有加载的 Skill，返回空字符串
            if not skill_paths or not isinstance(skill_paths, list):
                return ""
            
            # 加载所有可用的 skills
            skill_loader = get_skill_loader()
            all_skills = skill_loader.load_all_skills()
            
            # 构建 skill_path 到 skill 对象的映射（通过 file_path 匹配）
            skill_by_path = {}
            for skill in all_skills.values():
                skill_file_path = str(skill.file_path.resolve())
                skill_by_path[skill_file_path] = skill
            
            # 构建格式化的 Skill 内容
            skill_contents = []
            
            for skill_path in skill_paths:
                if not isinstance(skill_path, str):
                    continue
                
                try:
                    # 通过路径查找对应的 skill 对象
                    skill = skill_by_path.get(skill_path)
                    
                    if skill:
                        # 使用 skill 对象的 content（已过滤 frontmatter，不含 name 和 description）
                        skill_dir = str(skill.base_dir.resolve())
                        content = skill.content
                        
                        # 格式：[Skill directory: path/] + content
                        skill_contents.append(f"[Skill directory: {skill_dir}/]\n\n{content}")
                    else:
                        logger.warning(f"未找到 Skill 对象: {skill_path}")
                except Exception as e:
                    logger.error(f"读取 Skill 失败 {skill_path}: {e}")
            
            if skill_contents:
                return f"[额外 Skill 内容]:\n\n{'\n\n'.join(skill_contents)}"
            else:
                return ""
                
        except Exception as e:
            logger.error(f"获取已加载 Skill 内容失败: {e}")
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
            [当前工作区文件结构]:
            - 文件夹1/
              - 文件1.txt
              - 文件2.txt
            - 文件2.txt
            ```
        """
        try:
            # 获取data目录路径
            data_path = self.data_dir
            
            # 确保data目录存在
            os.makedirs(data_path, exist_ok=True)
            
            # 获取文件树
            file_tree_result = {"success": True, "tree": await get_file_tree_for_ai(data_path, data_path)}
            
            if not file_tree_result.get("success", False):
                logger.error(f"获取文件树失败: {file_tree_result.get('error', '未知错误')}")
                return "[当前工作区文件结构]:\n(获取文件树失败)"
            
            # 格式化文件树为文本
            tree_text = self._format_tree_to_text(file_tree_result.get("tree", []))
            
            # 如果文件树为空，显示"暂无文件"
            if not tree_text:
                tree_text = "暂无文件"
            
            return f"[当前工作区文件结构]:\n{tree_text}"
            
        except Exception as e:
            logger.error(f"获取文件树内容时出错: {e}")
            return "[当前工作区文件结构]:\n(获取文件树出错)"
    
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
        mode: Optional[str] = None
    ) -> str:
        """构建静态系统提示词（SystemMessage）
        
        这部分内容变化极少，是真正的"系统级"指令
        
        Args:
            mode: 对话模式 (outline/writing/adjustment)
            
        Returns:
            静态系统提示词
        """
        try:
            # 基础系统提示词
            prompt_configs = settings.get_config("mode", mode, "prompt", default="你是一个AI助手，负责为用户解决各种需求。")
            
            logger.info(f"系统提示词构建完成，模式: {mode}")
            return prompt_configs
            
        except Exception as e:
            logger.error(f"构建系统提示词时出错: {e}")
            return settings.get_config("mode", mode, "prompt", default="你是一个AI助手，负责为用户解决各种需求。")
    
    async def build_context_message(
        self,
        mode: Optional[str] = None,
        include_file_tree: bool = True,
        include_knowledge_bases: bool = True,
        include_loaded_files: bool = True,
        include_skills: bool = True,
        user_input: Optional[str] = None,
        enable_rag: bool = True,
        summary: Optional[str] = None
    ) -> str:
        """构建上下文消息内容（将作为末尾HumanMessage附加）
        
        这部分内容变化频繁，包含动态环境信息
        
        Args:
            mode: 对话模式
            include_file_tree: 是否包含文件树结构
            include_knowledge_bases: 是否包含知识库列表信息
            include_loaded_files: 是否包含已加载文件内容
            include_skills: 是否包含 Skills 信息
            user_input: 用户输入文本，用于RAG检索
            enable_rag: 是否启用RAG检索
            summary: 过往消息总结
            
        Returns:
            上下文消息内容字符串
        """
        try:
            context_parts = []
            
            # 添加过往消息总结
            if summary:
                context_parts.append(f"【过往消息总结】\n{summary}")
            
            # 添加 Skills 信息
            if include_skills:
                skills_info = self._get_skills_info(mode or "")
                if skills_info:
                    context_parts.append(skills_info)
            
            # 添加知识库列表信息
            if include_knowledge_bases:
                knowledge_bases_info = self._get_knowledge_bases_info()
                if knowledge_bases_info:
                    context_parts.append(f"【可用知识库】\n{knowledge_bases_info}")
            
            # 添加文件树结构
            if include_file_tree:
                file_tree_content = await self.get_file_tree_content()
                if file_tree_content:
                    context_parts.append(f"【当前工作区文件结构】\n{file_tree_content}")
            
            # 处理 @路径 同步（如果用户输入中包含 @路径）
            if user_input and mode:
                at_paths = self._extract_at_paths(user_input)
                if at_paths:
                    self._sync_at_paths_to_additional_info(at_paths, mode)
            
            # 添加已加载文件内容
            if include_loaded_files:
                loaded_files_content = await self._get_loaded_files_content(mode or "")
                if loaded_files_content:
                    context_parts.append(loaded_files_content)
            
            # 添加已加载 Skill 内容
            loaded_skills_content = await self._get_loaded_skills_content(mode or "")
            if loaded_skills_content:
                context_parts.append(loaded_skills_content)
            
            # 执行RAG检索并添加结果
            if enable_rag and user_input:
                rag_content = await self._perform_rag_search(user_input)
                if rag_content:
                    context_parts.append(f"【RAG检索结果】\n{rag_content}")
            
            # 合并所有部分
            if context_parts:
                context_message = "\n\n".join(context_parts)
                logger.info(f"上下文消息构建完成，包含部分: {len(context_parts)}")
                return context_message
            else:
                return ""
                
        except Exception as e:
            logger.error(f"构建上下文消息时出错: {e}")
            return ""
    
    async def build_prompts(
        self,
        mode: Optional[str] = None,
        user_input: Optional[str] = None,
        summary: Optional[str] = None
    ) -> Tuple[str, str]:
        """同时构建系统提示词和上下文消息（便捷方法）
        
        Args:
            mode: 对话模式
            user_input: 用户输入文本
            summary: 过往消息总结
            
        Returns:
            (system_prompt, context_message) 元组
        """
        system_prompt = await self.build_system_prompt(mode=mode)
        context_message = await self.build_context_message(
            mode=mode,
            user_input=user_input,
            summary=summary
        )
        return system_prompt, context_message


# 创建全局实例
system_prompt_builder = SystemPromptBuilder()
