from backend.api.chat_api import router as chat_router
from backend.api.config_api import router as config_router
from backend.api.file_api import router as file_router
from backend.api.history_api import router as history_router
from backend.api.knowledge_api import router as knowledge_router
from backend.api.provider_api import router as provider_router

__all__ = [
    "chat_router",
    "config_router",
    "file_router",
    "history_router",
    "knowledge_router",
    "provider_router",
]
