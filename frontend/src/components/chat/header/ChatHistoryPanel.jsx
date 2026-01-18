import { useCallback, useState, useEffect } from 'react';
import httpClient from '../../../utils/httpClient.js';
import ConfirmationModal from '../../others/UnifiedModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faUndo } from '@fortawesome/free-solid-svg-icons';
import './ChatHistoryPanel.css';

const ChatHistoryPanel = ({ onLoadHistory }) => {
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [sessionIdToDelete, setSessionIdToDelete] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [rollbackSessionId, setRollbackSessionId] = useState(null);
    const [showRollbackModal, setShowRollbackModal] = useState(false);
    const [checkpoints, setCheckpoints] = useState([]);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
    const [rollbackMessage, setRollbackMessage] = useState('');
    const [checkpointsLoading, setCheckpointsLoading] = useState(false);

    // 加载会话历史
    const loadSessionHistory = useCallback(async () => {
        try {
            setLoading(true);
            console.log('正在加载会话历史...');
            const response = await httpClient.get('/api/history/sessions');
            
            if (!response.success || !response.sessions) {
                console.error('加载会话历史失败:', response.error);
                setHistory([]);
                return;
            }
            
            // 转换会话数据格式
            const sessions = response.sessions.map(session => ({
                session_id: session.session_id,
                title: session.preview || `会话: ${session.session_id}`,
                created_at: session.created_at || new Date().toISOString(),
                updated_at: session.last_accessed || new Date().toISOString(),
                message_count: session.message_count,
                preview: session.preview
            }));
            
            console.log('成功加载会话历史:', sessions);
            setHistory(sessions);
        } catch (error) {
            console.error('加载会话历史异常:', error);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // 组件挂载时加载会话历史
    useEffect(() => {
        loadSessionHistory();
    }, [loadSessionHistory]);
    
    // 当面板打开时重新加载会话历史
    useEffect(() => {
        if (isVisible) {
            loadSessionHistory();
        }
    }, [isVisible, loadSessionHistory]);

    const handleClosePanel = () => {
        setIsVisible(false);
    };

    const handleRestoreMessages = (messages) => {
        console.log('恢复消息:', messages);
        // 调用从ChatPanel传来的回调函数，将历史消息传递给ChatPanel
        if (onLoadHistory && typeof onLoadHistory === 'function') {
            onLoadHistory(messages);
        }
        setIsVisible(false);
    };

    const handleSelectConversation = useCallback(async (sessionId) => {
        try {
            // 获取会话消息
            const messagesResult = await httpClient.post('/api/history/messages', {
                thread_id: sessionId,
                mode: 'outline'
            });
            
            if (messagesResult.success) {
                const messages = messagesResult.data || [];
                // 更新store.json中的thread_id
                try {
                    await httpClient.post('/api/config/store', {
                        key: 'thread_id',
                        value: sessionId
                    });
                    console.log(`已更新thread_id为: ${sessionId}`);
                } catch (error) {
                    console.error('更新thread_id失败:', error);
                }
                
                // 将消息转换为前端期望的格式
                const formattedMessages = messages.map(msg => {
                    // 将后端消息类型转换为前端角色
                    let role;
                    if (msg.message_type === 'human') {
                        role = 'user';
                    } else if (msg.message_type === 'ai') {
                        role = 'assistant';
                    } else {
                        role = msg.message_type; // 'tool' 或其他类型
                    }
                    
                    return {
                        id: msg.message_id || `msg_${msg.index}`,
                        role: role,
                        content: msg.content,
                        tool_calls: msg.tool_calls
                    };
                });
                
                // 检查最后一条消息是否是包含工具调用的AI消息
                const lastMessage = messages[messages.length - 1];
                let finalMessages = messages;
                
                if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
                    // 如果最后一条消息是包含工具调用的AI消息，需要将其转换为工具请求状态
                    // 1. 将AI消息的内容和工具调用分开
                    const aiMessage = {
                        ...lastMessage,
                        tool_calls: [] // AI消息本身不包含工具调用
                    };
                    
                    // 2. 创建工具请求消息
                    const toolRequestMessage = {
                        id: `historic_tool_${Date.now()}`, // 创建一个唯一ID
                        role: 'tool_request',
                        content: '',
                        tool_calls: lastMessage.tool_calls
                    };
                    
                    // 3. 替换最后一条消息并添加工具请求消息
                    finalMessages = [...messages.slice(0, -1), aiMessage, toolRequestMessage];
                }
                
                if (handleRestoreMessages) handleRestoreMessages(formattedMessages);
                if (handleClosePanel) handleClosePanel();
                
                console.log(`已加载会话 ${sessionId}，包含 ${formattedMessages.length} 条消息`);
            } else {
                console.error('加载会话消息失败:', messagesResult.error);
            }
        } catch (error) {
            console.error('选择会话失败:', error);
        }
    }, [handleRestoreMessages, handleClosePanel]);

    // 确认删除会话
    const handleConfirmDelete = useCallback(async () => {
        if (!sessionIdToDelete) return;
        
        setShowConfirmationModal(false);
        try {
            const result = await httpClient.delete(`/api/history/sessions/${sessionIdToDelete}`);
            if (result.success) {
                // 重新加载历史记录
                await loadSessionHistory();
            } else {
                console.error('删除会话失败:', result.error);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
        } finally {
            setSessionIdToDelete(null);
        }
    }, [sessionIdToDelete, loadSessionHistory]);

    // 取消删除会话
    const handleCancelDelete = useCallback(() => {
        setShowConfirmationModal(false);
        setSessionIdToDelete(null);
    }, []);

    const handleDeleteConversation = useCallback(async (sessionId) => {
        setSessionIdToDelete(sessionId);
        setConfirmationMessage('确定要删除此对话吗？');
        setShowConfirmationModal(true);
    }, []);

    // 处理回档按钮点击
    const handleRollbackClick = useCallback(async (sessionId) => {
        try {
            setCheckpointsLoading(true);
            setRollbackSessionId(sessionId);
            setSelectedCheckpoint(null);
            setRollbackMessage('');
            
            // 获取该会话的存档点
            const result = await httpClient.post('/api/history/checkpoints', {
                thread_id: sessionId,
                mode: 'outline'
            });
            
            if (result.success && result.data) {
                setCheckpoints(result.data);
                setShowRollbackModal(true);
            } else {
                console.error('获取存档点失败:', result.error);
                alert('获取存档点失败: ' + result.error);
            }
        } catch (error) {
            console.error('获取存档点异常:', error);
            alert('获取存档点异常: ' + error.message);
        } finally {
            setCheckpointsLoading(false);
        }
    }, []);

    // 处理确认回档
    const handleConfirmRollback = useCallback(async () => {
        if (!selectedCheckpoint) {
            alert('请选择一个存档点');
            return;
        }

        if (!rollbackMessage.trim()) {
            alert('请输入回档后的新消息');
            return;
        }

        try {
            setCheckpointsLoading(true);
            
            const result = await httpClient.post('/api/history/checkpoint/rollback', {
                thread_id: rollbackSessionId,
                checkpoint_index: selectedCheckpoint.index,
                new_message: rollbackMessage.trim(),
                mode: 'outline'
            });
            
            if (result.success) {
                console.log('回档成功:', result);
                alert('回档成功！');
                setShowRollbackModal(false);
                
                // 如果回档的是当前会话，刷新消息
                const threadResponse = await httpClient.get(`/api/config/store?key=${encodeURIComponent('thread_id')}`);
                const currentThreadId = threadResponse;
                if (currentThreadId === rollbackSessionId) {
                    // 重新加载当前会话的消息
                    const messagesResult = await httpClient.post('/api/history/messages', {
                        thread_id: currentThreadId,
                        mode: 'outline'
                    });
                    
                    if (messagesResult.success && messagesResult.data) {
                        const messages = messagesResult.data;
                        // 将消息转换为前端期望的格式
                        const formattedMessages = messages.map(msg => {
                            let role;
                            if (msg.message_type === 'human') {
                                role = 'user';
                            } else if (msg.message_type === 'ai') {
                                role = 'assistant';
                            } else {
                                role = msg.message_type;
                            }
                            
                            return {
                                id: msg.message_id || `msg_${msg.index}`,
                                role: role,
                                content: msg.content,
                                tool_calls: msg.tool_calls
                            };
                        });
                        
                        // 检查最后一条消息是否是包含工具调用的AI消息
                        const lastMessage = messages[messages.length - 1];
                        let finalMessages = messages;
                        
                        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
                            // 如果最后一条消息是包含工具调用的AI消息，需要将其转换为工具请求状态
                            // 1. 将AI消息的内容和工具调用分开
                            const aiMessage = {
                                ...lastMessage,
                                tool_calls: [] // AI消息本身不包含工具调用
                            };
                            
                            // 2. 创建工具请求消息
                            const toolRequestMessage = {
                                id: `rollback_tool_${Date.now()}`, // 创建一个唯一ID
                                role: 'tool_request',
                                content: '',
                                tool_calls: lastMessage.tool_calls
                            };
                            
                            // 3. 替换最后一条消息并添加工具请求消息
                            finalMessages = [...messages.slice(0, -1), aiMessage, toolRequestMessage];
                        }
                        
                        if (handleRestoreMessages) handleRestoreMessages(finalMessages);
                        console.log(`已重新加载 ${finalMessages.length} 条消息`);
                    }
                }
            } else {
                console.error('回档失败:', result.error);
                alert('回档失败: ' + result.error);
            }
        } catch (error) {
            console.error('回档异常:', error);
            alert('回档异常: ' + error.message);
        } finally {
            setCheckpointsLoading(false);
        }
    }, [rollbackSessionId, selectedCheckpoint, rollbackMessage, handleRestoreMessages]);

    // 关闭回档模态框
    const handleCloseRollbackModal = useCallback(() => {
        setShowRollbackModal(false);
        setRollbackSessionId(null);
        setCheckpoints([]);
        setSelectedCheckpoint(null);
        setRollbackMessage('');
    }, []);

    return (
        <div className="chat-history-container">
            <button
                className="history-button"
                onClick={() => setIsVisible(!isVisible)}
                title="历史会话"
            >
                <FontAwesomeIcon icon={faClock} />
            </button>
            
            {isVisible && (
                <div className="chat-history-panel">
            <h3>对话历史</h3>
            <button className="close-history-panel-button" onClick={handleClosePanel}>
                &times;
            </button>
            {loading ? (
                <p className="no-history-message">正在加载历史对话...</p>
            ) : !history || !Array.isArray(history) || history.length === 0 ? (
                <p className="no-history-message">暂无历史对话。</p>
            ) : (
                <ul className="history-list">
                    {history.map((session, index) => {
                        console.log(`Processing session[${index}]:`, session);
                        // 后端会话格式：session_id, created_at, last_accessed, message_count, preview
                        const sessionId = session.session_id || session.sessionId;
                        const messageCount = session.message_count || 0;
                        const createdAt = session.created_at || '';
                        const preview = session.preview || '';
                        
                        // 格式化创建时间
                        const formattedDate = createdAt ? new Date(createdAt).toLocaleString('zh-CN') : '未知时间';
                        
                        return (
                            <li key={sessionId} className="history-item">
                                <div
                                    className="history-text"
                                    onClick={() => handleSelectConversation(sessionId)}
                                >
                                    <div className="session-preview">{preview || `会话: ${sessionId}`}</div>
                                    <div className="session-info">
                                        <span className="message-count">{messageCount} 条消息</span>
                                        <span className="created-time">{formattedDate}</span>
                                    </div>
                                </div>
                                <div className="history-item-buttons">
                                    <button
                                        className="rollback-button"
                                        onClick={() => handleRollbackClick(sessionId)}
                                        title="回档此会话"
                                    >
                                        <FontAwesomeIcon icon={faUndo} />
                                    </button>
                                    <button
                                        className="delete-button"
                                        onClick={() => handleDeleteConversation(sessionId)}
                                        title="删除此会话"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {showConfirmationModal && (
                <ConfirmationModal
                    message={confirmationMessage}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            )}
                </div>
            )}
            
            {/* 回档模态框 */}
            {showRollbackModal && (
                <div className="rollback-modal-overlay">
                    <div className="rollback-modal">
                        <div className="rollback-modal-header">
                            <h3>消息回档</h3>
                            <button className="close-modal-button" onClick={handleCloseRollbackModal}>
                                &times;
                            </button>
                        </div>
                        
                        <div className="rollback-modal-content">
                            {checkpointsLoading ? (
                                <div className="loading-message">正在加载存档点...</div>
                            ) : checkpoints.length === 0 ? (
                                <div className="no-checkpoints-message">该会话暂无存档点</div>
                            ) : (
                                <>
                                    <div className="checkpoints-section">
                                        <h4>选择存档点</h4>
                                        <div className="checkpoints-list">
                                            {checkpoints.map((checkpoint) => (
                                                <div
                                                    key={checkpoint.checkpoint_id}
                                                    className={`checkpoint-option ${selectedCheckpoint?.index === checkpoint.index ? 'selected' : ''}`}
                                                    onClick={() => setSelectedCheckpoint(checkpoint)}
                                                >
                                                    <div className="checkpoint-info">
                                                        <span className="checkpoint-index">#{checkpoint.index}</span>
                                                        <span className="checkpoint-node">{Array.isArray(checkpoint.next_node) ? checkpoint.next_node.join(', ') : checkpoint.next_node}</span>
                                                        <span className="checkpoint-type">{checkpoint.last_message_type}</span>
                                                    </div>
                                                    <div className="checkpoint-content">
                                                        {checkpoint.last_message_content?.substring(0, 50) || '无内容'}
                                                        {checkpoint.last_message_content?.length > 50 && '...'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="rollback-input-section">
                                        <h4>回档后的新消息</h4>
                                        <textarea
                                            value={rollbackMessage}
                                            onChange={(e) => setRollbackMessage(e.target.value)}
                                            placeholder="请输入回档后的新消息内容..."
                                            rows={3}
                                        />
                                    </div>
                                    
                                    <div className="rollback-actions">
                                        <button
                                            className="confirm-rollback-button"
                                            onClick={handleConfirmRollback}
                                            disabled={checkpointsLoading || !selectedCheckpoint || !rollbackMessage.trim()}
                                        >
                                            {checkpointsLoading ? '回档中...' : '确认回档'}
                                        </button>
                                        <button
                                            className="cancel-rollback-button"
                                            onClick={handleCloseRollbackModal}
                                        >
                                            取消
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatHistoryPanel;
